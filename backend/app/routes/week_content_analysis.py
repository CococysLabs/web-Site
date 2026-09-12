"""
Endpoints para análisis con IA de:

- Semana Diagnóstico
- Semana 2 a Semana 11

Flujo de navegación:

GOOGLE_DRIVE_RESOURCES_ROOT_FOLDER_ID
    ↓
Semestre
    ↓
Área
    ↓
Cursos reales encontrados en Drive
    ↓
Validación del código contra CourseCatalog
    ↓
Preview
    ↓
Job
    ↓
Análisis con IA
    ↓
F2_Semanas / Observaciones IA
"""

from __future__ import annotations

from typing import (
    Any,
    Dict,
    List,
)

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    HTTPException,
    Query,
    status,
)

from pydantic import (
    BaseModel,
    Field,
    field_validator,
)

from sqlalchemy.orm import Session


from app.config import settings

from app.database import (
    get_db,
)

from app.models.course_catalog import (
    CourseCatalog,
)

from app.models.user import (
    User,
    UserRole,
)

from app.models.week_content_analysis_job import (
    WeekContentAnalysisJob,
)

from app.services.course_contacts_service import (
    course_contacts_service,
)

from app.services.curriculum_feedback_service import (
    DEEPSEEK_MODEL,
    GEMINI_CURRICULUM_MODEL,
    GROQ_CURRICULUM_MODEL,
)

from app.services.drive_service import (
    drive_service,
)

from app.services.week_content_analysis_job_service import (
    process_week_content_analysis_job,
)

from app.services.week_content_analysis_service import (
    WeekContentAnalysisError,
    week_content_analysis_service,
)

from app.utils.auth import (
    get_current_active_user,
)


router = APIRouter(
    prefix="/api/week-content-analysis",
    tags=[
        "week-content-analysis",
    ],
)


# ============================================================
# REQUESTS
# ============================================================

class WeekPreviewRequest(
    BaseModel
):
    """
    Preview de uno o varios cursos seleccionados.

    Los IDs corresponden a carpetas REALES de Google Drive.

    Ejemplo:

    semester_folder_id:
        carpeta 2026_Segundo_Semestre

    area_folder_id:
        carpeta 2. Software

    course_folder_ids:
        [
            id de 92_Programacion...,
            id de 773_Manejo...
        ]
    """

    semester_folder_id: str = Field(
        ...,
        min_length=1,
        max_length=200,
    )

    area_folder_id: str = Field(
        ...,
        min_length=1,
        max_length=200,
    )

    course_folder_ids: List[
        str
    ] = Field(
        ...,
        min_length=1,
    )

    @field_validator(
        "semester_folder_id",
        "area_folder_id",
    )
    @classmethod
    def clean_ids(
        cls,
        value: str,
    ) -> str:

        return str(
            value
        ).strip()


    @field_validator(
        "course_folder_ids"
    )
    @classmethod
    def clean_course_ids(
        cls,
        values: List[str],
    ) -> List[str]:

        result: List[
            str
        ] = []

        seen = set()

        for value in values:

            folder_id = str(
                value
            ).strip()

            if (
                folder_id
                and folder_id
                not in seen
            ):

                seen.add(
                    folder_id
                )

                result.append(
                    folder_id
                )

        if not result:

            raise ValueError(
                "Debe seleccionar al menos "
                "un curso"
            )

        return result


class WeekAnalysisJobRequest(
    BaseModel
):
    """
    Crear un job para UN curso.

    Para procesar varios cursos, el frontend debe
    crear un job por curso seleccionado.
    """

    semester_folder_id: str = Field(
        ...,
        min_length=1,
        max_length=200,
    )

    area_folder_id: str = Field(
        ...,
        min_length=1,
        max_length=200,
    )

    course_folder_id: str = Field(
        ...,
        min_length=1,
        max_length=200,
    )

    write_output: bool = True

    @field_validator(
        "semester_folder_id",
        "area_folder_id",
        "course_folder_id",
    )
    @classmethod
    def clean_text(
        cls,
        value: str,
    ) -> str:

        return str(
            value
        ).strip()


# ============================================================
# PERMISOS
# ============================================================

