"""
Servicio para validar el CONTENIDO de documentos contra los requisitos
de la hoja "Matriz observaciones" del Excel de la carpeta de curso.

Flujo:
  1. Deriva la sección desde el nombre de la carpeta Semana_X
  2. Lee la 2da hoja del Excel con openpyxl
  3. Filtra los requisitos de esa sección donde Aplica == "Si"
  4. Descarga todos los documentos (PDF/DOCX/PPTX) de la carpeta
  5. Extrae texto de cada documento
  6. Usa Gemini AI para verificar si cada sub-sección está implícitamente cubierta
  7. Escribe resultados ("Presente", "Observaciones") de vuelta al Excel en Drive
"""
import io
import re
import json
import unicodedata
import time
from typing import Dict, List, Optional, Any, Tuple

import openpyxl
from PyPDF2 import PdfReader
from docx import Document as DocxDocument
from pptx import Presentation

try:
    import google.generativeai as genai
    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False

from app.config import settings
from app.services.drive_service import drive_service


# ─── Constantes ──────────────────────────────────────────────────────────────

MATRIX_FILE_PREFIX = "Matriz observaciones"
GEMINI_MODEL       = "gemini-2.0-flash"
MAX_CHUNK_CHARS    = 25_000
CHUNK_OVERLAP      = 500
EXCEL_MIME_TYPE    = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

SUPPORTED_MIMES = {
    # Formatos binarios directos
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    # Google Workspace nativos — drive_service los exporta automáticamente
    "application/vnd.google-apps.presentation",   # → PPTX
    "application/vnd.google-apps.document",        # → DOCX
    "application/vnd.google-apps.spreadsheet",     # → XLSX (no se usa para extracción)
}

# Vocabulario de tipos de documento que actúan como ENCABEZADOS de grupo en el Excel.
# Solo nombres que representan el TIPO de archivo a buscar en Drive, no parámetros
# de contenido. Cuestionario/Actividad/Tarea/etc. son parámetros DENTRO de un tipo.
#
# Regla de inclusión: ¿corresponde a un archivo separado en Drive?
#   ✓ Presentación → Presentacion_S2.pptx
#   ✓ Lectura      → Lectura_S2.pdf
#   ✓ Video        → Video_S2.mp4 (o cuestionario PDF asociado al video)
#   ✗ Cuestionario → es un parámetro/requisito DENTRO del Video, no un archivo propio
#   ✗ Actividad    → ídem
DOCUMENT_TYPE_HEADERS: set = {
    'presentacion', 'presentación',
    'diapositivas', 'slides',
    'lectura', 'reading', 'documento',
    'video',
    'guia', 'guía',
    'informe',
    'reporte',
}


