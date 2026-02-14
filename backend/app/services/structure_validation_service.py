"""
Servicio para validar estructura de carpetas según matriz de observaciones
"""
import pandas as pd
import io
from typing import Dict, List, Optional, Any
from app.services.drive_service import drive_service


class StructureValidationService:
    """Servicio para validar que las carpetas tengan los documentos requeridos"""
    
    MATRIX_FILENAME = "Matriz observaciones estructura.xlsx"
    
    def __init__(self):
        """Inicializar servicio"""
        pass
    
    def find_matrix_file(self, folder_id: str) -> Optional[str]:
        """
        Buscar el archivo de matriz en la carpeta
        
        Args:
            folder_id: ID de la carpeta en Drive
            
        Returns:
            ID del archivo de matriz o None si no existe
        """
        try:
            files = drive_service.list_files(folder_id)
            
            for file in files:
                if file.get('name', '').startswith('Matriz observaciones'):
                    return file.get('id')
            
            return None
        except Exception as e:
            print(f"Error buscando matriz: {e}")
            return None
    
    def read_matrix_excel(self, file_id: str) -> Optional[pd.DataFrame]:
        """
        Leer el archivo Excel de matriz desde Drive
        
        Args:
            file_id: ID del archivo en Drive
            
        Returns:
            DataFrame con los datos o None si hay error
        """
        try:
            # Descargar archivo
            file_content = drive_service.download_file(file_id)
            if not file_content:
                print("No se pudo descargar el archivo de matriz")
                return None
            
            # Leer Excel
            excel_file = io.BytesIO(file_content)
            df = pd.read_excel(excel_file, engine='openpyxl')
            
            return df
        except Exception as e:
            print(f"Error leyendo Excel: {e}")
            return None
    
    def extract_required_documents(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        """
        Extraer lista de documentos requeridos del DataFrame
        
        Args:
            df: DataFrame con los datos de la matriz
            
        Returns:
            Lista de documentos requeridos con metadata
        """
        required_docs = []
        
        try:
            # Buscar columnas relevantes (ajustar según estructura real del Excel)
            # Asumimos columnas como: "Nombre Documento", "Tipo", "Obligatorio", etc.
            
            for index, row in df.iterrows():
                # Saltar filas vacías o headers
                if pd.isna(row.iloc[0]) or str(row.iloc[0]).strip() == '':
                    continue
                
                # Extraer información (ajustar índices según tu Excel)
                doc_info = {
                    'name': str(row.iloc[0]).strip() if not pd.isna(row.iloc[0]) else '',
                    'type': str(row.iloc[1]).strip() if len(row) > 1 and not pd.isna(row.iloc[1]) else 'Desconocido',
                    'required': True,  # Por defecto obligatorio
                    'description': str(row.iloc[2]).strip() if len(row) > 2 and not pd.isna(row.iloc[2]) else '',
                    'row_number': index + 1
                }
                
                # Solo agregar si tiene nombre válido
                if doc_info['name'] and doc_info['name'].lower() not in ['nombre', 'documento', 'archivo']:
                    required_docs.append(doc_info)
            
            print(f"📋 Documentos requeridos encontrados: {len(required_docs)}")
            return required_docs
            
        except Exception as e:
            print(f"Error extrayendo documentos: {e}")
            return []
    
    def get_existing_files(self, folder_id: str) -> List[Dict[str, Any]]:
        """
        Obtener lista de archivos existentes en la carpeta (excluyendo matriz)
        
        Args:
            folder_id: ID de la carpeta
            
        Returns:
            Lista de archivos existentes
        """
        try:
            files = drive_service.list_files(folder_id)
            
            # Filtrar matriz de observaciones
            existing_files = [
                {
                    'id': f.get('id'),
                    'name': f.get('name'),
                    'mimeType': f.get('mimeType'),
                    'size': f.get('size'),
                    'webViewLink': f.get('webViewLink')
                }
                for f in files
                if not f.get('name', '').startswith('Matriz observaciones')
            ]
            
            print(f"📁 Archivos existentes: {len(existing_files)}")
            return existing_files
            
        except Exception as e:
            print(f"Error obteniendo archivos: {e}")
            return []
    
    def compare_documents(
        self, 
        required_docs: List[Dict[str, Any]], 
        existing_files: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Comparar documentos requeridos vs existentes
        
        Args:
            required_docs: Lista de documentos requeridos
            existing_files: Lista de archivos existentes
            
        Returns:
            Diccionario con análisis de cumplimiento
        """
        existing_names = [f['name'].lower() for f in existing_files]
        
        found = []
        missing = []
        
        for req_doc in required_docs:
            req_name = req_doc['name'].lower()
            
            # Buscar coincidencia exacta o parcial
            matched = False
            matched_file = None
            
            for i, existing_name in enumerate(existing_names):
                # Coincidencia exacta
                if req_name == existing_name:
                    matched = True
                    matched_file = existing_files[i]
                    break
                
                # Coincidencia parcial (el nombre requerido está en el archivo existente)
                if req_name in existing_name or existing_name in req_name:
                    matched = True
                    matched_file = existing_files[i]
                    break
            
            if matched:
                found.append({
                    **req_doc,
                    'status': 'found',
                    'matched_file': matched_file
                })
            else:
                missing.append({
                    **req_doc,
                    'status': 'missing'
                })
        
        # Calcular estadísticas
        total_required = len(required_docs)
        total_found = len(found)
        total_missing = len(missing)
        compliance_percentage = (total_found / total_required * 100) if total_required > 0 else 0
        
        return {
            'total_required': total_required,
            'total_found': total_found,
            'total_missing': total_missing,
            'compliance_percentage': round(compliance_percentage, 2),
            'found_documents': found,
            'missing_documents': missing,
            'status': 'compliant' if total_missing == 0 else 'non_compliant'
        }
    
    def validate_folder_structure(self, folder_id: str) -> Dict[str, Any]:
        """
        Validar estructura completa de una carpeta de curso
        
        Args:
            folder_id: ID de la carpeta del curso
            
        Returns:
            Reporte completo de validación
        """
        try:
            print(f"\n🔍 Validando estructura de carpeta: {folder_id}")
            
            # 1. Buscar archivo de matriz
            matrix_file_id = self.find_matrix_file(folder_id)
            if not matrix_file_id:
                return {
                    'success': False,
                    'error': 'No se encontró el archivo "Matriz observaciones estructura.xlsx"',
                    'has_matrix': False
                }
            
            print(f"✅ Matriz encontrada: {matrix_file_id}")
            
            # 2. Leer matriz
            df = self.read_matrix_excel(matrix_file_id)
            if df is None:
                return {
                    'success': False,
                    'error': 'No se pudo leer el archivo de matriz',
                    'has_matrix': True
                }
            
            print(f"📊 Matriz leída: {len(df)} filas")
            
            # 3. Extraer documentos requeridos
            required_docs = self.extract_required_documents(df)
            if not required_docs:
                return {
                    'success': False,
                    'error': 'No se encontraron documentos requeridos en la matriz',
                    'has_matrix': True
                }
            
            # 4. Obtener archivos existentes
            existing_files = self.get_existing_files(folder_id)
            
            # 5. Comparar
            comparison = self.compare_documents(required_docs, existing_files)
            
            return {
                'success': True,
                'has_matrix': True,
                'folder_id': folder_id,
                **comparison
            }
            
        except Exception as e:
            print(f"❌ Error en validación: {e}")
            return {
                'success': False,
                'error': str(e)
            }


# Instancia global
structure_validation_service = StructureValidationService()