def require_teacher_or_admin(
    current_user: User,
) -> None:
    """
    Misma política usada en Planeación Curricular:

    - Admin
    - Teacher
    """

    is_admin = (
        current_user.role
        == UserRole.ADMIN
    )

    is_teacher = bool(
        getattr(
            current_user,
            "is_teacher",
            False,
        )
    )

    if (
        not is_admin
        and not is_teacher
    ):

        raise HTTPException(
            status_code=(
                status.HTTP_403_FORBIDDEN
            ),
            detail=(
                "Solo administradores o usuarios "
                "Teacher pueden analizar "
                "materiales de semanas"
            ),
        )


# ============================================================
# SERIALIZACIÓN DE JOB
# ============================================================

def week_job_to_dict(
    job: WeekContentAnalysisJob,
    include_result: bool = True,
) -> Dict[str, Any]:

    data: Dict[
        str,
        Any,
    ] = {

        "id": str(
            job.id
        ),

        "status": (
            job.status
        ),

        "progress": (
            job.progress
        ),

        "current_stage": (
            job.current_stage
        ),

        "current_week": (
            job.current_week
        ),

        "course": {
            "code": (
                job.course_code
            ),

            "name": (
                job.course_name
            ),

            "area": (
                job.area
            ),

            "folder_id": (
                job.course_folder_id
            ),

            "folder_name": (
                job.course_folder_name
            ),
        },

        "drive": {
            "semester_folder_id": (
                job.semester_folder_id
            ),

            "semester_folder_name": (
                job.semester_folder_name
            ),

            "area_folder_id": (
                job.area_folder_id
            ),

            "area_folder_name": (
                job.area_folder_name
            ),
        },

        "source_period": {
            "semester": (
                job.source_semester
            ),

            "year": (
                job.source_year
            ),

            "label": (
                f"{job.source_semester}"
                f"{job.source_year}"
            ),
        },

        "target_period": {
            "semester": (
                job.target_semester
            ),

            "year": (
                job.target_year
            ),

            "label": (
                f"{job.target_semester}"
                f"{job.target_year}"
            ),
        },

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
        ] = (
            job.result
        )

    return data


# ============================================================
# VALIDAR JERARQUÍA REAL DE DRIVE
# ============================================================

def _require_direct_child(
    child_folder_id: str,
    parent_folder_id: str,
    description: str,
) -> None:
    """
    Impide que el frontend mezcle IDs arbitrarios.

    Ejemplo:

    área seleccionada:
        2. Software de 2026_Segundo_Semestre

    curso seleccionado:
        debe ser hijo DIRECTO de esa área.
    """

    parent_id = (
        drive_service
        .get_parent_folder_id(
            child_folder_id
        )
    )

    if not parent_id:

        raise WeekContentAnalysisError(
            "No se pudo determinar la carpeta "
            f"padre de {description}"
        )

    if (
        str(
            parent_id
        )
        !=
        str(
            parent_folder_id
        )
    ):

        raise WeekContentAnalysisError(
            f"{description} no pertenece "
            "a la carpeta seleccionada"
        )


def _validate_semester_folder(
    semester_folder_id: str,
) -> Dict[str, Any]:
    """
    Comprobar que el semestre seleccionado sea
    hijo directo de:

    GOOGLE_DRIVE_RESOURCES_ROOT_FOLDER_ID
    """

    root_id = (
        week_content_analysis_service
        .resources_root_folder_id()
    )

    metadata = (
        drive_service
        .get_file_metadata(
            semester_folder_id
        )
    )

    if not metadata:

        raise WeekContentAnalysisError(
            "No se pudo acceder a la "
            "carpeta de semestre"
        )

    _require_direct_child(
        child_folder_id=(
            semester_folder_id
        ),

        parent_folder_id=(
            root_id
        ),

        description=(
            "La carpeta de semestre"
        ),
    )

    return metadata


def _validate_area_folder(
    semester_folder_id: str,
    area_folder_id: str,
) -> Dict[str, Any]:
    """
    Comprobar que el área pertenece directamente
    al semestre seleccionado.
    """

    metadata = (
        drive_service
        .get_file_metadata(
            area_folder_id
        )
    )

    if not metadata:

        raise WeekContentAnalysisError(
            "No se pudo acceder a "
            "la carpeta de área"
        )

    _require_direct_child(
        child_folder_id=(
            area_folder_id
        ),

        parent_folder_id=(
            semester_folder_id
        ),

        description=(
            "La carpeta de área"
        ),
    )

    return metadata


# ============================================================
# RESOLVER UN CURSO DE DRIVE CONTRA LA BD
# ============================================================

