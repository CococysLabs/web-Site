"""
Job persistente para análisis con IA de:

- Semana Diagnóstico
- Semana 2
- Semana 3
- ...
- Semana 11

El job trabaja sobre una carpeta REAL de curso en Google Drive.
"""

import uuid

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
)

from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.database import Base


class WeekContentAnalysisJob(Base):
    __tablename__ = "week_content_analysis_jobs"

    # ========================================================
    # IDENTIFICACIÓN
    # ========================================================

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    created_by = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    # ========================================================
    # UBICACIÓN REAL EN GOOGLE DRIVE
    # ========================================================

    course_folder_id = Column(
        String(200),
        nullable=False,
        index=True,
    )

    course_folder_name = Column(
        String(300),
        nullable=False,
    )

    area_folder_id = Column(
        String(200),
        nullable=True,
    )

    area_folder_name = Column(
        String(300),
        nullable=False,
    )

    semester_folder_id = Column(
        String(200),
        nullable=True,
    )

    semester_folder_name = Column(
        String(300),
        nullable=True,
    )

    # ========================================================
    # CURSO VALIDADO CONTRA BASE DE DATOS
    # ========================================================

    course_code = Column(
        String(20),
        nullable=False,
        index=True,
    )

    course_name = Column(
        String(300),
        nullable=False,
    )

    area = Column(
        String(100),
        nullable=False,
        index=True,
    )

    # ========================================================
    # PERÍODO DE LA CARPETA DEL CURSO
    #
    # Ejemplo:
    # 92_Programacion_de_Computadoras_2_2S_2026
    #
    # source:
    #   2S / 2026
    #
    # target:
    #   1S / 2027
    # ========================================================

    source_semester = Column(
        String(10),
        nullable=False,
    )

    source_year = Column(
        Integer,
        nullable=False,
    )

    target_semester = Column(
        String(10),
        nullable=False,
    )

    target_year = Column(
        Integer,
        nullable=False,
    )

    # ========================================================
    # CONFIGURACIÓN
    # ========================================================

    write_output = Column(
        Boolean,
        nullable=False,
        default=True,
    )

    # ========================================================
    # ESTADO DEL JOB
    #
    # queued
    # processing
    # completed
    # failed
    # ========================================================

    status = Column(
        String(30),
        nullable=False,
        default="queued",
        index=True,
    )

    progress = Column(
        Integer,
        nullable=False,
        default=0,
    )

    # Ejemplos:
    #
    # Preparando curso
    # Leyendo matriz
    # Analizando Semana Diagnóstico
    # Analizando Semana 2
    # Escribiendo matriz
    # Finalizado
    current_stage = Column(
        String(200),
        nullable=True,
    )

    # NULL para Diagnóstico o pasos generales.
    # 2..11 para semanas normales.
    current_week = Column(
        Integer,
        nullable=True,
    )

    # ========================================================
    # IA
    # ========================================================

    provider = Column(
        String(100),
        nullable=True,
    )

    model = Column(
        String(200),
        nullable=True,
    )

    # ========================================================
    # RESULTADO
    # ========================================================

    result = Column(
        JSON,
        nullable=True,
    )

    error = Column(
        Text,
        nullable=True,
    )

    # ========================================================
    # FECHAS
    # ========================================================

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    started_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    finished_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    def __repr__(self):
        return (
            f"<WeekContentAnalysisJob "
            f"{self.id} "
            f"{self.course_code} "
            f"{self.status}>"
        )