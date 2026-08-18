"""
Servicio de retroalimentación de Diseño Curricular.

Flujo por curso:

1. Localizar:
   periodo/
   área/
   curso/
   3_Planeacion_Curricular/

2. Buscar:
   1_Criterios y Expectativas
   2_Analisis_de_Contexto
   3_Fortalezas_Debilidades_y_Recomendaciones
   4_Analisis_Internacional
   5_Diseño_Curricular
   6_Diseño_Curricular_Retroalimentacion

3. Los documentos 1..4 son opcionales.
4. 5_Diseño_Curricular es obligatorio.
5. 6_Diseño_Curricular_Retroalimentacion solamente es
   obligatorio cuando se desea escribir el resultado.

6. Los Google Sheets 1..5 se exportan a PDF en memoria.
7. Se extrae texto del PDF.
8. Si PDF falla, se usa XLSX en memoria.
9. DeepSeek genera JSON estructurado.
10. Google Sheets API escribe la retroalimentación en el archivo 6.
"""

from __future__ import annotations

import io
import json
import re
import time
import unicodedata
import urllib.error
import urllib.request
import socket

from dataclasses import dataclass
from typing import (
    Any,
    Dict,
    Iterable,
    List,
    Optional,
    Tuple,
)

import openpyxl
from PyPDF2 import PdfReader

from app.config import settings
from app.models.course_catalog import CourseCatalog
from app.services.course_contacts_service import (
    CourseContactsError,
    course_contacts_service,
)
from app.services.drive_service import drive_service
from app.services.google_sheets_service import (
    google_sheets_service,
)


# ============================================================
# CONFIGURACIÓN DEL MÓDULO
# ============================================================

# Se deja en código, NO en .env.
#
# Actualmente corresponde a la raíz usada por la estructura
# curricular del proyecto.
CURRICULUM_ROOT_FOLDER_ID = (
    "1kKtxjCV9cXxkS_BeQv95Ud5M_Q0S77aA"
)

DEEPSEEK_MODEL = "deepseek-v4-flash"

DEEPSEEK_URL = (
    "https://api.deepseek.com/chat/completions"
)

DEEPSEEK_TIMEOUT_SECONDS = 240

DEEPSEEK_MAX_OUTPUT_TOKENS = 16_000

DEEPSEEK_MAX_ATTEMPTS = 3

# No representa tokens.
# Es solamente un límite interno para evitar enviar accidentalmente
# hojas absurdamente grandes generadas por formatos residuales.
MAX_CONTEXT_CHARS = 2_500_000

MAX_XLSX_ROWS = 20_000
MAX_XLSX_COLUMNS = 150
STOP_AFTER_EMPTY_ROWS = 150


GOOGLE_SHEET_MIME = (
    "application/vnd.google-apps.spreadsheet"
)

PDF_MIME = "application/pdf"

XLSX_MIME = (
    "application/vnd.openxmlformats-officedocument."
    "spreadsheetml.sheet"
)


GEMINI_CURRICULUM_MODEL = "gemini-3.5-flash-lite"

GEMINI_STREAM_URL = (
    "https://generativelanguage.googleapis.com/"
    "v1beta/models/{model}:streamGenerateContent?alt=sse"
)


# Este timeout es por inactividad de la conexión.
# Al usar streaming, cada chunk mantiene viva la conexión.
GEMINI_STREAM_TIMEOUT_SECONDS = 120

GEMINI_MAX_OUTPUT_TOKENS = 7000


GROQ_CURRICULUM_MODEL = "openai/gpt-oss-120b"

GROQ_API_URL = (
    "https://api.groq.com/openai/v1/chat/completions"
)

AI_PROVIDER_TIMEOUT_SECONDS = 240

# Groq tiene bastante menos contexto que Gemini.
# Es un límite conservador en CARACTERES, no en tokens.
GROQ_MAX_CONTEXT_CHARS = 350_000

# ============================================================
# ARCHIVOS ESPERADOS
# ============================================================

@dataclass(frozen=True)
class PlanningFileSpec:
    key: str
    name: str
    required_for_analysis: bool = False
    required_for_write: bool = False


PLANNING_FILES: Tuple[
    PlanningFileSpec,
    ...,
] = (
    PlanningFileSpec(
        key="criterios_expectativas",
        name="1_Criterios y Expectativas",
    ),

    PlanningFileSpec(
        key="analisis_contexto",
        name="2_Analisis_de_Contexto",
    ),

    PlanningFileSpec(
        key="fortalezas_debilidades_recomendaciones",
        name=(
            "3_Fortalezas_Debilidades_y_Recomendaciones"
        ),
    ),

    PlanningFileSpec(
        key="analisis_internacional",
        name="4_Analisis_Internacional",
    ),

    PlanningFileSpec(
        key="diseno_curricular",
        name="5_Diseño_Curricular",
        required_for_analysis=True,
    ),

    PlanningFileSpec(
        key="retroalimentacion",
        name=(
            "6_Diseño_Curricular_Retroalimentacion"
        ),
        required_for_write=True,
    ),
)


OPTIONAL_CONTEXT_KEYS = {
    "criterios_expectativas",
    "analisis_contexto",
    "fortalezas_debilidades_recomendaciones",
    "analisis_internacional",
}

MAIN_INPUT_KEY = "diseno_curricular"

OUTPUT_KEY = "retroalimentacion"


# ============================================================
# SALIDA ESPERADA DE DEEPSEEK
# ============================================================

FEEDBACK_KEYS: Tuple[str, ...] = (
    "competencias",
    "semana_diagnostico",
    "s2",
    "s3",
    "s4",
    "s5",
    "s6",
    "s7",
    "s8",
    "s9",
    "s10",
    "s11",
    "proyectos",
    "practicas",
    "tareas",
)

GEMINI_FEEDBACK_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "retroalimentacion": {
            "type": "OBJECT",
            "properties": {
                "competencias": {
                    "type": "STRING",
                },
                "semana_diagnostico": {
                    "type": "STRING",
                },
                "s2": {
                    "type": "STRING",
                },
                "s3": {
                    "type": "STRING",
                },
                "s4": {
                    "type": "STRING",
                },
                "s5": {
                    "type": "STRING",
                },
                "s6": {
                    "type": "STRING",
                },
                "s7": {
                    "type": "STRING",
                },
                "s8": {
                    "type": "STRING",
                },
                "s9": {
                    "type": "STRING",
                },
                "s10": {
                    "type": "STRING",
                },
                "s11": {
                    "type": "STRING",
                },
                "proyectos": {
                    "type": "STRING",
                },
                "practicas": {
                    "type": "STRING",
                },
                "tareas": {
                    "type": "STRING",
                },
            },
            "required": [
                "competencias",
                "semana_diagnostico",
                "s2",
                "s3",
                "s4",
                "s5",
                "s6",
                "s7",
                "s8",
                "s9",
                "s10",
                "s11",
                "proyectos",
                "practicas",
                "tareas",
            ],
        },
        "resumen_general": {
            "type": "STRING",
        },
        "advertencias": {
            "type": "ARRAY",
            "items": {
                "type": "STRING",
            },
        },
    },
    "required": [
        "retroalimentacion",
        "resumen_general",
        "advertencias",
    ],
}


OUTPUT_LABEL_ALIASES: Dict[
    str,
    Tuple[str, ...],
] = {
    "competencias": (
        "competencias",
    ),
    
    "semana_diagnostico": (
        "semana de diagnostico",
        "semana de diagnóstico",
        "semana diagnostico",
    ),

    "s2": ("s2",),
    "s3": ("s3",),
    "s4": ("s4",),
    "s5": ("s5",),
    "s6": ("s6",),
    "s7": ("s7",),
    "s8": ("s8",),
    "s9": ("s9",),
    "s10": ("s10",),
    "s11": ("s11",),

    "proyectos": (
        "proyectos",
    ),

    "practicas": (
        "practicas",
        "prácticas",
    ),

    "tareas": (
        "tareas",
    ),
}


class CurriculumFeedbackError(
    RuntimeError
):
    pass


