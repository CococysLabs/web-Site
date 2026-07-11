"""
Crear estructuras de carpetas en Google Drive usando:
- CSV como plantilla de estructura.
- Catálogo de cursos desde BD.
- Área seleccionada.
- Cursos seleccionados.
- Semestre y año.

No usa GOOGLE_DRIVE_FOLDER_ID.
Usa exclusivamente GOOGLE_DRIVE_STRUCTURE_FOLDER_ID.
"""
import csv
import io
import json
import re
import unicodedata
from collections import OrderedDict
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.course_catalog import CourseCatalog
from app.models.user import User, UserRole
from app.services.drive_service import drive_service
from app.utils.auth import get_current_active_user


router = APIRouter(prefix="/api/drive-structures", tags=["drive-structures"])


DEFAULT_STRUCTURE_ROOT_FOLDER_ID = "1kKtxjCV9cXxkS_BeQv95Ud5M_Q0S77aA"

AREA_FOLDER_NAMES = {
    # CAMBIAR EL NOMBRE DE LAS CARPETAS SI SE MODIFICA
    "Software": "2. Software",
    "Sistemas": "3. Sistemas",
    "Computacion": "4. Computacion",
}


def _get_structure_root_folder_id() -> str:
    return (
        getattr(settings, "GOOGLE_DRIVE_STRUCTURE_FOLDER_ID", None)
        or DEFAULT_STRUCTURE_ROOT_FOLDER_ID
    )


def _can_create_drive_structures(current_user: User) -> bool:
    """
    Pueden crear estructuras:
    - Administradores
    - Usuarios Teacher
    """
    return (
        current_user.role == UserRole.ADMIN
        or bool(getattr(current_user, "is_teacher", False))
    )


def _normalize_label(value: str) -> str:
    value = str(value or "").strip().lower().replace("_", " ")
    value = re.sub(r"\s+", " ", value)
    normalized = unicodedata.normalize("NFKD", value)
    normalized = "".join(
        char for char in normalized if not unicodedata.combining(char)
    )
    return normalized.rstrip(".")


def _strip_number_prefix(value: str) -> str:
    """
    Convierte:
    - '2. Software' -> 'Software'
    - '5_Contenidos' -> 'Contenidos'
    """
    return re.sub(r"^\d+[\s_\-.]+", "", str(value or "").strip())


def _canonical_area(value: str) -> str:
    """
    Normaliza el área para compararla contra el catálogo.
    """
    raw = _strip_number_prefix(value)
    normalized = _normalize_label(raw).replace(" ", "")

    if normalized in ("computacion", "computación"):
        return "Computacion"

    if normalized == "software":
        return "Software"

    if normalized == "sistemas":
        return "Sistemas"

    return raw


def _cell(row: List[str], index: int) -> str:
    if index >= len(row):
        return ""
    return str(row[index] or "").strip()


def _decode_csv(content: bytes) -> str:
    for encoding in ("utf-8-sig", "utf-8", "cp1252", "latin-1"):
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
    return [[str(cell or "").strip() for cell in row] for row in reader]


def _first_non_empty_after_label(rows: List[List[str]], label_index: int) -> Optional[str]:
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

    for index in range(label_index + 1, len(rows)):
        value = _cell(rows[index], 0)
        if value:
            return value

    return None


def _numbered_name(number: str, name: str) -> str:
    number = str(number or "").strip()
    name = str(name or "").strip()

    if not name:
        return ""

    if not number:
        return name

    if re.match(rf"^{re.escape(number)}[\s_\-.]+", name):
        return name

    return f"{number}_{name}"


def _sanitize_course_name(value: str) -> str:
    """
    Convierte:
    'Análisis y Diseño de Sistemas 1'
    a:
    'Analisis_y_Diseno_de_Sistemas_1'
    """
    value = str(value or "").strip()
    normalized = unicodedata.normalize("NFKD", value)
    normalized = "".join(
        char for char in normalized if not unicodedata.combining(char)
    )

    normalized = normalized.replace("&", " y ")
    normalized = re.sub(r"[^A-Za-z0-9]+", "_", normalized)
    normalized = re.sub(r"_+", "_", normalized)
    normalized = normalized.strip("_")

    return normalized


def _build_course_folder_name(course: CourseCatalog, semester: str, year: int) -> str:
    clean_name = _sanitize_course_name(course.name)
    clean_semester = _sanitize_course_name(semester).upper()
    return f"{course.code}_{clean_name}_{clean_semester}_{year}"


def _parse_course_codes(raw: str) -> List[str]:
    """
    Recibe JSON string desde FormData.
    Ejemplo:
    ["283","785"]
    """
    if not raw:
        return []

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        raise ValueError("course_codes debe ser un JSON array válido")

    if not isinstance(parsed, list):
        raise ValueError("course_codes debe ser una lista")

    return [str(item).strip() for item in parsed if str(item).strip()]


