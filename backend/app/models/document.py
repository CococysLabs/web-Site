"""
Modelo de documentos
"""
import uuid
from sqlalchemy import Column, String, DateTime, Enum as SQLEnum, ForeignKey, Text, Boolean, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base
import enum


class DocumentType(str, enum.Enum):
    """Tipos de documentos"""
    PDF = "pdf"
    EXCEL = "excel"
    WORD = "word"
    POWERPOINT = "powerpoint"


class DocumentStatus(str, enum.Enum):
    """Estados de documentos"""
    PENDING = "pending"  # Pendiente de análisis
    ANALYZING = "analyzing"  # En análisis
    COMPLETED = "completed"  # Análisis completado
    FAILED = "failed"  # Error en análisis


class Document(Base):
    """Modelo de documento"""
    __tablename__ = "documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Información básica
    name = Column(String, nullable=False)
    description = Column(Text)
    type = Column(SQLEnum(DocumentType), nullable=False)
    
    # Google Drive
    drive_file_id = Column(String, unique=True, nullable=True)
    drive_folder_id = Column(String, nullable=True)
    drive_web_view_link = Column(String, nullable=True)
    
    # Metadatos del archivo
    file_size = Column(String)  # Tamaño en bytes
    mime_type = Column(String)
    
    # Estado y análisis
    status = Column(SQLEnum(DocumentStatus), default=DocumentStatus.PENDING)
    analysis_result = Column(JSON, nullable=True)  # Resultado del análisis con Gemini
    
    # Validación
    is_valid = Column(Boolean, default=False)
    validation_errors = Column(JSON, nullable=True)
    
    # Relaciones
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    user = relationship("User", back_populates="documents")
    
    # Auditoría
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    analyzed_at = Column(DateTime(timezone=True), nullable=True)

    def __repr__(self):
        return f"<Document {self.name}>"
