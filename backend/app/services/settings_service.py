"""
Servicio para leer/escribir configuración del sistema desde la BD.
Los settings se persisten en la tabla system_settings.
"""
import json
from typing import Any, Dict, Optional
from sqlalchemy.orm import Session

from app.models.system_setting import SystemSetting


# ─── Defaults semilla ────────────────────────────────────────────────────────

DEFAULT_SETTINGS: Dict[str, Dict[str, Any]] = {
    # ── Google Drive ────────────────────────────────────────────────────────────
    "drive_root_folder_id": {
        "value": "1Zr0uo96b8Nyj97wxzOt17yCdqfgxbWbl",
        "value_type": "string",
        "category": "drive",
        "label": "Carpeta raíz de Google Drive",
        "description": "ID de la carpeta principal de Google Drive que contiene los cursos.",
        "is_sensitive": False,
    },
    # ── Proveedores de IA ───────────────────────────────────────────────────────
    "deepseek_enabled": {
        "value": "true",
        "value_type": "boolean",
        "category": "ai",
        "label": "Habilitar DeepSeek (proveedor principal)",
        "description": "Proveedor principal de IA. Si se desactiva, el sistema salta directamente a Gemini.",
        "is_sensitive": False,
    },
    "gemini_enabled": {
        "value": "true",
        "value_type": "boolean",
        "category": "ai",
        "label": "Habilitar Gemini (fallback 1)",
        "description": "Segundo proveedor en la cadena. Actúa como respaldo si DeepSeek falla o está desactivado.",
        "is_sensitive": False,
    },
    "gemini_model": {
        "value": "gemini-2.0-flash",
        "value_type": "string",
        "category": "ai",
        "label": "Modelo de Gemini",
        "description": "Modelo de Gemini a usar cuando actúa como fallback.",
        "is_sensitive": False,
    },
    "groq_enabled": {
        "value": "true",
        "value_type": "boolean",
        "category": "ai",
        "label": "Habilitar Groq (fallback 2)",
        "description": "Tercer proveedor en la cadena. Actúa como respaldo si Gemini falla o está desactivado.",
        "is_sensitive": False,
    },
    "openrouter_enabled": {
        "value": "true",
        "value_type": "boolean",
        "category": "ai",
        "label": "Habilitar OpenRouter (fallback 3)",
        "description": "Cuarto proveedor en la cadena. Último respaldo antes de la validación por palabras clave.",
        "is_sensitive": False,
    },
    "ai_temperature": {
        "value": "0.05",
        "value_type": "string",
        "category": "ai",
        "label": "Temperatura de los modelos",
        "description": "Controla la aleatoriedad de las respuestas (0.0 = determinista, 1.0 = muy creativo). Recomendado: 0.05.",
        "is_sensitive": False,
    },
    "ai_max_tokens": {
        "value": "2000",
        "value_type": "integer",
        "category": "ai",
        "label": "Tokens máximos por respuesta",
        "description": "Límite de tokens en la respuesta de cada proveedor. Afecta el costo y la verbosidad de las observaciones.",
        "is_sensitive": False,
    },
    # ── API Keys de proveedores (sensibles, se almacenan encriptadas en BD) ────
    "gemini_api_keys": {
        "value": "[]",
        "value_type": "json",
        "category": "ai",
        "label": "API Keys de Gemini",
        "description": "Lista de API Keys de Google Gemini. Se combinan con las configuradas en variables de entorno. Soporta múltiples keys para rotación automática.",
        "is_sensitive": True,
    },
    "deepseek_api_keys": {
        "value": "[]",
        "value_type": "json",
        "category": "ai",
        "label": "API Keys de DeepSeek",
        "description": "Lista de API Keys de DeepSeek. Se combinan con la configurada en variables de entorno.",
        "is_sensitive": True,
    },
    "groq_api_keys": {
        "value": "[]",
        "value_type": "json",
        "category": "ai",
        "label": "API Keys de Groq",
        "description": "Lista de API Keys de Groq. Se combinan con la configurada en variables de entorno.",
        "is_sensitive": True,
    },
    "openrouter_api_keys": {
        "value": "[]",
        "value_type": "json",
        "category": "ai",
        "label": "API Keys de OpenRouter",
        "description": "Lista de API Keys de OpenRouter. Se combinan con la configurada en variables de entorno.",
        "is_sensitive": True,
    },
    # ── Gestión de usuarios ─────────────────────────────────────────────────────
    "auto_approve_users": {
        "value": "false",
        "value_type": "boolean",
        "category": "users",
        "label": "Auto-aprobar usuarios nuevos",
        "description": "Si está activo, los estudiantes se aprueban automáticamente al registrarse sin revisión del administrador.",
        "is_sensitive": False,
    },
    "jwt_session_minutes": {
        "value": "30",
        "value_type": "integer",
        "category": "users",
        "label": "Duración de sesión (minutos)",
        "description": "Tiempo en minutos antes de que el token JWT expire y el usuario deba volver a iniciar sesión.",
        "is_sensitive": False,
    },
    # ── Criterios de validación ─────────────────────────────────────────────────
    "compliance_threshold": {
        "value": "70",
        "value_type": "integer",
        "category": "validation",
        "label": "Umbral mínimo de cumplimiento (%)",
        "description": "Porcentaje mínimo de requisitos cubiertos para considerar una sección como aprobada.",
        "is_sensitive": False,
    },
    "allowed_file_extensions": {
        "value": '[\".pdf\", \".docx\", \".pptx\", \".xlsx\"]',
        "value_type": "json",
        "category": "validation",
        "label": "Extensiones de archivo permitidas",
        "description": "Lista de extensiones de archivo aceptadas para análisis y validación.",
        "is_sensitive": False,
    },
    "max_upload_file_size_mb": {
        "value": "10",
        "value_type": "integer",
        "category": "validation",
        "label": "Tamaño máximo de archivo (MB)",
        "description": "Límite de tamaño para archivos subidos al sistema para análisis.",
        "is_sensitive": False,
    },
    "validation_cache_minutes": {
        "value": "60",
        "value_type": "integer",
        "category": "validation",
        "label": "Caché de validaciones (minutos)",
        "description": "Tiempo en minutos durante el cual se reutiliza un resultado de validación previo para la misma carpeta. Poner 0 para desactivar el caché.",
        "is_sensitive": False,
    },
    "min_confidence_threshold": {
        "value": "0.5",
        "value_type": "string",
        "category": "validation",
        "label": "Umbral mínimo de confianza de IA",
        "description": "Resultados con confianza menor a este valor se marcan como 'requiere revisión'. Rango: 0.0–1.0.",
        "is_sensitive": False,
    },
}

