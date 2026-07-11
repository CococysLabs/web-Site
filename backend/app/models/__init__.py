"""
Modelos de base de datos
"""
from app.models.user import User, UserRole
from app.models.document import Document, DocumentType, DocumentStatus
from app.models.validation import ValidationCriteria, DriveFolder
from app.models.system_setting import SystemSetting
from app.models.validation_record import ValidationRecord
from app.models.course_catalog import CourseCatalog

__all__ = [
    "User",
    "UserRole",
    "Document",
    "DocumentType",
    "DocumentStatus",
    "ValidationCriteria",
    "DriveFolder",
    "SystemSetting",
    "ValidationRecord",
    "CourseCatalog",
]

