from typing import List

from fastapi import (
    APIRouter,
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

from app.database import get_db
from app.models.course_catalog import CourseCatalog
from app.models.user import User, UserRole
from app.services.course_contacts_service import (
    CourseContactsError,
    course_contacts_service,
)
from app.utils.auth import get_current_active_user


router = APIRouter(
    prefix="/api/course-contacts",
    tags=["course-contacts"],
)


class CourseContactsRequest(BaseModel):
    area: str = Field(
        ...,
        min_length=1,
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
    def strip_text(
        cls,
        value: str,
    ) -> str:
        return value.strip()

    @field_validator("course_codes")
    @classmethod
    def clean_codes(
        cls,
        values: List[str],
    ) -> List[str]:
        cleaned = []
        found = set()

        for value in values:
            code = str(value).strip()

            if code and code not in found:
                found.add(code)
                cleaned.append(code)

        return cleaned


def require_teacher_or_admin(
    current_user: User,
) -> None:
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

    if not is_admin and not is_teacher:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Solo administradores o usuarios "
                "Teacher pueden crear contactos"
            ),
        )


def selected_courses(
    request: CourseContactsRequest,
    db: Session,
) -> List[CourseCatalog]:
    selected_area = (
        course_contacts_service.canonical_area(
            request.area
        )
    )

    query = (
        db.query(CourseCatalog)
        .filter(
            CourseCatalog.is_active == True
        )
        .filter(
            CourseCatalog.area
            == selected_area
        )
    )

    if request.course_codes:
        query = query.filter(
            CourseCatalog.code.in_(
                request.course_codes
            )
        )

    courses = (
        query
        .order_by(
            CourseCatalog.code.asc()
        )
        .all()
    )

    if not courses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "No se encontraron cursos activos "
                "para el área seleccionada"
            ),
        )

    if request.course_codes:
        found_codes = {
            str(course.code)
            for course in courses
        }

        missing_codes = [
            code
            for code in request.course_codes
            if code not in found_codes
        ]

        if missing_codes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Los siguientes códigos no existen "
                    f"en el área {selected_area}: "
                    f"{missing_codes}"
                ),
            )

    return courses


@router.get("/source-status")
def source_status(
    semester: str = Query(...),
    year: int = Query(
        ...,
        ge=2000,
        le=2100,
    ),
    current_user: User = Depends(
        get_current_active_user
    ),
):
    """
    Verificar que:

    - El Google Sheets es accesible.
    - Existen las hojas de docentes y auxiliares.
    - Los encabezados pueden leerse.
    """
    require_teacher_or_admin(
        current_user
    )

    try:
        return (
            course_contacts_service.source_status(
                semester,
                year,
            )
        )
    except CourseContactsError as exception:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exception),
        ) from exception


@router.post("/preview")
def preview_course_contacts(
    request: CourseContactsRequest,
    current_user: User = Depends(
        get_current_active_user
    ),
    db: Session = Depends(get_db),
):
    """
    Obtener la cantidad de docentes y auxiliares
    encontrados para cada curso sin crear archivos.
    """
    require_teacher_or_admin(
        current_user
    )

    courses = selected_courses(
        request,
        db,
    )

    try:
        return course_contacts_service.preview(
            courses,
            request.semester,
            request.year,
        )

    except CourseContactsError as exception:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exception),
        ) from exception

    except Exception as exception:
        import traceback

        print(
            "❌ Error inesperado generando "
            "la vista previa de contactos"
        )
        traceback.print_exc()

        raise HTTPException(
            status_code=(
                status.HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail=(
                "Error inesperado leyendo "
                f"los contactos: {exception}"
            ),
        ) from exception


@router.post("/create")
def create_course_contacts(
    request: CourseContactsRequest,
    current_user: User = Depends(
        get_current_active_user
    ),
    db: Session = Depends(get_db),
):
    """
    Crear o actualizar los Excel dentro de:

    año_semestre/curso/2_Contactos

    Es una función síncrona porque Google Drive y
    openpyxl realizan operaciones bloqueantes.
    """
    require_teacher_or_admin(
        current_user
    )

    courses = selected_courses(
        request,
        db,
    )

    try:
        return (
            course_contacts_service.create_files(
                courses,
                request.semester,
                request.year,
            )
        )
    except CourseContactsError as exception:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exception),
        ) from exception
    except Exception as exception:
        print(
            "❌ Error inesperado creando "
            f"contactos: {exception}"
        )

        raise HTTPException(
            status_code=(
                status.HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail=(
                "Error inesperado creando "
                f"contactos: {exception}"
            ),
        ) from exception