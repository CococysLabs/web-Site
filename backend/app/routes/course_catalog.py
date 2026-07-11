"""
Endpoints para consultar el catálogo reusable de cursos.
"""
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.course_catalog import CourseCatalog
from app.models.user import User
from app.utils.auth import get_current_active_user


router = APIRouter(prefix="/api/course-catalog", tags=["course-catalog"])


def _course_to_dict(course: CourseCatalog) -> dict:
    return {
        "id": str(course.id),
        "area": course.area,
        "code": course.code,
        "name": course.name,
        "is_active": course.is_active,
    }


@router.get("/areas")
async def list_course_areas(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Listar áreas disponibles en el catálogo.
    """
    rows = (
        db.query(CourseCatalog.area)
        .filter(CourseCatalog.is_active == True)
        .distinct()
        .order_by(CourseCatalog.area.asc())
        .all()
    )

    return {
        "areas": [
            {
                "area": row[0],
                "label": row[0],
            }
            for row in rows
        ]
    }


@router.get("")
async def list_courses(
    area: Optional[str] = Query(None),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Listar cursos activos. Si se envía area, filtra por área.
    """
    query = db.query(CourseCatalog).filter(CourseCatalog.is_active == True)

    if area:
        query = query.filter(CourseCatalog.area == area)

    courses = (
        query
        .order_by(CourseCatalog.area.asc(), CourseCatalog.code.asc())
        .all()
    )

    return {
        "courses": [_course_to_dict(course) for course in courses]
    }