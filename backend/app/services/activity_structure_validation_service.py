"""
Servicio para validar que los documentos de Proyectos, Practicas y Tareas
de un curso posean la estructura (títulos) requerida.

Reglas:
- Carpeta "6_Proyectos" / "7_Practicas" / "8_Tareas" ausente o vacía -> severidad ROJA.
- Carpeta con archivos, pero al documento le faltan títulos requeridos -> severidad ANARANJADA,
  listando exactamente qué títulos faltan.
- Todo presente -> severidad VERDE.

Solo se analizan Google Docs nativos y archivos .docx (no PDF/PPTX/Excel).
"""
import io
import re
import unicodedata
import zipfile
from xml.etree import ElementTree as ET
from typing import Any, Dict, List, Optional

from app.services.drive_service import drive_service

_WORD_NS = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
_HEADER_FOOTER_RE = re.compile(r"^word/(header|footer)\d*\.xml$")

GOOGLE_DOC_MIME = "application/vnd.google-apps.document"
DOCX_MIME = (
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
)

_PROYECTO_PRACTICA_TITLES = [
    "Marco formativo",
    "Valor",
    "Competencia(s)",
    "Objetivo SMART",
    "Enunciado",
    "Alcance",
    "Requerimientos tecnicos",
    "Entregables",
    "Material de apoyo",
    "Recursos y herramientas a utilizar",
    "Cronograma",
    "Rubrica de calificacion",
    "Resumen de puntuaciones",
    "Comentarios generales",
]

_TAREA_TITLES = [
    "Marco Formativo",
    "Valor",
    "Competencia(s)",
    "Objetivo",
    "Material de apoyo",
    "Actividad",
    "Descripcion del problema a resolver",
    "Alcance de la tarea",
    "Requerimientos tecnicos",
    "Entregables",
    "Cronograma",
    "Rubrica de calificacion",
    "Detalle de la calificacion",
]

REQUIRED_TITLES = {
    "proyecto_practica": _PROYECTO_PRACTICA_TITLES,
    "tarea": _TAREA_TITLES,
}

# Carpeta real en Drive -> (clave de resultado, checklist a usar)
ACTIVITY_SPECS = [
    {"key": "proyectos", "aliases": ["proyectos"], "checklist": "proyecto_practica"},
    {"key": "practicas", "aliases": ["practicas", "prácticas"], "checklist": "proyecto_practica"},
    {"key": "tareas", "aliases": ["tareas"], "checklist": "tarea"},
]


def _normalize(text: str) -> str:
    """
    Normaliza texto para comparación flexible: sin tildes, sin distinguir
    mayúsculas/minúsculas, y sin puntuación (para que "Competencia(s)"
    matchee contra "Competencias" en el documento).
    """
    text = re.sub(r"\(s\)", "", str(text or ""), flags=re.IGNORECASE)
    nfkd = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in nfkd if not unicodedata.combining(c))
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _normalize_folder_name(name: str) -> str:
    """Normaliza un nombre de carpeta quitando prefijo numérico (ej. '6_Proyectos' -> 'proyectos')."""
    name = re.sub(r"^\d+[\s_\-.]+", "", str(name or "").strip())
    return _normalize(name)