# Orden de display por categoría
CATEGORY_ORDER = ["drive", "ai", "users", "validation"]
CATEGORY_LABELS = {
    "drive":      "Google Drive",
    "ai":         "Proveedores de IA",
    "users":      "Gestión de Usuarios",
    "validation": "Criterios de Validación",
}


class SettingsService:
    """Lee y escribe configuración del sistema desde/hacia PostgreSQL."""

    # ──────────────────────────────────────────────────────────────────────────
    # Lectura
    # ──────────────────────────────────────────────────────────────────────────

    def get(self, key: str, db: Session, default: Optional[str] = None) -> Optional[str]:
        """
        Lee el valor de un setting.
        Prioridad: BD → DEFAULT_SETTINGS → parámetro `default`.
        """
        row = db.query(SystemSetting).filter(SystemSetting.key == key).first()
        if row is not None:
            return row.value
        if key in DEFAULT_SETTINGS:
            return DEFAULT_SETTINGS[key]["value"]
        return default

    def get_bool(self, key: str, db: Session) -> bool:
        val = (self.get(key, db) or "false").strip().lower()
        return val in ("true", "1", "yes", "on")

    def get_int(self, key: str, db: Session, default: int = 0) -> int:
        try:
            return int(self.get(key, db) or default)
        except (ValueError, TypeError):
            return default

    def get_json(self, key: str, db: Session, default: Any = None) -> Any:
        raw = self.get(key, db)
        if not raw:
            return default
        try:
            return json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            return default

    def get_all_grouped(self, db: Session) -> Dict[str, Any]:
        """
        Retorna todos los settings agrupados por categoría, listos para la API.
        Para keys marcados como is_sensitive, omite el value en la respuesta.
        """
        # Leer todos los rows de BD
        rows = {r.key: r for r in db.query(SystemSetting).all()}

        grouped: Dict[str, Any] = {}
        for cat in CATEGORY_ORDER:
            grouped[cat] = {
                "label": CATEGORY_LABELS.get(cat, cat),
                "settings": {}
            }

        for key, meta in DEFAULT_SETTINGS.items():
            cat = meta["category"]
            row = rows.get(key)
            value = row.value if row else meta["value"]
            is_sensitive = meta.get("is_sensitive", False)

            # Para API keys (json array sensible): devolver el array de keys
            # ofuscadas (solo primeros 8 chars + "...") para que el admin
            # pueda ver cuántas hay y cuáles son sin exponer el valor completo.
            if is_sensitive and meta["value_type"] == "json":
                try:
                    raw_list = json.loads(value or "[]")
                    display_value = [k[:8] + "..." if len(k) > 8 else k for k in raw_list]
                    display_count = len(raw_list)
                except Exception:
                    display_value = []
                    display_count = 0
                grouped[cat]["settings"][key] = {
                    "value":        display_value,
                    "key_count":    display_count,
                    "value_type":   meta["value_type"],
                    "label":        meta["label"],
                    "description":  meta["description"],
                    "is_sensitive": True,
                    "updated_at":   row.updated_at.isoformat() if row and row.updated_at else None,
                }
            else:
                grouped[cat]["settings"][key] = {
                    "value":       value if not is_sensitive else "***",
                    "value_type":  meta["value_type"],
                    "label":       meta["label"],
                    "description": meta["description"],
                    "is_sensitive": is_sensitive,
                    "updated_at":  row.updated_at.isoformat() if row and row.updated_at else None,
                }

        return grouped

    # ──────────────────────────────────────────────────────────────────────────
    # Escritura
    # ──────────────────────────────────────────────────────────────────────────

    def upsert(self, key: str, value: str, user_id, db: Session) -> SystemSetting:
        """
        Crea o actualiza un setting. Lanza ValueError si la key no está definida.
        """
        if key not in DEFAULT_SETTINGS:
            raise ValueError(f"Setting desconocido: '{key}'")

        meta = DEFAULT_SETTINGS[key]
        row = db.query(SystemSetting).filter(SystemSetting.key == key).first()

        if row:
            row.value      = value
            row.updated_by = user_id
        else:
            row = SystemSetting(
                key         = key,
                value       = value,
                value_type  = meta["value_type"],
                category    = meta["category"],
                label       = meta["label"],
                description = meta["description"],
                is_sensitive = meta.get("is_sensitive", False),
                updated_by  = user_id,
            )
            db.add(row)

        db.commit()
        db.refresh(row)
        return row

    # ──────────────────────────────────────────────────────────────────────────
    # Inicialización
    # ──────────────────────────────────────────────────────────────────────────

    def initialize_defaults(self, db: Session):
        """
        Inserta los defaults que no existan en BD.
        Llamado en startup de la aplicación.
        Para drive_root_folder_id usa el valor de la variable de entorno si no hay valor.
        """
        try:
            from app.config import settings as env_settings
            existing_keys = {r.key for r in db.query(SystemSetting.key).all()}
            inserted = 0

            for key, meta in DEFAULT_SETTINGS.items():
                if key in existing_keys:
                    continue

                # Valor inicial para la carpeta raíz Drive
                value = meta["value"]
                if key == "drive_root_folder_id":
                    env_val = getattr(env_settings, 'GOOGLE_DRIVE_FOLDER_ID', None) or ""
                    value = env_val

                row = SystemSetting(
                    key         = key,
                    value       = value,
                    value_type  = meta["value_type"],
                    category    = meta["category"],
                    label       = meta["label"],
                    description = meta["description"],
                    is_sensitive = meta.get("is_sensitive", False),
                )
                db.add(row)
                inserted += 1

            if inserted:
                db.commit()
                print(f"✅ Defaults de sistema inicializados: {inserted} setting(s) agregado(s)")
            else:
                print("✅ Settings de sistema: todos los defaults ya existen en BD")

        except Exception as e:
            db.rollback()
            print(f"⚠️  Error inicializando defaults de sistema: {e}")


settings_service = SettingsService()