def _parse_structure_template(content: bytes) -> Dict:
    """
    Lee el CSV de estructura.

    Nuevo formato esperado:

    No.,Carpeta,No.,Sub Carpeta
    0,Revision_de_Material,,
    1,Seguridad,,
    5,Contenidos,2,Semana_2
    5,Contenidos,3,Semana_3

    El CSV ya NO contiene Area ni Curso.
    El área viene desde el selectbox del frontend.
    Los cursos vienen desde el catálogo en BD.
    """
    rows = _read_csv_rows(content)

    header_index = None

    for index, row in enumerate(rows):
        col0 = _normalize_label(_cell(row, 0)).replace(".", "")
        col1 = _normalize_label(_cell(row, 1))
        col2 = _normalize_label(_cell(row, 2)).replace(".", "")
        col3 = _normalize_label(_cell(row, 3))

        if col0 == "no" and "carpeta" in col1 and (col2 == "no" or "sub" in col3):
            header_index = index
            break

    if header_index is None:
        raise ValueError("No se encontró la fila de encabezados: No.,Carpeta,No.,Sub Carpeta")

    folder_map: "OrderedDict[str, Dict]" = OrderedDict()
    current_parent_key = None

    for row in rows[header_index + 1:]:
        folder_no = _cell(row, 0)
        folder_raw = _cell(row, 1)
        sub_no = _cell(row, 2)
        sub_raw = _cell(row, 3)

        if not folder_raw and not sub_raw:
            continue

        if folder_raw:
            parent_name = _numbered_name(folder_no, folder_raw)
            parent_key = f"{folder_no}::{_normalize_label(folder_raw)}"
            current_parent_key = parent_key

            if parent_key not in folder_map:
                folder_map[parent_key] = {
                    "name": parent_name,
                    "subfolders": OrderedDict(),
                }

        elif current_parent_key:
            parent_key = current_parent_key
        else:
            continue

        if sub_raw:
            subfolder_name = _numbered_name(sub_no, sub_raw)
            folder_map[parent_key]["subfolders"][subfolder_name] = True

    folders = []
    for item in folder_map.values():
        folders.append({
            "name": item["name"],
            "subfolders": list(item["subfolders"].keys()),
        })

    if not folders:
        raise ValueError("El CSV no contiene carpetas para crear")

    return {
        "folders": folders,
    }

def _record_folder_result(
    path: str,
    created: bool,
    created_items: List[Dict],
    existing_items: List[Dict],
    folder: Optional[Dict] = None,
):
    item = {
        "path": path,
        "id": folder.get("id") if folder else None,
        "name": folder.get("name") if folder else None,
        "webViewLink": folder.get("webViewLink") if folder else None,
    }

    if created:
        created_items.append(item)
    else:
        existing_items.append(item)

import os

@router.get("/debug-config")
async def debug_drive_structure_config(
    current_user: User = Depends(get_current_active_user),
):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo admin"
        )

    root_folder_id = _get_structure_root_folder_id()
    credentials_file = getattr(settings, "GOOGLE_CREDENTIALS_FILE", None)

    metadata = None
    metadata_error = None

    try:
        metadata = drive_service.get_file_metadata(root_folder_id)
    except Exception as exc:
        metadata_error = str(exc)

    return {
        "GOOGLE_DRIVE_STRUCTURE_FOLDER_ID": root_folder_id,
        "GOOGLE_DRIVE_FOLDER_ID": getattr(settings, "GOOGLE_DRIVE_FOLDER_ID", None),
        "GOOGLE_CREDENTIALS_FILE": credentials_file,
        "credentials_file_exists": bool(credentials_file and os.path.exists(credentials_file)),
        "drive_service_initialized": bool(drive_service.service),
        "structure_folder_accessible": bool(metadata),
        "structure_folder_metadata": metadata,
        "metadata_error": metadata_error,
    }

