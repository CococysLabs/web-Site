"""
Servicio de integración con Google Drive
"""
import os
from typing import List, Optional, Dict
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload, MediaIoBaseUpload
import io

from app.config import settings


class GoogleDriveService:
    """Servicio para interactuar con Google Drive API"""
    
    def __init__(self):
        """Inicializar servicio de Drive"""
        self.scopes = ['https://www.googleapis.com/auth/drive']
        self.service = None
        self._initialize_service()
    
    def _initialize_service(self):
        """Inicializar conexión con Drive API"""
        try:
            # Verificar si existe el archivo de credenciales
            credentials_file = getattr(settings, 'GOOGLE_CREDENTIALS_FILE', None)
            
            if credentials_file and os.path.exists(credentials_file):
                credentials = service_account.Credentials.from_service_account_file(
                    credentials_file,
                    scopes=self.scopes
                )
                self.service = build('drive', 'v3', credentials=credentials)
            else:
                print("⚠️  Google Drive credentials not configured")
                # Por ahora permitimos que funcione sin credenciales para desarrollo
                self.service = None
        except Exception as e:
            print(f"❌ Error initializing Drive service: {e}")
            self.service = None
    
    def list_folders(self, parent_folder_id: Optional[str] = None) -> List[Dict]:
        """Listar carpetas en Drive"""
        if not self.service:
            return []
        
        try:
            query = "mimeType='application/vnd.google-apps.folder'"
            if parent_folder_id:
                query += f" and '{parent_folder_id}' in parents"
            
            query += " and trashed=false"
            
            results = self.service.files().list(
                q=query,
                fields="files(id, name, webViewLink, createdTime, modifiedTime)",
                orderBy="name"
            ).execute()
            
            return results.get('files', [])
        except Exception as e:
            print(f"Error listing folders: {e}")
            return []
    
    def list_files(self, folder_id: str, file_types: Optional[List[str]] = None) -> List[Dict]:
        """Listar archivos en una carpeta"""
        if not self.service:
            return []
        
        try:
            query = f"'{folder_id}' in parents and trashed=false"
            
            # Filtrar por tipo de archivo
            if file_types:
                mime_types = []
                for file_type in file_types:
                    if file_type.lower() == 'pdf':
                        mime_types.append("mimeType='application/pdf'")
                    elif file_type.lower() == 'excel':
                        mime_types.append("mimeType='application/vnd.ms-excel'")
                        mime_types.append("mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'")
                
                if mime_types:
                    query += " and (" + " or ".join(mime_types) + ")"
            
            results = self.service.files().list(
                q=query,
                fields="files(id, name, mimeType, size, webViewLink, createdTime, modifiedTime, owners)",
                orderBy="name"
            ).execute()
            
            return results.get('files', [])
        except Exception as e:
            print(f"Error listing files: {e}")
            return []
    
    def get_file_metadata(self, file_id: str) -> Optional[Dict]:
        """Obtener metadatos de un archivo"""
        if not self.service:
            return None
        
        try:
            file = self.service.files().get(
                fileId=file_id,
                fields="id, name, mimeType, size, webViewLink, createdTime, modifiedTime, owners"
            ).execute()
            return file
        except Exception as e:
            print(f"Error getting file metadata: {e}")
            return None
    
    def download_file(self, file_id: str) -> Optional[bytes]:
        """Descargar un archivo de Drive"""
        if not self.service:
            return None
        
        try:
            request = self.service.files().get_media(fileId=file_id)
            file_buffer = io.BytesIO()
            downloader = MediaIoBaseDownload(file_buffer, request)
            
            done = False
            while not done:
                status, done = downloader.next_chunk()
            
            file_buffer.seek(0)
            return file_buffer.read()
        except Exception as e:
            print(f"Error downloading file: {e}")
            return None
    
    def search_files(self, query: str, folder_id: Optional[str] = None) -> List[Dict]:
        """Buscar archivos por nombre"""
        if not self.service:
            return []
        
        try:
            search_query = f"name contains '{query}' and trashed=false"
            
            if folder_id:
                search_query += f" and '{folder_id}' in parents"
            
            results = self.service.files().list(
                q=search_query,
                fields="files(id, name, mimeType, size, webViewLink)",
                orderBy="name"
            ).execute()
            
            return results.get('files', [])
        except Exception as e:
            print(f"Error searching files: {e}")
            return []
    
    def upload_file(self, file_bytes: bytes, mime_type: str, existing_file_id: str) -> bool:
        """
        Actualiza el contenido de un archivo existente en Drive.
        Preserva el file ID, permisos y historial de versiones.
        """
        if not self.service:
            return False
        try:
            media = MediaIoBaseUpload(io.BytesIO(file_bytes), mimetype=mime_type)
            self.service.files().update(
                fileId=existing_file_id,
                media_body=media
            ).execute()
            print(f"✅ Archivo actualizado en Drive: {existing_file_id}")
            return True
        except Exception as e:
            print(f"Error actualizando archivo en Drive: {e}")
            return False

    def get_folder_structure(self, folder_id: str, depth: int = 2) -> Dict:
        """Obtener estructura de carpetas recursivamente"""
        if not self.service or depth <= 0:
            return {}
        
        try:
            folder_info = self.get_file_metadata(folder_id)
            if not folder_info:
                return {}
            
            structure = {
                'id': folder_info['id'],
                'name': folder_info['name'],
                'type': 'folder',
                'children': []
            }
            
            # Obtener subcarpetas
            folders = self.list_folders(folder_id)
            for folder in folders:
                if depth > 1:
                    subfolder_structure = self.get_folder_structure(folder['id'], depth - 1)
                    structure['children'].append(subfolder_structure)
                else:
                    structure['children'].append({
                        'id': folder['id'],
                        'name': folder['name'],
                        'type': 'folder'
                    })
            
            # Obtener archivos
            files = self.list_files(folder_id)
            for file in files:
                structure['children'].append({
                    'id': file['id'],
                    'name': file['name'],
                    'type': 'file',
                    'mimeType': file.get('mimeType'),
                    'size': file.get('size')
                })
            
            return structure
        except Exception as e:
            print(f"Error getting folder structure: {e}")
            return {}


# Instancia singleton del servicio
drive_service = GoogleDriveService()
