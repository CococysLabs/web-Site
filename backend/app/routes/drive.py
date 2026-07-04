"""
Rutas de Google Drive
"""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
import csv
import io
import re
import unicodedata

from app.config import settings
from app.database import get_db
from app.models.user import User, UserRole
from app.models.validation import DriveFolder
from app.services.drive_service import drive_service
from app.utils.auth import get_current_user

router = APIRouter(prefix="/api/drive", tags=["drive"])


def _ensure_user_folder_scope(current_user: User, folder_id: str):
    """Restringe a estudiantes a su carpeta asignada y subcarpetas."""
    if current_user.role == UserRole.ADMIN:
        return

    user_root_folder_id = getattr(current_user, "drive_folder_id", None)
    if not user_root_folder_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes una carpeta de Drive asignada"
        )

    if not drive_service.is_descendant_or_same(folder_id, user_root_folder_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permiso para acceder a esta carpeta"
        )


# Schemas
class FolderResponse(BaseModel):
    id: str
    name: str
    webViewLink: Optional[str] = None
    createdTime: Optional[str] = None
    
    class Config:
        from_attributes = True


class FileResponse(BaseModel):
    id: str
    name: str
    mimeType: str
    size: Optional[str] = None
    webViewLink: Optional[str] = None
    
    class Config:
        from_attributes = True


class SyncFolderRequest(BaseModel):
    folder_id: str
    folder_name: str
    auto_sync: bool = False

DEFAULT_STRUCTURE_ROOT_FOLDER_ID = "1kKtxjCV9cXxkS_BeQv95Ud5M_Q0S77aA"


def _get_structure_root_folder_id() -> str:
    """
    Esta raíz es SOLO para crear carpetas desde CSV.
    No debe confundirse con GOOGLE_DRIVE_FOLDER_ID, que se usa para análisis.
    """
    return (
        getattr(settings, "GOOGLE_DRIVE_STRUCTURE_FOLDER_ID", None)
        or DEFAULT_STRUCTURE_ROOT_FOLDER_ID
    )


def _user_can_create_folders(current_user: User) -> bool:
    """
    Permite crear carpetas a:
    - Admin
    - Usuarios marcados como Teacher
    """
    return (
        current_user.role == UserRole.ADMIN
        or bool(getattr(current_user, "is_teacher", False))
    )


def _cell(row: list, index: int) -> str:
    if index >= len(row):
        return ""
    return str(row[index] or "").strip()


def _normalize_text(value: str) -> str:
    value = str(value or "").strip().casefold()
    value = re.sub(r"\s+", " ", value)
    nfkd = unicodedata.normalize("NFKD", value)
    return "".join(c for c in nfkd if not unicodedata.combining(c))


def _strip_number_prefix(value: str) -> str:
    """
    Convierte:
    - '2. Software' -> 'Software'
    - '5_Contenidos' -> 'Contenidos'
    """
    return re.sub(r"^\d+[\s_\-.]+", "", str(value or "").strip())


def _numbered_name(number: str, name: str) -> str:
    """
    Convierte:
    number='5', name='Contenidos' -> '5_Contenidos'

    Si name ya viene numerado, lo deja igual.
    """
    number = str(number or "").strip()
    name = str(name or "").strip()

    if not number:
        return name

    if re.match(rf"^{re.escape(number)}[\s_\-.]+", name):
        return name

    return f"{number}_{name}"


def _decode_csv(content: bytes) -> str:
    for encoding in ("utf-8-sig", "utf-8", "latin-1"):
        try:
            return content.decode(encoding)
        except UnicodeDecodeError:
            continue
    return content.decode("utf-8", errors="replace")


def _read_csv_rows(content: bytes) -> List[List[str]]:
    text = _decode_csv(content)
    sample = text[:4096]

    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;")
    except Exception:
        dialect = csv.excel

    reader = csv.reader(io.StringIO(text), dialect)
    return [[str(c or "").strip() for c in row] for row in reader]


def _first_non_empty_after_label(rows: list, label_index: int) -> Optional[str]:
    """
    Soporta:
    Area,,,
    2. Software,,,

    Y también:
    Area,2. Software
    """
    same_row = rows[label_index]
    for value in same_row[1:]:
        if str(value or "").strip():
            return str(value).strip()

    for i in range(label_index + 1, len(rows)):
        value = _cell(rows[i], 0)
        if value:
            return value

    return None


