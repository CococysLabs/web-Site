"""
Modelo de Usuario
"""
from sqlalchemy import Column, String, Boolean, DateTime, Enum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid
import enum
from app.database import Base


class UserRole(str, enum.Enum):
    """Roles de usuario"""
    ADMIN = "admin"
    STUDENT = "student"


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nombre = Column(String(100), nullable=False)
    apellidos = Column(String(100), nullable=False)
    correo = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), default=UserRole.STUDENT, nullable=False)
    is_active = Column(Boolean, default=True)
    is_approved = Column(Boolean, default=False)  # Requiere aprobación del admin
    approved_by = Column(UUID(as_uuid=True), nullable=True)  # ID del admin que aprobó
    approved_at = Column(DateTime(timezone=True), nullable=True)
    is_teacher = Column(Boolean, default=False, nullable=True)   # Tiene vista de docente (Mi Curso)
    drive_folder_id = Column(String(200), nullable=True)          # ID de carpeta Drive asignada
    drive_folder_name = Column(String(300), nullable=True)        # Nombre de la carpeta Drive asignada
    permissions = Column(JSONB, nullable=True)                    # Permisos granulares del usuario
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
# Relaciones
    documents = relationship("Document", back_populates="user")

    
    def __repr__(self):
        return f"<User {self.correo} ({self.role})>"
