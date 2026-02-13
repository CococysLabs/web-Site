"""
Rutas de documentos
"""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel
import uuid

from app.database import get_db
from app.models.user import User, UserRole
from app.models.document import Document, DocumentStatus, DocumentType
from app.models.validation import ValidationCriteria
from app.services.drive_service import drive_service
from app.services.analysis_service import analysis_service
from app.utils.auth import get_current_user

router = APIRouter(prefix="/api/documents", tags=["documents"])


# Schemas
class DocumentResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str]
    type: DocumentType
    status: DocumentStatus
    is_valid: bool
    drive_web_view_link: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True


class AnalyzeDocumentRequest(BaseModel):
    document_id: uuid.UUID
    criteria_id: Optional[uuid.UUID] = None


class ValidationCriteriaCreate(BaseModel):
    name: str
    description: Optional[str] = None
    required_sections: List[str]
    min_pages: int = 1
    max_pages: Optional[int] = None


@router.get("/", response_model=List[DocumentResponse])
async def list_documents(
    status_filter: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Listar documentos"""
    query = db.query(Document)
    
    # Filtrar por usuario si no es admin
    if current_user.role != UserRole.ADMIN:
        query = query.filter(Document.uploaded_by == current_user.id)
    
    # Filtrar por estado
    if status_filter:
        query = query.filter(Document.status == status_filter)
    
    documents = query.order_by(Document.created_at.desc()).all()
    return documents


@router.post("/import-from-drive/{file_id}")
async def import_from_drive(
    file_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Importar un documento desde Google Drive
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo administradores pueden importar"
        )
    
    # Obtener metadata del archivo
    file_metadata = drive_service.get_file_metadata(file_id)
    if not file_metadata:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Archivo no encontrado en Drive"
        )
    
    # Verificar si ya existe
    existing = db.query(Document).filter(
        Document.drive_file_id == file_id
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este documento ya ha sido importado"
        )
    
    # Determinar tipo de documento
    mime_type = file_metadata.get('mimeType', '')
    doc_type = DocumentType.PDF
    if 'pdf' in mime_type:
        doc_type = DocumentType.PDF
    elif 'spreadsheet' in mime_type or 'excel' in mime_type:
        doc_type = DocumentType.EXCEL
    elif 'document' in mime_type or 'word' in mime_type:
        doc_type = DocumentType.WORD
    elif 'presentation' in mime_type or 'powerpoint' in mime_type:
        doc_type = DocumentType.POWERPOINT
    
    # Crear documento
    new_document = Document(
        name=file_metadata['name'],
        type=doc_type,
        drive_file_id=file_id,
        drive_web_view_link=file_metadata.get('webViewLink'),
        file_size=file_metadata.get('size'),
        mime_type=mime_type,
        status=DocumentStatus.PENDING,
        uploaded_by=current_user.id
    )
    
    db.add(new_document)
    db.commit()
    db.refresh(new_document)
    
    return {
        "message": "Documento importado exitosamente",
        "document": new_document
    }


@router.post("/analyze/{document_id}")
async def analyze_document(
    document_id: uuid.UUID,
    criteria_id: Optional[uuid.UUID] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Analizar un documento con Gemini
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo administradores pueden analizar documentos"
        )
    
    # Buscar documento
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Documento no encontrado"
        )
    
    # Actualizar estado
    document.status = DocumentStatus.ANALYZING
    db.commit()
    
    try:
        # Descargar archivo de Drive
        if not document.drive_file_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Documento no tiene ID de Drive"
            )
        
        file_content = drive_service.download_file(document.drive_file_id)
        if not file_content:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No se pudo descargar el archivo"
            )
        
        # Obtener criterios de validación
        required_sections = ["Bienvenida", "Agenda", "Competencias", "Contenido", "Cierre"]
        
        if criteria_id:
            criteria = db.query(ValidationCriteria).filter(
                ValidationCriteria.id == criteria_id
            ).first()
            if criteria:
                required_sections = criteria.required_sections
        
        # Analizar documento
        analysis_result = analysis_service.analyze_document_structure(
            file_content,
            required_sections
        )
        
        # Actualizar documento con resultados
        document.analysis_result = analysis_result
        document.is_valid = analysis_result.get('is_valid', False)
        document.status = DocumentStatus.COMPLETED
        document.analyzed_at = datetime.utcnow()
        
        if not analysis_result.get('is_valid'):
            document.validation_errors = {
                "missing_sections": analysis_result.get('missing_sections', [])
            }
        
        db.commit()
        db.refresh(document)
        
        return {
            "message": "Análisis completado",
            "document": document,
            "analysis": analysis_result
        }
        
    except Exception as e:
        document.status = DocumentStatus.FAILED
        document.validation_errors = {"error": str(e)}
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error analizando documento: {str(e)}"
        )


@router.get("/criteria", response_model=List[ValidationCriteriaCreate])
async def list_criteria(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Listar criterios de validación"""
    criteria = db.query(ValidationCriteria).filter(
        ValidationCriteria.is_active == True
    ).all()
    return criteria


@router.post("/criteria")
async def create_criteria(
    criteria: ValidationCriteriaCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Crear criterio de validación (solo admin)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo administradores"
        )
    
    new_criteria = ValidationCriteria(
        name=criteria.name,
        description=criteria.description,
        required_sections=criteria.required_sections,
        min_pages=criteria.min_pages,
        max_pages=criteria.max_pages
    )
    
    db.add(new_criteria)
    db.commit()
    db.refresh(new_criteria)
    
    return {"message": "Criterio creado", "criteria": new_criteria}


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Obtener detalles de un documento"""
    document = db.query(Document).filter(Document.id == document_id).first()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Documento no encontrado"
        )
    
    # Verificar permisos
    if current_user.role != UserRole.ADMIN and document.uploaded_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permiso para ver este documento"
        )
    
    return document
