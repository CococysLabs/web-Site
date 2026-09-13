"""
Procesamiento en segundo plano de los jobs de análisis
de Semana Diagnóstico y Semanas 2 a 11.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from app.database import SessionLocal

from app.models.course_catalog import (
    CourseCatalog,
)

from app.models.week_content_analysis_job import (
    WeekContentAnalysisJob,
)

from app.services.week_content_analysis_service import (
    WeekContentAnalysisError,
    week_content_analysis_service,
)


def utc_now():
    return datetime.now(
        timezone.utc
    )


def _update_job_progress(
    job_id: str,
    progress: int,
    stage: str,
    week: Optional[int] = None,
) -> None:
    """
    Actualiza progreso utilizando una sesión corta e independiente.

    No reutilizamos la sesión principal durante llamadas largas
    a Google Drive o proveedores de IA.
    """

    db = SessionLocal()

    try:
        job = (
            db.query(
                WeekContentAnalysisJob
            )
            .filter(
                WeekContentAnalysisJob.id
                == job_id
            )
            .first()
        )

        if not job:
            return

        job.progress = max(
            0,
            min(
                int(progress),
                99,
            ),
        )

        job.current_stage = (
            str(stage or "").strip()
            or None
        )

        job.current_week = week

        db.commit()

    except Exception as exc:
        db.rollback()

        print(
            "⚠️ [WEEK JOB] "
            "No se pudo actualizar progreso | "
            f"job={job_id} | "
            f"error={exc}",
            flush=True,
        )

    finally:
        db.close()


def process_week_content_analysis_job(
    job_id: str,
) -> None:
    """
    Procesar UN curso en segundo plano.

    Flujo:

    queued
        ↓
    processing
        ↓
    Semana Diagnóstico
        ↓
    Semanas 2..11
        ↓
    escritura F2_Semanas
        ↓
    completed / failed
    """

    db = SessionLocal()

    try:

        # ====================================================
        # 1. BUSCAR JOB
        # ====================================================

        job = (
            db.query(
                WeekContentAnalysisJob
            )
            .filter(
                WeekContentAnalysisJob.id
                == job_id
            )
            .first()
        )

        if not job:

            print(
                "❌ [WEEK JOB] "
                f"Job no encontrado | id={job_id}",
                flush=True,
            )

            return

        # ====================================================
        # 2. MARCAR PROCESSING
        # ====================================================

        job.status = "processing"
        job.progress = 5
        job.current_stage = (
            "Preparando análisis"
        )
        job.current_week = None

        job.started_at = utc_now()
        job.finished_at = None
        job.error = None

        db.commit()

        print(
            "\n"
            "=========================================\n"
            "🚀 [WEEK JOB] INICIADO\n"
            f"Job: {job.id}\n"
            f"Curso: {job.course_code} - {job.course_name}\n"
            f"Carpeta: {job.course_folder_name}\n"
            "=========================================",
            flush=True,
        )

        # ====================================================
        # 3. VALIDAR CURSO EN BD
        # ====================================================

        course = (
            db.query(
                CourseCatalog
            )
            .filter(
                CourseCatalog.is_active
                == True
            )
            .filter(
                CourseCatalog.area
                == job.area
            )
            .filter(
                CourseCatalog.code
                == job.course_code
            )
            .first()
        )

        if not course:

            raise WeekContentAnalysisError(
                "No se encontró el curso "
                f"{job.course_code} "
                f"en el área {job.area}"
            )

        # Evitar mantener el objeto SQLAlchemy conectado
        # durante todo el análisis.
        db.expunge(
            course
        )

        # Guardamos los datos antes de cerrar la sesión larga.
        course_folder_id = (
            job.course_folder_id
        )

        course_folder_name = (
            job.course_folder_name
        )

        area_folder_name = (
            job.area_folder_name
        )

        write_output = (
            job.write_output
        )

        # ====================================================
        # 4. ANÁLISIS
        # ====================================================

        _update_job_progress(
            job_id=job_id,
            progress=10,
            stage=(
                "Localizando estructura del curso"
            ),
        )

        result = (
            week_content_analysis_service
            .analyze_course(
                course=course,

                course_folder_id=(
                    course_folder_id
                ),

                course_folder_name=(
                    course_folder_name
                ),

                area_folder_name=(
                    area_folder_name
                ),

                write_output=(
                    write_output
                ),

                progress_callback=(
                    lambda progress,
                    stage,
                    week=None:
                    _update_job_progress(
                        job_id=job_id,
                        progress=progress,
                        stage=stage,
                        week=week,
                    )
                ),
            )
        )

        # ====================================================
        # 5. RECARGAR JOB
        # ====================================================

        job = (
            db.query(
                WeekContentAnalysisJob
            )
            .filter(
                WeekContentAnalysisJob.id
                == job_id
            )
            .first()
        )

        if not job:
            return

        # ====================================================
        # 6. PROVIDER
        # ====================================================

        providers = (
            result.get(
                "providers_used"
            )
            or []
        )

        provider_names = {
            str(
                item.get(
                    "provider"
                )
                or ""
            ).strip()
            for item
            in providers
            if item.get(
                "provider"
            )
        }

        model_names = {
            str(
                item.get(
                    "model"
                )
                or ""
            ).strip()
            for item
            in providers
            if item.get(
                "model"
            )
        }

        if len(provider_names) == 1:
            job.provider = next(
                iter(provider_names)
            )

        elif len(provider_names) > 1:
            job.provider = "multiple"

        else:
            job.provider = None

        if len(model_names) == 1:
            job.model = next(
                iter(model_names)
            )

        elif len(model_names) > 1:
            job.model = "multiple"

        else:
            job.model = None

        # ====================================================
        # 7. COMPLETADO
        # ====================================================

        job.status = "completed"
        job.progress = 100

        job.current_stage = (
            "Finalizado"
        )

        job.current_week = None

        job.result = result

        job.error = None

        job.finished_at = utc_now()

        db.commit()

        print(
            "✅ [WEEK JOB] "
            "Procesamiento terminado | "
            f"job={job.id} | "
            f"curso={job.course_code}",
            flush=True,
        )

    except Exception as exc:

        db.rollback()

        print(
            "❌ [WEEK JOB] "
            f"Error | job={job_id} | "
            f"tipo={type(exc).__name__} | "
            f"error={exc}",
            flush=True,
        )

        try:

            job = (
                db.query(
                    WeekContentAnalysisJob
                )
                .filter(
                    WeekContentAnalysisJob.id
                    == job_id
                )
                .first()
            )

            if job:

                job.status = "failed"

                # En failed NO ponemos 100.
                # 100 debe significar análisis realmente terminado.
                if (
                    job.progress is None
                    or job.progress >= 100
                ):
                    job.progress = 99

                job.current_stage = (
                    "Error durante el análisis"
                )

                job.current_week = None

                job.error = str(
                    exc
                )

                job.finished_at = utc_now()

                db.commit()

        except Exception as update_exc:

            db.rollback()

            print(
                "❌ [WEEK JOB] "
                "No se pudo guardar el error del job | "
                f"job={job_id} | "
                f"error={update_exc}",
                flush=True,
            )

    finally:
        db.close()