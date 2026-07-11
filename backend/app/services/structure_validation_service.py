"""
Servicio para validar estructura de carpetas según matriz de observaciones
"""
import pandas as pd
import io
import re
import unicodedata
from typing import Dict, List, Optional, Any
from app.services.drive_service import drive_service


class StructureValidationService:
    """
    Valida que las carpetas de curso contengan los documentos requeridos
    definidos en el archivo 'Matriz observaciones estructura.xlsx'.

    Reglas de matching:
    - Nombres normalizados: se quita número inicial, guiones/underscores → espacios,
      minúsculas, sin tildes. Ej: "2_Analisis_Internacional_y_Local" == "Analisis Internacional y Local"
    - "Sección ..." en el Excel es palabra reservada (encabezado de bloque) → se omite.
    - "Semana X" en el Excel → se busca la carpeta correspondiente y se verifica
      que tenga al menos 1 archivo (pdf, word, ppt, txt, xlsx, etc.).
    """

    MATRIX_PREFIX = "Matriz observaciones"

    def __init__(self):
        pass

    # ──────────────────────────────────────────────
    # Normalización de nombres
    # ──────────────────────────────────────────────

    def _normalize(self, name: str) -> str:
        """
        Normaliza un nombre para comparación flexible:
          1. Quita número inicial + separador: "2_Algo", "02. Algo", "2-Algo" → "Algo"
          2. Reemplaza _ y - por espacios
          3. Colapsa espacios múltiples
          4. Minúsculas
          5. Elimina tildes/diacríticos
        """
        # 1. Quitar prefijo numérico (p.ej. "2_", "02. ", "2-")
        name = re.sub(r'^\d+[\s_\-\.]+', '', name.strip())
        # 2. Underscores e hífen → espacio
        name = name.replace('_', ' ').replace('-', ' ')
        # 3. Colapsar espacios
        name = re.sub(r'\s+', ' ', name).strip()
        # 4. Minúsculas
        name = name.lower()
        # 5. Quitar tildes
        nfkd = unicodedata.normalize('NFKD', name)
        name = ''.join(c for c in nfkd if not unicodedata.combining(c))
        return name

    def _is_seccion(self, name: str) -> bool:
        """Detecta encabezados de sección (palabra reservada)."""
        norm = self._normalize(name)
        return norm.startswith('seccion')

    def _is_semana(self, name: str) -> bool:
        """Detecta entradas 'Semana X' que corresponden a carpetas."""
        norm = self._normalize(name)
        return bool(re.match(r'^semana\s*\d+', norm))

    def _names_match(self, required: str, existing: str) -> bool:
        """
        True si los nombres normalizados coinciden exactamente
        o uno contiene al otro (≥4 caracteres para evitar falsos positivos).
        """
        r = self._normalize(required)
        e = self._normalize(existing)
        if not r or not e:
            return False
        if r == e:
            return True
        # Coincidencia parcial solo si el fragmento es suficientemente largo
        min_len = 4
        if len(r) >= min_len and r in e:
            return True
        if len(e) >= min_len and e in r:
            return True
        return False

    # ──────────────────────────────────────────────
    # Lectura del Excel de la matriz
    # ──────────────────────────────────────────────

    def find_matrix_file(self, folder_id: str) -> Optional[str]:
        """Busca el archivo de matriz en la carpeta de Drive."""
        try:
            files = drive_service.list_files(folder_id)
            for f in files:
                if f.get('name', '').startswith(self.MATRIX_PREFIX):
                    return f.get('id')
            return None
        except Exception as e:
            print(f"Error buscando matriz: {e}")
            return None

    def read_matrix_excel(self, file_id: str) -> Optional[pd.DataFrame]:
        """Descarga y lee el Excel desde Drive."""
        try:
            content = drive_service.download_file(file_id)
            if not content:
                print("No se pudo descargar la matriz")
                return None
            df = pd.read_excel(io.BytesIO(content), engine='openpyxl')
            return df
        except Exception as e:
            print(f"Error leyendo Excel: {e}")
            return None

    def extract_required_documents(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        """
        Extrae la lista de documentos requeridos del DataFrame.

        - Omite filas vacías
        - Omite encabezados de sección ("Sección ...")
        - Omite filas que sean headers de columna
        - Marca entradas "Semana X" como carpetas (is_week_folder=True)
        """
        required_docs = []
        SKIP_NAMES = {'nombre', 'documento', 'archivo', 'descripcion', 'descripción', 'tipo'}

        for index, row in df.iterrows():
            raw = row.iloc[0]

            # Saltar vacíos
            if pd.isna(raw) or str(raw).strip() == '':
                continue

            name = str(raw).strip()

            # Saltar "Sección ..." (palabra reservada)
            if self._is_seccion(name):
                print(f"  ↳ [SECCIÓN] omitida: '{name}'")
                continue

            # Saltar encabezados de columna
            if name.lower() in SKIP_NAMES:
                continue

            # Tipo y descripción (columnas opcionales)
            doc_type = (
                str(row.iloc[1]).strip()
                if len(row) > 1 and not pd.isna(row.iloc[1])
                else 'Desconocido'
            )
            description = (
                str(row.iloc[2]).strip()
                if len(row) > 2 and not pd.isna(row.iloc[2])
                else ''
            )

            is_week = self._is_semana(name)

            required_docs.append({
                'name': name,
                'type': doc_type,
                'description': description,
                'is_week_folder': is_week,
                'required': True,
                'row_number': index + 1
            })

        weeks = sum(1 for d in required_docs if d['is_week_folder'])
        docs  = len(required_docs) - weeks
        print(f"📋 Requeridos: {len(required_docs)} ({docs} documentos, {weeks} semanas)")
        return required_docs

    # ──────────────────────────────────────────────
    # Contenido de Drive
    # ──────────────────────────────────────────────

    def get_existing_files(self, folder_id: str) -> List[Dict[str, Any]]:
        """Todos los archivos de la carpeta excepto la matriz."""
        try:
            files = drive_service.list_files(folder_id)
            return [
                {
                    'id': f.get('id'),
                    'name': f.get('name'),
                    'mimeType': f.get('mimeType'),
                    'size': f.get('size'),
                    'webViewLink': f.get('webViewLink')
                }
                for f in files
                if not f.get('name', '').startswith(self.MATRIX_PREFIX)
            ]
        except Exception as e:
            print(f"Error obteniendo archivos: {e}")
            return []

    def get_all_folders_recursive(self, root_folder_id: str, max_depth: int = 5) -> List[Dict[str, Any]]:
        """
        Búsqueda BFS de TODAS las subcarpetas en la jerarquía.
        Las carpetas "Semana X" pueden estar a cualquier nivel de profundidad.

        Returns:
            Lista de {'id', 'name', 'depth', 'parent_id'}
        """
        all_folders: List[Dict[str, Any]] = []
        visited: set = set()
        # Cola: (folder_id, depth, parent_id)
        queue: List[tuple] = [(root_folder_id, 0, None)]

        while queue:
            current_id, depth, parent_id = queue.pop(0)

            if current_id in visited or depth > max_depth:
                continue
            visited.add(current_id)

            try:
                subfolders = drive_service.list_folders(current_id)
                for folder in subfolders:
                    fid = folder.get('id')
                    entry = {
                        'id':        fid,
                        'name':      folder.get('name'),
                        'depth':     depth + 1,
                        'parent_id': current_id
                    }
                    all_folders.append(entry)
                    if fid and fid not in visited:
                        queue.append((fid, depth + 1, current_id))
            except Exception as e:
                print(f"  Error listando carpetas en profundidad {depth}: {e}")

        print(f"  🗂  Carpetas encontradas en toda la jerarquía: {len(all_folders)}")
        return all_folders

    def _folder_has_files(self, folder_id: str) -> bool:
        """True si la carpeta contiene al menos 1 archivo (de cualquier tipo)."""
        try:
            files = drive_service.list_files(folder_id)
            return len(files) > 0
        except Exception as e:
            print(f"Error verificando archivos en carpeta: {e}")
            return False

    # ──────────────────────────────────────────────
    # Comparación documentos requeridos vs existentes
    # ──────────────────────────────────────────────

    def compare_documents(
        self,
        required_docs: List[Dict[str, Any]],
        existing_files: List[Dict[str, Any]],
        all_folders_recursive: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Compara requeridos vs existentes:
        - Semana X → búsqueda recursiva en toda la jerarquía de carpetas;
                     verifica que la carpeta encontrada tenga ≥1 archivo.
        - Archivo  → coincidencia normalizada en los archivos directos de la carpeta raíz.
        """
        found   = []
        missing = []

        for req in required_docs:
            if req['is_week_folder']:
                # ── Buscar la carpeta "Semana X" en cualquier nivel ──
                matched_folder = None
                for folder in all_folders_recursive:
                    if self._names_match(req['name'], folder['name']):
                        matched_folder = folder
                        break

                if matched_folder:
                    has_content = self._folder_has_files(matched_folder['id'])
                    depth_label = f" (nivel {matched_folder.get('depth', '?')})"
                    if has_content:
                        found.append({
                            **req,
                            'status': 'found',
                            'matched_file': {
                                'name': matched_folder['name'] + depth_label,
                                'type': 'carpeta'
                            }
                        })
                        print(f"  ✅ '{req['name']}' → '{matched_folder['name']}'{depth_label} con archivos")
                    else:
                        missing.append({
                            **req,
                            'status': 'missing',
                            'reason': f'Carpeta "{matched_folder["name"]}" existe{depth_label} pero está vacía'
                        })
                        print(f"  ⚠️  '{req['name']}' → '{matched_folder['name']}'{depth_label} VACÍA")
                else:
                    missing.append({**req, 'status': 'missing'})
                    print(f"  ❌ '{req['name']}' → carpeta no encontrada en ningún nivel")

            else:
                # ── Buscar archivo con nombre normalizado ──
                matched_file = None
                for f in existing_files:
                    if self._names_match(req['name'], f['name']):
                        matched_file = f
                        break

                if matched_file:
                    found.append({
                        **req,
                        'status': 'found',
                        'matched_file': matched_file
                    })
                    print(f"  ✅ '{req['name']}' → '{matched_file['name']}'")
                else:
                    missing.append({**req, 'status': 'missing'})
                    print(f"  ❌ '{req['name']}' → archivo no encontrado")

        total_required = len(required_docs)
        total_found    = len(found)
        total_missing  = len(missing)
        compliance_pct = round(total_found / total_required * 100, 2) if total_required > 0 else 0

        return {
            'total_required':        total_required,
            'total_found':           total_found,
            'total_missing':         total_missing,
            'compliance_percentage': compliance_pct,
            'found_documents':       found,
            'missing_documents':     missing,
            'status': 'compliant' if total_missing == 0 else 'non_compliant'
        }

    # ──────────────────────────────────────────────
    # Punto de entrada principal
    # ──────────────────────────────────────────────

    def validate_folder_structure(self, folder_id: str) -> Dict[str, Any]:
        """
        Valida la estructura completa de una carpeta de curso.
        """
        try:
            print(f"\n🔍 Iniciando validación de carpeta: {folder_id}")

            # 1. Localizar la matriz
            matrix_id = self.find_matrix_file(folder_id)
            if not matrix_id:
                return {
                    'success': False,
                    'has_matrix': False,
                    'error': 'No se encontró "Matriz observaciones estructura.xlsx" en la carpeta'
                }
            print(f"✅ Matriz encontrada: {matrix_id}")

            # 2. Leer el Excel
            df = self.read_matrix_excel(matrix_id)
            if df is None:
                return {
                    'success': False,
                    'has_matrix': True,
                    'error': 'No se pudo leer el archivo de matriz'
                }
            print(f"📊 Excel leído: {len(df)} filas")

            # 3. Extraer documentos requeridos (omitiendo secciones)
            required_docs = self.extract_required_documents(df)
            if not required_docs:
                return {
                    'success': False,
                    'has_matrix': True,
                    'error': 'La matriz no contiene documentos requeridos válidos'
                }

            # 4. Obtener archivos directos y TODAS las carpetas (recursivo)
            existing_files        = self.get_existing_files(folder_id)
            all_folders_recursive = self.get_all_folders_recursive(folder_id)
            print(f"📁 Archivos directos: {len(existing_files)} | Carpetas totales (all levels): {len(all_folders_recursive)}")

            # 5. Comparar y generar reporte
            comparison = self.compare_documents(required_docs, existing_files, all_folders_recursive)

            return {
                'success':    True,
                'has_matrix': True,
                'folder_id':  folder_id,
                **comparison
            }

        except Exception as e:
            print(f"❌ Error en validación: {e}")
            return {
                'success': False,
                'has_matrix': False,
                'error': str(e)
            }


# Instancia global
structure_validation_service = StructureValidationService()