def _resolve_course_selection(
    db: Session,
    semester_folder_id: str,
    area_folder_id: str,
    course_folder_id: str,
) -> Dict[str, Any]:
    """
    Resolver completamente una selección del frontend.

    NO confiamos en:
    - código enviado por frontend;
    - nombre enviado por frontend;
    - semestre enviado por frontend;
    - área enviada por frontend.

    Todo se obtiene nuevamente de Drive y de BD.
    """

    # --------------------------------------------------------
    # 1. SEMESTRE
    # --------------------------------------------------------

    semester_folder = (
        _validate_semester_folder(
            semester_folder_id
        )
    )

    # --------------------------------------------------------
    # 2. ÁREA
    # --------------------------------------------------------

    area_folder = (
        _validate_area_folder(
            semester_folder_id,
            area_folder_id,
        )
    )

    # --------------------------------------------------------
    # 3. CURSO REAL DE DRIVE
    # --------------------------------------------------------

    course_folder = (
        drive_service
        .get_file_metadata(
            course_folder_id
        )
    )

    if not course_folder:

        raise WeekContentAnalysisError(
            "No se pudo acceder a la "
            "carpeta del curso"
        )

    _require_direct_child(
        child_folder_id=(
            course_folder_id
        ),

        parent_folder_id=(
            area_folder_id
        ),

        description=(
            "La carpeta del curso"
        ),
    )

    course_folder_name = str(
        course_folder.get(
            "name"
        )
        or ""
    ).strip()

    # --------------------------------------------------------
    # 4. EXTRAER CÓDIGO / PERÍODO DEL NOMBRE
    # --------------------------------------------------------

    parsed = (
        week_content_analysis_service
        .parse_course_folder_name(
            course_folder_name
        )
    )

    if not parsed:

        raise WeekContentAnalysisError(
            "La carpeta del curso no tiene "
            "el formato esperado: "
            "Codigo_Nombre_#S_Año"
        )

    course_code = str(
        parsed[
            "code"
        ]
    ).strip()

    # --------------------------------------------------------
    # 5. ÁREA CANÓNICA
    # --------------------------------------------------------

    canonical_area = (
        course_contacts_service
        .canonical_area(
            area_folder.get(
                "name",
                "",
            )
        )
    )

    # --------------------------------------------------------
    # 6. BUSCAR EN COURSE_CATALOG
    # --------------------------------------------------------

    course = (
        db.query(
            CourseCatalog
        )
        .filter(
            CourseCatalog.is_active
            == True
        )
        .filter(
            CourseCatalog.area
            == canonical_area
        )
        .filter(
            CourseCatalog.code
            == course_code
        )
        .first()
    )

    if not course:

        raise WeekContentAnalysisError(
            "El código del curso encontrado "
            "en Google Drive no existe como "
            "curso activo en la base de datos. "
            f"Código={course_code} | "
            f"Área={canonical_area}"
        )

    # --------------------------------------------------------
    # 7. COMPROBACIÓN FINAL
    # --------------------------------------------------------

    period = (
        week_content_analysis_service
        .validate_course_identity(
            course=course,

            course_folder_name=(
                course_folder_name
            ),

            area_folder_name=(
                area_folder.get(
                    "name",
                    "",
                )
            ),
        )
    )

    return {
        "semester_folder": (
            semester_folder
        ),

        "area_folder": (
            area_folder
        ),

        "course_folder": (
            course_folder
        ),

        "course": (
            course
        ),

        "period": (
            period
        ),

        "canonical_area": (
            canonical_area
        ),
    }


# ============================================================
# ESTADO DE PROVEEDORES IA
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

    gemini_keys: List[
        str
    ] = []

    primary = str(
        getattr(
            settings,
            "GEMINI_API_KEY",
            "",
        )
        or ""
    ).strip()

    if primary:

        gemini_keys.append(
            primary
        )

    extra = str(
        getattr(
            settings,
            "GEMINI_API_KEYS",
            "",
        )
        or ""
    )

    for item in extra.split(
        ","
    ):

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

                "name": (
                    "gemini"
                ),

                "model": (
                    GEMINI_CURRICULUM_MODEL
                ),

                "configured": bool(
                    gemini_keys
                ),

                "keys_available": len(
                    gemini_keys
                ),
            },

            {
                "priority": 2,

                "name": (
                    "deepseek"
                ),

                "model": (
                    DEEPSEEK_MODEL
                ),

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

                "name": (
                    "groq"
                ),

                "model": (
                    GROQ_CURRICULUM_MODEL
                ),

                "configured": bool(
                    getattr(
                        settings,
                        "GROQ_API_KEY",
                        None,
                    )
                ),
            },
        ],

        "analysis_strategy": (
            "presentation_by_presentation"
        ),

        "output": {
            "sheet": (
                "F2_Semanas"
            ),

            "column": (
                "H"
            ),

            "column_name": (
                "Observaciones IA"
            ),
        },
    }


