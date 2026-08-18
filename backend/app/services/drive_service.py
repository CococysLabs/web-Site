"""
Servicio de integración con Google Drive
"""
import io
import os
import json
import traceback
from time import perf_counter
from typing import Dict, List, Optional, Tuple

import httplib2
from google.oauth2 import service_account
from google_auth_httplib2 import AuthorizedHttp
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload, MediaIoBaseUpload
from googleapiclient.errors import HttpError


from app.config import settings

DRIVE_HTTP_TIMEOUT_SECONDS = 120
DRIVE_API_RETRIES = 2

class GoogleDriveService:
    """Servicio para interactuar con Google Drive API"""
    
    def __init__(self):
        """Inicializar servicio de Drive"""
        self.scopes = ['https://www.googleapis.com/auth/drive']
        self.service = None
        self._initialize_service()
    
    def _initialize_service(self):
        """
        Inicializar Google Drive API con un timeout explícito.

        google-api-python-client usa 60 segundos por defecto.
        Para exportar Google Sheets grandes usamos 120 segundos.
        """
        try:
            credentials_file = getattr(
                settings,
                "GOOGLE_CREDENTIALS_FILE",
                None,
            )

            if not credentials_file:
                print(
                    "⚠️ GOOGLE_CREDENTIALS_FILE no está configurado",
                    flush=True,
                )
                self.service = None
                return

            if not os.path.exists(credentials_file):
                print(
                    "⚠️ No existe el archivo de credenciales: "
                    f"{credentials_file}",
                    flush=True,
                )
                self.service = None
                return

            credentials = (
                service_account.Credentials
                .from_service_account_file(
                    credentials_file,
                    scopes=self.scopes,
                )
            )

            http = httplib2.Http(
                timeout=DRIVE_HTTP_TIMEOUT_SECONDS,
            )

            authorized_http = AuthorizedHttp(
                credentials,
                http=http,
            )

            self.service = build(
                "drive",
                "v3",
                http=authorized_http,
                cache_discovery=False,
            )

            print(
                "✅ Google Drive inicializado | "
                f"timeout={DRIVE_HTTP_TIMEOUT_SECONDS}s",
                flush=True,
            )

        except Exception as exc:
            print(
                "❌ Error inicializando Google Drive | "
                f"tipo={type(exc).__name__} | "
                f"mensaje={exc}",
                flush=True,
            )

            traceback.print_exc()
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
                orderBy="name",
                supportsAllDrives=True,
                includeItemsFromAllDrives=True,
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
                orderBy="name",
                supportsAllDrives=True,
                includeItemsFromAllDrives=True,
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
            file = (
                    self.service.files()
                    .get(
                        fileId=file_id,
                        fields=(
                            "id,name,mimeType,size,webViewLink,"
                            "createdTime,modifiedTime,owners"
                        ),
                        supportsAllDrives=True,
                    )
                    .execute(
                        num_retries=DRIVE_API_RETRIES,
                    )
                )
            return file
        except Exception as e:
            print(f"Error getting file metadata: {e}")
            return None
    
    # MIME types de Google Workspace → formato de exportación
    GOOGLE_EXPORT_MAP = {
        'application/vnd.google-apps.document':     'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.google-apps.spreadsheet':  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.google-apps.presentation': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    }

    def get_effective_mime(self, original_mime: str) -> str:
        """
        Para archivos nativos de Google Workspace, retorna el MIME del formato
        exportado (DOCX/XLSX/PPTX). Para el resto, retorna el mismo MIME.
        """
        return self.GOOGLE_EXPORT_MAP.get(original_mime, original_mime)

    def download_file(self, file_id: str) -> Optional[bytes]:
        """
        Descargar o exportar un archivo de Google Drive.

        Los archivos nativos de Google Workspace se exportan:
        - Google Docs -> DOCX
        - Google Sheets -> XLSX
        - Google Slides -> PPTX
        """
        if not self.service:
            print(
                "❌ [DRIVE] Servicio no inicializado",
                flush=True,
            )
            return None

        started_at = perf_counter()

        try:
            print(
                "📥 [DRIVE] Consultando MIME | "
                f"file_id={file_id}",
                flush=True,
            )

            metadata_started_at = perf_counter()

            metadata = (
                self.service.files()
                .get(
                    fileId=file_id,
                    fields="id,name,mimeType,size",
                    supportsAllDrives=True,
                )
                .execute(
                    num_retries=DRIVE_API_RETRIES,
                )
            )

            mime_type = metadata.get("mimeType", "")
            file_name = metadata.get("name", file_id)

            print(
                "✅ [DRIVE] Metadatos recibidos | "
                f"archivo={file_name} | "
                f"mime={mime_type} | "
                f"segundos={perf_counter() - metadata_started_at:.2f}",
                flush=True,
            )

            export_mime = self.GOOGLE_EXPORT_MAP.get(
                mime_type,
            )

            if export_mime:
                print(
                    "📤 [DRIVE] Iniciando exportación | "
                    f"archivo={file_name} | "
                    f"destino={export_mime}",
                    flush=True,
                )

                request = (
                    self.service.files()
                    .export_media(
                        fileId=file_id,
                        mimeType=export_mime,
                    )
                )
            else:
                print(
                    "📥 [DRIVE] Iniciando descarga directa | "
                    f"archivo={file_name}",
                    flush=True,
                )

                request = (
                    self.service.files()
                    .get_media(
                        fileId=file_id,
                        supportsAllDrives=True,
                    )
                )

            file_buffer = io.BytesIO()

            downloader = MediaIoBaseDownload(
                file_buffer,
                request,
            )

            done = False
            chunk_number = 0

            while not done:
                chunk_number += 1
                chunk_started_at = perf_counter()

                print(
                    "📥 [DRIVE] Descargando chunk | "
                    f"numero={chunk_number}",
                    flush=True,
                )

                status, done = downloader.next_chunk(
                    num_retries=DRIVE_API_RETRIES,
                )

                progress = (
                    round(status.progress() * 100, 1)
                    if status is not None
                    else 0
                )

                print(
                    "✅ [DRIVE] Chunk terminado | "
                    f"numero={chunk_number} | "
                    f"progreso={progress}% | "
                    f"segundos={perf_counter() - chunk_started_at:.2f}",
                    flush=True,
                )

            content = file_buffer.getvalue()

            print(
                "✅ [DRIVE] Archivo obtenido | "
                f"archivo={file_name} | "
                f"bytes={len(content)} | "
                f"total_segundos={perf_counter() - started_at:.2f}",
                flush=True,
            )

            return content

        except Exception as exc:
            print(
                "❌ [DRIVE] Error descargando archivo | "
                f"tipo={type(exc).__name__} | "
                f"mensaje={exc} | "
                f"segundos={perf_counter() - started_at:.2f}",
                flush=True,
            )

            traceback.print_exc()
            return None
    
    def export_workspace_file(
        self,
        file_id: str,
        export_mime: str,
    ) -> bytes:
        """
        Exportar temporalmente un archivo nativo de Google Workspace.

        Ejemplo:
            Google Sheets -> application/pdf

        IMPORTANTE:
        - El archivo se mantiene únicamente en memoria.
        - NO crea ningún PDF en Google Drive.
        - NO modifica el archivo original.
        """
        if not self.service:
            raise RuntimeError(
                "El servicio de Google Drive no está inicializado"
            )

        started_at = perf_counter()

        try:
            metadata = (
                self.service.files()
                .get(
                    fileId=file_id,
                    fields="id,name,mimeType",
                    supportsAllDrives=True,
                )
                .execute(
                    num_retries=DRIVE_API_RETRIES
                )
            )

            file_name = metadata.get(
                "name",
                file_id,
            )

            original_mime = metadata.get(
                "mimeType",
                "",
            )

            if not original_mime.startswith(
                "application/vnd.google-apps."
            ):
                raise ValueError(
                    f"'{file_name}' no es un archivo "
                    "nativo de Google Workspace"
                )

            print(
                "📤 [DRIVE] Exportación temporal | "
                f"archivo={file_name} | "
                f"destino={export_mime}",
                flush=True,
            )

            request = self.service.files().export_media(
                fileId=file_id,
                mimeType=export_mime,
            )

            buffer = io.BytesIO()

            downloader = MediaIoBaseDownload(
                buffer,
                request,
            )

            done = False

            while not done:
                _, done = downloader.next_chunk(
                    num_retries=DRIVE_API_RETRIES
                )

            content = buffer.getvalue()

            print(
                "✅ [DRIVE] Exportación temporal terminada | "
                f"archivo={file_name} | "
                f"bytes={len(content)} | "
                f"segundos={perf_counter() - started_at:.2f}",
                flush=True,
            )

            return content

        except Exception as exc:
            print(
                "❌ [DRIVE] Error exportando archivo temporal | "
                f"file_id={file_id} | "
                f"destino={export_mime} | "
                f"tipo={type(exc).__name__} | "
                f"mensaje={exc}",
                flush=True,
            )

            raise
    
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
                orderBy="name",
                supportsAllDrives=True,
                includeItemsFromAllDrives=True,
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
                media_body=media,
                supportsAllDrives=True,
            ).execute()
            print(f"✅ Archivo actualizado en Drive: {existing_file_id}")
            return True
        except Exception as e:
            print(f"Error actualizando archivo en Drive: {e}")
            return False

    def create_file(
        self,
        file_bytes: bytes,
        mime_type: str,
        filename: str,
        parent_folder_id: str,
    ) -> Optional[Dict]:
        """
        Sube un archivo NUEVO a una carpeta de Drive.
        Retorna {'id': str, 'name': str, 'webViewLink': str} o None si falla.

        Nota: Las Service Accounts no tienen cuota de almacenamiento en Drive personal.
        Solo pueden crear archivos en Shared Drives. Si la carpeta es personal, esta
        operación fallará — los resultados de validación se devuelven igual como JSON.
        """
        if not self.service:
            return None
        try:
            metadata = {
                'name': filename,
                'parents': [parent_folder_id],
            }
            media = MediaIoBaseUpload(io.BytesIO(file_bytes), mimetype=mime_type)
            result = self.service.files().create(
                body=metadata,
                media_body=media,
                fields='id, name, webViewLink',
                supportsAllDrives=True,
            ).execute()
            print(f"✅ Reporte guardado en Drive: '{filename}'")
            return result
        except Exception as e:
            err_str = str(e)
            if 'storageQuotaExceeded' in err_str or 'storage quota' in err_str.lower():
                print(
                    "  ℹ️  Reporte no guardado en Drive (carpeta personal — "
                    "las Service Accounts requieren Shared Drive para escribir). "
                    "Los resultados de validación se devuelven normalmente."
                )
            else:
                print(f"  ⚠️  No se pudo guardar reporte en Drive: {e}")
            return None
        
    @staticmethod
    def _format_drive_http_error(exception: HttpError) -> str:
        """
        Extraer el status, mensaje y reason de un HttpError de Google Drive.
        """
        status_code = getattr(
            exception.resp,
            "status",
            "unknown",
        )

        try:
            raw_content = exception.content

            if isinstance(raw_content, bytes):
                raw_content = raw_content.decode(
                    "utf-8",
                    errors="replace",
                )

            payload = json.loads(raw_content)
            error_data = payload.get("error", {})

            message = (
                error_data.get("message")
                or str(exception)
            )

            reasons = [
                item.get("reason")
                for item in error_data.get("errors", [])
                if item.get("reason")
            ]

            reason_text = (
                ", ".join(reasons)
                if reasons
                else "sin reason"
            )

            return (
                f"Google Drive API {status_code}: "
                f"{message} "
                f"(reason: {reason_text})"
            )

        except Exception:
            return (
                f"Google Drive API {status_code}: "
                f"{exception}"
            )


    def create_file_or_raise(
        self,
        file_bytes: bytes,
        mime_type: str,
        filename: str,
        parent_folder_id: str,
    ) -> Dict:
        """
        Crear un archivo en Drive sin ocultar la excepción real.

        Se usa en procesos donde el llamador necesita informar exactamente
        por qué Google Drive rechazó la creación.
        """
        if not self.service:
            raise RuntimeError(
                "El servicio de Google Drive no está inicializado"
            )

        metadata = {
            "name": filename,
            "parents": [parent_folder_id],
        }

        media = MediaIoBaseUpload(
            io.BytesIO(file_bytes),
            mimetype=mime_type,
            resumable=False,
        )

        try:
            result = (
                self.service.files()
                .create(
                    body=metadata,
                    media_body=media,
                    fields="id, name, mimeType, webViewLink, parents",
                    supportsAllDrives=True,
                )
                .execute()
            )

            print(
                f"✅ Archivo creado en Drive: "
                f"{filename} ({result.get('id')})"
            )

            return result

        except HttpError as exception:
            formatted_error = self._format_drive_http_error(
                exception
            )

            print(
                f"❌ No se pudo crear '{filename}' "
                f"en la carpeta {parent_folder_id}: "
                f"{formatted_error}"
            )

            raise RuntimeError(
                formatted_error
            ) from exception

        except Exception as exception:
            print(
                f"❌ Error inesperado creando '{filename}' "
                f"en Drive: {exception}"
            )

            raise RuntimeError(
                f"Error inesperado de Google Drive: {exception}"
            ) from exception

    def find_file_by_prefix(self, folder_id: str, prefix: str) -> Optional[Dict]:
        """
        Busca el primer archivo en una carpeta cuyo nombre empiece con 'prefix'.
        Retorna metadatos {'id', 'name', 'webViewLink'} o None.
        """
        if not self.service:
            return None
        try:
            query = (
                f"'{folder_id}' in parents "
                f"and name contains '{prefix}' "
                f"and trashed=false"
            )
            results = self.service.files().list(
                q=query,
                fields="files(id, name, webViewLink)",
                orderBy="createdTime desc",
                pageSize=1,
                supportsAllDrives=True,
                includeItemsFromAllDrives=True,
            ).execute()
            files = results.get('files', [])
            return files[0] if files else None
        except Exception as e:
            print(f"Error buscando archivo por prefijo: {e}")
            return None

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
        
    def _escape_query_value(self, value: str) -> str:
        """
        Escapa valores usados dentro de queries de Google Drive.
        """
        return str(value or "").replace("\\", "\\\\").replace("'", "\\'")

    def find_folder(self, folder_name: str, parent_folder_id: str) -> Optional[Dict]:
        """
        Busca una carpeta por nombre exacto dentro de un padre específico.
        """
        if not self.service:
            raise RuntimeError("El servicio de Google Drive no está inicializado")

        safe_name = self._escape_query_value(folder_name)
        safe_parent = self._escape_query_value(parent_folder_id)

        query = (
            "mimeType='application/vnd.google-apps.folder' "
            f"and name='{safe_name}' "
            f"and '{safe_parent}' in parents "
            "and trashed=false"
        )

        results = self.service.files().list(
            q=query,
            fields="files(id, name, webViewLink, createdTime, modifiedTime)",
            pageSize=10,
            orderBy="createdTime",
            supportsAllDrives=True,
            includeItemsFromAllDrives=True,
        ).execute()

        folders = results.get("files", [])
        return folders[0] if folders else None

    def create_folder(self, folder_name: str, parent_folder_id: str) -> Dict:
        """
        Crea una carpeta dentro del padre indicado.
        """
        if not self.service:
            raise RuntimeError("El servicio de Google Drive no está inicializado")

        metadata = {
            "name": folder_name,
            "mimeType": "application/vnd.google-apps.folder",
            "parents": [parent_folder_id],
        }

        return self.service.files().create(
            body=metadata,
            fields="id, name, webViewLink, createdTime, modifiedTime",
            supportsAllDrives=True,
        ).execute()

    def get_or_create_folder(
        self,
        folder_name: str,
        parent_folder_id: str,
    ) -> Tuple[Dict, bool]:
        """
        Obtiene una carpeta existente o la crea.

        Retorna:
        - folder metadata
        - True si fue creada
        - False si ya existía
        """
        existing = self.find_folder(folder_name, parent_folder_id)
        if existing:
            return existing, False

        created = self.create_folder(folder_name, parent_folder_id)
        return created, True


# Instancia singleton del servicio
drive_service = GoogleDriveService()