class CurriculumFeedbackService:

    def _call_ai(
        self,
        system_message: str,
        user_message: str,
    ) -> Dict[str, Any]:
        """
        Cadena de proveedores para retroalimentación curricular.

        1. Gemini 2.5 Flash-Lite
        2. DeepSeek, si existe key y tiene saldo
        3. Groq, únicamente si el contexto cabe
        """

        errors: List[str] = []

        # ========================================================
        # 1. GEMINI
        # ========================================================

        try:

            return self._call_gemini(
                system_message,
                user_message,
            )

        except Exception as exc:

            message = str(exc)

            errors.append(
                f"Gemini: {message}"
            )

            print(
                "⚠️ [CURRICULUM] Gemini no disponible | "
                f"tipo={type(exc).__name__} | "
                f"mensaje={message}",
                flush=True,
            )

        # ========================================================
        # 2. DEEPSEEK
        # ========================================================

        deepseek_key = str(
            getattr(
                settings,
                "DEEPSEEK_API_KEY",
                "",
            )
            or ""
        ).strip()

        if deepseek_key:

            try:

                result = self._call_deepseek(
                    system_message,
                    user_message,
                )

                # Nuestro método anterior no incluía provider.
                result[
                    "provider"
                ] = "deepseek"

                return result

            except Exception as exc:

                message = str(exc)

                errors.append(
                    f"DeepSeek: {message}"
                )

                if (
                    "HTTP 402"
                    in message
                    or "Insufficient Balance"
                    in message
                ):

                    print(
                        "⚠️ [CURRICULUM] DeepSeek sin saldo. "
                        "Pasando directamente a Groq.",
                        flush=True,
                    )

                else:

                    print(
                        "⚠️ [CURRICULUM] DeepSeek falló | "
                        f"{message}",
                        flush=True,
                    )

        # ========================================================
        # 3. GROQ
        # ========================================================

        try:

            return self._call_groq(
                system_message,
                user_message,
            )

        except Exception as exc:

            message = str(exc)

            errors.append(
                f"Groq: {message}"
            )

            print(
                "⚠️ [CURRICULUM] Groq no disponible | "
                f"{message}",
                flush=True,
            )

        # ========================================================
        # NINGUNO FUNCIONÓ
        # ========================================================

        raise CurriculumFeedbackError(
            "Ningún proveedor de IA pudo completar "
            "la retroalimentación. "
            + " | ".join(errors)
        )

    def _call_groq(
        self,
        system_message: str,
        user_message: str,
    ) -> Dict[str, Any]:

        api_key = str(
            getattr(
                settings,
                "GROQ_API_KEY",
                "",
            )
            or ""
        ).strip()

        if not api_key:
            raise CurriculumFeedbackError(
                "GROQ_API_KEY no está configurada"
            )

        total_chars = (
            len(system_message)
            + len(user_message)
        )

        if (
            total_chars
            > GROQ_MAX_CONTEXT_CHARS
        ):
            raise CurriculumFeedbackError(
                "El contexto es demasiado grande "
                "para utilizar Groq como respaldo "
                f"({total_chars} caracteres)"
            )

        payload = json.dumps(
            {
                "model": GROQ_CURRICULUM_MODEL,

                "messages": [
                    {
                        "role": "system",
                        "content": system_message,
                    },
                    {
                        "role": "user",
                        "content": user_message,
                    },
                ],

                "temperature": 0.1,

                "max_tokens": 12000,

                "response_format": {
                    "type": "json_object",
                },
            },
            ensure_ascii=False,
        ).encode(
            "utf-8"
        )

        print(
            "🤖 [CURRICULUM] Groq | "
            f"modelo={GROQ_CURRICULUM_MODEL} | "
            f"request_bytes={len(payload)}",
            flush=True,
        )

        request = urllib.request.Request(
            GROQ_API_URL,
            data=payload,
            headers={
                "Authorization": (
                    f"Bearer {api_key}"
                ),
                "Content-Type": (
                    "application/json"
                ),
            },
            method="POST",
        )

        try:

            with urllib.request.urlopen(
                request,
                timeout=AI_PROVIDER_TIMEOUT_SECONDS,
            ) as response:

                response_json = json.loads(
                    response.read().decode(
                        "utf-8"
                    )
                )

            choices = response_json.get(
                "choices",
                [],
            )

            if not choices:
                raise CurriculumFeedbackError(
                    "Groq no devolvió ninguna respuesta"
                )

            raw = (
                choices[0]
                .get(
                    "message",
                    {}
                )
                .get(
                    "content",
                    "",
                )
            )

            parsed = self._clean_json_response(
                raw
            )

            usage = response_json.get(
                "usage",
                {},
            )

            print(
                "✅ [CURRICULUM] Groq respondió | "
                f"modelo={GROQ_CURRICULUM_MODEL}",
                flush=True,
            )

            return {
                "data": parsed,

                "provider": "groq",

                "model": (
                    GROQ_CURRICULUM_MODEL
                ),

                "usage": usage,
            }

        except urllib.error.HTTPError as exc:

            try:
                body = (
                    exc.read()
                    .decode(
                        "utf-8",
                        errors="replace",
                    )
                )
            except Exception:
                body = ""

            raise CurriculumFeedbackError(
                f"Groq HTTP {exc.code}: "
                f"{body[:700]}"
            ) from exc

        except (
            urllib.error.URLError,
            TimeoutError,
        ) as exc:

            raise CurriculumFeedbackError(
                f"Groq no respondió: {exc}"
            ) from exc

    def _call_gemini(
        self,
        system_message: str,
        user_message: str,
    ) -> Dict[str, Any]:
        """
        Ejecuta Gemini mediante streamGenerateContent.

        IMPORTANTE:
        No esperamos a que Google cierre físicamente la conexión SSE.
        En cuanto Gemini devuelve finishReason, finalizamos nosotros
        el stream para evitar que la petición HTTP quede colgada.
        """

        keys = self._get_gemini_keys()

        if not keys:
            raise CurriculumFeedbackError(
                "No hay ninguna GEMINI_API_KEY configurada"
            )

        payload = json.dumps(
            {
                "systemInstruction": {
                    "parts": [
                        {
                            "text": system_message,
                        }
                    ],
                },

                "contents": [
                    {
                        "role": "user",
                        "parts": [
                            {
                                "text": user_message,
                            }
                        ],
                    }
                ],

                "generationConfig": {
                    "temperature": 0.1,

                    "maxOutputTokens": (
                        GEMINI_MAX_OUTPUT_TOKENS
                    ),

                    "responseMimeType": (
                        "application/json"
                    ),

                    "responseSchema": (
                        GEMINI_FEEDBACK_SCHEMA
                    ),
                },
            },
            ensure_ascii=False,
        ).encode("utf-8")

        last_error: Optional[Exception] = None

        for key_index, api_key in enumerate(
            keys,
            start=1,
        ):

            url = GEMINI_STREAM_URL.format(
                model=GEMINI_CURRICULUM_MODEL
            )

            print(
                "\n"
                "🤖 [CURRICULUM] Gemini STREAM | "
                f"modelo={GEMINI_CURRICULUM_MODEL} | "
                f"key={key_index}/{len(keys)} | "
                f"request_bytes={len(payload)}",
                flush=True,
            )

            request = urllib.request.Request(
                url,
                data=payload,
                headers={
                    "Content-Type": "application/json",
                    "x-goog-api-key": api_key,
                    "Accept": "text/event-stream",

                    # No queremos depender de una conexión
                    # keep-alive después de terminar la generación.
                    "Connection": "close",
                },
                method="POST",
            )

            started_at = time.perf_counter()

            text_parts: List[str] = []
            usage_metadata: Dict[str, Any] = {}

            finish_reason = None
            chunk_count = 0

            try:

                with urllib.request.urlopen(
                    request,
                    timeout=GEMINI_STREAM_TIMEOUT_SECONDS,
                ) as response:

                    print(
                        "📡 [CURRICULUM] Gemini conexión establecida",
                        flush=True,
                    )

                    for raw_line in response:

                        if not raw_line:
                            continue

                        line = (
                            raw_line
                            .decode(
                                "utf-8",
                                errors="replace",
                            )
                            .strip()
                        )

                        if not line.startswith("data:"):
                            continue

                        json_text = (
                            line[len("data:"):]
                            .strip()
                        )

                        if not json_text:
                            continue

                        if json_text == "[DONE]":
                            print(
                                "🏁 [CURRICULUM] Gemini envió [DONE]",
                                flush=True,
                            )
                            break

                        try:
                            event = json.loads(
                                json_text
                            )

                        except json.JSONDecodeError:

                            print(
                                "⚠️ [CURRICULUM] "
                                "Chunk SSE inválido ignorado",
                                flush=True,
                            )
                            continue

                        chunk_count += 1

                        # ==========================================
                        # USO / TOKENS
                        # ==========================================

                        if event.get("usageMetadata"):
                            usage_metadata = event[
                                "usageMetadata"
                            ]

                        # ==========================================
                        # CANDIDATO
                        # ==========================================

                        candidates = event.get(
                            "candidates",
                            [],
                        )

                        if candidates:

                            candidate = candidates[0]

                            content = candidate.get(
                                "content",
                                {},
                            )

                            parts = content.get(
                                "parts",
                                [],
                            )

                            # Guardar primero TODO el texto
                            # del evento actual.
                            for part in parts:

                                text = part.get(
                                    "text"
                                )

                                if text:
                                    text_parts.append(
                                        text
                                    )

                            candidate_finish_reason = (
                                candidate.get(
                                    "finishReason"
                                )
                            )

                            if candidate_finish_reason:

                                finish_reason = (
                                    candidate_finish_reason
                                )

                        # ==========================================
                        # LOG
                        # ==========================================

                        if (
                            chunk_count == 1
                            or chunk_count % 10 == 0
                            or finish_reason
                        ):

                            current_chars = sum(
                                len(item)
                                for item in text_parts
                            )

                            elapsed = (
                                time.perf_counter()
                                - started_at
                            )

                            print(
                                "📥 [CURRICULUM] Gemini generando | "
                                f"chunks={chunk_count} | "
                                f"chars={current_chars} | "
                                f"finish_reason={finish_reason} | "
                                f"segundos={elapsed:.1f}",
                                flush=True,
                            )

                        # ==========================================
                        # CORRECCIÓN IMPORTANTE
                        # ==========================================
                        #
                        # NO esperamos a que Google cierre
                        # físicamente la conexión HTTP.
                        #
                        # STOP significa que el modelo ya terminó.
                        #
                        # También salimos para MAX_TOKENS y otros
                        # finishReason; se validarán abajo.
                        # ==========================================

                        if finish_reason:
                            print(
                                "🛑 [CURRICULUM] "
                                "Fin lógico del stream detectado | "
                                f"finish_reason={finish_reason}",
                                flush=True,
                            )
                            break

                # Al salir del with urllib cierra el socket.
                elapsed = (
                    time.perf_counter()
                    - started_at
                )

                raw = "".join(
                    text_parts
                ).strip()

                print(
                    "✅ [CURRICULUM] Gemini stream terminado | "
                    f"chunks={chunk_count} | "
                    f"chars={len(raw)} | "
                    f"finish_reason={finish_reason} | "
                    f"segundos={elapsed:.2f}",
                    flush=True,
                )

                # ==============================================
                # VALIDACIONES
                # ==============================================

                if not raw:

                    raise CurriculumFeedbackError(
                        "Gemini terminó el stream "
                        "sin devolver contenido"
                    )

                if finish_reason == "MAX_TOKENS":

                    raise CurriculumFeedbackError(
                        "Gemini alcanzó el límite máximo "
                        "de tokens de salida"
                    )

                if finish_reason in {
                    "MALFORMED_FUNCTION_CALL",
                    "SAFETY",
                    "RECITATION",
                    "BLOCKLIST",
                    "PROHIBITED_CONTENT",
                    "SPII",
                }:

                    raise CurriculumFeedbackError(
                        "Gemini detuvo la generación. "
                        f"finish_reason={finish_reason}"
                    )

                # STOP es el resultado normal.
                if (
                    finish_reason
                    and finish_reason != "STOP"
                ):

                    print(
                        "⚠️ [CURRICULUM] Gemini terminó con "
                        f"finish_reason={finish_reason}",
                        flush=True,
                    )

                # ==============================================
                # JSON
                # ==============================================

                print(
                    "🔎 [CURRICULUM] Parseando JSON de Gemini...",
                    flush=True,
                )

                parsed = (
                    self._clean_json_response(
                        raw
                    )
                )

                print(
                    "✅ [CURRICULUM] JSON de Gemini parseado",
                    flush=True,
                )

                return {
                    "data": parsed,

                    "provider": "gemini",

                    "model": (
                        GEMINI_CURRICULUM_MODEL
                    ),

                    "usage": {
                        "prompt_tokens": (
                            usage_metadata.get(
                                "promptTokenCount"
                            )
                        ),

                        "completion_tokens": (
                            usage_metadata.get(
                                "candidatesTokenCount"
                            )
                        ),

                        "total_tokens": (
                            usage_metadata.get(
                                "totalTokenCount"
                            )
                        ),

                        "cached_tokens": (
                            usage_metadata.get(
                                "cachedContentTokenCount"
                            )
                        ),
                    },
                }

            # ==================================================
            # TIMEOUT
            # ==================================================

            except (
                socket.timeout,
                TimeoutError,
            ) as exc:

                last_error = exc

                elapsed = (
                    time.perf_counter()
                    - started_at
                )

                print(
                    "⏱️ [CURRICULUM] Gemini timeout | "
                    f"key={key_index}/{len(keys)} | "
                    f"chunks_recibidos={chunk_count} | "
                    f"chars_recibidos="
                    f"{sum(len(x) for x in text_parts)} | "
                    f"finish_reason={finish_reason} | "
                    f"segundos={elapsed:.2f}",
                    flush=True,
                )

                continue

            # ==================================================
            # HTTP
            # ==================================================

            except urllib.error.HTTPError as exc:

                try:
                    body = (
                        exc.read()
                        .decode(
                            "utf-8",
                            errors="replace",
                        )
                    )

                except Exception:
                    body = ""

                last_error = (
                    CurriculumFeedbackError(
                        f"Gemini HTTP {exc.code}: "
                        f"{body[:1000]}"
                    )
                )

                print(
                    "⚠️ [CURRICULUM] Gemini HTTP | "
                    f"key={key_index}/{len(keys)} | "
                    f"status={exc.code} | "
                    f"mensaje={body[:300]}",
                    flush=True,
                )

                if exc.code in {
                    408,
                    429,
                    500,
                    502,
                    503,
                    504,
                }:
                    continue

                if exc.code == 400:
                    break

                if exc.code in {
                    401,
                    403,
                }:
                    continue

                break

            # ==================================================
            # RED
            # ==================================================

            except urllib.error.URLError as exc:

                last_error = exc

                print(
                    "🌐 [CURRICULUM] Error de red "
                    "con Gemini | "
                    f"key={key_index}/{len(keys)} | "
                    f"error={exc}",
                    flush=True,
                )

                continue

            # ==================================================
            # RESPUESTA INVALIDA
            # ==================================================

            except CurriculumFeedbackError as exc:

                last_error = exc

                print(
                    "⚠️ [CURRICULUM] Respuesta de "
                    "Gemini no válida | "
                    f"key={key_index}/{len(keys)} | "
                    f"error={exc}",
                    flush=True,
                )

                continue

            except Exception as exc:

                last_error = exc

                print(
                    "❌ [CURRICULUM] Error inesperado "
                    "en Gemini | "
                    f"tipo={type(exc).__name__} | "
                    f"error={exc}",
                    flush=True,
                )

                continue

        raise CurriculumFeedbackError(
            "Gemini no pudo completar el análisis "
            f"con ninguna de las {len(keys)} key(s): "
            f"{last_error}"
        )
        

    def _get_gemini_keys(
        self,
    ) -> List[str]:
        keys: List[str] = []

        primary = str(
            getattr(
                settings,
                "GEMINI_API_KEY",
                "",
            )
            or ""
        ).strip()

        if primary and primary not in {
            "kjkj",
            "tu_api_key_de_gemini",
        }:
            keys.append(primary)

        extra_raw = str(
            getattr(
                settings,
                "GEMINI_API_KEYS",
                "",
            )
            or ""
        )

        for item in extra_raw.split(","):
            key = item.strip()

            if (
                key
                and key not in keys
            ):
                keys.append(key)

        return keys

    @staticmethod
    def _clean_json_response(
        raw: str,
    ) -> Dict[str, Any]:
        raw = str(raw or "").strip()

        raw = re.sub(
            r"^```json?\s*",
            "",
            raw,
            flags=re.IGNORECASE,
        )

        raw = re.sub(
            r"\s*```$",
            "",
            raw,
        )

        if not raw:
            raise CurriculumFeedbackError(
                "El proveedor de IA devolvió una respuesta vacía"
            )

        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise CurriculumFeedbackError(
                f"El proveedor devolvió JSON inválido: {exc}"
            ) from exc

        if not isinstance(parsed, dict):
            raise CurriculumFeedbackError(
                "La respuesta de IA no es un objeto JSON"
            )

        return parsed

    # ========================================================
    # NORMALIZACIÓN
    # ========================================================

    @staticmethod
    def normalize(
        value: object,
    ) -> str:
        """
        Comparación tolerante:

        5_Diseño_Curricular
        5 Diseño Curricular
        5-Diseño Curricular
        5_Diseño_Curricular.xlsx

        se consideran equivalentes.
        """
        text = str(
            value or ""
        ).strip()

        text = re.sub(
            r"\.(xlsx|xls|pdf)$",
            "",
            text,
            flags=re.IGNORECASE,
        )

        text = text.replace(
            "_",
            " ",
        )

        text = text.replace(
            "-",
            " ",
        )

        text = re.sub(
            r"\s+",
            " ",
            text,
        ).strip().lower()

        normalized = unicodedata.normalize(
            "NFKD",
            text,
        )

        normalized = "".join(
            character
            for character in normalized
            if not unicodedata.combining(
                character
            )
        )

        return normalized

    # ========================================================
    # UBICACIÓN DE CARPETAS
    # ========================================================

    def _find_period_folder(
        self,
        semester: str,
        year: int,
    ) -> Dict[str, Any]:
        """
        Soporta los dos casos:

        CASO A:
        CURRICULUM_ROOT_FOLDER_ID ya apunta a:
        2026_Segundo_Semestre

        CASO B:
        CURRICULUM_ROOT_FOLDER_ID apunta a una carpeta superior
        que contiene:
        2026_Segundo_Semestre
        """
        period = (
            course_contacts_service
            .period_data(
                semester,
                year,
            )
        )

        expected_name = period[
            "folder"
        ]

        root = (
            drive_service
            .get_file_metadata(
                CURRICULUM_ROOT_FOLDER_ID
            )
        )

        if not root:
            raise CurriculumFeedbackError(
                "No se pudo acceder a la carpeta raíz "
                "de Planeación Curricular"
            )

        root_name = root.get(
            "name",
            "",
        )

        if (
            self.normalize(root_name)
            == self.normalize(
                expected_name
            )
        ):
            return {
                **root,
                "id": (
                    root.get("id")
                    or CURRICULUM_ROOT_FOLDER_ID
                ),
            }

        period_folder = (
            drive_service.find_folder(
                expected_name,
                CURRICULUM_ROOT_FOLDER_ID,
            )
        )

        if not period_folder:
            raise CurriculumFeedbackError(
                "No se encontró la carpeta del período "
                f"'{expected_name}'"
            )

        return period_folder

    def _find_planning_folder(
        self,
        course_folder_id: str,
    ) -> Dict[str, Any]:

        folders = (
            drive_service
            .list_folders(
                course_folder_id
            )
        )

        exact_matches = [
            folder
            for folder in folders
            if self.normalize(
                folder.get(
                    "name"
                )
            )
            == self.normalize(
                "3_Planeacion_Curricular"
            )
        ]

        if len(exact_matches) == 1:
            return exact_matches[0]

        if len(exact_matches) > 1:
            raise CurriculumFeedbackError(
                "Hay más de una carpeta llamada "
                "3_Planeacion_Curricular"
            )

        # Respaldo por si alguien quitó el prefijo 3.
        fallback = [
            folder
            for folder in folders
            if self.normalize(
                folder.get(
                    "name"
                )
            )
            == self.normalize(
                "Planeacion Curricular"
            )
        ]

        if len(fallback) == 1:
            return fallback[0]

        if len(fallback) > 1:
            raise CurriculumFeedbackError(
                "Hay más de una carpeta de "
                "Planeación Curricular"
            )

        raise CurriculumFeedbackError(
            "No se encontró la carpeta "
            "3_Planeacion_Curricular"
        )

    def locate_course(
        self,
        course: CourseCatalog,
        semester: str,
        year: int,
    ) -> Dict[str, Dict[str, Any]]:
        """
        Localizar:

        periodo/
            área/
                curso/
                    3_Planeacion_Curricular/
        """
        try:
            period_folder = (
                self._find_period_folder(
                    semester,
                    year,
                )
            )

            canonical_area = (
                course_contacts_service
                .canonical_area(
                    course.area
                )
            )

            area_folder = (
                course_contacts_service
                .find_area_folder(
                    period_folder["id"],
                    canonical_area,
                )
            )

            course_folder = (
                course_contacts_service
                .find_course_folder(
                    area_folder["id"],
                    course,
                    semester,
                    year,
                )
            )

        except CourseContactsError as exc:
            raise CurriculumFeedbackError(
                str(exc)
            ) from exc

        if not course_folder:
            raise CurriculumFeedbackError(
                "No se encontró de forma inequívoca "
                f"la carpeta del curso {course.code}"
            )

        planning_folder = (
            self._find_planning_folder(
                course_folder["id"]
            )
        )

        return {
            "period": period_folder,
            "area": area_folder,
            "course": course_folder,
            "planning": planning_folder,
        }

    # ========================================================
    # LOCALIZAR ARCHIVOS 1..6
    # ========================================================

    def locate_planning_files(
        self,
        planning_folder_id: str,
    ) -> Dict[
        str,
        Optional[Dict[str, Any]],
    ]:

        files = (
            drive_service
            .list_files(
                planning_folder_id
            )
        )

        result: Dict[
            str,
            Optional[Dict[str, Any]],
        ] = {}

        for spec in PLANNING_FILES:

            expected = self.normalize(
                spec.name
            )

            matches = [
                file
                for file in files
                if self.normalize(
                    file.get(
                        "name"
                    )
                )
                == expected
            ]

            if len(matches) > 1:
                raise CurriculumFeedbackError(
                    "Hay más de un archivo que coincide con "
                    f"'{spec.name}'"
                )

            result[
                spec.key
            ] = (
                matches[0]
                if matches
                else None
            )

        return result

    # ========================================================
    # PREVIEW
    # ========================================================

    def preview_course(
        self,
        course: CourseCatalog,
        semester: str,
        year: int,
    ) -> Dict[str, Any]:

        try:
            locations = self.locate_course(
                course,
                semester,
                year,
            )

            files = (
                self.locate_planning_files(
                    locations[
                        "planning"
                    ]["id"]
                )
            )

        except CurriculumFeedbackError as exc:
            return {
                "code": str(
                    course.code
                ),
                "name": course.name,
                "area": course.area,

                "success": False,
                "ready_for_analysis": False,
                "ready_for_write": False,

                "warnings": [],
                "error": str(exc),
                "files": {},
            }

        warnings: List[str] = []

        for spec in PLANNING_FILES[:4]:

            if not files.get(
                spec.key
            ):
                warnings.append(
                    f"No se encontró {spec.name}. "
                    "El análisis continuará, pero el "
                    "contexto puede variar."
                )

        if not files.get(
            MAIN_INPUT_KEY
        ):
            warnings.append(
                "No se encontró 5_Diseño_Curricular. "
                "No es posible generar retroalimentación."
            )

        if not files.get(
            OUTPUT_KEY
        ):
            warnings.append(
                "No se encontró "
                "6_Diseño_Curricular_Retroalimentacion. "
                "Se puede generar el análisis, pero no "
                "guardar la retroalimentación."
            )

        return {
            "code": str(
                course.code
            ),

            "name": course.name,

            "area": (
                course_contacts_service
                .canonical_area(
                    course.area
                )
            ),

            "success": True,

            "ready_for_analysis": bool(
                files.get(
                    MAIN_INPUT_KEY
                )
            ),

            "ready_for_write": bool(
                files.get(
                    MAIN_INPUT_KEY
                )
                and files.get(
                    OUTPUT_KEY
                )
            ),

            "warnings": warnings,

            "locations": {
                key: {
                    "id": value.get(
                        "id"
                    ),
                    "name": value.get(
                        "name"
                    ),
                    "webViewLink": value.get(
                        "webViewLink"
                    ),
                }
                for key, value
                in locations.items()
            },

            "files": {
                spec.key: {
                    "expected_name": spec.name,

                    "found": bool(
                        files.get(
                            spec.key
                        )
                    ),

                    "id": (
                        files[
                            spec.key
                        ].get(
                            "id"
                        )
                        if files.get(
                            spec.key
                        )
                        else None
                    ),

                    "name": (
                        files[
                            spec.key
                        ].get(
                            "name"
                        )
                        if files.get(
                            spec.key
                        )
                        else None
                    ),

                    "mimeType": (
                        files[
                            spec.key
                        ].get(
                            "mimeType"
                        )
                        if files.get(
                            spec.key
                        )
                        else None
                    ),

                    "webViewLink": (
                        files[
                            spec.key
                        ].get(
                            "webViewLink"
                        )
                        if files.get(
                            spec.key
                        )
                        else None
                    ),
                }

                for spec
                in PLANNING_FILES
            },
        }

    def preview(
        self,
        courses: Iterable[
            CourseCatalog
        ],
        semester: str,
        year: int,
    ) -> Dict[str, Any]:

        items = [
            self.preview_course(
                course,
                semester,
                year,
            )
            for course in courses
        ]

        return {
            "success": True,

            "semester": (
                course_contacts_service
                .normalize_semester(
                    semester
                )
            ),

            "year": year,

            "summary": {
                "total_courses": len(
                    items
                ),

                "ready_for_analysis": sum(
                    1
                    for item in items
                    if item.get(
                        "ready_for_analysis"
                    )
                ),

                "ready_for_write": sum(
                    1
                    for item in items
                    if item.get(
                        "ready_for_write"
                    )
                ),

                "with_errors": sum(
                    1
                    for item in items
                    if not item.get(
                        "success"
                    )
                ),
            },

            "courses": items,
        }

    # ========================================================
    # PDF -> TEXTO
    # ========================================================

    @staticmethod
    def _pdf_to_text(
        content: bytes,
    ) -> str:

        reader = PdfReader(
            io.BytesIO(
                content
            )
        )

        pages: List[str] = []

        for index, page in enumerate(
            reader.pages,
            start=1,
        ):

            page_text = (
                page.extract_text()
                or ""
            ).strip()

            if page_text:

                pages.append(
                    f"--- Página {index} ---\n"
                    f"{page_text}"
                )

        return "\n\n".join(
            pages
        ).strip()

    # ========================================================
    # XLSX -> TEXTO
    # ========================================================

    @staticmethod
    def _xlsx_to_text(
        content: bytes,
    ) -> str:

        workbook = (
            openpyxl
            .load_workbook(
                io.BytesIO(
                    content
                ),
                read_only=True,
                data_only=True,
            )
        )

        parts: List[str] = []

        try:

            for worksheet in (
                workbook.worksheets
            ):

                parts.append(
                    "==============================\n"
                    f"HOJA: {worksheet.title}\n"
                    "=============================="
                )

                declared_rows = (
                    worksheet.max_row
                    or 1
                )

                declared_columns = (
                    worksheet.max_column
                    or 1
                )

                maximum_rows = min(
                    declared_rows,
                    MAX_XLSX_ROWS,
                )

                maximum_columns = min(
                    declared_columns,
                    MAX_XLSX_COLUMNS,
                )

                empty_rows = 0

                for row in worksheet.iter_rows(
                    min_row=1,
                    max_row=maximum_rows,
                    min_col=1,
                    max_col=maximum_columns,
                    values_only=True,
                ):

                    values = [
                        (
                            str(
                                value
                            ).strip()
                            if value
                            is not None
                            else ""
                        )
                        for value
                        in row
                    ]

                    while (
                        values
                        and not values[-1]
                    ):
                        values.pop()

                    if not any(
                        values
                    ):
                        empty_rows += 1

                        if (
                            empty_rows
                            >= STOP_AFTER_EMPTY_ROWS
                        ):
                            break

                        continue

                    empty_rows = 0

                    parts.append(
                        " | ".join(
                            values
                        )
                    )

        finally:
            workbook.close()

        return "\n".join(
            parts
        ).strip()

    # ========================================================
    # EXTRAER UN DOCUMENTO
    # ========================================================

    def _extract_source_text(
        self,
        file: Dict[str, Any],
    ) -> Tuple[
        str,
        str,
        List[str],
    ]:

        file_id = file[
            "id"
        ]

        file_name = file.get(
            "name",
            file_id,
        )

        mime_type = file.get(
            "mimeType",
            "",
        )

        warnings: List[str] = []

        # ----------------------------------------------------
        # Google Sheets
        # ----------------------------------------------------

        if (
            mime_type
            == GOOGLE_SHEET_MIME
        ):

            try:

                pdf_bytes = (
                    drive_service
                    .export_workspace_file(
                        file_id,
                        PDF_MIME,
                    )
                )

                pdf_text = (
                    self._pdf_to_text(
                        pdf_bytes
                    )
                )

                # Liberar lo antes posible.
                pdf_bytes = None

                if len(
                    pdf_text.strip()
                ) >= 50:

                    return (
                        pdf_text,
                        "pdf",
                        warnings,
                    )

                warnings.append(
                    f"{file_name}: el PDF temporal no "
                    "produjo suficiente texto. "
                    "Se utilizará XLSX como respaldo."
                )

            except Exception as exc:

                warnings.append(
                    f"{file_name}: no se pudo procesar "
                    f"el PDF temporal ({exc}). "
                    "Se utilizará XLSX como respaldo."
                )

            # Respaldo XLSX.
            xlsx_bytes = (
                drive_service
                .download_file(
                    file_id
                )
            )

            if not xlsx_bytes:

                raise CurriculumFeedbackError(
                    "No se pudo exportar "
                    f"'{file_name}' como XLSX"
                )

            xlsx_text = (
                self._xlsx_to_text(
                    xlsx_bytes
                )
            )

            xlsx_bytes = None

            return (
                xlsx_text,
                "xlsx_fallback",
                warnings,
            )

        # ----------------------------------------------------
        # PDF normal
        # ----------------------------------------------------

        if mime_type == PDF_MIME:

            content = (
                drive_service
                .download_file(
                    file_id
                )
            )

            if not content:

                raise CurriculumFeedbackError(
                    f"No se pudo descargar '{file_name}'"
                )

            return (
                self._pdf_to_text(
                    content
                ),
                "pdf",
                warnings,
            )

        # ----------------------------------------------------
        # XLSX normal
        # ----------------------------------------------------

        if mime_type in {
            XLSX_MIME,
            "application/vnd.ms-excel",
        }:

            content = (
                drive_service
                .download_file(
                    file_id
                )
            )

            if not content:

                raise CurriculumFeedbackError(
                    f"No se pudo descargar '{file_name}'"
                )

            return (
                self._xlsx_to_text(
                    content
                ),
                "xlsx",
                warnings,
            )

        raise CurriculumFeedbackError(
            f"Formato no soportado para "
            f"'{file_name}': {mime_type}"
        )

    # ========================================================
    # CARGAR CONTEXTO 1..5
    # ========================================================

    def load_context(
        self,
        files: Dict[
            str,
            Optional[
                Dict[str, Any]
            ],
        ],
    ) -> Tuple[
        Dict[str, Dict[str, Any]],
        List[str],
    ]:

        if not files.get(
            MAIN_INPUT_KEY
        ):

            raise CurriculumFeedbackError(
                "No se encontró 5_Diseño_Curricular. "
                "El análisis no puede continuar."
            )

        documents: Dict[
            str,
            Dict[str, Any],
        ] = {}

        warnings: List[str] = []

        for spec in PLANNING_FILES[:5]:

            file = files.get(
                spec.key
            )

            # ----------------------------------------------
            # Faltan documentos opcionales 1..4
            # ----------------------------------------------

            if not file:

                if (
                    spec.key
                    in OPTIONAL_CONTEXT_KEYS
                ):

                    warnings.append(
                        f"No se encontró {spec.name}. "
                        "El análisis continuará con "
                        "menos contexto."
                    )

                    continue

                raise CurriculumFeedbackError(
                    "No se encontró el archivo obligatorio "
                    f"{spec.name}"
                )

            # ----------------------------------------------
            # Extraer
            # ----------------------------------------------

            try:

                (
                    text,
                    extraction_method,
                    extraction_warnings,
                ) = self._extract_source_text(
                    file
                )

            except Exception as exc:

                if (
                    spec.key
                    in OPTIONAL_CONTEXT_KEYS
                ):

                    warnings.append(
                        f"No se pudo leer {spec.name}: "
                        f"{exc}. "
                        "El análisis continuará."
                    )

                    continue

                raise

            warnings.extend(
                extraction_warnings
            )

            if not text.strip():

                if (
                    spec.key
                    in OPTIONAL_CONTEXT_KEYS
                ):

                    warnings.append(
                        f"{spec.name} no contiene "
                        "texto utilizable. "
                        "El análisis continuará."
                    )

                    continue

                raise CurriculumFeedbackError(
                    "5_Diseño_Curricular no produjo "
                    "contenido utilizable"
                )

            documents[
                spec.key
            ] = {
                "name": (
                    file.get(
                        "name"
                    )
                    or spec.name
                ),

                "text": text,

                "chars": len(
                    text
                ),

                "extraction_method": (
                    extraction_method
                ),
            }

        return (
            documents,
            warnings,
        )

    # ========================================================
    # ARMAR CONTEXTO
    # ========================================================

    def _context_text(
        self,
        documents: Dict[
            str,
            Dict[str, Any],
        ],
    ) -> Tuple[str, bool]:
        """
        El documento 5 SIEMPRE tiene prioridad.

        Si por seguridad debemos recortar contexto:
        1. conservamos primero 5_Diseño_Curricular;
        2. repartimos el espacio restante entre 1..4.
        """
        main_document = documents[
            MAIN_INPUT_KEY
        ]

        main_block = (
            "========================================\n"
            "DOCUMENTO PRINCIPAL\n"
            f"{main_document['name']}\n"
            "========================================\n"
            f"{main_document['text']}"
        )

        if (
            len(main_block)
            >= MAX_CONTEXT_CHARS
        ):

            return (
                main_block[
                    :MAX_CONTEXT_CHARS
                ],
                True,
            )

        optional_blocks: List[
            str
        ] = []

        for spec in PLANNING_FILES[:4]:

            document = documents.get(
                spec.key
            )

            if not document:
                continue

            block = (
                "========================================\n"
                "DOCUMENTO DE CONTEXTO\n"
                f"{document['name']}\n"
                "========================================\n"
                f"{document['text']}"
            )

            optional_blocks.append(
                block
            )

        if not optional_blocks:

            return (
                main_block,
                False,
            )

        remaining = (
            MAX_CONTEXT_CHARS
            - len(main_block)
            - 10
        )

        complete_length = sum(
            len(block)
            for block
            in optional_blocks
        )

        if (
            complete_length
            <= remaining
        ):

            return (
                main_block
                + "\n\n"
                + "\n\n".join(
                    optional_blocks
                ),
                False,
            )

        # Repartir equitativamente el espacio disponible
        # para no eliminar completamente un documento de contexto.
        per_document = max(
            1,
            remaining
            // len(optional_blocks)
        )

        trimmed_blocks = [
            block[
                :per_document
            ]
            for block
            in optional_blocks
        ]

        return (
            main_block
            + "\n\n"
            + "\n\n".join(
                trimmed_blocks
            ),
            True,
        )

    # ========================================================
    # PROMPT
    # ========================================================

    @staticmethod
    def _feedback_schema_example(
    ) -> str:

        fields = ",\n".join(
            (
                f'    "{key}": '
                '"retroalimentación concreta"'
            )
            for key
            in FEEDBACK_KEYS
        )

        return (
            "{\n"
            '  "retroalimentacion": {\n'
            f"{fields}\n"
            "  },\n"
            '  "resumen_general": "síntesis breve",\n'
            '  "advertencias": []\n'
            "}"
        )

    def _build_prompt(
        self,
        course: CourseCatalog,
        context_text: str,
        warnings: List[str],
    ) -> Tuple[
        str,
        str,
    ]:

        system_message = """
Eres un especialista en diseño curricular universitario encargado de
revisar una planificación académica y generar retroalimentación técnica,
concreta y útil para su mejora.

FUENTE PRINCIPAL

La evaluación debe realizarse principalmente sobre:

5_Diseño_Curricular

Los documentos:

1_Criterios y Expectativas
2_Analisis_de_Contexto
3_Fortalezas_Debilidades_y_Recomendaciones
4_Analisis_Internacional

son únicamente documentos de contexto.

REGLAS FUNDAMENTALES

1. 5_Diseño_Curricular es siempre la fuente principal de la evaluación.

2. Los documentos 1, 2, 3 y 4 pueden utilizarse para comprender el
   contexto, contrastar información y enriquecer la revisión, pero nunca
   deben sustituir, modificar ni prevalecer sobre lo establecido en
   5_Diseño_Curricular.

3. No inventes:
   - requisitos;
   - criterios;
   - ponderaciones;
   - competencias;
   - actividades;
   - contenidos;
   - tiempos;
   - proyectos;
   - prácticas;
   - tareas;
   - errores;
   - recomendaciones institucionales.

4. Toda observación debe estar sustentada por información presente en
   los documentos proporcionados.

5. Si los documentos no proporcionan suficiente evidencia para afirmar
   algo, no lo afirmes.

6. La retroalimentación debe evaluar, no resumir. Evita volver a contar
   el contenido del documento salvo cuando sea necesario para explicar
   claramente una inconsistencia o una fortaleza.

7. Prioriza:
   - errores;
   - contradicciones;
   - omisiones;
   - inconsistencias;
   - problemas de coherencia;
   - referencias rotas;
   - problemas de ponderación;
   - problemas de tiempo;
   - oportunidades concretas de mejora.

8. Cuando un apartado esté correcto y no exista una observación negativa
   relevante, indica brevemente la fortaleza concreta. No inventes una
   recomendación únicamente para llenar la respuesta.

9. Las respuestas deben ser breves, específicas, académicas y
   accionables.

10. Responde únicamente con JSON válido y respeta exactamente la
    estructura solicitada.
""".strip()

        warning_text = (
            "\n".join(
                f"- {warning}"
                for warning
                in warnings
            )
            or "- Ninguna"
        )

        user_message = f"""
CURSO
Código: {course.code}
Nombre: {course.name}

ADVERTENCIAS SOBRE LAS FUENTES

{warning_text}


============================================================
OBJETIVO
============================================================

Analiza integralmente el Diseño Curricular del curso y genera
retroalimentación independiente para los siguientes 15 apartados:

- Competencias
- Semana de Diagnóstico
- S2
- S3
- S4
- S5
- S6
- S7
- S8
- S9
- S10
- S11
- Proyectos
- Prácticas
- Tareas

NO existe una salida independiente llamada "Diseño".

La hoja "Diseño" del documento principal sí debe analizarse y utilizarse
para comprobar la coherencia general, pero cualquier problema encontrado
allí debe reflejarse en el apartado directamente relacionado.


============================================================
ESTRUCTURA DE 5_Diseño_Curricular
============================================================

5_Diseño_Curricular proviene de un libro de Google Sheets que fue
exportado temporalmente a PDF.

El documento puede contener las siguientes hojas:

- Resumen
- Competencias
- Diseño
- Semana Diagnostico
- S.2
- S.3
- S.4
- S.5
- S.6
- S.7
- S.8
- S.9
- S.10
- S.11
- Proyectos
- Practicas
- Tareas
- Metadata

Debes considerar el documento completo.

NO analices únicamente las primeras páginas.

La exportación a PDF puede hacer que las hojas aparezcan de manera
consecutiva y que una misma hoja ocupe varias páginas. Utiliza el
contenido y su contexto para interpretar correctamente cada sección.


============================================================
FUNCIÓN DE CADA HOJA
============================================================

RESUMEN

Utilízala como referencia general para comprobar, cuando la información
esté disponible:

- distribución de ponderaciones;
- actividades;
- horas;
- estructura general;
- totales;
- coherencia con el detalle de las demás hojas.

No genera una retroalimentación independiente.


COMPETENCIAS

Evalúa:

- claridad;
- formulación;
- coherencia;
- relación con contenidos;
- relación con actividades;
- relación con proyectos;
- relación con prácticas, cuando existan;
- relación con tareas, cuando existan.

La retroalimentación correspondiente se devuelve en:

"competencias"


DISEÑO

Utilízala para revisar la estructura general y contrastarla con las
demás hojas.

Puede servir para detectar diferencias entre la planificación general
y el detalle.

NO devuelvas una clave "diseno".

Si encuentras una inconsistencia en esta hoja, colócala en el apartado
al que realmente corresponda.


SEMANA DIAGNOSTICO

Evalúa específicamente el diagnóstico inicial, sus actividades,
propósito, tiempos y relación con los conocimientos previos requeridos.

La retroalimentación se devuelve en:

"semana_diagnostico"


S.2 A S.11

S.2 corresponde a Semana 2.
S.3 corresponde a Semana 3.
S.4 corresponde a Semana 4.
S.5 corresponde a Semana 5.
S.6 corresponde a Semana 6.
S.7 corresponde a Semana 7.
S.8 corresponde a Semana 8.
S.9 corresponde a Semana 9.
S.10 corresponde a Semana 10.
S.11 corresponde a Semana 11.

IMPORTANTE:

Estas hojas representan SEMANAS de planificación.

NO representan sesiones.

Nunca utilices expresiones como:

- "sesión 2";
- "sesión 3";
- "sesión 4";
- "la sesión";
- "esta sesión".

Evalúa cada semana individualmente y también su coherencia con:

- las competencias;
- la planificación general;
- las semanas anteriores;
- las semanas posteriores;
- proyectos;
- prácticas, cuando existan;
- tareas, cuando existan.


PROYECTOS

Debe existir como mínimo UN proyecto definido.

Si no existe ningún proyecto, debes señalarlo como una omisión
importante en:

"proyectos"

Si existen proyectos, evalúa:

- coherencia con las competencias;
- relación con los contenidos;
- relación con las semanas;
- ponderación;
- alcance;
- consistencia entre el resumen y el detalle;
- posibles contradicciones.


PRACTICAS

Las prácticas son OPCIONALES.

Un curso puede tener:

- ninguna práctica;
- una práctica;
- varias prácticas.

Si no existe ninguna práctica real que evaluar:

"practicas": ""

La ausencia de prácticas NO debe:

- tratarse como error;
- generar advertencia;
- generar recomendación;
- provocar que sugieras crear una práctica.

Si sí existen prácticas, evalúa normalmente su coherencia, ponderación,
alcance y relación con las competencias y contenidos.


TAREAS

Las tareas son OPCIONALES.

Un curso puede tener:

- ninguna tarea;
- una tarea;
- varias tareas.

Si no existe ninguna tarea real que evaluar:

"tareas": ""

La ausencia de tareas NO debe:

- tratarse como error;
- generar advertencia;
- generar recomendación;
- provocar que sugieras crear tareas.

Si sí existen tareas, evalúa normalmente su coherencia, ponderación,
alcance y relación con las competencias y contenidos.


METADATA

Utilízala únicamente como información auxiliar para interpretar,
identificar o validar el documento.

No genera una retroalimentación independiente.


============================================================
REVISIÓN OBLIGATORIA DE CONSISTENCIA
============================================================

Antes de redactar las respuestas finales, compara entre sí las
diferentes partes de 5_Diseño_Curricular.

Comprueba especialmente:

1. PONDERACIONES

- Compara los valores generales contra el detalle.
- Verifica sumatorias cuando existan datos suficientes.
- No declares que una ponderación es correcta sin contrastarla
  con la información relacionada.

Ejemplo:

Si Resumen indica 10 puntos para Tareas pero el detalle de Tareas suma
14 puntos, debes señalar la inconsistencia en "tareas".


2. TIEMPOS

Compara:

- tiempo declarado;
- tiempo asignado;
- duración de actividades;
- duración de recursos;
- totales de cada semana;

cuando esos valores estén disponibles.

Si existen valores contradictorios, señálalos.


3. REFERENCIAS Y ERRORES DE HOJA DE CÁLCULO

Detecta, cuando aparezcan:

- #REF!
- #VALUE!
- #N/A
- #DIV/0!
- #NAME?
- u otros errores visibles.

Indica el problema en el apartado correspondiente.


4. ACTIVIDADES

Comprueba, cuando sea posible:

- actividades mencionadas en semanas contra las actividades
  realmente definidas;
- entregas mencionadas contra proyectos, prácticas o tareas;
- actividades sin definición;
- actividades duplicadas;
- diferencias de ponderación.


5. COMPETENCIAS

Comprueba si existe relación entre las competencias y:

- contenidos;
- semanas;
- actividades;
- proyectos;
- prácticas, cuando existan;
- tareas, cuando existan.

No exijas que una competencia aparezca literalmente repetida en cada
hoja; evalúa la coherencia académica real.


6. SECUENCIA

Comprueba la continuidad entre S2 y S11:

- progresión de contenidos;
- duplicaciones injustificadas;
- saltos evidentes;
- dependencias;
- relación entre actividades y contenidos.


7. CAMPOS VACÍOS

No todos los campos vacíos representan errores.

En particular:

- Prácticas puede estar vacío.
- Tareas puede estar vacío.

No señales un campo vacío como problema a menos que, según la estructura
y evidencia del propio documento, ese dato realmente sea requerido.

Proyectos es diferente: debe existir al menos uno.


============================================================
REGLAS DE REDACCIÓN
============================================================

Cada respuesta será escrita en una celda de Google Sheets cuya columna
A ya identifica el apartado.

Por esa razón, NO debes repetir innecesariamente la etiqueta.

PARA S2 A S11:

No comiences con:

- "La Semana 2..."
- "La semana 3..."
- "En la Semana 4..."
- "S5 presenta..."
- "S6 contiene..."
- "La sesión 7..."
- "La Sesión 8..."

Empieza directamente con la observación.

INCORRECTO:

"La sesión 8 presenta una inconsistencia en el recurso de video."

CORRECTO:

"El recurso de video presenta una inconsistencia de duración: se
asignan 10 minutos frente al valor indicado como máximo en la
planificación."

INCORRECTO:

"La Semana 5 contiene errores #REF!."

CORRECTO:

"Se detectan errores de referencia (#REF!) en las celdas de contenido;
deben corregirse para mantener la integridad de la planificación."


EVITA REDACCIONES GENÉRICAS

Evita frases como:

- "está bien estructurado";
- "es adecuado";
- "cumple correctamente";
- "presenta una estructura sólida";
- "se encuentra bien diseñado";

si no explicas concretamente por qué.

Prefiere observaciones sustentadas y específicas.


NO INVENTES CRITERIOS

No utilices expresiones como:

- "máximo institucional";
- "estándar institucional";
- "ponderación requerida";
- "tiempo permitido";
- "criterio obligatorio";

a menos que esa regla aparezca explícitamente en los documentos
proporcionados.


FORTALEZAS

Si no existe ningún problema relevante, puedes indicar una fortaleza
real y concreta.

Ejemplo:

"Existe coherencia entre la actividad práctica, el contenido trabajado
y la competencia asociada; no se identifican inconsistencias
relevantes."

No inventes problemas para producir una recomendación.


============================================================
RESUMEN GENERAL Y ADVERTENCIAS
============================================================

"resumen_general":

Debe sintetizar los hallazgos globales más importantes.

No debe repetir las 15 respuestas una por una.

Debe mencionar principalmente:

- fortalezas generales relevantes;
- inconsistencias importantes;
- problemas que requieren corrección.


"advertencias":

Incluye únicamente hallazgos que merezcan atención especial.

No conviertas todas las observaciones menores en advertencias.

Si no existen advertencias relevantes:

"advertencias": []


Cuando debas identificar semanas dentro del resumen o las advertencias,
utiliza:

- S2, S3, S4, ..., S11

o:

- Semana 2, Semana 3, ..., Semana 11

Nunca utilices:

- Sesión 2
- Sesión 3
- Sesión 4
- etc.


============================================================
SALIDAS OBLIGATORIAS
============================================================

Debes devolver exactamente estas claves dentro de
"retroalimentacion":

- competencias
- semana_diagnostico
- s2
- s3
- s4
- s5
- s6
- s7
- s8
- s9
- s10
- s11
- proyectos
- practicas
- tareas

No agregues otras claves.

No agregues:

- diseno
- resumen
- metadata

dentro de "retroalimentacion".


============================================================
DOCUMENTOS
============================================================

{context_text}


============================================================
FORMATO JSON OBLIGATORIO
============================================================

Responde ÚNICAMENTE con un objeto JSON válido.

No escribas explicaciones antes del JSON.
No escribas explicaciones después del JSON.
No utilices bloques Markdown.

La estructura debe ser exactamente:

{self._feedback_schema_example()}
""".strip()

        return (
            system_message,
            user_message,
        )

    # ========================================================
    # DEEPSEEK
    # ========================================================

    def _call_deepseek(
        self,
        system_message: str,
        user_message: str,
    ) -> Dict[str, Any]:

        api_key = (
            getattr(
                settings,
                "DEEPSEEK_API_KEY",
                None,
            )
            or ""
        ).strip()

        if not api_key:

            raise CurriculumFeedbackError(
                "DEEPSEEK_API_KEY no está configurada"
            )

        payload = json.dumps(
            {
                "model": DEEPSEEK_MODEL,

                "messages": [
                    {
                        "role": "system",
                        "content": system_message,
                    },
                    {
                        "role": "user",
                        "content": user_message,
                    },
                ],

                # Para esta tarea queremos salida estructurada
                # y no necesitamos exponer razonamiento interno.
                "thinking": {
                    "type": "disabled",
                },

                "temperature": 0.1,

                "max_tokens": (
                    DEEPSEEK_MAX_OUTPUT_TOKENS
                ),

                "response_format": {
                    "type": "json_object",
                },
            },
            ensure_ascii=False,
        ).encode(
            "utf-8"
        )

        last_error: Optional[
            Exception
        ] = None

        for attempt in range(
            1,
            DEEPSEEK_MAX_ATTEMPTS + 1,
        ):

            print(
                "🤖 [CURRICULUM] DeepSeek | "
                f"intento={attempt}/"
                f"{DEEPSEEK_MAX_ATTEMPTS} | "
                f"modelo={DEEPSEEK_MODEL} | "
                f"request_bytes={len(payload)}",
                flush=True,
            )

            request = (
                urllib.request.Request(
                    DEEPSEEK_URL,
                    data=payload,
                    headers={
                        "Authorization": (
                            f"Bearer {api_key}"
                        ),
                        "Content-Type": (
                            "application/json"
                        ),
                    },
                    method="POST",
                )
            )

            try:

                with urllib.request.urlopen(
                    request,
                    timeout=(
                        DEEPSEEK_TIMEOUT_SECONDS
                    ),
                ) as response:

                    response_body = (
                        response
                        .read()
                        .decode(
                            "utf-8"
                        )
                    )

                response_json = (
                    json.loads(
                        response_body
                    )
                )

                choices = (
                    response_json
                    .get(
                        "choices",
                        [],
                    )
                )

                if not choices:

                    raise (
                        CurriculumFeedbackError(
                            "DeepSeek no devolvió "
                            "ninguna respuesta"
                        )
                    )

                choice = choices[0]

                finish_reason = (
                    choice.get(
                        "finish_reason"
                    )
                )

                if (
                    finish_reason
                    == "length"
                ):

                    raise (
                        CurriculumFeedbackError(
                            "DeepSeek cortó la "
                            "respuesta por límite "
                            "de salida"
                        )
                    )

                raw = (
                    choice
                    .get(
                        "message",
                        {},
                    )
                    .get(
                        "content",
                        "",
                    )
                    .strip()
                )

                # Defensa adicional si el modelo envía
                # ```json ... ```
                raw = re.sub(
                    r"^```json?\s*",
                    "",
                    raw,
                    flags=re.IGNORECASE,
                )

                raw = re.sub(
                    r"\s*```$",
                    "",
                    raw,
                )

                parsed = json.loads(
                    raw
                )

                return {
                    "data": parsed,

                    "usage": (
                        response_json
                        .get(
                            "usage",
                            {},
                        )
                    ),

                    "model": (
                        response_json
                        .get(
                            "model",
                            DEEPSEEK_MODEL,
                        )
                    ),
                }

            except urllib.error.HTTPError as exc:

                body = (
                    exc.read()
                    .decode(
                        "utf-8",
                        errors="replace",
                    )
                )

                last_error = (
                    CurriculumFeedbackError(
                        f"DeepSeek HTTP "
                        f"{exc.code}: "
                        f"{body[:1000]}"
                    )
                )

                # Solo reintentar errores transitorios.
                if exc.code not in {
                    408,
                    409,
                    429,
                    500,
                    502,
                    503,
                    504,
                }:
                    break

            except (
                urllib.error.URLError,
                TimeoutError,
            ) as exc:

                last_error = exc

            except json.JSONDecodeError as exc:

                last_error = (
                    CurriculumFeedbackError(
                        "DeepSeek devolvió "
                        "JSON inválido: "
                        f"{exc}"
                    )
                )

                break

            except CurriculumFeedbackError:
                raise

            except Exception as exc:

                last_error = exc

            if (
                attempt
                < DEEPSEEK_MAX_ATTEMPTS
            ):

                wait_seconds = min(
                    4,
                    2 ** (
                        attempt - 1
                    ),
                )

                time.sleep(
                    wait_seconds
                )

        raise CurriculumFeedbackError(
            "No se pudo completar el análisis "
            f"con DeepSeek: {last_error}"
        )

    # ========================================================
    # VALIDAR JSON DE IA
    # ========================================================

    @staticmethod
    def _validate_feedback_payload(
        payload: Dict[str, Any],
    ) -> Dict[str, Any]:

        feedback = payload.get(
            "retroalimentacion"
        )

        if not isinstance(
            feedback,
            dict,
        ):

            raise CurriculumFeedbackError(
                "El proveedor de IA no devolvió el objeto "
                "'retroalimentacion'"
            )
            
        missing = [
            key
            for key
            in FEEDBACK_KEYS
            if key not in feedback
        ]

        if missing:

            raise CurriculumFeedbackError(
                "La respuesta del proveedor de IA está "
                "incompleta. Faltan: "
                + ", ".join(
                    missing
                )
            )

        clean_feedback: Dict[
            str,
            str,
        ] = {}

        for key in FEEDBACK_KEYS:

            value = feedback.get(
                key
            )

            if value is None:
                value = ""

            clean_feedback[
                key
            ] = str(
                value
            ).strip()

        ai_warnings = (
            payload.get(
                "advertencias"
            )
        )

        if not isinstance(
            ai_warnings,
            list,
        ):
            ai_warnings = []

        return {
            "retroalimentacion": (
                clean_feedback
            ),

            "resumen_general": str(
                payload.get(
                    "resumen_general"
                )
                or ""
            ).strip(),

            "advertencias": (
                ai_warnings
            ),
        }

    # ========================================================
    # LEER FILAS DEL ARCHIVO 6
    # ========================================================

    def _output_row_map(
        self,
        spreadsheet_id: str,
    ) -> Tuple[
        str,
        Dict[str, int],
    ]:

        sheet_title = (
            google_sheets_service
            .get_first_sheet_title(
                spreadsheet_id
            )
        )

        values = (
            google_sheets_service
            .get_column_values(
                spreadsheet_id,
                sheet_title,
                "A",
            )
        )

        alias_lookup: Dict[
            str,
            str,
        ] = {}

        for (
            feedback_key,
            aliases,
        ) in OUTPUT_LABEL_ALIASES.items():

            for alias in aliases:

                alias_lookup[
                    self.normalize(
                        alias
                    )
                ] = feedback_key

        row_map: Dict[
            str,
            int,
        ] = {}

        for row_number, row in enumerate(
            values,
            start=1,
        ):

            if not row:
                continue

            label = self.normalize(
                row[0]
            )

            feedback_key = (
                alias_lookup
                .get(
                    label
                )
            )

            if (
                feedback_key
                and feedback_key
                not in row_map
            ):
                row_map[
                    feedback_key
                ] = row_number

        return (
            sheet_title,
            row_map,
        )

    # ========================================================
    # ESCRIBIR ARCHIVO 6
    # ========================================================

    def write_feedback(
        self,
        spreadsheet_id: str,
        feedback: Dict[str, str],
        feedback_column: str,
    ) -> Dict[str, Any]:
        """
        NO se hardcodea la fila.

        Busca:
        Competencias
        Diseño
        Semana de Diagnóstico
        S2...
        Tareas

        en la columna A y escribe en la columna indicada.

        feedback_column se recibe desde el endpoint porque todavía
        no hemos definido qué columna de la plantilla es la oficial.
        """
        feedback_column = str(
            feedback_column
        ).strip().upper()

        if not re.fullmatch(
            r"[A-Z]{1,3}",
            feedback_column,
        ):

            raise CurriculumFeedbackError(
                "La columna de retroalimentación "
                "no es válida"
            )

        (
            sheet_title,
            row_map,
        ) = self._output_row_map(
            spreadsheet_id
        )

        missing_rows = [
            key
            for key
            in FEEDBACK_KEYS
            if key not in row_map
        ]

        if missing_rows:

            raise CurriculumFeedbackError(
                "El archivo "
                "6_Diseño_Curricular_Retroalimentacion "
                "no contiene todas las etiquetas esperadas "
                "en la columna A. Faltan: "
                + ", ".join(
                    missing_rows
                )
            )

        escaped_sheet_title = (
            sheet_title.replace(
                "'",
                "''",
            )
        )

        updates: List[
            Dict[str, Any]
        ] = []

        for key in FEEDBACK_KEYS:

            row_number = row_map[
                key
            ]

            cell_range = (
                f"'{escaped_sheet_title}'!"
                f"{feedback_column}"
                f"{row_number}"
            )

            updates.append(
                {
                    "range": cell_range,
                    "values": [
                        [
                            feedback.get(
                                key,
                                "",
                            )
                        ]
                    ],
                }
            )

        result = (
            google_sheets_service
            .batch_update_values(
                spreadsheet_id,
                updates,
            )
        )

        return {
            "success": True,
            "sheet": sheet_title,
            "column": feedback_column,
            **result,
        }

    # ========================================================
    # ANALIZAR UN CURSO
    # ========================================================

    def analyze_course(
        self,
        course: CourseCatalog,
        semester: str,
        year: int,
        write_output: bool = False,
        feedback_column: Optional[
            str
        ] = None,
    ) -> Dict[str, Any]:
        """
        Análisis completo de UN curso.

        Este método será reutilizado posteriormente por el
        background worker para procesar todos los cursos.
        """
        started_at = (
            time.perf_counter()
        )

        print(
            "\n"
            "=========================================\n"
            "🎓 RETROALIMENTACIÓN CURRICULAR\n"
            f"Curso: {course.code} - {course.name}\n"
            f"Semestre: {semester}\n"
            f"Año: {year}\n"
            "=========================================",
            flush=True,
        )

        # ----------------------------------------------------
        # 1. Localizar
        # ----------------------------------------------------

        locations = self.locate_course(
            course,
            semester,
            year,
        )

        # ----------------------------------------------------
        # 2. Archivos
        # ----------------------------------------------------

        files = self.locate_planning_files(
            locations[
                "planning"
            ]["id"]
        )

        if not files.get(
            MAIN_INPUT_KEY
        ):

            raise CurriculumFeedbackError(
                "No se encontró "
                "5_Diseño_Curricular"
            )

        if (
            write_output
            and not files.get(
                OUTPUT_KEY
            )
        ):

            raise CurriculumFeedbackError(
                "No se encontró "
                "6_Diseño_Curricular_Retroalimentacion"
            )

        if (
            write_output
            and not feedback_column
        ):

            raise CurriculumFeedbackError(
                "Debes indicar feedback_column "
                "para escribir la retroalimentación"
            )

        # ----------------------------------------------------
        # 3. Cargar PDF/XLSX
        # ----------------------------------------------------

        documents, warnings = (
            self.load_context(
                files
            )
        )

        # ----------------------------------------------------
        # 4. Construir contexto
        # ----------------------------------------------------

        (
            context_text,
            context_truncated,
        ) = self._context_text(
            documents
        )

        if context_truncated:

            warnings.append(
                "El contexto superó el límite interno "
                "de seguridad del backend y fue recortado. "
                "Se priorizó 5_Diseño_Curricular."
            )

        # ----------------------------------------------------
        # 5. Prompt
        # ----------------------------------------------------

        (
            system_message,
            user_message,
        ) = self._build_prompt(
            course,
            context_text,
            warnings,
        )

        # ----------------------------------------------------
        # 6. DeepSeek
        # ----------------------------------------------------

        ai_result = (
            self._call_ai(
                system_message,
                user_message,
            )
        )

        print(
            "✅ [CURRICULUM] IA terminada correctamente | "
            f"provider={ai_result.get('provider')} | "
            f"model={ai_result.get('model')}",
            flush=True,
        )

        print(
            "🔎 [CURRICULUM] Validando respuesta estructurada...",
            flush=True,
        )

        # ----------------------------------------------------
        # 7. Validar
        # ----------------------------------------------------

        validated = (
            self._validate_feedback_payload(
                ai_result[
                    "data"
                ]
            )
        )
        
        print(
            "✅ [CURRICULUM] JSON de retroalimentación válido | "
            f"apartados={len(validated.get('retroalimentacion', {}))}",
            flush=True,
        )

        # ----------------------------------------------------
        # 8. Escribir opcionalmente
        # ----------------------------------------------------

        write_result = None

        if write_output:

            output_file = files[
                OUTPUT_KEY
            ]

            if (
                output_file.get(
                    "mimeType"
                )
                != GOOGLE_SHEET_MIME
            ):

                raise CurriculumFeedbackError(
                    "6_Diseño_Curricular_Retroalimentacion "
                    "debe ser un Google Sheets nativo"
                )

            write_result = (
                self.write_feedback(
                    output_file[
                        "id"
                    ],
                    validated[
                        "retroalimentacion"
                    ],
                    feedback_column,
                )
            )

        # ----------------------------------------------------
        # 9. Resultado
        # ----------------------------------------------------

        result = {
            "success": True,

            "course": {
                "code": str(
                    course.code
                ),

                "name": (
                    course.name
                ),

                "area": (
                    course_contacts_service
                    .canonical_area(
                        course.area
                    )
                ),

                "semester": (
                    course_contacts_service
                    .normalize_semester(
                        semester
                    )
                ),

                "year": year,
            },

            "warnings": warnings,

            "documents": {
                key: {
                    "name": value[
                        "name"
                    ],

                    "chars": value[
                        "chars"
                    ],

                    "extraction_method": (
                        value[
                            "extraction_method"
                        ]
                    ),
                }

                for key, value
                in documents.items()
            },

            "context_chars_sent": len(
                context_text
            ),

            "context_truncated": (
                context_truncated
            ),

            "provider": {
                "name": ai_result.get(
                    "provider",
                    "unknown",
                ),

                "model": ai_result.get(
                    "model"
                ),

                "usage": ai_result.get(
                    "usage",
                    {},
                ),
            },

            "result": validated,

            "write": write_result,

            "elapsed_seconds": round(
                time.perf_counter()
                - started_at,
                2,
            ),
        }

        print(
            "🏁 [CURRICULUM] Curso completamente procesado | "
            f"curso={course.code} | "
            f"segundos={result['elapsed_seconds']} | "
            f"write_output={write_output}",
            flush=True,
        )

        return result


curriculum_feedback_service = (
    CurriculumFeedbackService()
)