# ============================================================
# 1. SEMESTRES
# ============================================================

@router.get(
    "/semesters"
)
def list_semesters(
    current_user: User = Depends(
        get_current_active_user
    ),
):
    """
    Primera selección.

    Lee directamente:

    GOOGLE_DRIVE_RESOURCES_ROOT_FOLDER_ID

    Ejemplo de resultado:

    2026_Primer_Semestre
    2026_Segundo_Semestre

    No están hardcodeados.
    """

    require_teacher_or_admin(
        current_user
    )

    try:

        return (
            week_content_analysis_service
            .list_semesters()
        )

    except WeekContentAnalysisError as exc:

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
                "Error inesperado cargando "
                f"semestres: {exc}"
            ),
        ) from exc


# ============================================================
# 2. ÁREAS
# ============================================================

@router.get(
    "/areas"
)
def list_areas(
    semester_folder_id: str = Query(
        ...,
        min_length=1,
    ),

    current_user: User = Depends(
        get_current_active_user
    ),
):
    """
    Segunda selección.

    Dentro del semestre seleccionado devuelve
    las carpetas REALES existentes.

    Ejemplo:

    2. Software
    3. Sistemas
    """

    require_teacher_or_admin(
        current_user
    )

    try:

        # Verificar que realmente pertenezca
        # a Recursos Educativos.
        _validate_semester_folder(
            semester_folder_id
        )

        return (
            week_content_analysis_service
            .list_areas(
                semester_folder_id
            )
        )

    except WeekContentAnalysisError as exc:

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
                "Error inesperado cargando "
                f"áreas: {exc}"
            ),
        ) from exc


# ============================================================
# 3. CURSOS
# ============================================================

