"""
Modelo de log de auditoría para acciones críticas del sistema.
"""
import uuid
from sqlalchemy import Column, String, Text, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB, INET
from sqlalchemy.sql import func

from app.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id     = Column(UUID(as_uuid=True), nullable=True, index=True)
    user_email  = Column(String(255), nullable=True)
    action      = Column(String(100), nullable=False, index=True)
    target_type = Column(String(50), nullable=True)   # "user" | "setting" | "api_key"
    target_id   = Column(String(255), nullable=True)
    details     = Column(JSONB, nullable=True)         # datos extra de la acción
    ip_address  = Column(INET, nullable=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now(), index=True)