def _parse_course_structure_csv(content: bytes) -> Dict[str, Any]:
    """
    Lee CSV con formato:

    Area,,,
    2. Software,,,

    Curso,,,
    283_Analisis_y_Diseño_de_Sistemas_1_2S_2026,,,

    No.,Carpeta,No.,Sub Carpeta
    5,Contenidos,2,Semana_2

    Retorna:
    {
      area: str,
      course: str,
      folders: [
        {
          folder_name: str,
          folder_aliases: list[str],
          subfolders: [
            {subfolder_name: str, subfolder_aliases: list[str]}
          ]
        }
      ]
    }
    """
    rows = _read_csv_rows(content)

    area = None
    course = None
    header_index = None

    for i, row in enumerate(rows):
        first = _normalize_text(_cell(row, 0))

        if first == "area":
            area = _first_non_empty_after_label(rows, i)

        if first == "curso":
            course = _first_non_empty_after_label(rows, i)

        col0 = _normalize_text(_cell(row, 0)).replace(".", "")
        col1 = _normalize_text(_cell(row, 1))
        col2 = _normalize_text(_cell(row, 2)).replace(".", "")
        col3 = _normalize_text(_cell(row, 3))

        if col0 == "no" and "carpeta" in col1 and (col2 == "no" or "sub" in col3):
            header_index = i
            break

    if not area:
        raise ValueError("No se encontró el valor de Area en el CSV")

    if not course:
        raise ValueError("No se encontró el valor de Curso en el CSV")

    if header_index is None:
        raise ValueError("No se encontró la fila de encabezados: No.,Carpeta,No.,Sub Carpeta")

    folder_map: Dict[str, Dict[str, Any]] = {}
    ordered_folders: List[Dict[str, Any]] = []
    current_parent_key = None

    for row in rows[header_index + 1:]:
        folder_no = _cell(row, 0)
        folder_raw = _cell(row, 1)
        sub_no = _cell(row, 2)
        sub_raw = _cell(row, 3)

        if not folder_raw and not sub_raw:
            continue

        if folder_raw:
            folder_name = _numbered_name(folder_no, folder_raw)
            parent_key = f"{folder_no}::{_normalize_text(folder_raw)}"
            current_parent_key = parent_key

            if parent_key not in folder_map:
                item = {
                    "folder_name": folder_name,
                    "folder_aliases": [
                        folder_raw,
                        _strip_number_prefix(folder_raw),
                        _strip_number_prefix(folder_name),
                    ],
                    "subfolders": [],
                }
                folder_map[parent_key] = item
                ordered_folders.append(item)

        elif current_parent_key:
            parent_key = current_parent_key
        else:
            continue

        if sub_raw:
            subfolder_name = _numbered_name(sub_no, sub_raw)
            folder_map[parent_key]["subfolders"].append({
                "subfolder_name": subfolder_name,
                "subfolder_aliases": [
                    sub_raw,
                    _strip_number_prefix(sub_raw),
                    _strip_number_prefix(subfolder_name),
                ],
            })

    return {
        "area": area,
        "area_aliases": [_strip_number_prefix(area)],
        "course": course,
        "folders": ordered_folders,
    }
    
@router.get("/main-folders", response_model=List[FolderResponse])
async def list_main_folders(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Listar carpetas principales configuradas en GOOGLE_DRIVE_FOLDER_ID
    Retorna: BD, Computación, Sistemas, Software
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo administradores pueden acceder"
        )
    
    from app.config import settings
    from app.services.settings_service import settings_service
    # Preferir el valor guardado en BD; fallback al env
    folder_id = settings_service.get("drive_root_folder_id", db) or settings.GOOGLE_DRIVE_FOLDER_ID

    if not folder_id:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Carpeta raíz de Drive no configurada. Configúrala en Ajustes del Sistema."
        )
    
    folders = drive_service.list_folders(folder_id)
    return folders


@router.get("/folders", response_model=List[FolderResponse])
async def list_folders(
    parent_folder_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Listar carpetas de Google Drive
    Solo accesible por administradores
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo administradores pueden acceder"
        )
    
    folders = drive_service.list_folders(parent_folder_id)
    return folders


@router.get("/files/{folder_id}", response_model=List[FileResponse])
async def list_files(
    folder_id: str,
    file_types: Optional[str] = None,  # Ej: "pdf,excel"
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Listar archivos en una carpeta de Drive
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo administradores pueden acceder"
        )
    
    # Parsear tipos de archivo
    types_list = None
    if file_types:
        types_list = [t.strip() for t in file_types.split(",")]
    
    files = drive_service.list_files(folder_id, types_list)
    return files


