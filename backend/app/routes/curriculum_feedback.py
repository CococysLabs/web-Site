"""
Endpoints para retroalimentación de Diseño Curricular.

Por ahora:

GET  /api/curriculum-feedback/provider-status
POST /api/curriculum-feedback/preview
POST /api/curriculum-feedback/analyze-course

IMPORTANTE:

analyze-course procesa únicamente UN curso.

El procesamiento masivo se implementará mediante jobs/background
worker para no dejar una petición HTTP abierta durante varios minutos.
"""

from typing import (
    List,
    Optional,
)

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    HTTPException,
    status,
)

from pydantic import (
    BaseModel,
    Field,
    field_validator,
)

from sqlalchemy.orm import Session

from app.models.curriculum_feedback_job import (
    CurriculumFeedbackJob,
)

from app.services.curriculum_feedback_job_service import (
    process_curriculum_feedback_job,
)

from app.config import settings
from app.database import get_db
from app.models.course_catalog import (
    CourseCatalog,
)
from app.models.user import (
    User,
    UserRole,
)

from app.services.course_contacts_service import (
    course_contacts_service,
)

from app.services.curriculum_feedback_service import (
    CurriculumFeedbackError,
    DEEPSEEK_MODEL,
    GEMINI_CURRICULUM_MODEL,
    GROQ_CURRICULUM_MODEL,
    curriculum_feedback_service,
)

from app.utils.auth import (
    get_current_active_user,
)

from time import perf_counter

router = APIRouter(
    prefix="/api/curriculum-feedback",
    tags=[
        "curriculum-feedback"
    ],
)


class CurriculumFeedbackJobRequest(
    BaseModel
):
    course_code: str = Field(
        ...,
        min_length=1,
        max_length=20,
    )

    area: Optional[str] = Field(
        default=None,
        max_length=100,
    )

    semester: str = Field(
        ...,
        min_length=1,
        max_length=30,
    )

    year: int = Field(
        ...,
        ge=2000,
        le=2100,
    )

    write_output: bool = True

    @field_validator(
        "course_code",
        "area",
        "semester",
    )
    @classmethod
    def clean_text(
        cls,
        value,
    ):
        if value is None:
            return None

        return str(
            value
        ).strip()

# ============================================================
# REQUESTS
# ============================================================

class CurriculumPreviewRequest(
    BaseModel
):
    """
    Si area es None:
        consulta todas las áreas.

    Si course_codes está vacío:
        consulta todos los cursos activos dentro del filtro.
    """

    area: Optional[str] = Field(
        default=None,
        max_length=100,
    )

    course_codes: List[str] = Field(
        default_factory=list
    )

    semester: str = Field(
        ...,
        min_length=1,
        max_length=30,
    )

    year: int = Field(
        ...,
        ge=2000,
        le=2100,
    )

    @field_validator(
        "area",
        "semester",
    )
    @classmethod
    def clean_text(
        cls,
        value,
    ):
        if value is None:
            return None

        return str(
            value
        ).strip()

    @field_validator(
        "course_codes"
    )
    @classmethod
    def clean_codes(
        cls,
        values: List[str],
    ) -> List[str]:

        result: List[
            str
        ] = []

        seen = set()

        for value in values:

            code = str(
                value
            ).strip()

            if (
                code
                and code not in seen
            ):
                seen.add(
                    code
                )

                result.append(
                    code
                )

        return result


class CurriculumAnalyzeCourseRequest(
    BaseModel
):
    course_code: str = Field(
        ...,
        min_length=1,
        max_length=20,
    )

    area: Optional[str] = Field(
        default=None,
        max_length=100,
    )

    semester: str = Field(
        ...,
        min_length=1,
        max_length=30,
    )

    year: int = Field(
        ...,
        ge=2000,
        le=2100,
    )

    write_output: bool = False

    @field_validator(
        "course_code",
        "area",
        "semester",
    )
    @classmethod
    def clean_text(
        cls,
        value,
    ):
        if value is None:
            return None

        return str(
            value
        ).strip()


# ============================================================
# PERMISOS
# ============================================================

