"""
Job persistente para análisis de retroalimentación curricular.
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


class CurriculumFeedbackJob(Base):
    __tablename__ = "curriculum_feedback_jobs"

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

    area = Column(
        String(100),
        nullable=False,
        index=True,
    )

    course_code = Column(
        String(20),
        nullable=False,
        index=True,
    )

    course_name = Column(
        String(300),
        nullable=False,
    )

    semester = Column(
        String(10),
        nullable=False,
    )

    year = Column(
        Integer,
        nullable=False,
    )

    write_output = Column(
        Boolean,
        nullable=False,
        default=False,
    )

    feedback_column = Column(
        String(3),
        nullable=True,
    )

    # queued
    # processing
    # completed
    # failed
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

    provider = Column(
        String(50),
        nullable=True,
    )

    model = Column(
        String(150),
        nullable=True,
    )

    result = Column(
        JSON,
        nullable=True,
    )

    error = Column(
        Text,
        nullable=True,
    )

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
            f"<CurriculumFeedbackJob "
            f"{self.id} "
            f"{self.course_code} "
            f"{self.status}>"
        )