@router.get(
    "/courses"
)
def list_courses(
    semester_folder_id: str = Query(
        ...,
        min_length=1,
    ),

    area_folder_id: str = Query(
        ...,
        min_length=1,
    ),

    current_user: User = Depends(
        get_current_active_user
    ),

    db: Session = Depends(
        get_db
    ),
):
    """
    Tercera selección.

    Lee las carpetas REALES existentes dentro del área.

    Después:

    1. extrae el código desde el nombre;
    2. consulta CourseCatalog;
    3. comprueba el área;
    4. devuelve únicamente como "courses"
       los cursos válidos.

    Los nombres no reconocidos se devuelven aparte
    para diagnóstico.
    """

    require_teacher_or_admin(
        current_user
    )

    try:

        # ----------------------------------------------------
        # VALIDAR JERARQUÍA
        # ----------------------------------------------------

        _validate_semester_folder(
            semester_folder_id
        )

        area_folder = (
            _validate_area_folder(
                semester_folder_id,
                area_folder_id,
            )
        )

        # ----------------------------------------------------
        # CARPETAS REALES
        # ----------------------------------------------------

        drive_result = (
            week_content_analysis_service
            .list_course_folders(
                area_folder_id
            )
        )

        drive_courses = (
            drive_result.get(
                "courses",
                [],
            )
        )

        canonical_area = (
            course_contacts_service
            .canonical_area(
                area_folder.get(
                    "name",
                    "",
                )
            )
        )

        # ----------------------------------------------------
        # TODOS LOS CÓDIGOS ENCONTRADOS
        # ----------------------------------------------------

        codes = list(
            {
                str(
                    item.get(
                        "code"
                    )
                    or ""
                ).strip()

                for item
                in drive_courses

                if str(
                    item.get(
                        "code"
                    )
                    or ""
                ).strip()
            }
        )

        # ----------------------------------------------------
        # CONSULTA ÚNICA A BD
        # ----------------------------------------------------

        catalog_courses: List[
            CourseCatalog
        ] = []

        if codes:

            catalog_courses = (
                db.query(
                    CourseCatalog
                )
                .filter(
                    CourseCatalog.is_active
                    == True
                )
                .filter(
                    CourseCatalog.area
                    == canonical_area
                )
                .filter(
                    CourseCatalog.code.in_(
                        codes
                    )
                )
                .all()
            )

        catalog_map = {
            str(
                course.code
            ): (
                course
            )

            for course
            in catalog_courses
        }

        # ----------------------------------------------------
        # VALIDAR CADA CARPETA
        # ----------------------------------------------------

        valid_courses: List[
            Dict[str, Any]
        ] = []

        invalid_courses: List[
            Dict[str, Any]
        ] = []

        for folder in drive_courses:

            code = str(
                folder.get(
                    "code"
                )
                or ""
            ).strip()

            catalog_course = (
                catalog_map.get(
                    code
                )
            )

            # ----------------------------------------------
            # NO EXISTE EN BD
            # ----------------------------------------------

            if not catalog_course:

                invalid_courses.append(
                    {
                        **folder,

                        "valid": False,

                        "reason": (
                            "El código no existe como "
                            "curso activo en CourseCatalog "
                            f"para el área {canonical_area}"
                        ),
                    }
                )

                continue

            # ----------------------------------------------
            # COMPROBACIÓN COMPLETA
            # ----------------------------------------------

            try:

                period = (
                    week_content_analysis_service
                    .validate_course_identity(
                        course=(
                            catalog_course
                        ),

                        course_folder_name=(
                            folder.get(
                                "name",
                                "",
                            )
                        ),

                        area_folder_name=(
                            area_folder.get(
                                "name",
                                "",
                            )
                        ),
                    )
                )

            except Exception as exc:

                invalid_courses.append(
                    {
                        **folder,

                        "valid": False,

                        "reason": str(
                            exc
                        ),
                    }
                )

                continue

            # ----------------------------------------------
            # VÁLIDO
            # ----------------------------------------------

            valid_courses.append(
                {
                    "folder_id": (
                        folder.get(
                            "id"
                        )
                    ),

                    "folder_name": (
                        folder.get(
                            "name"
                        )
                    ),

                    "webViewLink": (
                        folder.get(
                            "webViewLink"
                        )
                    ),

                    "valid": True,

                    "course": {
                        "id": str(
                            catalog_course.id
                        ),

                        "code": str(
                            catalog_course.code
                        ),

                        "name": (
                            catalog_course.name
                        ),

                        "area": (
                            catalog_course.area
                        ),
                    },

                    "source_period": {
                        "semester": (
                            period[
                                "source_semester"
                            ]
                        ),

                        "year": (
                            period[
                                "source_year"
                            ]
                        ),

                        "label": (
                            period[
                                "source_period"
                            ]
                        ),
                    },

                    "target_period": {
                        "semester": (
                            period[
                                "target_semester"
                            ]
                        ),

                        "year": (
                            period[
                                "target_year"
                            ]
                        ),

                        "label": (
                            period[
                                "target_period"
                            ]
                        ),
                    },
                }
            )

        return {
            "success": True,

            "semester_folder_id": (
                semester_folder_id
            ),

            "area": {
                "folder_id": (
                    area_folder_id
                ),

                "folder_name": (
                    area_folder.get(
                        "name"
                    )
                ),

                "canonical_area": (
                    canonical_area
                ),
            },

            # Estos son los que debe mostrar
            # normalmente el frontend.
            "courses": (
                valid_courses
            ),

            # Para diagnóstico.
            "invalid_courses": (
                invalid_courses
            ),

            # Carpetas que ni siquiera parecían cursos.
            "ignored_folders": (
                drive_result.get(
                    "ignored",
                    [],
                )
            ),

            "summary": {
                "valid": len(
                    valid_courses
                ),

                "invalid": len(
                    invalid_courses
                ),

                "ignored": len(
                    drive_result.get(
                        "ignored",
                        [],
                    )
                ),
            },
        }

    except WeekContentAnalysisError as exc:

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
                "Error inesperado cargando "
                f"cursos: {exc}"
            ),
        ) from exc


# ============================================================
# 4. PREVIEW
# ============================================================