class DocumentContentValidationService:
    """
    Valida el contenido de documentos en carpetas Semana_X contra los
    requisitos de la hoja 'Matriz observaciones' del Excel del curso.
    """

    def __init__(self):
        self.model = None
        self.enabled = False
        self._init_gemini()

    def _init_gemini(self):
        if not GENAI_AVAILABLE:
            print("⚠️  google-generativeai no disponible")
            return
        api_key = getattr(settings, 'GEMINI_API_KEY', None)
        if api_key and api_key not in ('', 'kjkj'):
            genai.configure(api_key=api_key)
            self.model = genai.GenerativeModel(GEMINI_MODEL)
            self.enabled = True
            print(f"✅ Gemini ({GEMINI_MODEL}) listo para validación de contenido")
        else:
            print("⚠️  GEMINI_API_KEY no configurada — modo fallback (keyword matching)")

    # ──────────────────────────────────────────────────────────────────────────
    # Normalización (igual que structure_validation_service)
    # ──────────────────────────────────────────────────────────────────────────

    def _normalize(self, name: str) -> str:
        name = re.sub(r'^\d+[\s_\-\.]+', '', str(name).strip())
        name = name.replace('_', ' ').replace('-', ' ')
        name = re.sub(r'\s+', ' ', name).strip()
        name = name.lower()
        nfkd = unicodedata.normalize('NFKD', name)
        return ''.join(c for c in nfkd if not unicodedata.combining(c))

    def _derive_section_from_folder(self, folder_name: str) -> str:
        """
        Convierte un nombre de carpeta Drive en el nombre canónico de sección.
        "Semana_2" → "Semana 2", "semana_12" → "Semana 12"
        Para otros tipos devuelve el nombre limpio (underscores → espacios).
        """
        normalized = self._normalize(folder_name)
        # Sin $ final: acepta "Semana_6 - Algoritmos" → "semana 6 algoritmos" → "Semana 6"
        m = re.match(r'^semana\s*(\d+)', normalized)
        if m:
            return f"Semana {m.group(1)}"
        return folder_name.replace('_', ' ').replace('-', ' ').strip()

    # ──────────────────────────────────────────────────────────────────────────
    # Excel: localizar, leer y parsear
    # ──────────────────────────────────────────────────────────────────────────

    def find_matrix_file(self, folder_id: str) -> Optional[Tuple[str, str]]:
        """
        Busca el Excel 'Matriz observaciones*.xlsx' en la carpeta indicada.
        Retorna (file_id, file_name) o None.
        """
        try:
            files = drive_service.list_files(folder_id)
            for f in files:
                if f.get('name', '').startswith(MATRIX_FILE_PREFIX):
                    return (f['id'], f['name'])
            return None
        except Exception as e:
            print(f"Error buscando matriz: {e}")
            return None

    def read_workbook(self, file_id: str) -> Optional[openpyxl.Workbook]:
        """Descarga el Excel desde Drive y lo carga con openpyxl."""
        content = drive_service.download_file(file_id)
        if not content:
            print("No se pudo descargar el Excel")
            return None
        try:
            return openpyxl.load_workbook(io.BytesIO(content))
        except Exception as e:
            print(f"Error cargando workbook: {e}")
            return None

    def get_content_sheet(self, wb: openpyxl.Workbook) -> Optional[Any]:
        """
        Obtiene la hoja 'Matriz observaciones' (2da hoja por índice).
        Fallback: busca por nombre que contenga 'observaciones'.
        """
        if len(wb.sheetnames) >= 2:
            return wb.worksheets[1]
        for name in wb.sheetnames:
            if 'observacion' in self._normalize(name):
                return wb[name]
        print(f"⚠️  No se encontró la hoja 'Matriz observaciones'. Hojas disponibles: {wb.sheetnames}")
        return None

    def _find_header_row(self, ws) -> Tuple[int, Dict[str, int]]:
        """
        Escanea las primeras 5 filas para encontrar la fila de encabezados.
        Retorna (header_row_idx, col_map) con índices 1-based.
        col_map keys: 'seccion', 'sub_seccion', 'aplica', 'autor', 'presente', 'observaciones'
        """
        target_keywords = {
            'seccion', 'sub seccion', 'aplica', 'autor', 'presente', 'observaciones'
        }

        for row_idx in range(1, 6):
            row_vals = []
            for col_idx in range(1, ws.max_column + 1):
                val = ws.cell(row=row_idx, column=col_idx).value
                row_vals.append(self._normalize(str(val or '')))

            matches = sum(1 for v in row_vals if any(kw in v for kw in target_keywords))
            if matches >= 3:
                col_map: Dict[str, int] = {}
                for col_idx, norm_val in enumerate(row_vals, 1):
                    if not norm_val:
                        continue
                    if 'sub' in norm_val and 'seccion' in norm_val:
                        col_map['sub_seccion'] = col_idx
                    elif 'seccion' in norm_val:
                        col_map['seccion'] = col_idx
                    elif norm_val.startswith('aplica'):
                        col_map['aplica'] = col_idx
                    elif norm_val == 'autor':
                        col_map['autor'] = col_idx
                    elif 'presente' in norm_val:
                        col_map['presente'] = col_idx
                    elif 'observaci' in norm_val:
                        col_map['observaciones'] = col_idx
                print(f"📋 Encabezados encontrados en fila {row_idx}: {col_map}")
                return (row_idx, col_map)

        raise ValueError("No se encontró fila de encabezados en las primeras 5 filas del Excel")

    def parse_requirements(
        self,
        ws,
        target_section: str
    ) -> Tuple[List[Dict], Dict[str, int], int]:
        """
        Lee la hoja y filtra los requisitos para la sección indicada donde Aplica == 'Si'.
        Retorna (requirements_list, col_map, header_row_idx).

        Cada elemento de requirements_list:
            {'row_idx': int, 'sub_seccion': str, 'autor': str}
        """
        header_row_idx, col_map = self._find_header_row(ws)
        norm_target = self._normalize(target_section)
        requirements = []
        last_sec_val = None   # soporte para celdas combinadas (merged cells)

        for row_idx in range(header_row_idx + 1, ws.max_row + 1):
            # Leer sección
            sec_col = col_map.get('seccion')
            if not sec_col:
                continue
            sec_val = ws.cell(row=row_idx, column=sec_col).value
            if sec_val:
                last_sec_val = sec_val
            elif last_sec_val:
                sec_val = last_sec_val
            if not sec_val:
                continue
            if self._normalize(str(sec_val)) != norm_target:
                continue

            # Verificar Aplica == Si
            aplica_col = col_map.get('aplica')
            if aplica_col:
                aplica_val = ws.cell(row=row_idx, column=aplica_col).value
                if self._normalize(str(aplica_val or '')) != 'si':
                    continue

            # Leer sub-sección
            sub_col = col_map.get('sub_seccion')
            sub_val = ws.cell(row=row_idx, column=sub_col).value if sub_col else None
            if not sub_val or str(sub_val).strip() == '':
                continue

            # Leer autor (opcional)
            autor_col = col_map.get('autor')
            autor_val = ws.cell(row=row_idx, column=autor_col).value if autor_col else None

            requirements.append({
                'row_idx':    row_idx,
                'sub_seccion': str(sub_val).strip(),
                'autor':      str(autor_val).strip() if autor_val else '',
            })

        print(f"📋 Requisitos para '{target_section}': {len(requirements)}")

        # DEBUG: mostrar primeras 10 filas de datos para diagnóstico
        if len(requirements) == 0:
            sec_col = col_map.get('seccion')
            aplica_col = col_map.get('aplica')
            print(f"🔍 DEBUG: buscando sección normalizada = '{norm_target}'")
            seen_sections = set()
            for r in range(header_row_idx + 1, min(header_row_idx + 30, ws.max_row + 1)):
                sec_raw = ws.cell(row=r, column=sec_col).value if sec_col else None
                aplica_raw = ws.cell(row=r, column=aplica_col).value if aplica_col else None
                sec_norm = self._normalize(str(sec_raw or ''))
                if sec_norm and sec_norm not in seen_sections:
                    seen_sections.add(sec_norm)
                    print(f"   Fila {r}: sección='{sec_raw}' (norm='{sec_norm}') | aplica='{aplica_raw}'")
            if not seen_sections:
                print("   ⚠️  No se encontraron valores en la columna Sección")

        return requirements, col_map, header_row_idx

    # ──────────────────────────────────────────────────────────────────────────
    # Extracción de texto
    # ──────────────────────────────────────────────────────────────────────────

    def _extract_pdf_text(self, file_bytes: bytes) -> str:
        try:
            reader = PdfReader(io.BytesIO(file_bytes))
            pages = []
            for i, page in enumerate(reader.pages, 1):
                text = page.extract_text() or ''
                if text.strip():
                    pages.append(f"=== Página {i} ===\n{text}")
            return "\n".join(pages)
        except Exception as e:
            print(f"Error extrayendo PDF: {e}")
            return ''

    def _extract_docx_text(self, file_bytes: bytes) -> str:
        try:
            doc = DocxDocument(io.BytesIO(file_bytes))
            paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
            return "\n".join(paragraphs)
        except Exception as e:
            print(f"Error extrayendo DOCX: {e}")
            return ''

    def _extract_pptx_text(self, file_bytes: bytes) -> str:
        try:
            prs = Presentation(io.BytesIO(file_bytes))
            slides_text = []
            for i, slide in enumerate(prs.slides, 1):
                parts = [f"=== Diapositiva {i} ==="]
                for shape in slide.shapes:
                    if hasattr(shape, "text") and shape.text.strip():
                        parts.append(shape.text.strip())
                slides_text.append("\n".join(parts))
            return "\n\n".join(slides_text)
        except Exception as e:
            print(f"Error extrayendo PPTX: {e}")
            return ''

    def extract_text_from_bytes(self, file_bytes: bytes, mime_type: str) -> str:
        """Extrae texto según el tipo MIME del archivo."""
        if mime_type == 'application/pdf':
            return self._extract_pdf_text(file_bytes)
        elif 'wordprocessingml' in mime_type:
            return self._extract_docx_text(file_bytes)
        elif 'presentationml' in mime_type:
            return self._extract_pptx_text(file_bytes)
        return ''

    def parse_requirements_by_group(
        self,
        ws,
        target_section: str,
        col_map: Dict[str, int],
        header_row_idx: int
    ) -> List[Dict]:
        """
        Lee la hoja y agrupa los requisitos por tipo de documento (Presentación, Lectura, Video…).

        Estructura del Excel:
          Sección  | Sub-sección          | Aplica
          Semana 2 | Presentación         |        ← encabezado de grupo (sin Aplica)
          Semana 2 | Bienvenida           | Si     ← parámetro
          Semana 2 | Agenda               | Si     ← parámetro
          ...
          Semana 2 | Lectura              |        ← encabezado de grupo
          Semana 2 | Titulo               | Si     ← parámetro

        Retorna lista de grupos:
          [
            {
              'group_name': 'Presentación',
              'params': [
                {'row_idx': int, 'sub_seccion': str, 'autor': str},
                ...
              ]
            },
            ...
          ]
        """
        norm_target = self._normalize(target_section)
        sec_col   = col_map.get('seccion')
        sub_col   = col_map.get('sub_seccion')
        aplica_col = col_map.get('aplica')
        autor_col  = col_map.get('autor')

        if not sec_col or not sub_col:
            return []

        groups: List[Dict] = []
        current_group: Optional[Dict] = None
        last_sec_val = None   # soporte para celdas combinadas (merged cells)

        for row_idx in range(header_row_idx + 1, ws.max_row + 1):
            sec_val = ws.cell(row=row_idx, column=sec_col).value
            # Celdas combinadas: la primera celda del rango tiene valor;
            # las siguientes son None → usar el último valor conocido.
            if sec_val:
                last_sec_val = sec_val
            elif last_sec_val:
                sec_val = last_sec_val
            if not sec_val:
                continue
            if self._normalize(str(sec_val)) != norm_target:
                continue

            sub_val = ws.cell(row=row_idx, column=sub_col).value
            if not sub_val or str(sub_val).strip() == '':
                continue
            sub_str = str(sub_val).strip()

            aplica_val = ws.cell(row=row_idx, column=aplica_col).value if aplica_col else None
            aplica_norm = self._normalize(str(aplica_val or ''))

            # Excluir filas explícitamente marcadas como No aplica
            if aplica_norm == 'no':
                continue

            sub_norm = self._normalize(sub_str)

            # ── Detección de encabezado de grupo ────────────────────────────
            # El vocabulario es el criterio PRIMARIO (robusto ante cualquier
            # variante de Aplica: 'Si', None, vacío, etc.).
            #
            # Dos patrones de Excel observados:
            #   A) aplica='Si' en todas las filas (incluidos tipos de doc)
            #   B) aplica=None en todas las filas
            # En ambos casos el nombre de sub-sección identifica el tipo.
            #
            # Fallback: si el sub_seccion NO está en el vocabulario y aplica
            # tampoco es 'si' (ej. aplica=None), lo tratamos como parámetro
            # asumiendo que el Excel omite la columna Aplica.
            if sub_norm in DOCUMENT_TYPE_HEADERS:
                # Tipo de documento conocido → nuevo grupo
                current_group = {'group_name': sub_str, 'params': []}
                groups.append(current_group)
            else:
                # Parámetro a evaluar
                autor_val = ws.cell(row=row_idx, column=autor_col).value if autor_col else None
                param = {
                    'row_idx':    row_idx,
                    'sub_seccion': sub_str,
                    'autor':      str(autor_val).strip() if autor_val else '',
                }
                if current_group is not None:
                    current_group['params'].append(param)
                else:
                    # No hay encabezado previo → grupo implícito "General"
                    current_group = {'group_name': 'General', 'params': [param]}
                    groups.append(current_group)

        # Descartar grupos vacíos
        groups = [g for g in groups if g['params']]

        total_params = sum(len(g['params']) for g in groups)
        print(f"📋 Grupos para '{target_section}': {len(groups)} grupos, {total_params} parámetros")
        for g in groups:
            print(f"   📑 '{g['group_name']}': {len(g['params'])} parámetros")
            for p in g['params']:
                print(f"      · {p['sub_seccion']}")

        return groups

    # Pistas de tipo: qué MIME buscar para cada nombre de grupo
    _GROUP_TYPE_HINTS: Dict[str, List[str]] = {
        'presentacion':  ['presentationml'],
        'presentación':  ['presentationml'],
        'diapositivas':  ['presentationml'],
        'slides':        ['presentationml'],
        'lectura':       ['pdf', 'wordprocessingml'],
        'reading':       ['pdf', 'wordprocessingml'],
        'documento':     ['pdf', 'wordprocessingml'],
        'video':         ['pdf', 'wordprocessingml'],   # cuestionario/actividad asociada
        'cuestionario':  ['pdf', 'wordprocessingml'],
        'actividad':     ['pdf', 'wordprocessingml'],
        'guia':          ['pdf', 'wordprocessingml'],
        'guía':          ['pdf', 'wordprocessingml'],
        'tarea':         ['pdf', 'wordprocessingml'],
        'informe':       ['pdf', 'wordprocessingml'],
        'reporte':       ['pdf', 'wordprocessingml'],
    }

    def _names_match(self, group_name: str, file_name: str) -> bool:
        """
        Compara el nombre del grupo (tipo de documento) con el nombre del archivo.
        Devuelve True si el nombre normalizado del grupo aparece en el nombre del archivo.

        Ejemplos:
          "Presentación", "Lab pdc1 Presentacion 6 1S2025.pdf"  → True
          "Lectura",       "Lectura_Semana2.pdf"                 → True
          "Video",         "Lab pdc1 Presentacion 6 1S2025.pdf" → False
        """
        norm_group = self._normalize(group_name).lower()
        norm_file  = self._normalize(file_name).lower()
        # Coincidencia si el grupo (o sus primeras palabras) aparece en el nombre del archivo
        return norm_group in norm_file

    def _match_file_to_group(
        self,
        group_name: str,
        files_metadata: List[Dict],
        already_matched: set
    ) -> Optional[Dict]:
        """
        Encuentra el archivo más adecuado para un tipo de documento (grupo).

        Prioridad:
          1. Coincidencia de nombre normalizado (p.ej. "Presentación" ↔ "Presentacion_S2.pptx")
          2. Pista por MIME type según el nombre del grupo
          3. Cualquier archivo soportado no asignado aún
        """
        norm_group = self._normalize(group_name)

        # 1. Coincidencia de nombre
        for f in files_metadata:
            if f['name'] in already_matched:
                continue
            if self._names_match(group_name, f['name']):
                return f

        # 2. Pista por MIME
        for hint_key, mime_frags in self._GROUP_TYPE_HINTS.items():
            if hint_key in norm_group:
                for f in files_metadata:
                    if f['name'] in already_matched:
                        continue
                    mime = f.get('mimeType', '').lower()
                    if any(frag in mime for frag in mime_frags):
                        return f
                break   # intentar solo la primera pista que aplique

        # 3. Cualquier archivo soportado disponible (no asignado aún)
        #    Solo si no hay un match más específico.
        for f in files_metadata:
            if f['name'] not in already_matched:
                return f

        # Sin archivo exclusivo → el grupo reportará "no encontrado".
        # Si la carpeta no tiene un archivo de Lectura, Video, etc.,
        # es correcto decir que ese tipo de documento no existe.
        return None

    def download_and_extract_all_docs(
        self, folder_id: str
    ) -> Tuple[Dict[str, str], List[Dict]]:
        """
        Descarga y extrae texto de todos los documentos soportados en la carpeta.
        Excluye el Excel de la matriz.

        Retorna:
          doc_texts:      Dict[filename → extracted_text]
          files_metadata: List[{name, mimeType, id}]  (los archivos procesados)
        """
        files = drive_service.list_files(folder_id)
        doc_texts: Dict[str, str] = {}
        files_metadata: List[Dict] = []

        for f in files:
            name = f.get('name', '')
            mime = f.get('mimeType', '')

            # Excluir matriz y reportes generados por el sistema
            if name.startswith(MATRIX_FILE_PREFIX):
                continue
            if name.startswith(self.REPORT_PREFIX):
                continue
            # Solo tipos soportados
            if mime not in SUPPORTED_MIMES:
                print(f"  ↷ Omitiendo '{name}' (MIME: {mime})")
                continue

            # Para Google Workspace nativos, drive_service.download_file() exporta
            # automáticamente (Slides→PPTX, Docs→DOCX). Necesitamos el MIME efectivo
            # (después de exportar) para elegir el extractor correcto.
            effective_mime = drive_service.get_effective_mime(mime)

            tipo = "exportando" if effective_mime != mime else "descargando"
            print(f"  ⬇️  {tipo.capitalize()} '{name}' [{effective_mime.split('.')[-1]}]...")
            file_bytes = drive_service.download_file(f['id'])
            if not file_bytes:
                print(f"  ⚠️  No se pudo obtener '{name}'")
                continue

            text = self.extract_text_from_bytes(file_bytes, effective_mime)
            doc_texts[name] = text
            files_metadata.append({'name': name, 'mimeType': mime, 'id': f.get('id', '')})
            print(f"  📄 '{name}': {len(text)} chars | {len(text.split())} palabras")

        return doc_texts, files_metadata

    def combine_document_texts(self, doc_texts: Dict[str, str]) -> str:
        """Une todos los textos con separadores claros de documento."""
        parts = []
        for filename, text in doc_texts.items():
            parts.append(f"========== DOCUMENTO: {filename} ==========\n{text}")
        return "\n\n".join(parts)

    # ──────────────────────────────────────────────────────────────────────────
    # Chunking
    # ──────────────────────────────────────────────────────────────────────────

    def chunk_text(self, text: str, chunk_size: int = MAX_CHUNK_CHARS) -> List[str]:
        """
        Divide texto en chunks de máximo chunk_size caracteres.
        Divide por párrafos (\\n\\n) y aplica solapamiento de CHUNK_OVERLAP chars.
        """
        if len(text) <= chunk_size:
            return [text]

        paragraphs = text.split('\n\n')
        chunks: List[str] = []
        current = ''

        for para in paragraphs:
            if len(current) + len(para) + 2 <= chunk_size:
                current = current + '\n\n' + para if current else para
            else:
                if current:
                    chunks.append(current)
                    # Solapamiento: últimos CHUNK_OVERLAP chars del chunk anterior
                    overlap = current[-CHUNK_OVERLAP:] if len(current) > CHUNK_OVERLAP else current
                    current = overlap + '\n\n' + para
                else:
                    # Párrafo individual muy largo: dividir por oraciones
                    sentences = re.split(r'(?<=[.!?])\s+', para)
                    for sent in sentences:
                        if len(current) + len(sent) + 1 <= chunk_size:
                            current = current + ' ' + sent if current else sent
                        else:
                            if current:
                                chunks.append(current)
                            current = sent

        if current:
            chunks.append(current)

        return chunks

    # ──────────────────────────────────────────────────────────────────────────
    # IA: evaluación de requisitos con Gemini
    # ──────────────────────────────────────────────────────────────────────────

    def _call_gemini(
        self,
        requirement_text: str,
        doc_chunk: str,
        section_name: str,
        autor: str,
        model_name: Optional[str] = None
    ) -> Dict[str, str]:
        """
        Llama a Gemini para evaluar si el chunk de documento cubre el requisito.
        Retorna {'presente': 'Si'|'No', 'observacion': str}.
        """
        prompt = f"""Eres un evaluador académico. Determina si el siguiente contenido de documentos universitarios cubre el requisito indicado, ya sea de forma EXPLÍCITA o IMPLÍCITA.

SECCIÓN DEL CURSO: {section_name}
REQUISITO A VERIFICAR: {requirement_text}
AUTOR ESPERADO: {autor if autor else 'No especificado'}

Un requisito se considera PRESENTE (Si) si:
- El documento aborda el tema aunque use terminología diferente
- El concepto está demostrado con ejemplos o ejercicios
- El contenido implica el cumplimiento del requisito

Un requisito se considera AUSENTE (No) si:
- El tema no aparece en ninguna forma
- El contenido es insuficiente para cubrir el requisito

CONTENIDO DE LOS DOCUMENTOS:
{doc_chunk}

Responde ÚNICAMENTE con JSON válido, sin markdown ni texto adicional:
{{"presente": "Si" o "No", "observacion": "Explicación de 1-2 oraciones"}}"""

        try:
            # Usar modelo dinámico si se especifica (desde settings de BD)
            import google.generativeai as genai
            active_model = genai.GenerativeModel(model_name or GEMINI_MODEL)
            response = active_model.generate_content(prompt)
            raw = response.text.strip()
            # Limpiar posible markdown
            raw = re.sub(r'^```json?\s*', '', raw)
            raw = re.sub(r'\s*```$', '', raw)
            parsed = json.loads(raw)
            return {
                'presente':    str(parsed.get('presente', 'No')),
                'observacion': str(parsed.get('observacion', ''))
            }
        except json.JSONDecodeError:
            print(f"  ⚠️  JSON inválido de Gemini, usando fallback")
            return self._fallback_keyword_check(requirement_text, doc_chunk)
        except Exception as e:
            print(f"  ⚠️  Error en Gemini: {e}")
            return self._fallback_keyword_check(requirement_text, doc_chunk)

    def _fallback_keyword_check(self, requirement_text: str, doc_text: str) -> Dict[str, str]:
        """
        Fallback cuando Gemini no está disponible o falla.
        Búsqueda inteligente de palabras clave con matching parcial (stem-like).
        """
        norm_req = self._normalize(requirement_text)
        norm_doc = self._normalize(doc_text)

        # Palabras significativas (≥4 chars), sin stopwords básicas
        STOPWORDS = {'para', 'como', 'esta', 'este', 'esto', 'cion', 'idad', 'mente', 'del', 'los', 'las', 'con', 'que', 'una', 'por', 'sus'}
        keywords = [w for w in norm_req.split() if len(w) >= 4 and w not in STOPWORDS]

        if not keywords:
            return {
                'presente': 'No',
                'observacion': f'Sin IA (quota agotada): el requisito "{requirement_text}" no tiene términos evaluables'
            }

        # Match parcial: cada keyword se busca como substring Y por sus primeros 5 chars (stem)
        found = []
        missing = []
        for kw in keywords:
            stem = kw[:5]
            if kw in norm_doc or stem in norm_doc:
                found.append(kw)
            else:
                missing.append(kw)

        ratio = len(found) / len(keywords)
        presente = 'Si' if ratio >= 0.35 else 'No'

        found_str   = ', '.join(found[:4])   or '—'
        missing_str = ', '.join(missing[:4]) or '—'
        obs = (
            f'Sin IA (quota agotada): encontrado [{found_str}]'
            + (f' | faltante [{missing_str}]' if missing else '')
            + f' ({len(found)}/{len(keywords)} términos)'
        )
        return {'presente': presente, 'observacion': obs}

    def _evaluate_requirement(
        self,
        requirement_text: str,
        combined_text: str,
        section_name: str,
        autor: str,
        use_gemini: bool = True,
        model_name: Optional[str] = None
    ) -> Dict[str, str]:
        """
        Evalúa si el texto combinado de todos los documentos cubre el requisito.
        Si el texto es muy largo, evalúa por chunks — Si en cualquier chunk = presente.
        """
        if not use_gemini or not self.enabled:
            return self._fallback_keyword_check(requirement_text, combined_text)

        if len(combined_text) <= MAX_CHUNK_CHARS:
            return self._call_gemini(requirement_text, combined_text, section_name, autor, model_name)

        # Texto largo: evaluar por chunks
        chunks = self.chunk_text(combined_text)
        last_result = {'presente': 'No', 'observacion': ''}
        for i, chunk in enumerate(chunks, 1):
            print(f"    chunk {i}/{len(chunks)}...")
            result = self._call_gemini(requirement_text, chunk, section_name, autor, model_name)
            last_result = result
            if result['presente'] == 'Si':
                return result
            time.sleep(0.3)  # Rate limiting ligero

        return last_result

    def _evaluate_group_batch(
        self,
        params: List[Dict],
        doc_text: str,
        section_name: str,
        group_name: str,
        use_gemini: bool = True,
        model_name: Optional[str] = None,
    ) -> List[Dict[str, str]]:
        """
        Evalúa TODOS los parámetros de un grupo en UNA SOLA llamada a Gemini.
        Reduce N llamadas a 1 por grupo → de 18 llamadas a 3 por Semana.

        Retorna lista ordenada de {'presente', 'observacion'} por parámetro.
        Si Gemini falla, aplica fallback keyword por cada param.
        """
        if not use_gemini or not self.enabled:
            return [self._fallback_keyword_check(p['sub_seccion'], doc_text) for p in params]

        # Truncar texto al máximo razonable para un solo prompt
        max_chars = MAX_CHUNK_CHARS
        doc_snippet = doc_text[:max_chars]

        reqs_list = "\n".join(
            f"{i+1}. {p['sub_seccion']}" for i, p in enumerate(params)
        )

        prompt = f"""Eres un evaluador académico riguroso. Analiza el siguiente contenido de un documento universitario y determina si cubre cada uno de los requisitos listados.

SECCIÓN DEL CURSO: {section_name}
TIPO DE DOCUMENTO: {group_name}

Un requisito se considera PRESENTE (Si) si el documento lo aborda, aunque sea con terminología diferente, mediante ejemplos, o de forma implícita.
Un requisito se considera AUSENTE (No) si el tema no aparece en ninguna forma o el contenido es claramente insuficiente.

REQUISITOS A EVALUAR:
{reqs_list}

CONTENIDO DEL DOCUMENTO:
{doc_snippet}

Responde ÚNICAMENTE con un array JSON válido (sin markdown ni texto extra), con exactamente {len(params)} objetos en el mismo orden que los requisitos:
[
  {{"presente": "Si" o "No", "observacion": "Explicación breve de 1 oración"}},
  ...
]"""

        MAX_RETRIES = 3
        for attempt in range(MAX_RETRIES):
            try:
                import google.generativeai as genai
                active_model = genai.GenerativeModel(model_name or GEMINI_MODEL)
                response = active_model.generate_content(prompt)
                raw = response.text.strip()
                raw = re.sub(r'^```json?\s*', '', raw)
                raw = re.sub(r'\s*```$', '', raw)
                parsed = json.loads(raw)

                if not isinstance(parsed, list):
                    raise ValueError("Respuesta no es lista")

                results = []
                for i, p in enumerate(params):
                    if i < len(parsed):
                        item = parsed[i]
                        results.append({
                            'presente':    str(item.get('presente', 'No')),
                            'observacion': str(item.get('observacion', '')),
                        })
                    else:
                        results.append(self._fallback_keyword_check(p['sub_seccion'], doc_text))
                return results

            except json.JSONDecodeError:
                print(f"  ⚠️  Batch JSON inválido (intento {attempt+1}), fallback por parámetro")
                break
            except Exception as e:
                err_str = str(e)
                if '429' in err_str or 'quota' in err_str.lower() or 'RESOURCE_EXHAUSTED' in err_str:
                    wait = 2 ** (attempt + 1)   # 2s, 4s, 8s
                    print(f"  ⏳ Quota excedida, esperando {wait}s... (intento {attempt+1}/{MAX_RETRIES})")
                    time.sleep(wait)
                    if attempt == MAX_RETRIES - 1:
                        print(f"  ⚠️  Gemini quota agotada tras {MAX_RETRIES} intentos, usando fallback")
                        break
                else:
                    print(f"  ⚠️  Error Gemini batch: {e}")
                    break

        # Fallback: keyword check para cada param
        return [self._fallback_keyword_check(p['sub_seccion'], doc_text) for p in params]

    # ──────────────────────────────────────────────────────────────────────────
    # Generación del reporte Excel (archivo nuevo, no modifica la matriz)
    # ──────────────────────────────────────────────────────────────────────────

    REPORT_PREFIX = "Reporte Validacion"

    def _build_report_excel(
        self,
        section_name: str,
        requirements: List[Dict],
        results: List[Dict],
        compliance_pct: float,
        docs_analyzed: List[str],
        model_name: str,
        groups: Optional[List[Dict]] = None,
    ) -> bytes:
        """
        Crea un nuevo workbook de reporte desde cero.
        No toca el Excel original de la matriz.
        """
        from datetime import datetime
        from openpyxl.styles import (
            Font, PatternFill, Alignment, Border, Side
        )

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Validación Contenido"

        # ── Estilos ──────────────────────────────────────────────
        title_font   = Font(bold=True, size=14)
        header_font  = Font(bold=True, size=10, color="FFFFFF")
        label_font   = Font(bold=True, size=10)
        normal_font  = Font(size=10)

        header_fill  = PatternFill("solid", fgColor="1E3A5F")   # azul oscuro
        green_fill   = PatternFill("solid", fgColor="C6EFCE")   # verde claro
        red_fill     = PatternFill("solid", fgColor="FFC7CE")   # rojo claro
        gray_fill    = PatternFill("solid", fgColor="F2F2F2")   # gris info

        center = Alignment(horizontal="center", vertical="center", wrap_text=True)
        left   = Alignment(horizontal="left",   vertical="center", wrap_text=True)

        thin = Side(style="thin", color="CCCCCC")
        border = Border(left=thin, right=thin, top=thin, bottom=thin)

        # ── Fila 1: Título ────────────────────────────────────────
        ws.merge_cells("A1:D1")
        ws["A1"].value     = "Reporte de Validación de Contenido"
        ws["A1"].font      = title_font
        ws["A1"].alignment = center
        ws.row_dimensions[1].height = 28

        # ── Filas 2-4: Metadatos ──────────────────────────────────
        meta = [
            ("Sección:",      section_name,
             "Fecha:",        datetime.now().strftime("%Y-%m-%d %H:%M")),
            ("Cumplimiento:", f"{compliance_pct}%",
             "Modelo IA:",    model_name),
            ("Documentos:",   ", ".join(docs_analyzed) if docs_analyzed else "—",
             "",              ""),
        ]
        for r_offset, (la, va, lb, vb) in enumerate(meta, start=2):
            ws[f"A{r_offset}"].value      = la
            ws[f"A{r_offset}"].font       = label_font
            ws[f"A{r_offset}"].fill       = gray_fill
            ws[f"B{r_offset}"].value      = va
            ws[f"B{r_offset}"].font       = normal_font
            ws[f"C{r_offset}"].value      = lb
            ws[f"C{r_offset}"].font       = label_font
            ws[f"C{r_offset}"].fill       = gray_fill
            ws[f"D{r_offset}"].value      = vb
            ws[f"D{r_offset}"].font       = normal_font
            ws.row_dimensions[r_offset].height = 18

        # Merge celda B3 si "Documentos" es larga
        ws.merge_cells("B4:D4")

        group_header_fill = PatternFill("solid", fgColor="2563EB")   # azul medio (encab. grupo)
        group_header_font = Font(bold=True, size=10, color="FFFFFF")

        # ── Fila 5: Espaciador ────────────────────────────────────
        ws.row_dimensions[5].height = 8

        # ── Fila 6: Encabezados de tabla ──────────────────────────
        headers = ["Sub-sección / Requisito", "Archivo analizado", "Presente", "Observación"]
        for col, h in enumerate(headers, start=1):
            cell = ws.cell(row=6, column=col)
            cell.value     = h
            cell.font      = header_font
            cell.fill      = header_fill
            cell.alignment = center
            cell.border    = border
        ws.row_dimensions[6].height = 20

        # ── Filas 7+: Datos (agrupados si hay grupos, planos si no) ──────────
        current_row = 7

        if groups:
            for group in groups:
                # Fila de encabezado de grupo (tipo de documento)
                g_pct   = group.get('compliance_percentage', 0)
                g_file  = group.get('matched_file') or '— archivo no encontrado —'
                g_label = (f"📑 {group['group_name']}  ·  {g_file}  "
                           f"·  {group.get('present_count', 0)}/{group.get('total_params', 0)} "
                           f"({g_pct}%)")
                ws.merge_cells(
                    start_row=current_row, start_column=1,
                    end_row=current_row,   end_column=4
                )
                gc = ws.cell(row=current_row, column=1)
                gc.value     = g_label
                gc.font      = group_header_font
                gc.fill      = group_header_fill
                gc.alignment = left
                ws.row_dimensions[current_row].height = 18
                current_row += 1

                # Filas de parámetros del grupo
                for r in group.get('results', []):
                    presente   = r.get('presente', 'No')
                    row_fill   = green_fill if presente == 'Si' else red_fill
                    row_data   = [r['sub_seccion'], g_file, presente, r.get('observacion', '')]
                    for col, val in enumerate(row_data, start=1):
                        cell = ws.cell(row=current_row, column=col)
                        cell.value     = val
                        cell.font      = normal_font
                        cell.fill      = row_fill
                        cell.alignment = left if col != 3 else center
                        cell.border    = border
                    ws.row_dimensions[current_row].height = 32
                    current_row += 1

        else:
            # Fallback: lista plana (sin grupos)
            for req, result in zip(requirements, results):
                presente = result.get('presente', 'No')
                row_fill = green_fill if presente == 'Si' else red_fill
                row_data = [req['sub_seccion'], req.get('autor', ''), presente, result.get('observacion', '')]
                for col, val in enumerate(row_data, start=1):
                    cell = ws.cell(row=current_row, column=col)
                    cell.value     = val
                    cell.font      = normal_font
                    cell.fill      = row_fill
                    cell.alignment = left if col != 3 else center
                    cell.border    = border
                ws.row_dimensions[current_row].height = 36
                current_row += 1

        # ── Anchos de columna ─────────────────────────────────────
        ws.column_dimensions["A"].width = 55
        ws.column_dimensions["B"].width = 20
        ws.column_dimensions["C"].width = 12
        ws.column_dimensions["D"].width = 60

        buf = io.BytesIO()
        wb.save(buf)
        return buf.getvalue()

    def _save_report(
        self,
        report_bytes: bytes,
        section_name: str,
        target_folder_id: str,
    ) -> Optional[Dict]:
        """
        Sube el reporte a Drive.
        Si ya existe un reporte para esta sección en la carpeta, lo actualiza.
        Si no, crea uno nuevo.
        Retorna {'id', 'name', 'webViewLink'} o None.
        """
        from datetime import datetime

        # Prefijo estable para poder encontrarlo después
        safe_section = section_name.replace(" ", "_")
        prefix = f"{self.REPORT_PREFIX} {safe_section}"

        # Buscar si ya existe
        existing = drive_service.find_file_by_prefix(target_folder_id, prefix)

        if existing:
            # Actualizar en lugar de crear nuevo
            ok = drive_service.upload_file(report_bytes, EXCEL_MIME_TYPE, existing['id'])
            if ok:
                print(f"  📤 Reporte actualizado: '{existing['name']}'")
                return existing
            return None
        else:
            # Crear archivo nuevo con timestamp
            ts = datetime.now().strftime("%Y-%m-%d %H-%M")
            filename = f"{prefix} - {ts}.xlsx"
            result = drive_service.create_file(
                report_bytes, EXCEL_MIME_TYPE, filename, target_folder_id
            )
            return result

    # ──────────────────────────────────────────────────────────────────────────
    # Punto de entrada principal
    # ──────────────────────────────────────────────────────────────────────────

    def validate_folder_content(
        self,
        semana_folder_id: str,
        semana_folder_name: str,
        candidate_folder_ids: List[str],
        db=None
    ) -> Dict[str, Any]:
        """
        Pipeline completo de validación de contenido para una carpeta Semana_X.

        Nuevo enfoque por grupos:
          - El Excel agrupa parámetros bajo encabezados de tipo de documento
            (Presentación, Lectura, Video…)
          - Cada tipo de documento se localiza en la carpeta Drive
          - Los parámetros se evalúan SOLO contra el archivo correspondiente
            → Gemini recibe contexto puro, sin mezclar documentos
        """
        try:
            print(f"\n🧠 Iniciando validación de contenido: '{semana_folder_name}'")

            # 0. Leer settings dinámicos desde BD (si db disponible)
            use_gemini = self.enabled
            active_model_name = GEMINI_MODEL
            if db is not None:
                try:
                    from app.services.settings_service import settings_service
                    use_gemini = self.enabled and settings_service.get_bool("gemini_enabled", db)
                    active_model_name = settings_service.get("gemini_model", db) or GEMINI_MODEL
                    print(f"  ⚙️  Gemini: {'habilitado' if use_gemini else 'deshabilitado'} | modelo: {active_model_name}")
                except Exception:
                    pass

            # 1. Derivar sección
            section_name = self._derive_section_from_folder(semana_folder_name)
            print(f"  📌 Sección: '{section_name}'")

            # 2. Buscar el Excel en cada carpeta candidata
            matrix_info = None
            matrix_folder_id = None
            for fid in candidate_folder_ids:
                print(f"  🔎 Buscando matriz en: {fid}")
                matrix_info = self.find_matrix_file(fid)
                if matrix_info:
                    matrix_folder_id = fid
                    break

            if not matrix_info:
                return {
                    'success': False,
                    'error': f'No se encontró "{MATRIX_FILE_PREFIX}" en ninguna carpeta candidata'
                }
            matrix_file_id, matrix_file_name = matrix_info
            print(f"  📊 Matriz: '{matrix_file_name}'")

            # 3. Cargar workbook
            wb = self.read_workbook(matrix_file_id)
            if wb is None:
                return {'success': False, 'error': 'No se pudo leer el Excel'}
            ws = self.get_content_sheet(wb)
            if ws is None:
                return {'success': False, 'error': 'No se encontró la hoja "Matriz observaciones"'}

            header_row_idx, col_map = self._find_header_row(ws)

            # 4. Parsear requisitos AGRUPADOS por tipo de documento
            groups = self.parse_requirements_by_group(ws, section_name, col_map, header_row_idx)
            if not groups:
                return {
                    'success': False,
                    'error': f'No se encontraron requisitos para la sección "{section_name}"'
                }

            # 5. Descargar y extraer texto de TODOS los documentos de la carpeta
            doc_texts, files_metadata = self.download_and_extract_all_docs(semana_folder_id)
            if not doc_texts:
                return {
                    'success': False,
                    'error': 'No se encontraron documentos PDF/DOCX/PPTX en la carpeta'
                }
            print(f"  📁 {len(doc_texts)} documento(s) en la carpeta")

            # 6. Validar cada grupo contra su documento específico
            group_results: List[Dict] = []
            already_matched: set = set()      # evitar asignar el mismo archivo a 2 grupos
            total_present = 0
            total_absent  = 0

            for group in groups:
                # 6a. Buscar el archivo correspondiente al tipo de documento
                matched_file = self._match_file_to_group(
                    group['group_name'], files_metadata, already_matched
                )
                file_found    = matched_file is not None
                matched_name  = matched_file['name'] if matched_file else None
                if matched_name:
                    already_matched.add(matched_name)

                doc_text = doc_texts.get(matched_name, '') if matched_name else ''

                print(f"\n  📑 Grupo '{group['group_name']}' → "
                      f"{'archivo: ' + matched_name if file_found else '⚠️ sin archivo'}")

                # 6b. Evaluar TODOS los parámetros del grupo en UNA sola llamada batch
                params_results: List[Dict] = []
                present_in_group = 0
                absent_in_group  = 0
                n = len(group['params'])

                if not file_found or not doc_text.strip():
                    # Sin archivo → todos ausentes
                    batch_evals = [
                        {
                            'presente':    'No',
                            'observacion': (f'Documento tipo "{group["group_name"]}" no encontrado '
                                           f'en la carpeta "{semana_folder_name}"'),
                        }
                        for _ in group['params']
                    ]
                else:
                    print(f"    🤖 Batch Gemini: {n} parámetros en 1 llamada...")
                    batch_evals = self._evaluate_group_batch(
                        params     = group['params'],
                        doc_text   = doc_text,
                        section_name = section_name,
                        group_name = group['group_name'],
                        use_gemini = use_gemini,
                        model_name = active_model_name,
                    )
                    # Pausa cortés entre grupos (no entre parámetros)
                    time.sleep(1.5)

                for i, (param, eval_r) in enumerate(zip(group['params'], batch_evals), 1):
                    sub = param['sub_seccion']
                    print(f"    [{i}/{n}] '{sub[:50]}' → {eval_r['presente']}")
                    if eval_r['presente'] == 'Si':
                        present_in_group += 1
                    else:
                        absent_in_group += 1
                    params_results.append({
                        'sub_seccion': sub,
                        'autor':       param['autor'],
                        'presente':    eval_r['presente'],
                        'observacion': eval_r['observacion'],
                    })

                total_present += present_in_group
                total_absent  += absent_in_group
                g_total = len(group['params'])
                g_pct   = round(present_in_group / g_total * 100, 2) if g_total else 0

                group_results.append({
                    'group_name':           group['group_name'],
                    'matched_file':         matched_name,
                    'file_found':           file_found,
                    'total_params':         g_total,
                    'present_count':        present_in_group,
                    'absent_count':         absent_in_group,
                    'compliance_percentage': g_pct,
                    'results':              params_results,
                })
                print(f"  ✅ '{group['group_name']}': {present_in_group}/{g_total} ({g_pct}%)")

            # 7. Estadísticas globales
            total_requirements = total_present + total_absent
            compliance_pct = round(total_present / total_requirements * 100, 2) if total_requirements else 0

            # Lista plana para compatibilidad (report, batch, etc.)
            flat_results = [r for g in group_results for r in g['results']]
            # Flat requirements list for report builder
            flat_requirements = [
                {'sub_seccion': r['sub_seccion'], 'autor': r['autor']}
                for r in flat_results
            ]

            print(f"\n✅ Validación: {total_present}/{total_requirements} ({compliance_pct}%) presentes "
                  f"en {len(groups)} grupo(s)")

            # 8. Generar reporte Excel (sin tocar la matriz original)
            report_bytes = self._build_report_excel(
                section_name   = section_name,
                requirements   = flat_requirements,
                results        = flat_results,
                compliance_pct = compliance_pct,
                docs_analyzed  = list(doc_texts.keys()),
                model_name     = active_model_name,
                groups         = group_results,
            )
            report_info = self._save_report(report_bytes, section_name, semana_folder_id)
            if report_info:
                print(f"  📄 Reporte: '{report_info.get('name')}'")

            return {
                'success':               True,
                'section':               section_name,
                'total_requirements':    total_requirements,
                'present_count':         total_present,
                'absent_count':          total_absent,
                'compliance_percentage': compliance_pct,
                # NUEVO: desglose por grupo
                'groups':                group_results,
                # Compatibilidad hacia atrás (batch, history)
                'results':               flat_results,
                'documents_analyzed':    list(doc_texts.keys()),
                'report_generated':      report_info is not None,
                'report_name':           report_info.get('name') if report_info else None,
                'report_link':           report_info.get('webViewLink') if report_info else None,
                'excel_updated':         False,
                'gemini_enabled':        self.enabled,
            }

        except Exception as e:
            print(f"❌ Error en validación de contenido: {e}")
            import traceback
            traceback.print_exc()
            return {'success': False, 'error': str(e)}


# Singleton global
document_content_validation_service = DocumentContentValidationService()
