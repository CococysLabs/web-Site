"""
Endpoints para validar estructura y contenido de carpetas de curso.
Incluye: validate-folder, validate-content, validate-course (lote), history, stats.
"""
import re
import unicodedata
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func as sqlfunc, desc
from typing import Optional, List, Dict, Any
from pydantic import BaseModel

from app.database import get_db, SessionLocal
from app.models.user import User, UserRole
from app.models.validation_record import ValidationRecord
from app.models.validation_job import ValidationJob
from app.services.structure_validation_service import structure_validation_service
from app.services.drive_service import drive_service
from app.utils.auth import get_current_user

router = APIRouter(prefix="/api/validation", tags=["validation"])


def _has_permission(current_user: User, permission_key: str) -> bool:
    if current_user.role == UserRole.ADMIN:
        return True
    perms = getattr(current_user, "permissions", None) or {}
    return bool(perms.get(permission_key, False))


def _ensure_user_folder_scope(current_user: User, folder_ids: List[str]):
    """Restringe a estudiantes a su carpeta asignada y subcarpetas."""
    if current_user.role == UserRole.ADMIN:
        return

    user_root_folder_id = getattr(current_user, "drive_folder_id", None)
    if not user_root_folder_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes una carpeta de Drive asignada"
        )

    for folder_id in {fid for fid in folder_ids if fid}:
        if not drive_service.is_descendant_or_same(folder_id, user_root_folder_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permiso para validar carpetas fuera de tu carpeta asignada"
            )


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _normalize(name: str) -> str:
    name = re.sub(r'^\d+[\s_\-\.]+', '', str(name).strip())
    name = name.replace('_', ' ').replace('-', ' ')
    name = re.sub(r'\s+', ' ', name).strip().lower()
    nfkd = unicodedata.normalize('NFKD', name)
    return ''.join(c for c in nfkd if not unicodedata.combining(c))


def _is_semana_folder(name: str) -> bool:
    return bool(re.match(r'^semana\s?\d+', _normalize(name)))


def _is_lab_folder(name: str) -> bool:
    """Detecta carpetas de laboratorio: 6_Proyectos, 7_Practicas, 8_Tareas."""
    norm = _normalize(name)
    return any(k in norm for k in ('proyectos', 'practicas', 'tareas'))


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
    candidate_folder_ids: List[str] = []  # ancestros del curso para localizar la matriz


# ─── Validate Folder (estructura) ────────────────────────────────────────────

