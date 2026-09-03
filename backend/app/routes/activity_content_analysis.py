"""
Endpoints para el análisis de contenido de Proyectos, Practicas y Tareas
(Fase 2 del panel de Planeación Curricular).

Los cursos se identifican por su carpeta real en Google Drive
(Semestre → Área → Curso), igual que la validación de estructura de
Proyectos/Practicas/Tareas (app/routes/validation.py:
/activities/semesters, /activities/courses) — no por el catálogo de
cursos de la base de datos.

Endpoint síncrono (sin tabla de jobs, igual que
/api/curriculum-feedback/analyze-course): procesa un único curso por
petición. El frontend llama a este endpoint una vez por curso
seleccionado, en secuencia.

POST /api/activity-content-analysis/preview
POST /api/activity-content-analysis/analyze-course
"""

from typing import List

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)

from pydantic import BaseModel, Field, field_validator

from app.models.user import User

from app.routes.curriculum_feedback import require_teacher_or_admin

from app.services.activity_content_analysis_service import (
    ActivityContentAnalysisError,
    activity_content_analysis_service,
)
from app.utils.auth import get_current_active_user


router = APIRouter(
    prefix="/api/activity-content-analysis",
    tags=["Análisis de Contenido de Actividades"],
)


class ActivityCourseRef(BaseModel):
    folder_id: str = Field(..., min_length=1, max_length=200)

    name: str = Field(..., min_length=1, max_length=300)

    area: str = Field(..., min_length=1, max_length=100)

    @field_validator("folder_id", "name", "area")
    @classmethod
    def clean_text(cls, value):
        return value.strip()


class ActivityPreviewRequest(BaseModel):
    courses: List[ActivityCourseRef] = Field(..., min_length=1)


class ActivityAnalyzeCourseRequest(BaseModel):
    course_folder_id: str = Field(..., min_length=1, max_length=200)

    course_name: str = Field(..., min_length=1, max_length=300)

    area: str = Field(..., min_length=1, max_length=100)

    write_output: bool = True

    # Vacío o ausente = analizar Proyectos, Practicas y Tareas.
    # Si se indica, limita el análisis a esos tipos (reduce la
    # duración de la petición y la carga sobre la IA).
    activity_types: List[str] = Field(default_factory=list)

    @field_validator("course_folder_id", "course_name", "area")
    @classmethod
    def clean_text(cls, value):
        return value.strip()


# ============================================================
# PREVIEW
# ============================================================

@router.post("/preview")
def preview_activity_content_analysis(
    request: ActivityPreviewRequest,
    current_user: User = Depends(get_current_active_user),
):
    require_teacher_or_admin(current_user)

    try:
        results = [
            activity_content_analysis_service.preview_course_by_folder(
                course.folder_id, course.name, course.area
            )
            for course in request.courses
        ]

        return {
            "success": True,
            "courses": results,
            "summary": {
                "total_courses": len(results),
                "ready_for_analysis": len(
                    [r for r in results if r.get("ready_for_analysis")]
                ),
                "ready_for_write": len(
                    [r for r in results if r.get("ready_for_write")]
                ),
                "with_errors": len(
                    [r for r in results if not r.get("success")]
                ),
            },
        }

    except ActivityContentAnalysisError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    except Exception as exc:
        import traceback
        traceback.print_exc()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "Error inesperado comprobando "
                f"Proyectos/Practicas/Tareas: {exc}"
            ),
        ) from exc


# ============================================================
# ANALIZAR UN CURSO (síncrono, sin tabla de jobs)
# ============================================================

@router.post("/analyze-course")
def analyze_activity_content_course(
    request: ActivityAnalyzeCourseRequest,
    current_user: User = Depends(get_current_active_user),
):
    """
    Endpoint síncrono: procesa un único curso por petición.

    El frontend llama a este endpoint una vez por curso seleccionado,
    en secuencia (no lanzar muchos cursos en paralelo).
    """

    require_teacher_or_admin(current_user)

    preview = activity_content_analysis_service.preview_course_by_folder(
        request.course_folder_id, request.course_name, request.area
    )

    if not preview.get("ready_for_analysis"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "El curso no está listo para analizarse",
                "preview": preview,
            },
        )

    if request.write_output and not preview.get("ready_for_write"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": (
                    "El curso puede analizarse, pero no está listo "
                    "para escribir la matriz"
                ),
                "preview": preview,
            },
        )

    try:
        return activity_content_analysis_service.analyze_course_by_folder(
            course_folder_id=request.course_folder_id,
            course_name=request.course_name,
            area=request.area,
            write_output=request.write_output,
            activity_keys=request.activity_types or None,
        )

    except ActivityContentAnalysisError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    except Exception as exc:
        import traceback
        traceback.print_exc()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "Error inesperado analizando "
                f"Proyectos/Practicas/Tareas: {exc}"
            ),
        ) from exc