def require_teacher_or_admin(
    current_user: User,
) -> None:

    if (
        current_user.role
        != UserRole.ADMIN
        and not bool(
            getattr(
                current_user,
                "is_teacher",
                False,
            )
        )
    ):

        raise HTTPException(
            status_code=(
                status.HTTP_403_FORBIDDEN
            ),
            detail=(
                "Solo administradores o usuarios Teacher "
                "pueden generar retroalimentación curricular"
            ),
        )


# ============================================================
# UTILS
# ============================================================

def curriculum_job_to_dict(
    job: CurriculumFeedbackJob,
    include_result: bool = True,
) -> dict:

    data = {
        "id": str(
            job.id
        ),

        "status": (
            job.status
        ),

        "progress": (
            job.progress
        ),

        "course": {
            "area": (
                job.area
            ),

            "code": (
                job.course_code
            ),

            "name": (
                job.course_name
            ),
        },

        "semester": (
            job.semester
        ),

        "year": (
            job.year
        ),

        "write_output": (
            job.write_output
        ),

        "provider": (
            job.provider
        ),

        "model": (
            job.model
        ),

        "error": (
            job.error
        ),

        "created_at": (
            job.created_at.isoformat()
            if job.created_at
            else None
        ),

        "started_at": (
            job.started_at.isoformat()
            if job.started_at
            else None
        ),

        "finished_at": (
            job.finished_at.isoformat()
            if job.finished_at
            else None
        ),
    }

    if include_result:
        data[
            "result"
        ] = job.result

    return data

# ============================================================
# CURSOS
# ============================================================

def get_courses(
    db: Session,
    area: Optional[str],
    course_codes: List[str],
) -> List[CourseCatalog]:

    query = (
        db.query(
            CourseCatalog
        )
        .filter(
            CourseCatalog.is_active
            == True
        )
    )

    # Área opcional.
    if area:

        selected_area = (
            course_contacts_service
            .canonical_area(
                area
            )
        )

        query = query.filter(
            CourseCatalog.area
            == selected_area
        )

    # Códigos opcionales.
    if course_codes:

        query = query.filter(
            CourseCatalog.code.in_(
                course_codes
            )
        )

    courses = (
        query
        .order_by(
            CourseCatalog.area.asc(),
            CourseCatalog.code.asc(),
        )
        .all()
    )

    if not courses:

        raise HTTPException(
            status_code=(
                status.HTTP_400_BAD_REQUEST
            ),
            detail=(
                "No se encontraron cursos activos "
                "para los filtros seleccionados"
            ),
        )

    # Comprobar códigos solicitados.
    if course_codes:

        found_codes = {
            str(
                course.code
            )
            for course
            in courses
        }

        missing_codes = [
            code
            for code
            in course_codes
            if code
            not in found_codes
        ]

        if missing_codes:

            raise HTTPException(
                status_code=(
                    status.HTTP_400_BAD_REQUEST
                ),
                detail=(
                    "No se encontraron los siguientes cursos: "
                    f"{missing_codes}"
                ),
            )

    return courses


# ============================================================
# ESTADO
# ============================================================

@router.get(
    "/provider-status"
)
def provider_status(
    current_user: User = Depends(
        get_current_active_user
    ),
):

    require_teacher_or_admin(
        current_user
    )

    gemini_keys = []

    primary_gemini = str(
        getattr(
            settings,
            "GEMINI_API_KEY",
            "",
        )
        or ""
    ).strip()

    if primary_gemini:
        gemini_keys.append(
            primary_gemini
        )

    extra_gemini = str(
        getattr(
            settings,
            "GEMINI_API_KEYS",
            "",
        )
        or ""
    )

    for item in extra_gemini.split(","):

        key = item.strip()

        if (
            key
            and key not in gemini_keys
        ):
            gemini_keys.append(
                key
            )

    return {
        "success": True,

        "providers": [
            {
                "priority": 1,
                "name": "gemini",
                "model": GEMINI_CURRICULUM_MODEL,
                "configured": bool(
                    gemini_keys
                ),
                "keys_available": len(
                    gemini_keys
                ),
            },

            {
                "priority": 2,
                "name": "deepseek",
                "model": DEEPSEEK_MODEL,
                "configured": bool(
                    getattr(
                        settings,
                        "DEEPSEEK_API_KEY",
                        None,
                    )
                ),
            },

            {
                "priority": 3,
                "name": "groq",
                "model": GROQ_CURRICULUM_MODEL,
                "configured": bool(
                    getattr(
                        settings,
                        "GROQ_API_KEY",
                        None,
                    )
                ),
            },
        ],

        "source_strategy": (
            "context_pdf_and_curriculum_google_sheets_values"
        ),

        "xlsx_fallback": True,

        "output_strategy": (
            "google_sheets_api"
        ),
    }


