# Configuración de Google Drive API

Esta guía te ayudará a configurar la integración con Google Drive para el sistema COCOCYS.

## 📋 Requisitos Previos

- Una cuenta de Google
- Acceso a Google Cloud Console

## 🚀 Pasos para Configurar

### 1. Crear un Proyecto en Google Cloud Console

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Nombra tu proyecto (ej: "COCOCYS-Drive-Integration")

### 2. Habilitar la API de Google Drive

1. En el menú lateral, ve a **"APIs y servicios"** → **"Biblioteca"**
2. Busca **"Google Drive API"**
3. Haz clic en **"HABILITAR"**

### 3. Crear Credenciales de Cuenta de Servicio

1. Ve a **"APIs y servicios"** → **"Credenciales"**
2. Haz clic en **"+ CREAR CREDENCIALES"**
3. Selecciona **"Cuenta de servicio"**
4. Completa la información:
   - **Nombre**: `cococys-drive-service`
   - **Descripción**: Servicio para acceder a Google Drive
5. Haz clic en **"CREAR Y CONTINUAR"**
6. En **"Otorgar acceso a esta cuenta de servicio"**:
   - Puedes dejarlo vacío o asignar el rol "Editor" si deseas
7. Haz clic en **"LISTO"**

### 4. Descargar el Archivo de Credenciales

1. En la lista de cuentas de servicio, haz clic en la que acabas de crear
2. Ve a la pestaña **"CLAVES"**
3. Haz clic en **"AGREGAR CLAVE"** → **"Crear clave nueva"**
4. Selecciona **"JSON"**
5. Se descargará un archivo JSON automáticamente

### 5. Configurar las Credenciales en el Proyecto

1. Renombra el archivo descargado a `credentials.json`
2. Copia el archivo a la carpeta `backend/` de tu proyecto:
   ```bash
   cp ~/Downloads/tu-proyecto-*.json /ruta/al/proyecto/backend/credentials.json
   ```
3. El archivo `.env` ya está configurado para usar `credentials.json`

### 6. Compartir la Carpeta de Drive con la Cuenta de Servicio

**IMPORTANTE**: Para que la cuenta de servicio pueda acceder a tus carpetas de Drive:

1. Abre el archivo `credentials.json` y busca el campo `client_email`
   - Tendrá un formato como: `cococys-drive-service@tu-proyecto.iam.gserviceaccount.com`
2. Ve a Google Drive y abre la carpeta que deseas usar
3. Haz clic derecho → **"Compartir"**
4. Agrega el email de la cuenta de servicio (`client_email`) como **"Editor"** o **"Lector"**
5. Copia el **ID de la carpeta** de la URL:
   - URL ejemplo: `https://drive.google.com/drive/folders/1ABC...XYZ`
   - ID de la carpeta: `1ABC...XYZ`
6. Actualiza el archivo `.env` con este ID:
   ```env
   GOOGLE_DRIVE_FOLDER_ID=1ABC...XYZ
   ```

## ✅ Verificar la Configuración

Una vez completados los pasos:

1. Reinicia el servidor backend:
   ```bash
   cd backend
   ./venv/bin/python -m uvicorn app.main:app --reload
   ```

2. Verifica que no haya errores en la consola

3. Inicia sesión como administrador en el frontend

4. Ve a la pestaña **"Drive"** en el panel de administración

5. Deberías ver las carpetas de tu Google Drive

## 🔧 Solución de Problemas

### Error: "Google Drive credentials not configured"
- Verifica que el archivo `credentials.json` exista en la carpeta `backend/`
- Verifica que la ruta en `.env` sea correcta

### No veo carpetas
- Asegúrate de haber compartido la carpeta con el email de la cuenta de servicio
- Verifica que el `GOOGLE_DRIVE_FOLDER_ID` en `.env` sea correcto
- Verifica que la cuenta de servicio tenga permisos de "Lector" o "Editor"

### Error de permisos
- La cuenta de servicio necesita permisos explícitos en cada carpeta
- Comparte la carpeta raíz y todas las subcarpetas necesarias

## 📝 Estructura del Archivo credentials.json

Tu archivo debe tener una estructura similar a:

```json
{
  "type": "service_account",
  "project_id": "tu-proyecto",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...",
  "client_email": "cococys-drive-service@tu-proyecto.iam.gserviceaccount.com",
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "..."
}
```

## 🎉 ¡Listo!

Una vez configurado correctamente, podrás:
- ✅ Ver todas las carpetas compartidas con la cuenta de servicio
- ✅ Listar archivos dentro de las carpetas
- ✅ Importar documentos desde Drive para análisis
- ✅ Sincronizar automáticamente carpetas específicas

---

**Nota**: Guarda tu archivo `credentials.json` de forma segura y **NUNCA** lo subas a repositorios públicos. El archivo `.gitignore` ya está configurado para excluirlo.
