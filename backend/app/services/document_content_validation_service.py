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
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
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
        m = re.match(r'^semana\s*(\d+)$', normalized)
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

        for row_idx in range(header_row_idx + 1, ws.max_row + 1):
            # Leer sección
            sec_col = col_map.get('seccion')
            if not sec_col:
                continue
            sec_val = ws.cell(row=row_idx, column=sec_col).value
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

    def download_and_extract_all_docs(self, folder_id: str) -> Dict[str, str]:
        """
        Descarga y extrae texto de todos los documentos soportados en la carpeta.
        Excluye el Excel de la matriz.
        Retorna Dict[filename → extracted_text].
        """
        files = drive_service.list_files(folder_id)
        doc_texts: Dict[str, str] = {}

        for f in files:
            name = f.get('name', '')
            mime = f.get('mimeType', '')

            # Excluir el Excel de la matriz
            if name.startswith(MATRIX_FILE_PREFIX):
                continue
            # Solo tipos soportados
            if mime not in SUPPORTED_MIMES:
                print(f"  ↷ Omitiendo '{name}' (MIME: {mime})")
                continue

            print(f"  ⬇️  Descargando '{name}'...")
            file_bytes = drive_service.download_file(f['id'])
            if not file_bytes:
                print(f"  ⚠️  No se pudo descargar '{name}'")
                continue

            text = self.extract_text_from_bytes(file_bytes, mime)
            doc_texts[name] = text
            print(f"  📄 '{name}': {len(text)} caracteres extraídos")

        return doc_texts

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
        Busca palabras clave del requisito en el texto del documento.
        """
        norm_req = self._normalize(requirement_text)
        norm_doc = self._normalize(doc_text)
        # Extraer palabras significativas (>3 chars) del requisito
        keywords = [w for w in norm_req.split() if len(w) > 3]
        if not keywords:
            return {'presente': 'No', 'observacion': 'Análisis básico sin IA: sin palabras clave'}

        hits = sum(1 for kw in keywords if kw in norm_doc)
        ratio = hits / len(keywords)
        if ratio >= 0.4:
            return {
                'presente': 'Si',
                'observacion': f'Análisis básico sin IA: {hits}/{len(keywords)} términos clave encontrados'
            }
        return {
            'presente': 'No',
            'observacion': f'Análisis básico sin IA: solo {hits}/{len(keywords)} términos clave encontrados'
        }

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

    # ──────────────────────────────────────────────────────────────────────────
    # Escritura de resultados al Excel
    # ──────────────────────────────────────────────────────────────────────────

    def write_results_to_excel(
        self,
        wb: openpyxl.Workbook,
        ws,
        col_map: Dict[str, int],
        requirements: List[Dict],
        results: List[Dict]
    ) -> bytes:
        """
        Rellena las columnas 'Presente' y 'Observaciones' del Excel.
        Retorna los bytes del workbook modificado.
        """
        presente_col     = col_map.get('presente')
        observacion_col  = col_map.get('observaciones')

        for req, result in zip(requirements, results):
            row_idx = req['row_idx']
            if presente_col:
                ws.cell(row=row_idx, column=presente_col).value = result['presente']
            if observacion_col:
                ws.cell(row=row_idx, column=observacion_col).value = result['observacion']

        buf = io.BytesIO()
        wb.save(buf)
        return buf.getvalue()

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

        Args:
            semana_folder_id:     ID de Drive de la carpeta Semana_X a analizar
            semana_folder_name:   Nombre de la carpeta (ej. "Semana_2")
            candidate_folder_ids: IDs de carpetas candidatas donde buscar el Excel
                                  (de más específico a más general)

        Returns dict con:
            success, section, total_requirements, present_count, absent_count,
            compliance_percentage, results[], documents_analyzed[], excel_updated, gemini_enabled
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
                    pass  # Si falla la lectura de settings, usar defaults

            # 1. Derivar sección
            section_name = self._derive_section_from_folder(semana_folder_name)
            print(f"  📌 Sección derivada: '{section_name}'")

            # 2. Buscar el Excel buscando en cada carpeta candidata (del más cercano al más lejano)
            matrix_info = None
            matrix_folder_id = None
            for fid in candidate_folder_ids:
                print(f"  🔎 Buscando matriz en carpeta: {fid}")
                matrix_info = self.find_matrix_file(fid)
                if matrix_info:
                    matrix_folder_id = fid
                    break

            if not matrix_info:
                searched = ', '.join(candidate_folder_ids)
                return {
                    'success': False,
                    'error': f'No se encontró "{MATRIX_FILE_PREFIX}" en ninguna carpeta candidata (buscado en: {searched})'
                }
            matrix_file_id, matrix_file_name = matrix_info
            print(f"  📊 Matriz encontrada: '{matrix_file_name}' en carpeta {matrix_folder_id}")

            # 3. Cargar workbook y hoja de contenido
            wb = self.read_workbook(matrix_file_id)
            if wb is None:
                return {'success': False, 'error': 'No se pudo leer el Excel'}

            ws = self.get_content_sheet(wb)
            if ws is None:
                return {'success': False, 'error': 'No se encontró la hoja "Matriz observaciones" (2da hoja)'}

            # 4. Parsear requisitos para la sección
            requirements, col_map, _ = self.parse_requirements(ws, section_name)
            if not requirements:
                return {
                    'success': False,
                    'error': f'No se encontraron requisitos aplicables para la sección "{section_name}"'
                }

            # 5. Descargar y extraer texto de todos los documentos
            doc_texts = self.download_and_extract_all_docs(semana_folder_id)
            if not doc_texts:
                return {
                    'success': False,
                    'error': 'No se encontraron documentos PDF/DOCX/PPTX en la carpeta'
                }
            combined_text = self.combine_document_texts(doc_texts)
            print(f"  📝 Texto combinado: {len(combined_text)} caracteres de {len(doc_texts)} documento(s)")

            # 6. Evaluar cada requisito con Gemini
            results: List[Dict] = []
            for i, req in enumerate(requirements, 1):
                print(f"  🔍 [{i}/{len(requirements)}] '{req['sub_seccion'][:60]}...' ")
                result = self._evaluate_requirement(
                    req['sub_seccion'],
                    combined_text,
                    section_name,
                    req['autor'],
                    use_gemini=use_gemini,
                    model_name=active_model_name
                )
                results.append(result)
                print(f"    → {result['presente']}: {result['observacion'][:80]}")
                # Pausa entre llamadas a Gemini para evitar rate limiting
                if self.enabled and i < len(requirements):
                    time.sleep(0.5)

            # 7. Escribir resultados al Excel y re-subir a Drive
            updated_bytes = self.write_results_to_excel(wb, ws, col_map, requirements, results)
            excel_updated = drive_service.upload_file(updated_bytes, EXCEL_MIME_TYPE, matrix_file_id)

            # 8. Calcular estadísticas
            present_count = sum(1 for r in results if r['presente'] == 'Si')
            absent_count  = len(results) - present_count
            compliance_pct = round(present_count / len(results) * 100, 2) if results else 0

            print(f"\n✅ Validación completada: {present_count}/{len(results)} ({compliance_pct}%) presentes")
            if excel_updated:
                print(f"  📤 Excel actualizado en Drive: '{matrix_file_name}'")

            return {
                'success':               True,
                'section':               section_name,
                'total_requirements':    len(requirements),
                'present_count':         present_count,
                'absent_count':          absent_count,
                'compliance_percentage': compliance_pct,
                'results': [
                    {
                        'sub_seccion': req['sub_seccion'],
                        'autor':       req['autor'],
                        'presente':    result['presente'],
                        'observacion': result['observacion'],
                    }
                    for req, result in zip(requirements, results)
                ],
                'documents_analyzed': list(doc_texts.keys()),
                'excel_updated':      excel_updated,
                'gemini_enabled':     self.enabled,
            }

        except Exception as e:
            print(f"❌ Error en validación de contenido: {e}")
            import traceback
            traceback.print_exc()
            return {'success': False, 'error': str(e)}


# Singleton global
document_content_validation_service = DocumentContentValidationService()