@router.post("/create-courses")
async def create_course_folders_from_template(
    file: UploadFile = File(...),
    area: str = Form(...),
    course_codes: str = Form("[]"),
    semester: str = Form(...),
    year: int = Form(...),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Crear carpetas de cursos desde una plantilla CSV.

    CSV:
    - Define estructura de carpetas.
    - Puede incluir Area como '2. Software'.

    Form:
    - area: Software | Computacion | Sistemas
    - course_codes: JSON array. Si viene vacío, crea todos los cursos del área.
    - semester: 1S, 2S, 3S, XS, etc.
    - year: año.
    """
    if not _can_create_drive_structures(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo administradores o usuarios Teacher pueden crear estructuras"
        )

    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo debe ser CSV"
        )

    selected_area = _canonical_area(area)

    if not semester.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El semestre es requerido"
        )

    if year < 2000 or year > 2100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El año no es válido"
        )

    try:
        content = await file.read()
        template = _parse_structure_template(content)
        selected_codes = _parse_course_codes(course_codes)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc)
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No se pudo leer la plantilla CSV: {str(exc)}"
        )

    root_folder_id = _get_structure_root_folder_id()
    root_metadata = drive_service.get_file_metadata(root_folder_id)

    if not root_metadata:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No se pudo acceder a GOOGLE_DRIVE_STRUCTURE_FOLDER_ID. Verifica permisos de Drive."
        )

    courses_query = (
        db.query(CourseCatalog)
        .filter(CourseCatalog.is_active == True)
        .filter(CourseCatalog.area == selected_area)
    )

    if selected_codes:
        courses_query = courses_query.filter(CourseCatalog.code.in_(selected_codes))

    courses = (
        courses_query
        .order_by(CourseCatalog.code.asc())
        .all()
    )

    if not courses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se encontraron cursos para crear"
        )

    found_codes = {course.code for course in courses}
    missing_codes = [code for code in selected_codes if code not in found_codes]

    if missing_codes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Los siguientes códigos no existen en el área {selected_area}: {missing_codes}"
        )

    area_folder_name = AREA_FOLDER_NAMES.get(selected_area) or selected_area

    created_items: List[Dict] = []
    existing_items: List[Dict] = []
    error_details: List[Dict] = []
    course_results: List[Dict] = []

    try:
        area_folder, area_created = drive_service.get_or_create_folder(
            area_folder_name,
            root_folder_id,
        )
        _record_folder_result(
            path=area_folder_name,
            created=area_created,
            created_items=created_items,
            existing_items=existing_items,
            folder=area_folder,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"No se pudo crear o encontrar la carpeta del área: {str(exc)}"
        )

    for course in courses:
        course_created_items: List[Dict] = []
        course_existing_items: List[Dict] = []
        course_errors: List[Dict] = []

        course_folder_name = _build_course_folder_name(course, semester, year)
        course_path = f"{area_folder_name}/{course_folder_name}"

        try:
            course_folder, course_created = drive_service.get_or_create_folder(
                course_folder_name,
                area_folder["id"],
            )

            _record_folder_result(
                path=course_path,
                created=course_created,
                created_items=created_items,
                existing_items=existing_items,
                folder=course_folder,
            )

            _record_folder_result(
                path=course_path,
                created=course_created,
                created_items=course_created_items,
                existing_items=course_existing_items,
                folder=course_folder,
            )

        except Exception as exc:
            error = {
                "path": course_path,
                "error": str(exc),
            }
            error_details.append(error)
            course_errors.append(error)

            course_results.append({
                "code": course.code,
                "name": course.name,
                "folder_name": course_folder_name,
                "success": False,
                "created_count": len(course_created_items),
                "existing_count": len(course_existing_items),
                "error_count": len(course_errors),
                "created_items": course_created_items,
                "existing_items": course_existing_items,
                "errors": course_errors,
            })
            continue

        for folder in template["folders"]:
            main_name = folder["name"]
            main_path = f"{course_path}/{main_name}"

            try:
                main_folder, main_created = drive_service.get_or_create_folder(
                    main_name,
                    course_folder["id"],
                )

                _record_folder_result(
                    path=main_path,
                    created=main_created,
                    created_items=created_items,
                    existing_items=existing_items,
                    folder=main_folder,
                )

                _record_folder_result(
                    path=main_path,
                    created=main_created,
                    created_items=course_created_items,
                    existing_items=course_existing_items,
                    folder=main_folder,
                )

            except Exception as exc:
                error = {
                    "path": main_path,
                    "error": str(exc),
                }
                error_details.append(error)
                course_errors.append(error)
                continue

            for sub_name in folder.get("subfolders", []):
                sub_path = f"{main_path}/{sub_name}"

                try:
                    sub_folder, sub_created = drive_service.get_or_create_folder(
                        sub_name,
                        main_folder["id"],
                    )

                    _record_folder_result(
                        path=sub_path,
                        created=sub_created,
                        created_items=created_items,
                        existing_items=existing_items,
                        folder=sub_folder,
                    )

                    _record_folder_result(
                        path=sub_path,
                        created=sub_created,
                        created_items=course_created_items,
                        existing_items=course_existing_items,
                        folder=sub_folder,
                    )

                except Exception as exc:
                    error = {
                        "path": sub_path,
                        "error": str(exc),
                    }
                    error_details.append(error)
                    course_errors.append(error)

        course_results.append({
            "code": course.code,
            "name": course.name,
            "folder_name": course_folder_name,
            "success": len(course_errors) == 0,
            "created_count": len(course_created_items),
            "existing_count": len(course_existing_items),
            "error_count": len(course_errors),
            "created_items": course_created_items,
            "existing_items": course_existing_items,
            "errors": course_errors,
        })

    success = len(error_details) == 0

    return {
        "success": success,
        "message": (
            "Estructuras creadas correctamente"
            if success
            else "La creación terminó con errores"
        ),
        "root_folder_id": root_folder_id,
        "root_folder_name": root_metadata.get("name"),
        "area": selected_area,
        "area_folder_name": area_folder_name,
        "semester": semester,
        "year": year,
        "total_courses": len(courses),
        "summary": {
            "created_count": len(created_items),
            "existing_count": len(existing_items),
            "error_count": len(error_details),
        },
        "created_items": created_items,
        "existing_items": existing_items,
        "error_details": error_details,
        "courses": course_results,
    }