@router.post("/validate-folder", response_model=ValidationResponse)
async def validate_folder_structure(
    request: ValidateFolderRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Validar estructura de una carpeta de curso."""
    if not _has_permission(current_user, "can_validate_structure"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="No tienes permiso para validar estructura")
    _ensure_user_folder_scope(current_user, [request.folder_id])
    try:
        result = structure_validation_service.validate_folder_structure(request.folder_id, db=db)

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


# ─── Job helpers ──────────────────────────────────────────────────────────────

def _create_job(db: Session, user_id, job_type: str) -> ValidationJob:
    job = ValidationJob(user_id=user_id, job_type=job_type, status="pending",
                        progress="En cola...")
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def _update_job(job_id, **kwargs):
    """Actualiza el job en una sesión propia (uso desde background tasks)."""
    db = SessionLocal()
    try:
        job = db.query(ValidationJob).filter(ValidationJob.id == job_id).first()
        if job:
            for k, v in kwargs.items():
                setattr(job, k, v)
            if kwargs.get("status") in ("completed", "failed"):
                job.completed_at = datetime.now(timezone.utc)
            db.commit()
    except Exception as e:
        print(f"⚠️  Error actualizando job {job_id}: {e}")
        db.rollback()
    finally:
        db.close()


@router.get("/jobs/{job_id}")
async def get_job_status(
    job_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Consulta el estado de un job de validación en background."""
    import uuid as _uuid
    try:
        jid = _uuid.UUID(job_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="job_id inválido")

    job = db.query(ValidationJob).filter(ValidationJob.id == jid).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job no encontrado")
    if str(job.user_id) != str(current_user.id) and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Sin acceso a este job")

    return {
        "job_id":      str(job.id),
        "status":      job.status,
        "progress":    job.progress,
        "result":      job.result_json,
        "error":       job.error,
        "created_at":  job.created_at.isoformat() if job.created_at else None,
        "completed_at": job.completed_at.isoformat() if job.completed_at else None,
    }


# ─── Validate Content (background) ────────────────────────────────────────────

def _run_content_validation(job_id, semana_folder_id, semana_folder_name,
                             matrix_folder_id, candidate_folder_ids,
                             course_name, user_id):
    """Tarea en background: ejecuta la validación de contenido y guarda resultado."""
    from app.services.document_content_validation_service import document_content_validation_service
    from app.services.settings_service import settings_service
    db = SessionLocal()
    try:
        _update_job(job_id, status="running",
                    progress=f"Verificando caché para '{semana_folder_name}'...")

        # ── Cache check ──────────────────────────────────────────────────────
        cache_minutes = settings_service.get_int("validation_cache_minutes", db, default=60)
        if cache_minutes > 0:
            cutoff = datetime.now(timezone.utc) - timedelta(minutes=cache_minutes)
            cached = (
                db.query(ValidationRecord)
                .filter(
                    ValidationRecord.folder_id == semana_folder_id,
                    ValidationRecord.validation_type == "content",
                    ValidationRecord.created_at >= cutoff,
                )
                .order_by(desc(ValidationRecord.created_at))
                .first()
            )
            if cached and cached.results_json:
                cached_result = dict(cached.results_json)
                cached_result["cached"] = True
                cached_result["cached_at"] = cached.created_at.isoformat()
                _update_job(job_id, status="completed", result_json=cached_result,
                            progress=f"⚡ Resultado del caché ({cache_minutes} min)")
                return

        _update_job(job_id, progress=f"Analizando '{semana_folder_name}' con IA...")

        candidates = [matrix_folder_id]
        for fid in (candidate_folder_ids or []):
            if fid not in candidates:
                candidates.append(fid)

        result = document_content_validation_service.validate_folder_content(
            semana_folder_id     = semana_folder_id,
            semana_folder_name   = semana_folder_name,
            candidate_folder_ids = candidates,
            db                   = db,
            user_id              = user_id,
        )

        if result.get('success'):
            pct = result.get('compliance_percentage', 0) or 0
            _save_record(
                db,
                folder_id    = semana_folder_id,
                folder_name  = semana_folder_name,
                course_name  = course_name,
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
                validated_by  = user_id,
            )

        _update_job(job_id, status="completed", result_json=result,
                    progress="Validación completada")
    except Exception as e:
        print(f"❌ Error en background job {job_id}: {e}")
        _update_job(job_id, status="failed", error=str(e),
                    progress="Error en la validación")
    finally:
        db.close()


@router.post("/validate-content")
async def validate_document_content(
    request: ValidateContentRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Inicia la validación de contenido en background. Retorna job_id para consultar estado."""
    if not _has_permission(current_user, "can_validate_content"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="No tienes permiso para validar contenido")
    _ensure_user_folder_scope(
        current_user,
        [request.semana_folder_id, request.matrix_folder_id] + (request.candidate_folder_ids or [])
    )

    job = _create_job(db, current_user.id, "content")
    background_tasks.add_task(
        _run_content_validation,
        job_id               = job.id,
        semana_folder_id     = request.semana_folder_id,
        semana_folder_name   = request.semana_folder_name,
        matrix_folder_id     = request.matrix_folder_id,
        candidate_folder_ids = request.candidate_folder_ids or [],
        course_name          = request.course_name,
        user_id              = current_user.id,
    )
    return {"job_id": str(job.id), "status": "pending",
            "message": f"Validación de '{request.semana_folder_name}' iniciada"}


# ─── Validate Course (lote) ───────────────────────────────────────────────────

def _run_course_validation(job_id, course_folder_id, course_name,
                            validation_type, candidate_folder_ids, user_id):
    """Tarea en background: valida todas las semanas y labs de un curso."""
    from app.services.document_content_validation_service import document_content_validation_service
    db = SessionLocal()
    try:
        _update_job(job_id, status="running",
                    progress=f"Iniciando validación de curso '{course_name}'...")

        all_subfolders = drive_service.list_folders(course_folder_id)
        semana_folders = [f for f in all_subfolders if _is_semana_folder(f['name'])]

        def semana_num(f):
            m = re.search(r'\d+', f['name'])
            return int(m.group()) if m else 0
        semana_folders.sort(key=semana_num)

        lab_folders = [f for f in all_subfolders if _is_lab_folder(f['name'])]
        lab_folders.sort(key=lambda f: f['name'])

        if not semana_folders and not lab_folders:
            _update_job(job_id, status="completed", progress="Sin carpetas encontradas",
                        result_json={"success": False, "error": "No se encontraron carpetas",
                                     "course_name": course_name, "total_weeks": 0})
            return

        total_folders = len(semana_folders) + len(lab_folders)
        course_structure = None

        if validation_type in ("structure", "both"):
            _update_job(job_id, progress=f"Validando estructura del curso...")
            struct = structure_validation_service.validate_folder_structure(course_folder_id, db=db)
            pct_s = struct.get('compliance_percentage', 0) or 0
            course_structure = {
                "success": struct.get('success', False),
                "compliance_percentage": pct_s,
                "status": _compliance_status(pct_s),
                "total_required": struct.get('total_required', 0),
                "total_found": struct.get('total_found', 0),
                "total_missing": struct.get('total_missing', 0),
                "missing_documents": [d.get('name') for d in (struct.get('missing_documents') or [])],
                "error": struct.get('error'),
            }
            _save_record(db, folder_id=course_folder_id, folder_name=course_name,
                         course_name=course_name, validation_type="structure",
                         compliance_percentage=pct_s, total_items=struct.get('total_required', 0) or 0,
                         present_items=struct.get('total_found', 0) or 0,
                         missing_items=struct.get('total_missing', 0) or 0,
                         status=_compliance_status(pct_s), results_json=struct, validated_by=user_id)

        weeks_results = []
        lab_results = []
        total_content_compliance = 0.0
        content_count = 0
        failed = 0
        candidates = [course_folder_id] + [fid for fid in candidate_folder_ids if fid != course_folder_id]

        all_content_folders = semana_folders + lab_folders
        for idx, folder in enumerate(all_content_folders):
            is_lab = _is_lab_folder(folder['name'])
            _update_job(job_id, progress=f"[{idx+1}/{total_folders}] Analizando '{folder['name']}'...")

            folder_result = {
                "folder_id": folder['id'], "folder_name": folder['name'],
                "content": None, "compliance_percentage": 0.0,
                "status": "unknown", "error": None,
            }
            if is_lab:
                folder_result["folder_type"] = "lab"

            try:
                if validation_type in ("content", "both"):
                    content = document_content_validation_service.validate_folder_content(
                        semana_folder_id=folder['id'], semana_folder_name=folder['name'],
                        candidate_folder_ids=candidates, db=db, user_id=user_id,
                    )
                    if content.get('success'):
                        pct_c = content.get('compliance_percentage', 0) or 0
                        folder_result["content"] = {
                            "compliance_percentage": pct_c, "status": _compliance_status(pct_c),
                            "total_requirements": content.get('total_requirements', 0),
                            "present_count": content.get('present_count', 0),
                            "absent_count": content.get('absent_count', 0),
                            "results": content.get('results', []),
                            **({"groups": content.get('groups', []), "is_lab": True} if is_lab else {}),
                        }
                        folder_result["compliance_percentage"] = round(pct_c, 1)
                        folder_result["status"] = _compliance_status(pct_c)
                        total_content_compliance += pct_c
                        content_count += 1
                        _save_record(db, folder_id=folder['id'], folder_name=folder['name'],
                                     course_name=course_name, validation_type="content",
                                     section_name=content.get('section'),
                                     compliance_percentage=pct_c,
                                     total_items=content.get('total_requirements', 0) or 0,
                                     present_items=content.get('present_count', 0) or 0,
                                     missing_items=content.get('absent_count', 0) or 0,
                                     status=_compliance_status(pct_c),
                                     results_json={k: v for k, v in content.items() if k != 'results'},
                                     documents_analyzed=content.get('documents_analyzed', []),
                                     excel_updated=content.get('excel_updated', False),
                                     validated_by=user_id)
                    else:
                        folder_result["content"] = {"error": content.get('error', 'Sin datos')}
            except Exception as err:
                print(f"  ❌ Error en {folder['name']}: {err}")
                folder_result["error"] = str(err)
                failed += 1

            if is_lab:
                lab_results.append(folder_result)
            else:
                weeks_results.append(folder_result)

        avg_compliance = (round(total_content_compliance / content_count, 1)
                          if content_count > 0 else
                          round(course_structure['compliance_percentage'], 1) if course_structure else 0.0)

        result = {
            "success": True, "course_name": course_name,
            "course_folder_id": course_folder_id, "validation_type": validation_type,
            "total_weeks": len(semana_folders), "total_lab_folders": len(lab_folders),
            "completed": total_folders - failed, "failed": failed,
            "average_compliance": avg_compliance, "overall_status": _compliance_status(avg_compliance),
            "course_structure": course_structure, "weeks": weeks_results, "lab_folders": lab_results,
        }
        _update_job(job_id, status="completed", result_json=result,
                    progress=f"Curso completo — {avg_compliance}% de cumplimiento promedio")
    except Exception as e:
        print(f"❌ Error en background job curso {job_id}: {e}")
        _update_job(job_id, status="failed", error=str(e), progress="Error en la validación")
    finally:
        db.close()


@router.post("/validate-course")
async def validate_course_batch(
    request: ValidateCourseRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Inicia la validación de curso completo en background. Retorna job_id."""
    validation_type = (request.validation_type or "both").lower()
    if validation_type not in {"structure", "content", "both"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="validation_type inválido. Use: structure, content o both")

    if validation_type in ("structure", "both") and not _has_permission(current_user, "can_validate_structure"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="No tienes permiso para validar estructura")
    if validation_type in ("content", "both") and not _has_permission(current_user, "can_validate_content"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="No tienes permiso para validar contenido")

    _ensure_user_folder_scope(current_user, [request.course_folder_id] + (request.candidate_folder_ids or []))

    job = _create_job(db, current_user.id, "course")
    background_tasks.add_task(
        _run_course_validation,
        job_id               = job.id,
        course_folder_id     = request.course_folder_id,
        course_name          = request.course_name,
        validation_type      = validation_type,
        candidate_folder_ids = request.candidate_folder_ids or [],
        user_id              = current_user.id,
    )
    return {"job_id": str(job.id), "status": "pending",
            "message": f"Validación de curso '{request.course_name}' iniciada"}


# ─── History ─────────────────────────────────────────────────────────────────

@router.get("/history")
async def get_validation_history(
    folder_id:   Optional[str] = Query(None),
    course_name: Optional[str] = Query(None),
    type:        Optional[str] = Query(None),   # "structure" | "content"
    limit:       int           = Query(50, le=500),
    offset:      int           = Query(0),
    current_user: User         = Depends(get_current_user),
    db: Session                = Depends(get_db)
):
    """Historial de validaciones con filtros opcionales."""
    is_admin = current_user.role == UserRole.ADMIN
    perms = getattr(current_user, "permissions", None) or {}
    can_any = perms.get("can_validate_structure", False) or perms.get("can_validate_content", False) or perms.get("can_analyze", False)
    if not is_admin and not can_any:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="No tienes permiso para ver el historial")

    q = db.query(ValidationRecord)
    # Estudiantes solo ven sus propios registros
    if not is_admin:
        q = q.filter(ValidationRecord.validated_by == current_user.id)
    if folder_id:
        q = q.filter(ValidationRecord.folder_id == folder_id)
    if course_name:
        q = q.filter(ValidationRecord.course_name.ilike(f"%{course_name}%"))
    if type:
        q = q.filter(ValidationRecord.validation_type == type)

    total = q.count()
    records = q.order_by(desc(ValidationRecord.created_at)).offset(offset).limit(limit).all()

    # Cargar nombres de validadores en un solo query
    validator_ids = list({r.validated_by for r in records if r.validated_by})
    validators: Dict[Any, str] = {}
    if validator_ids:
        users = db.query(User.id, User.nombre, User.apellidos).filter(User.id.in_(validator_ids)).all()
        validators = {str(u.id): f"{u.nombre} {u.apellidos}".strip() for u in users}

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
                "validated_by_name":      validators.get(str(r.validated_by), "—"),
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
    is_admin = current_user.role == UserRole.ADMIN
    perms = getattr(current_user, "permissions", None) or {}
    can_any = perms.get("can_validate_structure", False) or perms.get("can_validate_content", False) or perms.get("can_analyze", False)
    if not is_admin and not can_any:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="No tienes permiso para ver estadísticas")

    since = datetime.now(timezone.utc) - timedelta(days=days)
    q = db.query(ValidationRecord).filter(ValidationRecord.created_at >= since)
    if not is_admin:
        q = q.filter(ValidationRecord.validated_by == current_user.id)
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
    if current_user.role != UserRole.ADMIN:
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