# ============================================================
# PREVIEW
# ============================================================

@router.post(
    "/preview"
)
def preview_curriculum_feedback(
    request: CurriculumPreviewRequest,

    current_user: User = Depends(
        get_current_active_user
    ),

    db: Session = Depends(
        get_db
    ),
):

    require_teacher_or_admin(
        current_user
    )

    courses = get_courses(
        db,
        request.area,
        request.course_codes,
    )

    try:

        return (
            curriculum_feedback_service
            .preview(
                courses,
                request.semester,
                request.year,
            )
        )

    except CurriculumFeedbackError as exc:

        raise HTTPException(
            status_code=(
                status.HTTP_400_BAD_REQUEST
            ),
            detail=str(
                exc
            ),
        ) from exc

    except Exception as exc:

        import traceback
        traceback.print_exc()

        raise HTTPException(
            status_code=(
                status.HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail=(
                "Error inesperado comprobando "
                f"Planeación Curricular: {exc}"
            ),
        ) from exc


# ===========================================================
# JOBS
# ============================================================
@router.get(
    "/jobs/{job_id}"
)
def get_curriculum_feedback_job(
    job_id: str,

    current_user: User = Depends(
        get_current_active_user
    ),

    db: Session = Depends(
        get_db
    ),
):

    require_teacher_or_admin(
        current_user
    )

    job = (
        db.query(
            CurriculumFeedbackJob
        )
        .filter(
            CurriculumFeedbackJob.id
            == job_id
        )
        .first()
    )

    if not job:

        raise HTTPException(
            status_code=404,
            detail=(
                "Job no encontrado"
            ),
        )

    if (
        current_user.role
        != UserRole.ADMIN
        and job.created_by
        != current_user.id
    ):

        raise HTTPException(
            status_code=403,
            detail=(
                "No tienes permiso "
                "para consultar este job"
            ),
        )

    return {
        "success": True,

        "job": {
            "id": str(
                job.id
            ),

            "status": (
                job.status
            ),

            "progress": (
                job.progress
            ),

            "course": {
                "area": (
                    job.area
                ),

                "code": (
                    job.course_code
                ),

                "name": (
                    job.course_name
                ),
            },

            "semester": (
                job.semester
            ),

            "year": (
                job.year
            ),

            "write_output": (
                job.write_output
            ),

            "provider": (
                job.provider
            ),

            "model": (
                job.model
            ),

            "error": (
                job.error
            ),

            "created_at": (
                job.created_at.isoformat()
                if job.created_at
                else None
            ),

            "started_at": (
                job.started_at.isoformat()
                if job.started_at
                else None
            ),

            "finished_at": (
                job.finished_at.isoformat()
                if job.finished_at
                else None
            ),

            "result": (
                job.result
            ),
        },
    }

# ============================================================
# JOBS
# ============================================================
@router.post(
    "/jobs",
    status_code=status.HTTP_202_ACCEPTED,
)
def create_curriculum_feedback_job(
    request: CurriculumFeedbackJobRequest,

    background_tasks: BackgroundTasks,

    current_user: User = Depends(
        get_current_active_user
    ),

    db: Session = Depends(
        get_db
    ),
):
    """
    Crear un job de retroalimentación curricular.

    La petición responde inmediatamente.
    El análisis se ejecuta en segundo plano.
    """

    require_teacher_or_admin(
        current_user
    )

    courses = get_courses(
        db,
        request.area,
        [
            request.course_code
        ],
    )

    if len(courses) > 1:

        raise HTTPException(
            status_code=(
                status.HTTP_400_BAD_REQUEST
            ),
            detail=(
                "El código existe en más de un área. "
                "Indica el área del curso."
            ),
        )

    course = courses[0]

    # --------------------------------------------------------
    # Comprobación previa
    # --------------------------------------------------------

    preview = (
        curriculum_feedback_service
        .preview_course(
            course,
            request.semester,
            request.year,
        )
    )

    if not preview.get(
        "ready_for_analysis"
    ):

        raise HTTPException(
            status_code=(
                status.HTTP_400_BAD_REQUEST
            ),
            detail={
                "message": (
                    "El curso no está listo "
                    "para analizarse"
                ),
                "preview": preview,
            },
        )

    if (
        request.write_output
        and not preview.get(
            "ready_for_write"
        )
    ):

        raise HTTPException(
            status_code=(
                status.HTTP_400_BAD_REQUEST
            ),
            detail={
                "message": (
                    "El curso puede analizarse, "
                    "pero no está listo para escribir "
                    "la matriz"
                ),
                "preview": preview,
            },
        )

    # --------------------------------------------------------
    # Crear job
    # --------------------------------------------------------

    job = CurriculumFeedbackJob(
        created_by=current_user.id,
        area=course_contacts_service.canonical_area(
            course.area
        ),
        course_code=str(
            course.code
        ),
        course_name=course.name,
        semester=(
            course_contacts_service
            .normalize_semester(
                request.semester
            )
        ),
        year=request.year,
        write_output=request.write_output,

        # Compatibilidad con la tabla existente.
        # Ya no controla dónde se escribe.
        feedback_column="G",

        status="queued",
        progress=0,
        result=None,
        error=None,
    )

    db.add(
        job
    )

    db.commit()

    db.refresh(
        job
    )

    # --------------------------------------------------------
    # Background
    # --------------------------------------------------------

    background_tasks.add_task(
        process_curriculum_feedback_job,
        str(
            job.id
        ),
    )

    return {
        "success": True,

        "job_id": str(
            job.id
        ),

        "status": (
            job.status
        ),

        "progress": (
            job.progress
        ),

        "status_url": (
            "/api/curriculum-feedback/"
            f"jobs/{job.id}"
        ),

        "course": {
            "area": (
                job.area
            ),

            "code": (
                job.course_code
            ),

            "name": (
                job.course_name
            ),
        },

        "semester": (
            job.semester
        ),

        "year": (
            job.year
        ),

        "write_output": (
            job.write_output
        ),
    }

# ============================================================
# ANALIZAR UN CURSO
# ============================================================

@router.post(
    "/analyze-course"
)
def analyze_curriculum_course(
    request: CurriculumAnalyzeCourseRequest,

    current_user: User = Depends(
        get_current_active_user
    ),

    db: Session = Depends(
        get_db
    ),
):
    """
    Endpoint síncrono para probar un único curso.

    Inicialmente utilizaremos:
        773_Manejo_e_Implementacion_de_Archivos_2S_2026

    NO utilizar este endpoint para lanzar 30+ cursos
    simultáneamente desde el frontend.
    """

    require_teacher_or_admin(
        current_user
    )

    courses = get_courses(
        db,
        request.area,
        [
            request.course_code
        ],
    )

    if len(courses) > 1:

        raise HTTPException(
            status_code=(
                status.HTTP_400_BAD_REQUEST
            ),
            detail=(
                "El código existe en más de un área. "
                "Indica el área del curso."
            ),
        )

    course = courses[0]

    try:

        started_at = perf_counter()

        print(
            "🚀 [CURRICULUM API] Iniciando endpoint | "
            f"curso={course.code}",
            flush=True,
        )

        result = (
            curriculum_feedback_service
            .analyze_course(
                course=course,
                semester=request.semester,
                year=request.year,
                write_output=(
                    request.write_output
                ),
            )
        )

        print(
            "📦 [CURRICULUM API] Resultado recibido del servicio | "
            f"curso={course.code} | "
            f"segundos={perf_counter() - started_at:.2f}",
            flush=True,
        )

        return result

    except CurriculumFeedbackError as exc:

        raise HTTPException(
            status_code=(
                status.HTTP_400_BAD_REQUEST
            ),
            detail=str(
                exc
            ),
        ) from exc

    except Exception as exc:

        import traceback
        traceback.print_exc()

        raise HTTPException(
            status_code=(
                status.HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail=(
                "Error inesperado generando "
                f"retroalimentación: {exc}"
            ),
        ) from exc