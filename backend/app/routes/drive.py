"""
Rutas de Google Drive
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel

from app.database import get_db
from app.models.user import User, UserRole
from app.models.validation import DriveFolder
from app.services.drive_service import drive_service
from app.utils.auth import get_current_user

router = APIRouter(prefix="/api/drive", tags=["drive"])


# Schemas
class FolderResponse(BaseModel):
    id: str
    name: str
    webViewLink: Optional[str] = None
    createdTime: Optional[str] = None
    
    class Config:
        from_attributes = True


class FileResponse(BaseModel):
    id: str
    name: str
    mimeType: str
    size: Optional[str] = None
    webViewLink: Optional[str] = None
    
    class Config:
        from_attributes = True


class SyncFolderRequest(BaseModel):
    folder_id: str
    folder_name: str
    auto_sync: bool = False


@router.get("/main-folders", response_model=List[FolderResponse])
async def list_main_folders(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Listar carpetas principales configuradas en GOOGLE_DRIVE_FOLDER_ID
    Retorna: BD, Computación, Sistemas, Software
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo administradores pueden acceder"
        )
    
    from app.config import settings
    from app.services.settings_service import settings_service
    # Preferir el valor guardado en BD; fallback al env
    folder_id = settings_service.get("drive_root_folder_id", db) or settings.GOOGLE_DRIVE_FOLDER_ID

    if not folder_id:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Carpeta raíz de Drive no configurada. Configúrala en Ajustes del Sistema."
        )
    
    folders = drive_service.list_folders(folder_id)
    return folders


@router.get("/folders", response_model=List[FolderResponse])
async def list_folders(
    parent_folder_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Listar carpetas de Google Drive
    Solo accesible por administradores
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo administradores pueden acceder"
        )
    
    folders = drive_service.list_folders(parent_folder_id)
    return folders


@router.get("/files/{folder_id}", response_model=List[FileResponse])
async def list_files(
    folder_id: str,
    file_types: Optional[str] = None,  # Ej: "pdf,excel"
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Listar archivos en una carpeta de Drive
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo administradores pueden acceder"
        )
    
    # Parsear tipos de archivo
    types_list = None
    if file_types:
        types_list = [t.strip() for t in file_types.split(",")]
    
    files = drive_service.list_files(folder_id, types_list)
    return files


@router.get("/contents/{folder_id}")
async def list_contents(
    folder_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Listar carpetas y archivos en una carpeta de Drive (navegación jerárquica)
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo administradores pueden acceder"
        )
    
    # Obtener carpetas y archivos
    folders = drive_service.list_folders(folder_id)
    files = drive_service.list_files(folder_id)

    return {
        'folders': folders,
        'files': files
    }


@router.post("/sync-folder")
async def sync_folder(
    request: SyncFolderRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Sincronizar una carpeta de Drive con el sistema
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo administradores pueden sincronizar carpetas"
        )
    
    # Verificar si ya existe
    existing = db.query(DriveFolder).filter(
        DriveFolder.folder_id == request.folder_id
    ).first()
    
    if existing:
        existing.is_active = True
        existing.auto_sync = request.auto_sync
        existing.folder_name = request.folder_name
        db.commit()
        return {"message": "Carpeta actualizada", "folder": existing}
    
    # Crear nueva carpeta sincronizada
    new_folder = DriveFolder(
        folder_id=request.folder_id,
        folder_name=request.folder_name,
        auto_sync=request.auto_sync,
        is_active=True
    )
    
    db.add(new_folder)
    db.commit()
    db.refresh(new_folder)
    
    return {"message": "Carpeta sincronizada exitosamente", "folder": new_folder}


@router.get("/synced-folders")
async def get_synced_folders(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Obtener carpetas sincronizadas"""
    folders = db.query(DriveFolder).filter(DriveFolder.is_active == True).all()
    return folders


@router.get("/folder-structure/{folder_id}")
async def get_folder_structure(
    folder_id: str,
    depth: int = 2,
    current_user: User = Depends(get_current_user)
):
    """
    Obtener estructura completa de una carpeta
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo administradores pueden acceder"
        )
    
    structure = drive_service.get_folder_structure(folder_id, depth)
    return structure


@router.get("/search")
async def search_files(
    query: str,
    folder_id: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Buscar archivos en Drive"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo administradores pueden buscar"
        )
    
    files = drive_service.search_files(query, folder_id)
    return files
