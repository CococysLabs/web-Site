"""
Modelo para trabajos de validación en background.
Permite que el usuario reciba respuesta inmediata (job_id)
y consulte el estado mientras el análisis de IA corre en background.
"""
import uuid
from sqlalchemy import Column, String, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func

from app.database import Base


class ValidationJob(Base):
    __tablename__ = "validation_jobs"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id     = Column(UUID(as_uuid=True), nullable=False, index=True)
    job_type    = Column(String(20), nullable=False)    # "content" | "course"
    status      = Column(String(20), default="pending") # pending | running | completed | failed
    progress    = Column(Text, nullable=True)            # mensaje visible al usuario
    result_json = Column(JSONB, nullable=True)           # resultado final
    error       = Column(Text, nullable=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