@router.post(
    "/preview"
)
def preview_courses(
    request: WeekPreviewRequest,

    current_user: User = Depends(
        get_current_active_user
    ),

    db: Session = Depends(
        get_db
    ),
):
    """
    Preview de uno o varios cursos.

    NO utiliza IA.

    NO modifica Drive.

    Comprueba:

    - jerarquía;
    - código contra BD;
    - período origen/destino;
    - matriz;
    - F2_Semanas;
    - 4_Diagnostico;
    - Diagnostico;
    - TFortalecimiento;
    - 5_Contenidos;
    - Semana 2..11;
    - Presentación;
    - Google Sheets/XLSX;
    - existencia de opcionales.
    """

    require_teacher_or_admin(
        current_user
    )

    items: List[
        Dict[str, Any]
    ] = []

    for course_folder_id in (
        request.course_folder_ids
    ):

        try:

            selection = (
                _resolve_course_selection(
                    db=db,

                    semester_folder_id=(
                        request
                        .semester_folder_id
                    ),

                    area_folder_id=(
                        request
                        .area_folder_id
                    ),

                    course_folder_id=(
                        course_folder_id
                    ),
                )
            )

            course = (
                selection[
                    "course"
                ]
            )

            course_folder = (
                selection[
                    "course_folder"
                ]
            )

            area_folder = (
                selection[
                    "area_folder"
                ]
            )

            preview = (
                week_content_analysis_service
                .preview_course(
                    course=course,

                    course_folder_id=(
                        course_folder[
                            "id"
                        ]
                    ),

                    course_folder_name=(
                        course_folder[
                            "name"
                        ]
                    ),

                    area_folder_name=(
                        area_folder[
                            "name"
                        ]
                    ),
                )
            )

            items.append(
                preview
            )

        except Exception as exc:

            items.append(
                {
                    "success": False,

                    "ready_for_analysis": False,

                    "ready_for_write": False,

                    "course": {
                        "folder_id": (
                            course_folder_id
                        ),
                    },

                    "warnings": [],

                    "error": str(
                        exc
                    ),
                }
            )

    return {
        "success": True,

        "summary": {
            "total_courses": len(
                items
            ),

            "ready_for_analysis": sum(
                1

                for item
                in items

                if item.get(
                    "ready_for_analysis"
                )
            ),

            "ready_for_write": sum(
                1

                for item
                in items

                if item.get(
                    "ready_for_write"
                )
            ),

            "with_warnings": sum(
                1

                for item
                in items

                if item.get(
                    "warnings"
                )
            ),

            "blocked": sum(
                1

                for item
                in items

                if not item.get(
                    "ready_for_analysis"
                )
            ),
        },

        "courses": (
            items
        ),
    }


# ============================================================
# 5. CONSULTAR JOB
# ============================================================

@router.get(
    "/jobs/{job_id}"
)
def get_week_analysis_job(
    job_id: str,

    current_user: User = Depends(
        get_current_active_user
    ),

    db: Session = Depends(
        get_db
    ),
):
    """
    Consultar progreso de un job.

    Ejemplo:

    {
        "status": "processing",
        "progress": 55,
        "current_stage": "Analizando Semana 6",
        "current_week": 6
    }
    """

    require_teacher_or_admin(
        current_user
    )

    job = (
        db.query(
            WeekContentAnalysisJob
        )
        .filter(
            WeekContentAnalysisJob.id
            == job_id
        )
        .first()
    )

    if not job:

        raise HTTPException(
            status_code=(
                status.HTTP_404_NOT_FOUND
            ),
            detail=(
                "Job no encontrado"
            ),
        )

    # Un Teacher solo puede consultar sus propios jobs.
    if (
        current_user.role
        != UserRole.ADMIN

        and job.created_by
        != current_user.id
    ):

        raise HTTPException(
            status_code=(
                status.HTTP_403_FORBIDDEN
            ),
            detail=(
                "No tienes permiso para "
                "consultar este job"
            ),
        )

    return {
        "success": True,

        "job": (
            week_job_to_dict(
                job,
                include_result=True,
            )
        ),
    }


# ============================================================
# 6. CREAR JOB
# ============================================================

