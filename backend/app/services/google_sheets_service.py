"""
Servicio mínimo para Google Sheets.

Se utiliza únicamente para:
- Leer las etiquetas de 6_Diseño_Curricular_Retroalimentacion.
- Escribir la retroalimentación en las celdas correspondientes.

Usa la misma cuenta de servicio y las mismas credenciales
que Google Drive.
"""

from __future__ import annotations

import os
from typing import Dict, List, Optional

import httplib2
from google.oauth2 import service_account
from google_auth_httplib2 import AuthorizedHttp
from googleapiclient.discovery import build

from app.config import settings


SHEETS_HTTP_TIMEOUT_SECONDS = 120
SHEETS_API_RETRIES = 2

GOOGLE_DRIVE_SCOPE = (
    "https://www.googleapis.com/auth/drive"
)


class GoogleSheetsService:
    def __init__(self):
        self.service = None

    def _initialize_service(self):
        """
        Inicialización diferida.

        Esto es importante porque en Render las credenciales
        pueden escribirse en /tmp durante el startup.
        """
        credentials_file = getattr(
            settings,
            "GOOGLE_CREDENTIALS_FILE",
            None,
        )

        if not credentials_file:
            raise RuntimeError(
                "GOOGLE_CREDENTIALS_FILE no está configurado"
            )

        if not os.path.exists(credentials_file):
            raise RuntimeError(
                "No existe el archivo de credenciales de Google: "
                f"{credentials_file}"
            )

        credentials = (
            service_account.Credentials
            .from_service_account_file(
                credentials_file,
                scopes=[GOOGLE_DRIVE_SCOPE],
            )
        )

        http = httplib2.Http(
            timeout=SHEETS_HTTP_TIMEOUT_SECONDS
        )

        authorized_http = AuthorizedHttp(
            credentials,
            http=http,
        )

        self.service = build(
            "sheets",
            "v4",
            http=authorized_http,
            cache_discovery=False,
        )

        print(
            "✅ Google Sheets API inicializada",
            flush=True,
        )

    def _get_service(self):
        if self.service is None:
            self._initialize_service()

        return self.service

    @staticmethod
    def _escape_sheet_title(
        value: str,
    ) -> str:
        """
        Escapar comillas simples para rangos A1.
        """
        return str(value).replace(
            "'",
            "''",
        )

    def get_first_sheet_title(
        self,
        spreadsheet_id: str,
    ) -> str:
        """
        Obtener el nombre de la primera pestaña del Google Sheet.
        """
        service = self._get_service()

        result = (
            service.spreadsheets()
            .get(
                spreadsheetId=spreadsheet_id,
                fields=(
                    "sheets("
                    "properties("
                    "sheetId,"
                    "title,"
                    "index"
                    ")"
                    ")"
                ),
            )
            .execute(
                num_retries=SHEETS_API_RETRIES
            )
        )

        sheets = result.get(
            "sheets",
            [],
        )

        if not sheets:
            raise RuntimeError(
                "El Google Sheet no contiene hojas"
            )

        ordered = sorted(
            sheets,
            key=lambda item: (
                item.get(
                    "properties",
                    {}
                ).get(
                    "index",
                    0,
                )
            ),
        )

        title = (
            ordered[0]
            .get(
                "properties",
                {}
            )
            .get(
                "title"
            )
        )

        if not title:
            raise RuntimeError(
                "No se pudo obtener el nombre de la primera hoja"
            )

        return title

    def get_column_values(
        self,
        spreadsheet_id: str,
        sheet_title: str,
        column: str,
    ) -> List[List[str]]:
        """
        Leer una columna completa.

        Ejemplo:
            columna A de 6_Diseño_Curricular_Retroalimentacion
        """
        service = self._get_service()

        escaped_title = self._escape_sheet_title(
            sheet_title
        )

        cell_range = (
            f"'{escaped_title}'!"
            f"{column}:{column}"
        )

        result = (
            service.spreadsheets()
            .values()
            .get(
                spreadsheetId=spreadsheet_id,
                range=cell_range,
                valueRenderOption="FORMATTED_VALUE",
            )
            .execute(
                num_retries=SHEETS_API_RETRIES
            )
        )

        return result.get(
            "values",
            [],
        )

    def batch_update_values(
        self,
        spreadsheet_id: str,
        updates: List[Dict],
    ) -> Dict:
        """
        Escribir varios rangos en una sola petición.
        """
        if not updates:
            return {
                "updated": 0,
            }

        service = self._get_service()

        result = (
            service.spreadsheets()
            .values()
            .batchUpdate(
                spreadsheetId=spreadsheet_id,
                body={
                    "valueInputOption": "RAW",
                    "data": updates,
                    "includeValuesInResponse": False,
                },
            )
            .execute(
                num_retries=SHEETS_API_RETRIES
            )
        )

        return {
            "updated": result.get(
                "totalUpdatedCells",
                0,
            ),
            "updated_rows": result.get(
                "totalUpdatedRows",
                0,
            ),
            "updated_columns": result.get(
                "totalUpdatedColumns",
                0,
            ),
        }


google_sheets_service = GoogleSheetsService()