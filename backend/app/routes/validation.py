"""
Endpoints para validar estructura y contenido de carpetas de curso.
Incluye: validate-folder, validate-content, validate-course (lote), history, stats.
"""
import re
import unicodedata
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func as sqlfunc, desc
from typing import Optional, List, Dict, Any
from pydantic import BaseModel

from app.database import get_db
from app.models.user import User, UserRole
from app.models.validation_record import ValidationRecord
from app.services.structure_validation_service import structure_validation_service
from app.services.drive_service import drive_service
from app.utils.auth import get_current_user

router = APIRouter(prefix="/api/validation", tags=["validation"])


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _normalize(name: str) -> str:
    name = re.sub(r'^\d+[\s_\-\.]+', '', str(name).strip())
    name = name.replace('_', ' ').replace('-', ' ')
    name = re.sub(r'\s+', ' ', name).strip().lower()
    nfkd = unicodedata.normalize('NFKD', name)
    return ''.join(c for c in nfkd if not unicodedata.combining(c))


def _is_semana_folder(name: str) -> bool:
    return bool(re.match(r'^semana[\s_]\d+$', _normalize(name)))


def _compliance_status(pct: float) -> str:
    if pct >= 70:
        return "compliant"
    elif pct >= 40:
        return "partial"
    return "low"


def _save_record(db: Session, **kwargs) -> ValidationRecord:
    """Guarda un ValidationRecord en BD. Silencia errores para no interrumpir flujo."""
    try:
        record = ValidationRecord(**kwargs)
        db.add(record)
        db.commit()
        db.refresh(record)
        return record
    except Exception as e:
        db.rollback()
        print(f"⚠️  No se pudo guardar registro de validación: {e}")
        return None


# ─── Schemas ─────────────────────────────────────────────────────────────────

class ValidateFolderRequest(BaseModel):
    folder_id: str
    folder_name: Optional[str] = None   # nombre para el registro de historial
    course_name: Optional[str] = None


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


class ValidateContentRequest(BaseModel):
    semana_folder_id: str
    semana_folder_name: str
    matrix_folder_id: str
    candidate_folder_ids: Optional[list] = []
    course_name: Optional[str] = None


class ValidateCourseRequest(BaseModel):
    course_folder_id: str
    course_name: str
    validation_type: str = "both"   # "structure" | "content" | "both"


# ─── Validate Folder (estructura) ────────────────────────────────────────────

