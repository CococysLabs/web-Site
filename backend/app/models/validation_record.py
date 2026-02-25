"""
Modelo para guardar el historial de validaciones (estructura y contenido)
"""
import uuid
from sqlalchemy import Column, String, Float, Integer, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSON
from sqlalchemy.sql import func

from app.database import Base


class ValidationRecord(Base):
    __tablename__ = "validation_records"

    id                    = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    folder_id             = Column(String(200), nullable=False, index=True)
    folder_name           = Column(String(300), nullable=False)
    course_name           = Column(String(300), nullable=True)   # Nombre del curso padre
    validation_type       = Column(String(20),  nullable=False)  # "structure" | "content"
    section_name          = Column(String(200), nullable=True)   # "Semana 2" (solo content)
    compliance_percentage = Column(Float,       nullable=False, default=0.0)
    total_items           = Column(Integer,     nullable=False, default=0)
    present_items         = Column(Integer,     nullable=False, default=0)
    missing_items         = Column(Integer,     nullable=False, default=0)
    status                = Column(String(20),  nullable=False, default='unknown')
    # "compliant" (>=70%) | "partial" (40-69%) | "low" (<40%) | "unknown"
    results_json          = Column(JSON, nullable=True)          # resultado completo
    documents_analyzed    = Column(JSON, nullable=True)          # lista de archivos
    excel_updated         = Column(Boolean, nullable=False, default=False)
    validated_by          = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at            = Column(DateTime(timezone=True), server_default=func.now(), index=True)
