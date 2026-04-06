"""
Endpoints de configuración del sistema (solo administradores)
"""
import json
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Dict, Any
from pydantic import BaseModel

from app.database import get_db
from app.models.user import User, UserRole
from app.services.settings_service import settings_service, DEFAULT_SETTINGS
from app.utils.auth import get_current_user
from app.utils.audit import log_action

router = APIRouter(prefix="/api/admin/settings", tags=["Configuración"])

# Keys que almacenan listas de API keys
API_KEY_SETTINGS = {"gemini_api_keys", "deepseek_api_keys", "groq_api_keys", "openrouter_api_keys"}

# ─── Schemas ─────────────────────────────────────────────────────────────────

class SettingUpdateRequest(BaseModel):
    value: str


class BulkUpdateRequest(BaseModel):
    settings: Dict[str, str]


class ApiKeyAddRequest(BaseModel):
    key: str       # nueva API key a agregar


class ApiKeyRemoveRequest(BaseModel):
    index: int     # índice en la lista a eliminar


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
        log_action(db, "settings.update", user_id=current_user.id, user_email=current_user.correo,
                   target_type="setting", target_id=key,
                   details={"new_value": request.value if not DEFAULT_SETTINGS[key].get("is_sensitive") else "***"})
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

    log_action(db, "settings.bulk_update", user_id=current_user.id, user_email=current_user.correo,
               target_type="setting", details={"keys": updated, "count": len(updated)})

    return {
        "success": True,
        "message": f"{len(updated)} setting(s) actualizado(s)",
        "updated": updated
    }


@router.post("/api-keys/{key}/add")
async def add_api_key(
    key: str,
    request: ApiKeyAddRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Agrega una API key a la lista del proveedor indicado."""
    _require_admin(current_user)
    if key not in API_KEY_SETTINGS:
        raise HTTPException(status_code=400, detail=f"'{key}' no es una lista de API keys")

    new_key = request.key.strip()
    if not new_key:
        raise HTTPException(status_code=400, detail="La API key no puede estar vacía")

    raw = settings_service.get(key, db) or "[]"
    try:
        keys_list = json.loads(raw)
    except Exception:
        keys_list = []

    if new_key in keys_list:
        raise HTTPException(status_code=400, detail="Esa API key ya está registrada")

    keys_list.append(new_key)
    settings_service.upsert(key, json.dumps(keys_list), current_user.id, db)
    log_action(db, "api_key.add", user_id=current_user.id, user_email=current_user.correo,
               target_type="api_key", target_id=key,
               details={"provider_setting": key, "key_count": len(keys_list)})

    return {"success": True, "key_count": len(keys_list), "message": f"API key agregada ({len(keys_list)} total)"}


@router.delete("/api-keys/{key}/{index}")
async def remove_api_key(
    key: str,
    index: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Elimina la API key en la posición `index` de la lista del proveedor."""
    _require_admin(current_user)
    if key not in API_KEY_SETTINGS:
        raise HTTPException(status_code=400, detail=f"'{key}' no es una lista de API keys")

    raw = settings_service.get(key, db) or "[]"
    try:
        keys_list = json.loads(raw)
    except Exception:
        keys_list = []

    if index < 0 or index >= len(keys_list):
        raise HTTPException(status_code=400, detail=f"Índice {index} fuera de rango")

    keys_list.pop(index)
    settings_service.upsert(key, json.dumps(keys_list), current_user.id, db)
    log_action(db, "api_key.delete", user_id=current_user.id, user_email=current_user.correo,
               target_type="api_key", target_id=key,
               details={"provider_setting": key, "key_count": len(keys_list)})

    return {"success": True, "key_count": len(keys_list), "message": f"API key eliminada ({len(keys_list)} restantes)"}


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


# ─── Audit Log ────────────────────────────────────────────────────────────────

@router.get("/audit-log")
async def get_audit_log(
    action: str = None,
    limit: int = 100,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retorna el log de auditoría paginado (solo admins)."""
    _require_admin(current_user)
    from app.models.audit_log import AuditLog
    from sqlalchemy import desc as _desc
    q = db.query(AuditLog)
    if action:
        q = q.filter(AuditLog.action == action)
    total = q.count()
    entries = q.order_by(_desc(AuditLog.created_at)).offset(offset).limit(limit).all()
    return {
        "total": total,
        "offset": offset,
        "limit": limit,
        "entries": [
            {
                "id":          str(e.id),
                "user_email":  e.user_email,
                "action":      e.action,
                "target_type": e.target_type,
                "target_id":   e.target_id,
                "details":     e.details,
                "ip_address":  str(e.ip_address) if e.ip_address else None,
                "created_at":  e.created_at.isoformat() if e.created_at else None,
            }
            for e in entries
        ]
    }
