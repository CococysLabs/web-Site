"""
Endpoints de configuración del sistema (solo administradores)
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Dict, Any
from pydantic import BaseModel

from app.database import get_db
from app.models.user import User, UserRole
from app.services.settings_service import settings_service, DEFAULT_SETTINGS
from app.utils.auth import get_current_user

router = APIRouter(prefix="/api/admin/settings", tags=["Configuración"])


# ─── Schemas ─────────────────────────────────────────────────────────────────

class SettingUpdateRequest(BaseModel):
    value: str


class BulkUpdateRequest(BaseModel):
    settings: Dict[str, str]


# ─── Helper ──────────────────────────────────────────────────────────────────

def _require_admin(current_user: User):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo administradores pueden gestionar la configuración del sistema"
        )


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("")
async def get_all_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Obtener toda la configuración del sistema agrupada por categoría.
    Solo accesible por administradores.
    """
    _require_admin(current_user)
    return {
        "success": True,
        "data": settings_service.get_all_grouped(db)
    }


@router.put("/{key}")
async def update_setting(
    key: str,
    request: SettingUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Actualizar un setting individual.
    """
    _require_admin(current_user)

    if key not in DEFAULT_SETTINGS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Setting desconocido: '{key}'"
        )

    try:
        row = settings_service.upsert(key, request.value, current_user.id, db)
        return {
            "success": True,
            "message": f"Setting '{key}' actualizado correctamente",
            "key": key,
            "value": row.value,
            "updated_at": row.updated_at.isoformat() if row.updated_at else None
        }
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/bulk")
async def bulk_update_settings(
    request: BulkUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Actualizar múltiples settings a la vez.
    Body: {"settings": {"key1": "value1", "key2": "value2"}}
    """
    _require_admin(current_user)

    unknown = [k for k in request.settings if k not in DEFAULT_SETTINGS]
    if unknown:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Settings desconocidos: {unknown}"
        )

    updated = []
    for key, value in request.settings.items():
        settings_service.upsert(key, value, current_user.id, db)
        updated.append(key)

    return {
        "success": True,
        "message": f"{len(updated)} setting(s) actualizado(s)",
        "updated": updated
    }


@router.post("/reset/{key}")
async def reset_setting(
    key: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Restaurar un setting a su valor por defecto.
    """
    _require_admin(current_user)

    if key not in DEFAULT_SETTINGS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Setting desconocido: '{key}'"
        )

    default_value = DEFAULT_SETTINGS[key]["value"]
    row = settings_service.upsert(key, default_value, current_user.id, db)

    return {
        "success": True,
        "message": f"Setting '{key}' restaurado al valor por defecto",
        "key": key,
        "value": row.value
    }
