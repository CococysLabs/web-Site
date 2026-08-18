"""
Procesamiento en segundo plano de jobs de
retroalimentación curricular.
"""

from __future__ import annotations

import traceback
import uuid

from datetime import datetime, timezone

from app.database import SessionLocal
from app.models.course_catalog import CourseCatalog
from app.models.curriculum_feedback_job import (
    CurriculumFeedbackJob,
)
from app.services.curriculum_feedback_service import (
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
    Ejecutar UN job de retroalimentación.

    IMPORTANTE:
    Esta función crea sus propias sesiones de BD.
    Nunca reutiliza la sesión HTTP del endpoint.
    """

    try:
        job_uuid = uuid.UUID(
            str(job_id)
        )

    except ValueError:
        print(
            "❌ [CURRICULUM JOB] "
            f"job_id inválido={job_id}",
            flush=True,
        )
        return

    print(
        "\n"
        "=========================================\n"
        "🧵 CURRICULUM JOB INICIADO\n"
        f"job_id={job_uuid}\n"
        "=========================================",
        flush=True,
    )

    # ========================================================
    # 1. CARGAR JOB Y CURSO
    # ========================================================

    db = SessionLocal()

    try:

        job = (
            db.query(
                CurriculumFeedbackJob
            )
            .filter(
                CurriculumFeedbackJob.id
                == job_uuid
            )
            .first()
        )

        if not job:

            print(
                "❌ [CURRICULUM JOB] "
                f"No existe job={job_uuid}",
                flush=True,
            )

            return

        # Protección contra ejecución duplicada.
        if job.status == "completed":

            print(
                "ℹ️ [CURRICULUM JOB] "
                f"Job ya completado={job_uuid}",
                flush=True,
            )

            return

        course = (
            db.query(
                CourseCatalog
            )
            .filter(
                CourseCatalog.area
                == job.area,

                CourseCatalog.code
                == job.course_code,

                CourseCatalog.is_active
                == True,
            )
            .first()
        )

        if not course:

            job.status = "failed"
            job.progress = 100
            job.error = (
                "El curso ya no existe "
                "o está inactivo en el catálogo."
            )
            job.finished_at = utc_now()

            db.commit()

            return

        # Copiar únicamente datos simples antes
        # de cerrar la sesión.
        course_id = course.id

        semester = job.semester
        year = job.year

        write_output = bool(
            job.write_output
        )

        feedback_column = (
            job.feedback_column
        )

        job.status = "processing"
        job.progress = 10
        job.started_at = utc_now()
        job.error = None

        db.commit()

    except Exception:

        db.rollback()
        raise

    finally:

        db.close()

    # ========================================================
    # 2. NUEVA SESIÓN PARA RECUPERAR COURSE
    # ========================================================

    db = SessionLocal()

    try:

        course = (
            db.query(
                CourseCatalog
            )
            .filter(
                CourseCatalog.id
                == course_id
            )
            .first()
        )

        if not course:
            raise RuntimeError(
                "No se pudo recuperar "
                "el curso del job"
            )

        # Lo desacoplamos completamente
        # de la sesión antes del procesamiento largo.
        db.expunge(
            course
        )

    finally:

        db.close()

    # ========================================================
    # 3. PROCESAMIENTO PESADO
    # ========================================================

    try:

        print(
            "🤖 [CURRICULUM JOB] "
            "Ejecutando análisis | "
            f"job={job_uuid} | "
            f"curso={course.code}",
            flush=True,
        )

        result = (
            curriculum_feedback_service
            .analyze_course(
                course=course,
                semester=semester,
                year=year,
                write_output=write_output,
                feedback_column=feedback_column,
            )
        )

        # ====================================================
        # 4. GUARDAR RESULTADO
        # ====================================================

        db = SessionLocal()

        try:

            job = (
                db.query(
                    CurriculumFeedbackJob
                )
                .filter(
                    CurriculumFeedbackJob.id
                    == job_uuid
                )
                .first()
            )

            if not job:
                return

            job.status = "completed"
            job.progress = 100
            job.result = result
            job.error = None
            job.finished_at = utc_now()

            provider = (
                result.get(
                    "provider",
                    {}
                )
            )

            job.provider = provider.get(
                "name"
            )

            job.model = provider.get(
                "model"
            )

            db.commit()

            print(
                "✅ [CURRICULUM JOB] "
                "Job completado | "
                f"job={job_uuid} | "
                f"curso={course.code}",
                flush=True,
            )

        except Exception:

            db.rollback()
            raise

        finally:

            db.close()

    # ========================================================
    # ERROR DEL JOB
    # ========================================================

    except Exception as exc:

        traceback.print_exc()

        print(
            "❌ [CURRICULUM JOB] "
            "Error procesando job | "
            f"job={job_uuid} | "
            f"tipo={type(exc).__name__} | "
            f"error={exc}",
            flush=True,
        )

        db = SessionLocal()

        try:

            job = (
                db.query(
                    CurriculumFeedbackJob
                )
                .filter(
                    CurriculumFeedbackJob.id
                    == job_uuid
                )
                .first()
            )

            if job:

                job.status = "failed"
                job.progress = 100
                job.error = str(
                    exc
                )[:10000]

                job.finished_at = utc_now()

                db.commit()

        except Exception:

            db.rollback()
            traceback.print_exc()

        finally:

            db.close()