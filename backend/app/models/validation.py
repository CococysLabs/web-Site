"""
Modelo de criterios de validación
"""
import uuid
from sqlalchemy import Column, String, DateTime, Boolean, Integer, Text, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.database import Base


class ValidationCriteria(Base):
    """Criterios de validación para documentos"""
    __tablename__ = "validation_criteria"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Estructura esperada
    name = Column(String, nullable=False)  # Ej: "Estructura Laboratorio Semana 1"
    description = Column(Text)
    
    # Secciones requeridas (JSON con lista de secciones)
    # Ejemplo: ["Bienvenida", "Agenda", "Competencias", "Contenido", "Cierre"]
    required_sections = Column(JSON, nullable=False)
    
    # Configuración
    is_active = Column(Boolean, default=True)
    min_pages = Column(Integer, default=1)
    max_pages = Column(Integer, nullable=True)
    
    # Auditoría
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    def __repr__(self):
        return f"<ValidationCriteria {self.name}>"


class DriveFolder(Base):
    """Carpetas de Google Drive sincronizadas"""
    __tablename__ = "drive_folders"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Información de Drive
    folder_id = Column(String, unique=True, nullable=False)
    folder_name = Column(String, nullable=False)
    folder_path = Column(String)  # Ruta completa ej: "Pénsum/5_Contenidos_Laboratorio"
    web_view_link = Column(String)
    
    # Configuración
    is_active = Column(Boolean, default=True)
    auto_sync = Column(Boolean, default=False)  # Sincronización automática
    
    # Estadísticas
    total_files = Column(Integer, default=0)
    last_sync_at = Column(DateTime(timezone=True), nullable=True)
    
    # Auditoría
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    def __repr__(self):
        return f"<DriveFolder {self.folder_name}>"
