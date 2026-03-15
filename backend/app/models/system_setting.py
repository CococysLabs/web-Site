"""
Modelo para configuración del sistema persistida en BD
"""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.database import Base


class SystemSetting(Base):
    __tablename__ = "system_settings"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    key         = Column(String(100), unique=True, nullable=False, index=True)
    value       = Column(Text, nullable=True)
    value_type  = Column(String(20), nullable=False, default='string')
    # string | integer | boolean | json
    category    = Column(String(50), nullable=False)
    # drive | ai | users | validation
    label       = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    is_sensitive = Column(Boolean, nullable=False, default=False)
    updated_by  = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_at  = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
