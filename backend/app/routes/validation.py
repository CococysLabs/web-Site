"""
Endpoint para validar estructura de carpetas
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any
from pydantic import BaseModel

from app.database import get_db
from app.models.user import User, UserRole
from app.services.structure_validation_service import structure_validation_service
from app.utils.auth import get_current_user

router = APIRouter(prefix="/api/validation", tags=["validation"])


# Schemas
class ValidateFolderRequest(BaseModel):
    folder_id: str


class ValidationResponse(BaseModel):
    success: bool
    has_matrix: bool
    total_required: Optional[int] = None
    total_found: Optional[int] = None
    total_missing: Optional[int] = None
    compliance_percentage: Optional[float] = None
    found_documents: Optional[list] = None
    missing_documents: Optional[list] = None
    status: Optional[str] = None
    error: Optional[str] = None


@router.post("/validate-folder", response_model=ValidationResponse)
async def validate_folder_structure(
    request: ValidateFolderRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Validar estructura de una carpeta de curso
    
    Busca el archivo "Matriz observaciones estructura.xlsx" en la carpeta,
    lee los documentos requeridos y compara con los archivos existentes.
    
    Retorna:
    - Lista de documentos encontrados
    - Lista de documentos faltantes
    - Porcentaje de cumplimiento
    """
    # Verificar permisos (solo admin)
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo administradores pueden validar carpetas"
        )
    
    try:
        # Validar estructura
        result = structure_validation_service.validate_folder_structure(
            request.folder_id
        )
        
        return result
        
    except Exception as e:
        print(f"❌ Error validating folder structure: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al validar estructura: {str(e)}"
        )


@router.get("/health-check")
async def validation_health_check():
    """Verificar estado del servicio de validación"""
    return {
        "service": "validation",
        "status": "ready",
        "message": "Servicio de validación de estructura activo"
    }