@router.post("/validate-folder", response_model=ValidationResponse)
async def validate_folder_structure(
    request: ValidateFolderRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Validar estructura de una carpeta de curso."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Solo administradores pueden validar carpetas")
    try:
        result = structure_validation_service.validate_folder_structure(request.folder_id)

        # Guardar en historial
        if result.get('success') or result.get('has_matrix') is not None:
            pct = result.get('compliance_percentage', 0) or 0
            _save_record(
                db,
                folder_id    = request.folder_id,
                folder_name  = request.folder_name or request.folder_id,
                course_name  = request.course_name,
                validation_type = "structure",
                compliance_percentage = pct,
                total_items   = result.get('total_required', 0) or 0,
                present_items = result.get('total_found', 0) or 0,
                missing_items = result.get('total_missing', 0) or 0,
                status        = _compliance_status(pct),
                results_json  = result,
                validated_by  = current_user.id,
            )

        return result

    except Exception as e:
        print(f"❌ Error validating folder structure: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"Error al validar estructura: {str(e)}")


# ─── Validate Content ─────────────────────────────────────────────────────────

@router.post("/validate-content")
async def validate_document_content(
    request: ValidateContentRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Validar el CONTENIDO de los documentos en una carpeta Semana_X con Gemini AI."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Solo administradores pueden validar contenido")
    try:
        from app.services.document_content_validation_service import document_content_validation_service
        candidates = [request.matrix_folder_id]
        for fid in (request.candidate_folder_ids or []):
            if fid not in candidates:
                candidates.append(fid)
        result = document_content_validation_service.validate_folder_content(
            semana_folder_id  = request.semana_folder_id,
            semana_folder_name = request.semana_folder_name,
            candidate_folder_ids = candidates,
            db = db
        )

        # Guardar en historial
        if result.get('success'):
            pct = result.get('compliance_percentage', 0) or 0
            _save_record(
                db,
                folder_id    = request.semana_folder_id,
                folder_name  = request.semana_folder_name,
                course_name  = request.course_name,
                validation_type = "content",
                section_name = result.get('section'),
                compliance_percentage = pct,
                total_items   = result.get('total_requirements', 0) or 0,
                present_items = result.get('present_count', 0) or 0,
                missing_items = result.get('absent_count', 0) or 0,
                status        = _compliance_status(pct),
                results_json  = {k: v for k, v in result.items() if k != 'results'},
                documents_analyzed = result.get('documents_analyzed', []),
                excel_updated = result.get('excel_updated', False),
                validated_by  = current_user.id,
            )

        return result
    except Exception as e:
        print(f"❌ Error validando contenido: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"Error al validar contenido: {str(e)}")


# ─── Validate Course (lote) ───────────────────────────────────────────────────

@router.post("/validate-course")
async def validate_course_batch(
    request: ValidateCourseRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Validar todas las carpetas Semana_X de un curso de una sola vez.
    Tipo: 'structure' | 'content' | 'both'
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Solo administradores pueden validar cursos")

    try:
        from app.services.document_content_validation_service import document_content_validation_service

        # 1. Listar subcarpetas del curso
        all_subfolders = drive_service.list_folders(request.course_folder_id)
        semana_folders = [f for f in all_subfolders if _is_semana_folder(f['name'])]

        # Ordenar por número de semana
        def semana_num(f):
            m = re.search(r'\d+', f['name'])
            return int(m.group()) if m else 0
        semana_folders.sort(key=semana_num)

        if not semana_folders:
            return {
                "success": False,
                "error": "No se encontraron carpetas Semana_X en el curso",
                "course_name": request.course_name,
                "total_weeks": 0
            }

        print(f"\n📦 Validación en lote: '{request.course_name}' — {len(semana_folders)} semanas")

        # ── Estructura: se valida UNA VEZ en la carpeta raíz del curso ────────
        # El Excel "Matriz observaciones estructura.xlsx" vive en el root del
        # curso, NO en cada Semana_X. Validarlo por semana siempre fallaría.
        course_structure = None
        if request.validation_type in ("structure", "both"):
            print(f"  📋 Validando estructura del curso en carpeta raíz...")
            struct = structure_validation_service.validate_folder_structure(request.course_folder_id)
            pct_s = struct.get('compliance_percentage', 0) or 0
            course_structure = {
                "success":              struct.get('success', False),
                "compliance_percentage": pct_s,
                "status":               _compliance_status(pct_s),
                "total_required":       struct.get('total_required', 0),
                "total_found":          struct.get('total_found', 0),
                "total_missing":        struct.get('total_missing', 0),
                "missing_documents":    [d.get('name') for d in (struct.get('missing_documents') or [])],
                "error":                struct.get('error'),
            }
            _save_record(
                db,
                folder_id    = request.course_folder_id,
                folder_name  = request.course_name,
                course_name  = request.course_name,
                validation_type = "structure",
                compliance_percentage = pct_s,
                total_items   = struct.get('total_required', 0) or 0,
                present_items = struct.get('total_found', 0) or 0,
                missing_items = struct.get('total_missing', 0) or 0,
                status        = _compliance_status(pct_s),
                results_json  = struct,
                validated_by  = current_user.id,
            )
            print(f"  ✅ Estructura del curso: {pct_s}%")

        # ── Contenido: se valida por cada Semana_X ───────────────────────────
        weeks_results = []
        total_content_compliance = 0.0
        content_weeks_count = 0
        failed = 0

        for folder in semana_folders:
            week_result = {
                "folder_id":             folder['id'],
                "folder_name":           folder['name'],
                "content":               None,
                "compliance_percentage": 0.0,
                "status":                "unknown",
                "error":                 None,
            }

            try:
                if request.validation_type in ("content", "both"):
                    candidates = [request.course_folder_id, folder['id']]
                    content = document_content_validation_service.validate_folder_content(
                        semana_folder_id     = folder['id'],
                        semana_folder_name   = folder['name'],
                        candidate_folder_ids = candidates,
                        db                   = db
                    )
                    if content.get('success'):
                        pct_c = content.get('compliance_percentage', 0) or 0
                        week_result["content"] = {
                            "compliance_percentage": pct_c,
                            "status":               _compliance_status(pct_c),
                            "total_requirements":   content.get('total_requirements', 0),
                            "present_count":        content.get('present_count', 0),
                            "absent_count":         content.get('absent_count', 0),
                            "results":              content.get('results', []),
                        }
                        week_result["compliance_percentage"] = round(pct_c, 1)
                        week_result["status"] = _compliance_status(pct_c)
                        total_content_compliance += pct_c
                        content_weeks_count += 1
                        _save_record(
                            db,
                            folder_id    = folder['id'],
                            folder_name  = folder['name'],
                            course_name  = request.course_name,
                            validation_type = "content",
                            section_name = content.get('section'),
                            compliance_percentage = pct_c,
                            total_items   = content.get('total_requirements', 0) or 0,
                            present_items = content.get('present_count', 0) or 0,
                            missing_items = content.get('absent_count', 0) or 0,
                            status        = _compliance_status(pct_c),
                            results_json  = {k: v for k, v in content.items() if k != 'results'},
                            documents_analyzed = content.get('documents_analyzed', []),
                            excel_updated = content.get('excel_updated', False),
                            validated_by  = current_user.id,
                        )
                    else:
                        week_result["content"] = {"error": content.get('error', 'Sin datos')}

            except Exception as week_err:
                print(f"  ❌ Error en {folder['name']}: {week_err}")
                week_result["error"] = str(week_err)
                failed += 1

            weeks_results.append(week_result)
            print(f"  {'✅' if not week_result['error'] else '⚠️ '} {folder['name']}: {week_result['compliance_percentage']}%")

        completed = len(semana_folders) - failed

        # Promedio global: si hay contenido, usar ese; si solo estructura, usar esa
        if content_weeks_count > 0:
            avg_compliance = round(total_content_compliance / content_weeks_count, 1)
        elif course_structure:
            avg_compliance = round(course_structure['compliance_percentage'], 1)
        else:
            avg_compliance = 0.0

        return {
            "success":            True,
            "course_name":        request.course_name,
            "course_folder_id":   request.course_folder_id,
            "validation_type":    request.validation_type,
            "total_weeks":        len(semana_folders),
            "completed":          completed,
            "failed":             failed,
            "average_compliance": avg_compliance,
            "overall_status":     _compliance_status(avg_compliance),
            "course_structure":   course_structure,
            "weeks":              weeks_results,
        }

    except Exception as e:
        print(f"❌ Error en validación en lote: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"Error en validación de curso: {str(e)}")


# ─── History ─────────────────────────────────────────────────────────────────

@router.get("/history")
async def get_validation_history(
    folder_id:   Optional[str] = Query(None),
    course_name: Optional[str] = Query(None),
    type:        Optional[str] = Query(None),   # "structure" | "content"
    limit:       int           = Query(50, le=200),
    offset:      int           = Query(0),
    current_user: User         = Depends(get_current_user),
    db: Session                = Depends(get_db)
):
    """Historial de validaciones con filtros opcionales."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Solo administradores pueden ver el historial")

    q = db.query(ValidationRecord)
    if folder_id:
        q = q.filter(ValidationRecord.folder_id == folder_id)
    if course_name:
        q = q.filter(ValidationRecord.course_name.ilike(f"%{course_name}%"))
    if type:
        q = q.filter(ValidationRecord.validation_type == type)

    total = q.count()
    records = q.order_by(desc(ValidationRecord.created_at)).offset(offset).limit(limit).all()

    return {
        "total": total,
        "offset": offset,
        "limit": limit,
        "records": [
            {
                "id":                     str(r.id),
                "folder_id":              r.folder_id,
                "folder_name":            r.folder_name,
                "course_name":            r.course_name,
                "validation_type":        r.validation_type,
                "section_name":           r.section_name,
                "compliance_percentage":  r.compliance_percentage,
                "total_items":            r.total_items,
                "present_items":          r.present_items,
                "missing_items":          r.missing_items,
                "status":                 r.status,
                "documents_analyzed":     r.documents_analyzed,
                "excel_updated":          r.excel_updated,
                "created_at":             r.created_at.isoformat() if r.created_at else None,
            }
            for r in records
        ]
    }


# ─── Stats ───────────────────────────────────────────────────────────────────

@router.get("/stats")
async def get_validation_stats(
    course_name: Optional[str] = Query(None),
    days:        int           = Query(30),
    current_user: User         = Depends(get_current_user),
    db: Session                = Depends(get_db)
):
    """Estadísticas de validaciones para el dashboard de reportes."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Solo administradores pueden ver estadísticas")

    since = datetime.now(timezone.utc) - timedelta(days=days)
    q = db.query(ValidationRecord).filter(ValidationRecord.created_at >= since)
    if course_name:
        q = q.filter(ValidationRecord.course_name.ilike(f"%{course_name}%"))

    records = q.order_by(desc(ValidationRecord.created_at)).all()

    total = len(records)
    avg_compliance = round(sum(r.compliance_percentage for r in records) / total, 1) if total else 0.0

    by_type = {"structure": 0, "content": 0}
    by_status = {"compliant": 0, "partial": 0, "low": 0}
    by_week: Dict[str, Dict] = {}

    for r in records:
        by_type[r.validation_type] = by_type.get(r.validation_type, 0) + 1
        by_status[r.status] = by_status.get(r.status, 0) + 1
        key = r.folder_name or r.folder_id
        if key not in by_week:
            by_week[key] = {"count": 0, "total_pct": 0.0, "course": r.course_name}
        by_week[key]["count"] += 1
        by_week[key]["total_pct"] += r.compliance_percentage

    by_week_list = sorted([
        {
            "week":            k,
            "course":          v["course"],
            "count":           v["count"],
            "avg_compliance":  round(v["total_pct"] / v["count"], 1),
        }
        for k, v in by_week.items()
    ], key=lambda x: x["avg_compliance"], reverse=True)

    # Tendencia: agrupar por día
    trend: Dict[str, List[float]] = {}
    for r in records:
        if r.created_at:
            day = r.created_at.strftime("%Y-%m-%d")
            trend.setdefault(day, []).append(r.compliance_percentage)
    trend_list = sorted([
        {"date": d, "avg_compliance": round(sum(vals) / len(vals), 1)}
        for d, vals in trend.items()
    ], key=lambda x: x["date"])

    return {
        "period_days":      days,
        "total_validations": total,
        "average_compliance": avg_compliance,
        "by_type":           by_type,
        "by_status":         by_status,
        "by_week":           by_week_list[:20],
        "trend":             trend_list,
        "recent":            [
            {
                "id":           str(r.id),
                "folder_name":  r.folder_name,
                "course_name":  r.course_name,
                "type":         r.validation_type,
                "compliance":   r.compliance_percentage,
                "status":       r.status,
                "created_at":   r.created_at.isoformat() if r.created_at else None,
            }
            for r in records[:10]
        ]
    }


# ─── Public Summary (visible para todos los autenticados) ────────────────────

@router.get("/public-summary")
async def get_public_validation_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Resumen de validaciones agrupado por curso y semana.
    Accesible a todos los usuarios autenticados (estudiantes, docentes, admins).
    """
    records = (
        db.query(ValidationRecord)
        .order_by(desc(ValidationRecord.created_at))
        .all()
    )

    courses: Dict[str, Any] = {}
    for r in records:
        course = r.course_name or "Sin curso"
        if course not in courses:
            courses[course] = {"weeks": {}, "count": 0, "total_pct": 0.0, "last_validated": None}
        courses[course]["count"] += 1
        courses[course]["total_pct"] += r.compliance_percentage
        if courses[course]["last_validated"] is None:
            courses[course]["last_validated"] = r.created_at

        week = r.folder_name
        if week not in courses[course]["weeks"]:
            courses[course]["weeks"][week] = {"count": 0, "total_pct": 0.0, "last_validated": None}
        courses[course]["weeks"][week]["count"] += 1
        courses[course]["weeks"][week]["total_pct"] += r.compliance_percentage
        if courses[course]["weeks"][week]["last_validated"] is None:
            courses[course]["weeks"][week]["last_validated"] = r.created_at

    summary = []
    for course_name, data in sorted(courses.items()):
        avg = round(data["total_pct"] / data["count"], 1) if data["count"] else 0.0
        weeks = sorted(
            [
                {
                    "week": w,
                    "avg_compliance": round(v["total_pct"] / v["count"], 1),
                    "count": v["count"],
                    "status": _compliance_status(round(v["total_pct"] / v["count"], 1)),
                    "last_validated": v["last_validated"].isoformat() if v["last_validated"] else None,
                }
                for w, v in data["weeks"].items()
            ],
            key=lambda x: x["week"],
        )
        summary.append({
            "course_name": course_name,
            "total_validations": data["count"],
            "avg_compliance": avg,
            "status": _compliance_status(avg),
            "total_weeks": len(weeks),
            "weeks": weeks,
            "last_validated": data["last_validated"].isoformat() if data["last_validated"] else None,
        })

    return {
        "courses": sorted(summary, key=lambda x: x["avg_compliance"], reverse=True),
        "total_validations": len(records),
    }


# ─── Export CSV ───────────────────────────────────────────────────────────────

@router.get("/export")
async def export_validations_csv(
    type: Optional[str] = Query(None),
    days: int = Query(30, ge=1),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Exportar historial de validaciones como CSV (solo admin)
    """
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="No tienes permisos")

    import csv
    from io import StringIO
    from fastapi.responses import StreamingResponse

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    query = db.query(ValidationRecord).filter(ValidationRecord.created_at >= cutoff)
    if type:
        query = query.filter(ValidationRecord.validation_type == type)
    records = query.order_by(desc(ValidationRecord.created_at)).all()

    output = StringIO()
    writer = csv.writer(output)
    writer.writerow([
        'Fecha', 'Carpeta', 'Curso', 'Tipo', 'Cumplimiento (%)',
        'Estado', 'Items Requeridos', 'Items Presentes', 'Items Faltantes'
    ])
    for r in records:
        writer.writerow([
            r.created_at.strftime('%Y-%m-%d %H:%M') if r.created_at else '',
            r.folder_name or '',
            r.course_name or '',
            r.validation_type or '',
            f"{r.compliance_percentage:.1f}" if r.compliance_percentage is not None else '',
            r.status or '',
            r.total_items or 0,
            r.present_items or 0,
            r.missing_items or 0,
        ])
    output.seek(0)
    filename = f"validaciones_{datetime.now(timezone.utc).strftime('%Y%m%d')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ─── Health ───────────────────────────────────────────────────────────────────

@router.get("/health-check")
async def validation_health_check():
    """Verificar estado del servicio de validación"""
    return {"service": "validation", "status": "ready"}