class ActivityStructureValidationService:
    """Valida la estructura de documentos de Proyectos/Practicas/Tareas de un curso."""

    # ──────────────────────────────────────────────
    # Navegación de Drive
    # ──────────────────────────────────────────────

    def _find_activity_folder(self, course_folder_id: str, aliases: List[str]) -> Optional[Dict]:
        subfolders = drive_service.list_folders(course_folder_id)
        alias_norms = {_normalize(alias) for alias in aliases}
        for folder in subfolders:
            if _normalize_folder_name(folder.get("name", "")) in alias_norms:
                return folder
        return None

    def _collect_candidate_files(self, folder_id: str) -> List[Dict]:
        """Archivos directos de la carpeta, más un nivel extra de subcarpetas
        (algunos cursos organizan Proyectos en FASE1/FASE2/FASE3)."""
        files = list(drive_service.list_files(folder_id))

        for subfolder in drive_service.list_folders(folder_id):
            for f in drive_service.list_files(subfolder["id"]):
                f = dict(f)
                f["_subfolder"] = subfolder.get("name")
                files.append(f)

        return files

    @staticmethod
    def _is_supported_document(file_meta: Dict) -> bool:
        mime = file_meta.get("mimeType", "")
        name = file_meta.get("name", "")
        return (
            mime == GOOGLE_DOC_MIME
            or mime == DOCX_MIME
            or name.lower().endswith(".docx")
        )

    # ──────────────────────────────────────────────
    # Extracción y verificación de contenido
    # ──────────────────────────────────────────────

    @staticmethod
    def _extract_full_text(docx_bytes: bytes) -> str:
        """
        Extrae TODO el texto de un .docx leyendo el XML directamente
        (en vez de usar el modelo de objetos de python-docx).

        python-docx expone solo `document.paragraphs`/`document.tables`,
        que NO incluyen párrafos envueltos en controles de contenido
        (content controls / `w:sdt`) ni cuadros de texto — comunes en
        plantillas de Word con campos estructurados. Recorrer el XML
        directamente (buscando cada `w:p` y concatenando sus `w:t`)
        captura el texto sin importar cómo esté envuelto el párrafo.
        """
        parts: List[str] = []
        with zipfile.ZipFile(io.BytesIO(docx_bytes)) as archive:
            xml_files = [
                name for name in archive.namelist()
                if name == "word/document.xml" or _HEADER_FOOTER_RE.match(name)
            ]
            for name in xml_files:
                try:
                    root = ET.fromstring(archive.read(name))
                except ET.ParseError:
                    continue

                for paragraph in root.iter(f"{_WORD_NS}p"):
                    text = "".join(
                        node.text or "" for node in paragraph.iter(f"{_WORD_NS}t")
                    )
                    if text:
                        parts.append(text)

        return "\n".join(parts)

    def _validate_file(self, file_meta: Dict, checklist_key: str) -> Dict[str, Any]:
        required_titles = REQUIRED_TITLES[checklist_key]
        base = {
            "file_id": file_meta.get("id"),
            "file_name": file_meta.get("name"),
            "subfolder": file_meta.get("_subfolder"),
            "web_view_link": file_meta.get("webViewLink"),
        }

        content = drive_service.download_file(file_meta["id"])
        if not content:
            return {
                **base,
                "status": "error",
                "error": "No se pudo descargar/exportar el archivo desde Drive",
                "missing_titles": [],
            }

        try:
            full_text = self._extract_full_text(content)
        except Exception as exc:
            return {
                **base,
                "status": "error",
                "error": f"No se pudo leer el documento: {exc}",
                "missing_titles": [],
            }

        doc_norm = _normalize(full_text)
        missing = [title for title in required_titles if _normalize(title) not in doc_norm]

        return {
            **base,
            "status": "ok" if not missing else "incompleto",
            "error": None,
            "missing_titles": missing,
        }

    def _validate_activity_type(
        self,
        course_folder_id: str,
        key: str,
        aliases: List[str],
        checklist_key: str,
    ) -> Dict[str, Any]:
        folder = self._find_activity_folder(course_folder_id, aliases)
        if not folder:
            return {
                "activity": key,
                "severity": "red",
                "reason": "No se encontró la carpeta correspondiente en Drive",
                "folder_id": None,
                "files": [],
            }

        candidates = self._collect_candidate_files(folder["id"])
        if not candidates:
            return {
                "activity": key,
                "severity": "red",
                "reason": "La carpeta existe pero está vacía",
                "folder_id": folder["id"],
                "files": [],
            }

        documents = [f for f in candidates if self._is_supported_document(f)]
        if not documents:
            return {
                "activity": key,
                "severity": "red",
                "reason": "La carpeta tiene archivos, pero ninguno es un Google Doc o .docx analizable",
                "folder_id": folder["id"],
                "files": [],
            }

        results = [self._validate_file(f, checklist_key) for f in documents]
        has_issues = any(r["status"] in ("incompleto", "error") for r in results)

        return {
            "activity": key,
            "severity": "orange" if has_issues else "green",
            "reason": None,
            "folder_id": folder["id"],
            "files": results,
        }

    # ──────────────────────────────────────────────
    # Punto de entrada principal
    # ──────────────────────────────────────────────

    def validate_course(self, course_folder_id: str) -> Dict[str, Any]:
        activities = {}
        for spec in ACTIVITY_SPECS:
            activities[spec["key"]] = self._validate_activity_type(
                course_folder_id,
                spec["key"],
                spec["aliases"],
                spec["checklist"],
            )

        return {
            "success": True,
            "course_folder_id": course_folder_id,
            "activities": activities,
        }


# Instancia global
activity_structure_validation_service = ActivityStructureValidationService()
