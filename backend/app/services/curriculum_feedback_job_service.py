"""
Procesamiento en segundo plano de jobs de
retroalimentación curricular.
"""

from __future__ import annotations

from datetime import datetime, timezone

from app.database import SessionLocal
from app.models.course_catalog import CourseCatalog
from app.models.curriculum_feedback_job import (
    CurriculumFeedbackJob,
)
from app.services.curriculum_feedback_service import (
    CurriculumFeedbackError,
    curriculum_feedback_service,
)


def utc_now():
    return datetime.now(
        timezone.utc
    )


def process_curriculum_feedback_job(
    job_id: str,
) -> None:
    """
    Procesar un job curricular utilizando una
    sesión de base de datos independiente.
    """

    db = SessionLocal()

    try:
        # ====================================================
        # JOB
        # ====================================================

        job = (
            db.query(
                CurriculumFeedbackJob
            )
            .filter(
                CurriculumFeedbackJob.id
                == job_id
            )
            .first()
        )

        if not job:
            print(
                "❌ [CURRICULUM JOB] "
                f"Job no encontrado | id={job_id}",
                flush=True,
            )
            return

        # ====================================================
        # PROCESSING
        # ====================================================

        job.status = "processing"
        job.progress = 10
        job.started_at = (
            datetime.now(
                timezone.utc
            )
        )

        job.error = None

        db.commit()

        print(
            "\n"
            "🚀 [CURRICULUM JOB] "
            "Procesamiento iniciado | "
            f"job={job.id} | "
            f"curso={job.course_code}",
            flush=True,
        )

        # ====================================================
        # CURSO
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

            raise CurriculumFeedbackError(
                "No se encontró el curso "
                f"{job.course_code} "
                f"en el área {job.area}"
            )

        # Evitamos mantener el objeto ligado a una
        # transacción durante todo el análisis.
        db.expunge(
            course
        )

        # ====================================================
        # ANÁLISIS
        # ====================================================

        job.progress = 20

        db.commit()

        result = (
            curriculum_feedback_service
            .analyze_course(
                course=course,
                semester=job.semester,
                year=job.year,
                write_output=(
                    job.write_output
                ),
            )
        )

        # ====================================================
        # COMPLETADO
        # ====================================================

        job = (
            db.query(
                CurriculumFeedbackJob
            )
            .filter(
                CurriculumFeedbackJob.id
                == job_id
            )
            .first()
        )

        if not job:
            return

        job.status = "completed"
        job.progress = 100

        job.result = result

        provider = (
            result.get(
                "provider",
                {}
            )
        )

        job.provider = (
            provider.get(
                "name"
            )
        )

        job.model = (
            provider.get(
                "model"
            )
        )

        job.finished_at = (
            datetime.now(
                timezone.utc
            )
        )

        job.error = None

        db.commit()

        print(
            "✅ [CURRICULUM JOB] "
            "Procesamiento terminado | "
            f"job={job.id} | "
            f"curso={job.course_code}",
            flush=True,
        )

    except Exception as exc:

        db.rollback()

        print(
            "❌ [CURRICULUM JOB] "
            f"Error | job={job_id} | "
            f"tipo={type(exc).__name__} | "
            f"error={exc}",
            flush=True,
        )

        try:

            job = (
                db.query(
                    CurriculumFeedbackJob
                )
                .filter(
                    CurriculumFeedbackJob.id
                    == job_id
                )
                .first()
            )

            if job:

                job.status = "failed"
                job.progress = 100

                job.error = str(
                    exc
                )

                job.finished_at = (
                    datetime.now(
                        timezone.utc
                    )
                )

                db.commit()

        except Exception:

            db.rollback()

    finally:

        db.close()        