@router.get("/contents/{folder_id}")
async def list_contents(
    folder_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Listar carpetas y archivos en una carpeta de Drive (navegación jerárquica).
    Admins: acceso total.
    Estudiantes: solo si tienen permiso can_view_drive.
    """
    is_admin = current_user.role == UserRole.ADMIN
    permissions = getattr(current_user, "permissions", None) or {}
    can_view = permissions.get("can_view_drive", False)

    if not is_admin and not can_view:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permiso para explorar carpetas de Drive"
        )

    _ensure_user_folder_scope(current_user, folder_id)

    # Obtener carpetas y archivos
    folders = drive_service.list_folders(folder_id)
    files = drive_service.list_files(folder_id)

    return {
        'folders': folders,
        'files': files
    }

@router.post("/create-folders-from-csv")
async def create_folders_from_csv(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Crear estructura de carpetas en Google Drive a partir de un CSV.

    IMPORTANTE:
    - Siempre crea dentro de GOOGLE_DRIVE_STRUCTURE_FOLDER_ID.
    - No usa GOOGLE_DRIVE_FOLDER_ID.
    - No usa current_user.drive_folder_id.
    - Solo admin o usuarios Teacher.
    """
    if not _user_can_create_folders(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo administradores o usuarios Teacher pueden crear carpetas"
        )

    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo debe ser CSV"
        )

    root_folder_id = _get_structure_root_folder_id()

    try:
        content = await file.read()
        parsed = _parse_course_structure_csv(content)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No se pudo leer el CSV: {str(e)}"
        )

    created = []
    existing = []
    errors = []

    def register(folder: Dict, path: str):
        item = {
            "id": folder.get("id"),
            "name": folder.get("name"),
            "path": path,
            "webViewLink": folder.get("webViewLink"),
        }

        if folder.get("created"):
            created.append(item)
        else:
            existing.append(item)

    def ensure_folder(parent_id: str, name: str, aliases: list, path: str):
        folder = drive_service.get_or_create_folder(
            parent_folder_id=parent_id,
            folder_name=name,
            aliases=aliases,
        )

        if not folder:
            errors.append({
                "path": path,
                "error": f"No se pudo crear o encontrar la carpeta '{name}'"
            })
            return None

        register(folder, path)
        return folder

    area_name = parsed["area"]
    course_name = parsed["course"]

    # 1. Area dentro de la nueva raíz 1kK...
    area_folder = ensure_folder(
        root_folder_id,
        area_name,
        parsed.get("area_aliases", []),
        area_name,
    )

    if not area_folder:
        return {
            "success": False,
            "message": "No se pudo crear/encontrar la carpeta de Area",
            "root_folder_id": root_folder_id,
            "errors": errors,
        }

    # 2. Curso dentro del Area
    course_folder = ensure_folder(
        area_folder["id"],
        course_name,
        [],
        f"{area_name}/{course_name}",
    )

    if not course_folder:
        return {
            "success": False,
            "message": "No se pudo crear/encontrar la carpeta de Curso",
            "root_folder_id": root_folder_id,
            "errors": errors,
        }

    # 3. Carpetas y subcarpetas del curso
    for folder_item in parsed["folders"]:
        parent_name = folder_item["folder_name"]
        parent_path = f"{area_name}/{course_name}/{parent_name}"

        parent_folder = ensure_folder(
            course_folder["id"],
            parent_name,
            folder_item.get("folder_aliases", []),
            parent_path,
        )

        if not parent_folder:
            continue

        for sub_item in folder_item.get("subfolders", []):
            sub_name = sub_item["subfolder_name"]
            sub_path = f"{parent_path}/{sub_name}"

            ensure_folder(
                parent_folder["id"],
                sub_name,
                sub_item.get("subfolder_aliases", []),
                sub_path,
            )

    return {
        "success": len(errors) == 0,
        "message": "Estructura procesada correctamente" if not errors else "Estructura procesada con errores",
        "root_folder_id": root_folder_id,
        "area": area_name,
        "course": course_name,
        "course_folder_id": course_folder.get("id"),
        "summary": {
            "created_count": len(created),
            "existing_count": len(existing),
            "error_count": len(errors),
        },
        "created": created,
        "existing": existing,
        "errors": errors,
    }

@router.post("/sync-folder")
async def sync_folder(
    request: SyncFolderRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Sincronizar una carpeta de Drive con el sistema
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo administradores pueden sincronizar carpetas"
        )
    
    # Verificar si ya existe
    existing = db.query(DriveFolder).filter(
        DriveFolder.folder_id == request.folder_id
    ).first()
    
    if existing:
        existing.is_active = True
        existing.auto_sync = request.auto_sync
        existing.folder_name = request.folder_name
        db.commit()
        return {"message": "Carpeta actualizada", "folder": existing}
    
    # Crear nueva carpeta sincronizada
    new_folder = DriveFolder(
        folder_id=request.folder_id,
        folder_name=request.folder_name,
        auto_sync=request.auto_sync,
        is_active=True
    )
    
    db.add(new_folder)
    db.commit()
    db.refresh(new_folder)
    
    return {"message": "Carpeta sincronizada exitosamente", "folder": new_folder}


@router.get("/synced-folders")
async def get_synced_folders(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Obtener carpetas sincronizadas"""
    folders = db.query(DriveFolder).filter(DriveFolder.is_active == True).all()
    return folders


@router.get("/folder-structure/{folder_id}")
async def get_folder_structure(
    folder_id: str,
    depth: int = 2,
    current_user: User = Depends(get_current_user)
):
    """
    Obtener estructura completa de una carpeta
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo administradores pueden acceder"
        )
    
    structure = drive_service.get_folder_structure(folder_id, depth)
    return structure


@router.get("/search")
async def search_files(
    query: str,
    folder_id: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Buscar archivos en Drive"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo administradores pueden buscar"
        )
    
    files = drive_service.search_files(query, folder_id)
    return files
