"""
Endpoint para analizar documentos desde Google Drive
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any
from pydantic import BaseModel
import uuid

from app.database import get_db
from app.models.user import User, UserRole
from app.models.document import Document, DocumentStatus, DocumentType
from app.models.analysis_log import AnalysisLog
from app.services.drive_service import drive_service
from app.services.analysis_service import analysis_service
from app.utils.auth import get_current_user

router = APIRouter(prefix="/api/analysis", tags=["analysis"])


def _save_analysis_log(db: Session, user_id, user_name: str, analyzed_what: str,
                       analysis_type: str, provider: str, key_source: str,
                       status: str = "completed", score: float = None,
                       drive_file_id: str = None, course_name: str = None):
    try:
        log = AnalysisLog(
            user_id=user_id,
            user_name=user_name,
            analyzed_what=analyzed_what,
            drive_file_id=drive_file_id,
            analysis_type=analysis_type,
            provider=provider,
            key_source=key_source,
            status=status,
            score=score,
            course_name=course_name,
        )
        db.add(log)
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"⚠️  No se pudo guardar analysis_log: {e}")


def _ensure_analysis_permission(current_user: User):
    is_admin = current_user.role == UserRole.ADMIN
    perms = getattr(current_user, "permissions", None) or {}
    if not is_admin and not perms.get("can_analyze", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permiso para analizar documentos"
        )


def _ensure_folder_scope_for_user(current_user: User, folder_id: Optional[str]):
    if current_user.role == UserRole.ADMIN:
        return

    if not folder_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="folder_id es requerido para usuarios no administradores"
        )

    user_root_folder_id = getattr(current_user, "drive_folder_id", None)
    if not user_root_folder_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes una carpeta de Drive asignada"
        )

    if not drive_service.is_descendant_or_same(folder_id, user_root_folder_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permiso para analizar archivos fuera de tu carpeta asignada"
        )


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
    _ensure_analysis_permission(current_user)
    _ensure_folder_scope_for_user(current_user, request.folder_id)

    if current_user.role != UserRole.ADMIN and not drive_service.file_belongs_to_folder(request.file_id, request.folder_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="El archivo no pertenece a la carpeta indicada"
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

        # Verificar que sea un formato soportado (incluyendo Google Workspace nativos)
        from app.services.analysis_service import SUPPORTED_MIMES
        if mime_type not in SUPPORTED_MIMES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Formato no soportado: {mime_type}. Se aceptan PDF, DOCX, PPTX, XLSX, TXT y archivos de Google Workspace."
            )

        # Descargar (o exportar si es Google Workspace)
        print(f"📥 Descargando: {file_name} ({mime_type})")
        file_content = drive_service.download_file(request.file_id)

        if not file_content:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al descargar el archivo desde Drive"
            )

        # Para archivos de Google Workspace, el mime efectivo es el formato exportado
        effective_mime = drive_service.get_effective_mime(mime_type)

        # Analizar el documento completo
        print(f"🔍 Analizando: {file_name} (effective mime: {effective_mime})")
        analysis_result = analysis_service.analyze_complete(
            file_content, effective_mime,
            db=db, user_id=current_user.id
        )
        
        # Guardar o actualizar en la base de datos
        existing_doc = db.query(Document).filter(
            Document.drive_file_id == request.file_id
        ).first()
        
        # Determinar DocumentType a partir del mime efectivo
        if 'wordprocessingml' in effective_mime or 'google-apps.document' in mime_type:
            doc_type = DocumentType.WORD
        elif 'presentationml' in effective_mime or 'google-apps.presentation' in mime_type:
            doc_type = DocumentType.POWERPOINT
        elif 'spreadsheetml' in effective_mime or 'google-apps.spreadsheet' in mime_type:
            doc_type = DocumentType.EXCEL
        else:
            doc_type = DocumentType.PDF

        if existing_doc:
            existing_doc.analysis_result = analysis_result
            existing_doc.status = DocumentStatus.COMPLETED
            db.commit()
        else:
            new_doc = Document(
                name=file_name,
                type=doc_type,
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

        # Registrar en historial de análisis
        _save_analysis_log(
            db=db,
            user_id=current_user.id,
            user_name=f"{current_user.nombre} {current_user.apellidos}",
            analyzed_what=file_name,
            drive_file_id=request.file_id,
            analysis_type="document",
            provider=analysis_service.provider_name,
            key_source=analysis_service.key_source,
            score=analysis_result.get("quality", {}).get("score"),
        )

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


@router.get("/history")
async def get_analysis_history(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    analysis_type: Optional[str] = Query(None, description="document|structure|content|course"),
    user_id: Optional[str] = Query(None, description="Filtrar por usuario (solo admin)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Historial de análisis.
    - Usuarios: ven solo sus propios registros.
    - Admins: ven todo el sistema; pueden filtrar por user_id.
    """
    query = db.query(AnalysisLog)

    if current_user.role != UserRole.ADMIN:
        query = query.filter(AnalysisLog.user_id == current_user.id)
    elif user_id:
        try:
            query = query.filter(AnalysisLog.user_id == uuid.UUID(user_id))
        except ValueError:
            pass

    if analysis_type:
        query = query.filter(AnalysisLog.analysis_type == analysis_type)

    total = query.count()
    records = (
        query.order_by(desc(AnalysisLog.created_at))
        .offset(offset)
        .limit(limit)
        .all()
    )

    return {
        "total": total,
        "offset": offset,
        "limit": limit,
        "records": [
            {
                "id": str(r.id),
                "user_id": str(r.user_id) if r.user_id else None,
                "user_name": r.user_name or "—",
                "analyzed_what": r.analyzed_what,
                "analysis_type": r.analysis_type,
                "provider": r.provider,
                "key_source": r.key_source,
                "status": r.status,
                "score": r.score,
                "course_name": r.course_name,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in records
        ],
    }