@router.post(
    "/jobs",
    status_code=(
        status.HTTP_202_ACCEPTED
    ),
)
def create_week_analysis_job(
    request: WeekAnalysisJobRequest,

    background_tasks: BackgroundTasks,

    current_user: User = Depends(
        get_current_active_user
    ),

    db: Session = Depends(
        get_db
    ),
):
    """
    Crear UN job de análisis de semanas.

    El endpoint responde inmediatamente.

    El trabajo pesado ocurre en:

    process_week_content_analysis_job()
    """

    require_teacher_or_admin(
        current_user
    )

    try:

        # ====================================================
        # 1. RESOLVER SELECCIÓN
        # ====================================================

        selection = (
            _resolve_course_selection(
                db=db,

                semester_folder_id=(
                    request
                    .semester_folder_id
                ),

                area_folder_id=(
                    request
                    .area_folder_id
                ),

                course_folder_id=(
                    request
                    .course_folder_id
                ),
            )
        )

        course = (
            selection[
                "course"
            ]
        )

        period = (
            selection[
                "period"
            ]
        )

        semester_folder = (
            selection[
                "semester_folder"
            ]
        )

        area_folder = (
            selection[
                "area_folder"
            ]
        )

        course_folder = (
            selection[
                "course_folder"
            ]
        )

        # ====================================================
        # 2. PREVIEW OBLIGATORIO
        # ====================================================

        preview = (
            week_content_analysis_service
            .preview_course(
                course=course,

                course_folder_id=(
                    course_folder[
                        "id"
                    ]
                ),

                course_folder_name=(
                    course_folder[
                        "name"
                    ]
                ),

                area_folder_name=(
                    area_folder[
                        "name"
                    ]
                ),
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

                    "preview": (
                        preview
                    ),
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
                        "pero no está listo para "
                        "escribir F2_Semanas"
                    ),

                    "preview": (
                        preview
                    ),
                },
            )

        # ====================================================
        # 3. CREAR JOB
        # ====================================================

        job = (
            WeekContentAnalysisJob(
                created_by=(
                    current_user.id
                ),

                # --------------------------------------------
                # DRIVE
                # --------------------------------------------

                course_folder_id=(
                    course_folder[
                        "id"
                    ]
                ),

                course_folder_name=(
                    course_folder[
                        "name"
                    ]
                ),

                area_folder_id=(
                    area_folder[
                        "id"
                    ]
                ),

                area_folder_name=(
                    area_folder[
                        "name"
                    ]
                ),

                semester_folder_id=(
                    semester_folder[
                        "id"
                    ]
                ),

                semester_folder_name=(
                    semester_folder[
                        "name"
                    ]
                ),

                # --------------------------------------------
                # CURSO
                # --------------------------------------------

                course_code=str(
                    course.code
                ),

                course_name=(
                    course.name
                ),

                area=(
                    selection[
                        "canonical_area"
                    ]
                ),

                # --------------------------------------------
                # PERÍODO
                # --------------------------------------------

                source_semester=(
                    period[
                        "source_semester"
                    ]
                ),

                source_year=(
                    period[
                        "source_year"
                    ]
                ),

                target_semester=(
                    period[
                        "target_semester"
                    ]
                ),

                target_year=(
                    period[
                        "target_year"
                    ]
                ),

                # --------------------------------------------
                # CONFIG
                # --------------------------------------------

                write_output=(
                    request.write_output
                ),

                # --------------------------------------------
                # ESTADO
                # --------------------------------------------

                status=(
                    "queued"
                ),

                progress=0,

                current_stage=(
                    "En cola"
                ),

                current_week=None,

                result=None,

                error=None,
            )
        )

        db.add(
            job
        )

        db.commit()

        db.refresh(
            job
        )

        # ====================================================
        # 4. BACKGROUND
        # ====================================================

        background_tasks.add_task(
            process_week_content_analysis_job,

            str(
                job.id
            ),
        )

        # ====================================================
        # 5. RESPUESTA
        # ====================================================

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

            "current_stage": (
                job.current_stage
            ),

            "status_url": (
                "/api/week-content-analysis/"
                f"jobs/{job.id}"
            ),

            "course": {
                "code": (
                    job.course_code
                ),

                "name": (
                    job.course_name
                ),

                "area": (
                    job.area
                ),

                "folder_id": (
                    job.course_folder_id
                ),

                "folder_name": (
                    job.course_folder_name
                ),
            },

            "source_period": {
                "semester": (
                    job.source_semester
                ),

                "year": (
                    job.source_year
                ),

                "label": (
                    f"{job.source_semester}"
                    f"{job.source_year}"
                ),
            },

            "target_period": {
                "semester": (
                    job.target_semester
                ),

                "year": (
                    job.target_year
                ),

                "label": (
                    f"{job.target_semester}"
                    f"{job.target_year}"
                ),
            },

            "write_output": (
                job.write_output
            ),

            "preview": (
                preview
            ),
        }

    except HTTPException:
        raise

    except WeekContentAnalysisError as exc:

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
                "Error inesperado creando "
                f"el job de semanas: {exc}"
            ),
        ) from exc