# ─── Teacher Summary ─────────────────────────────────────────────────────────

@router.get("/teacher-summary")
async def get_teacher_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Resumen de validaciones para el docente autenticado.
    Filtra por el drive_folder_id asignado en su perfil.
    """
    folder_id = getattr(current_user, "drive_folder_id", None)
    if not folder_id:
        return {"has_folder": False, "records": [], "total": 0,
                "avg_compliance": 0.0, "by_week": []}

    records = (
        db.query(ValidationRecord)
        .filter(
            (ValidationRecord.folder_id == folder_id) |
            (ValidationRecord.course_name.ilike(f"%{folder_id}%"))
        )
        .order_by(desc(ValidationRecord.created_at))
        .all()
    )

    total = len(records)
    avg = round(sum(r.compliance_percentage for r in records) / total, 1) if total else 0.0

    by_week: Dict[str, Dict] = {}
    for r in records:
        key = r.folder_name or r.folder_id
        if key not in by_week:
            by_week[key] = {"count": 0, "total_pct": 0.0, "last_validated": None}
        by_week[key]["count"] += 1
        by_week[key]["total_pct"] += r.compliance_percentage
        if by_week[key]["last_validated"] is None:
            by_week[key]["last_validated"] = r.created_at

    by_week_list = sorted([
        {
            "week": k,
            "count": v["count"],
            "avg_compliance": round(v["total_pct"] / v["count"], 1),
            "status": _compliance_status(round(v["total_pct"] / v["count"], 1)),
            "last_validated": v["last_validated"].isoformat() if v["last_validated"] else None,
        }
        for k, v in by_week.items()
    ], key=lambda x: x["week"])

    return {
        "has_folder": True,
        "folder_id": folder_id,
        "total": total,
        "avg_compliance": avg,
        "overall_status": _compliance_status(avg),
        "by_week": by_week_list,
        "recent": [
            {
                "id": str(r.id),
                "folder_name": r.folder_name,
                "validation_type": r.validation_type,
                "compliance_percentage": r.compliance_percentage,
                "status": r.status,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in records[:10]
        ]
    }


# ─── Health ───────────────────────────────────────────────────────────────────

@router.get("/health-check")
async def validation_health_check():
    """Verificar estado del servicio de validación"""
    return {"service": "validation", "status": "ready"}
