"""
Registro histórico unificado de todos los análisis de IA ejecutados en el sistema.
Captura: quién analizó, qué analizó y con qué API key/proveedor.
"""
import uuid
from sqlalchemy import Column, String, Float, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.database import Base


class AnalysisLog(Base):
    __tablename__ = "analysis_logs"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id       = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"),
                           nullable=True, index=True)
    user_name     = Column(String(200), nullable=True)   # "Nombre Apellidos" (denormalizado)
    analyzed_what = Column(String(500), nullable=False)  # nombre del archivo o carpeta
    drive_file_id = Column(String(200), nullable=True)
    # "document" | "structure" | "content" | "course"
    analysis_type = Column(String(30), nullable=False)
    # "gemini" | "deepseek" | "groq" | "openrouter" | "basic" | "none"
    provider      = Column(String(30), nullable=False, default="basic")
    # "personal" | "admin" | "env" | "none"
    key_source    = Column(String(20), nullable=False, default="none")
    status        = Column(String(20), nullable=False, default="completed")
    score         = Column(Float, nullable=True)         # 0-100, solo para "document"
    course_name   = Column(String(300), nullable=True)
    created_at    = Column(DateTime(timezone=True), server_default=func.now(), index=True)
