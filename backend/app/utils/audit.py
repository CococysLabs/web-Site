"""
Helper para registrar acciones en el log de auditoría.
"""
from typing import Any, Dict, Optional
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog


def log_action(
    db: Session,
    action: str,
    user_id=None,
    user_email: Optional[str] = None,
    target_type: Optional[str] = None,
    target_id: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
    ip_address: Optional[str] = None,
):
    """
    Registra una acción en audit_logs. Silencia errores para no interrumpir flujo.

    Ejemplos de action: "user.approve", "user.reject", "user.toggle_active",
    "settings.update", "api_key.add", "api_key.delete", "user.update_config"
    """
    try:
        entry = AuditLog(
            user_id=user_id,
            user_email=user_email,
            action=action,
            target_type=target_type,
            target_id=str(target_id) if target_id is not None else None,
            details=details,
            ip_address=ip_address,
        )
        db.add(entry)
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"⚠️  audit_log error ({action}): {e}")
