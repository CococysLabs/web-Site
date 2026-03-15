# Configuración de Google Drive con OAuth 2.0 (Sin Cuenta de Servicio)

Esta guía te ayudará a conectar con Google Drive usando OAuth 2.0, ideal cuando no puedes crear claves de cuenta de servicio.

## 📋 Pasos para Configurar OAuth 2.0

### 1️⃣ **Crear Credenciales OAuth en Google Cloud Console**

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. **IMPORTANTE**: Usa una cuenta personal de Gmail si tu cuenta organizacional tiene restricciones
3. Selecciona o crea tu proyecto `COCOCYS`

### 2️⃣ **Configurar la Pantalla de Consentimiento OAuth**

1. Ve a: **"APIs y servicios"** → **"Pantalla de consentimiento de OAuth"**
2. Selecciona **"Externo"** (si es cuenta personal) o **"Interno"** (si aplica)
3. Haz clic en **"CREAR"**
4. Llena los datos mínimos:
   - **Nombre de la aplicación**: `COCOCYS`
   - **Correo de asistencia del usuario**: tu email
   - **Correo del desarrollador**: tu email
5. Haz clic en **"GUARDAR Y CONTINUAR"**
6. En **"Permisos"**: haz clic en **"AGREGAR O QUITAR PERMISOS"**
   - Busca: `Google Drive API`
   - Selecciona: `../auth/drive.readonly` (solo lectura)
7. Haz clic en **"GUARDAR Y CONTINUAR"**
8. En **"Usuarios de prueba"**: agrega tu email
9. Haz clic en **"GUARDAR Y CONTINUAR"**

### 3️⃣ **Crear Credenciales OAuth**

1. Ve a: **"APIs y servicios"** → **"Credenciales"**
2. Haz clic en **"+ CREAR CREDENCIALES"**
3. Selecciona: **"ID de cliente de OAuth"**
4. Tipo de aplicación: **"Aplicación de escritorio"**
5. Nombre: `COCOCYS Desktop`
6. Haz clic en **"CREAR"**
7. **Descarga el JSON** (botón de descarga ⬇️)
8. Renombra el archivo descargado a: `client_secret.json`

### 4️⃣ **Coloca el Archivo en el Proyecto**

```bash
# Mueve el archivo descargado
mv ~/Downloads/client_secret_*.json "/Users/rivaldotojin/Documents/Documentos - MacBook Pro de Rivaldo/Tesis/web-Site/backend/client_secret.json"
```

### 5️⃣ **Actualiza el .env**

Cambia esta línea en tu archivo `.env`:

```env
# Cambia esto:
GOOGLE_CREDENTIALS_FILE=credentials.json

# Por esto:
GOOGLE_CREDENTIALS_FILE=client_secret.json
GOOGLE_AUTH_TYPE=oauth
```

### 6️⃣ **Primera Autorización**

Al ejecutar el script de prueba por primera vez:

```bash
cd backend
./venv/bin/python test_drive_oauth.py
```

1. Se abrirá tu navegador automáticamente
2. Inicia sesión con tu cuenta de Google
3. Acepta los permisos solicitados
4. Se guardará un archivo `token.json` con tu sesión

**⚠️ Importante**: El archivo `token.json` guardará tu autenticación, no necesitarás autorizar cada vez.

## 🔐 Archivos de Seguridad

Después de configurar tendrás estos archivos:

```
backend/
├── client_secret.json    ← Credenciales OAuth (descargadas)
├── token.json           ← Token de acceso (generado automáticamente)
└── .env                 ← Configuración
```

## ✅ Ventajas de OAuth vs Cuenta de Servicio

- ✅ **No necesitas permisos de administrador**
- ✅ **Funciona con cuentas organizacionales restringidas**
- ✅ **Acceso directo a TU Drive** (no necesitas compartir carpetas)
- ✅ **Más seguro** para desarrollo y pruebas
- ⚠️ Requiere autorización inicial en navegador

## 🔧 Solución de Problemas

### Error: "Access blocked: This app's request is invalid"
- Asegúrate de haber agregado tu email en "Usuarios de prueba"
- Verifica que la API de Drive esté habilitada

### El navegador no se abre
- Copia la URL que aparece en la consola
- Pégala manualmente en tu navegador

### Token expirado
- Simplemente borra el archivo `token.json`
- Vuelve a ejecutar el script para re-autorizar

---

**📝 Nota**: Esta configuración es perfecta para desarrollo y proyectos de tesis. Para producción con múltiples usuarios, considera implementar OAuth completo en el backend.
