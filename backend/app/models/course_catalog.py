"""
Catálogo reusable de cursos por área.
"""
import uuid
from sqlalchemy import Column, String, Boolean, DateTime, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.database import Base


class CourseCatalog(Base):
    __tablename__ = "course_catalog"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    area = Column(String(100), nullable=False, index=True)
    code = Column(String(20), nullable=False, index=True)
    name = Column(String(300), nullable=False)

    is_active = Column(Boolean, nullable=False, default=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("area", "code", name="uq_course_catalog_area_code"),
    )

    def __repr__(self):
        return f"<CourseCatalog {self.area} {self.code} {self.name}>"