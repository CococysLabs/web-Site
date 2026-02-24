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


# ─── Validación de CONTENIDO ──────────────────────────────────────────────────

class ValidateContentRequest(BaseModel):
    semana_folder_id: str          # ID de la carpeta Semana_X a analizar
    semana_folder_name: str        # Nombre de la carpeta (para derivar la sección)
    matrix_folder_id: str          # ID principal candidato (padre de Semana)
    candidate_folder_ids: Optional[list] = []  # Todos los IDs de la jerarquía a probar


@router.post("/validate-content")
async def validate_document_content(
    request: ValidateContentRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Validar el CONTENIDO de los documentos en una carpeta Semana_X.

    Flujo:
    1. Deriva la sección desde semana_folder_name (ej. "Semana_2" → "Semana 2")
    2. Lee la 2da hoja ("Matriz observaciones") del Excel en matrix_folder_id
    3. Filtra requisitos de esa sección donde Aplica == "Si"
    4. Descarga y extrae texto de todos los PDF/DOCX/PPTX de semana_folder_id
    5. Usa Gemini AI para verificar si cada sub-sección está implícitamente cubierta
    6. Escribe resultados ("Presente", "Observaciones") de vuelta al Excel en Drive
    7. Retorna reporte consolidado

    Solo accesible por administradores. Puede tardar 30-120 segundos según
    el número de documentos y requisitos.
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo administradores pueden validar contenido"
        )

    try:
        from app.services.document_content_validation_service import document_content_validation_service
        # Construir lista de candidatos: primero el principal, luego los adicionales
        candidates = [request.matrix_folder_id]
        for fid in (request.candidate_folder_ids or []):
            if fid not in candidates:
                candidates.append(fid)
        result = document_content_validation_service.validate_folder_content(
            semana_folder_id=request.semana_folder_id,
            semana_folder_name=request.semana_folder_name,
            candidate_folder_ids=candidates,
            db=db
        )
        return result
    except Exception as e:
        print(f"❌ Error validando contenido: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al validar contenido: {str(e)}"
        )


@router.get("/health-check")
async def validation_health_check():
    """Verificar estado del servicio de validación"""
    return {
        "service": "validation",
        "status": "ready",
        "message": "Servicio de validación de estructura activo"
    }
