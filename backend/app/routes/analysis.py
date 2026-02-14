"""
Endpoint para analizar documentos desde Google Drive
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any
from pydantic import BaseModel
import uuid

from app.database import get_db
from app.models.user import User, UserRole
from app.models.document import Document, DocumentStatus, DocumentType
from app.services.drive_service import drive_service
from app.services.analysis_service import analysis_service
from app.utils.auth import get_current_user

router = APIRouter(prefix="/api/analysis", tags=["analysis"])


# Schemas
class AnalyzeFileRequest(BaseModel):
    file_id: str
    folder_id: Optional[str] = None


class AnalysisResponse(BaseModel):
    success: bool
    file_name: str
    analysis: Dict[str, Any]
    message: str


@router.post("/analyze-drive-file", response_model=AnalysisResponse)
async def analyze_drive_file(
    request: AnalyzeFileRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Analizar un archivo directamente desde Google Drive
    
    Realiza análisis de:
    1. Existencia y validez
    2. Estructura (secciones, tabla de contenidos, etc.)
    3. Contexto (resumen, temas, idioma, etc.)
    """
    # Verificar permisos (solo admin)
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo administradores pueden analizar documentos"
        )
    
    try:
        # Obtener metadata del archivo
        file_metadata = drive_service.get_file_metadata(request.file_id)
        if not file_metadata:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Archivo no encontrado en Drive"
            )
        
        file_name = file_metadata.get('name', 'Unknown')
        mime_type = file_metadata.get('mimeType', '')
        
        # Verificar que sea PDF
        if 'pdf' not in mime_type.lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Solo se pueden analizar archivos PDF. Tipo detectado: {mime_type}"
            )
        
        # Descargar el archivo
        print(f"📥 Descargando: {file_name}")
        file_content = drive_service.download_file(request.file_id)
        
        if not file_content:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al descargar el archivo desde Drive"
            )
        
        # Analizar el documento completo
        print(f"🔍 Analizando: {file_name}")
        analysis_result = analysis_service.analyze_complete(file_content)
        
        # Guardar o actualizar en la base de datos
        existing_doc = db.query(Document).filter(
            Document.drive_file_id == request.file_id
        ).first()
        
        if existing_doc:
            # Actualizar documento existente
            existing_doc.analysis_result = analysis_result
            existing_doc.status = DocumentStatus.COMPLETED
            db.commit()
        else:
            # Crear nuevo documento
            new_doc = Document(
                name=file_name,
                type=DocumentType.PDF,
                drive_file_id=request.file_id,
                drive_folder_id=request.folder_id,
                drive_web_view_link=file_metadata.get('webViewLink'),
                file_size=file_metadata.get('size'),
                mime_type=mime_type,
                analysis_result=analysis_result,
                status=DocumentStatus.COMPLETED,
                uploaded_by=current_user.id
            )
            db.add(new_doc)
            db.commit()
        
        return AnalysisResponse(
            success=True,
            file_name=file_name,
            analysis=analysis_result,
            message=f"Análisis completado exitosamente para: {file_name}"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error analyzing document: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al analizar documento: {str(e)}"
        )


@router.get("/document/{document_id}")
async def get_document_analysis(
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Obtener el análisis de un documento guardado"""
    
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
    
    return {
        "id": str(document.id),
        "name": document.name,
        "status": document.status,
        "analysis": document.analysis_result,
        "drive_link": document.drive_web_view_link,
        "created_at": document.created_at.isoformat()
    }


@router.get("/health-check")
async def analysis_health_check():
    """Verificar estado del servicio de análisis"""
    return {
        "service": "analysis",
        "gemini_enabled": analysis_service.enabled,
        "status": "ready" if analysis_service.enabled else "limited",
        "message": "Gemini AI activo" if analysis_service.enabled else "Usando análisis básico (sin Gemini API)"
    }
