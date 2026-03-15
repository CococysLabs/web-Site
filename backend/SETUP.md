# 🚀 Configuración del Backend - COCOCYS

## Requisitos Previos

- Python 3.10 o superior
- PostgreSQL (Neon Database)
- Cuenta de Google Cloud (para Gemini API)

## Instalación

### 1. Crear entorno virtual

```bash
cd backend
python -m venv venv

# macOS/Linux
source venv/bin/activate

# Windows
venv\Scripts\activate
```

### 2. Instalar dependencias

```bash
pip install -r requirements.txt
```

### 3. Configurar variables de entorno

```bash
# Copiar archivo de ejemplo
cp .env.example .env

# Editar con tus credenciales REALES
nano .env
```

**Obtener credenciales:**

- **DATABASE_URL**: https://console.neon.tech
- **SECRET_KEY**: Generar con `openssl rand -hex 32`
- **GEMINI_API_KEY**: https://makersuite.google.com/app/apikey

### 4. Inicializar base de datos

```bash
# Opción 1: Crear tablas automáticamente (SQLAlchemy)
python -m app.main

# Opción 2: Ejecutar schema SQL manualmente
cd ../database
psql $DATABASE_URL -f schema.sql
```

## Ejecutar en Desarrollo

```bash
cd backend

# Con uvicorn directamente
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# O con el script de Python
python -m app.main
```

La API estará disponible en:
- API: http://localhost:8000
- Documentación: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Probar la API

### Health Check
```bash
curl http://localhost:8000/health
```

### Registrar usuario
```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Juan",
    "apellidos": "Pérez",
    "correo": "juan@ejemplo.com",
    "password": "MiPassword123",
    "confirm_password": "MiPassword123"
  }'
```

### Login
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "correo": "juan@ejemplo.com",
    "password": "MiPassword123"
  }'
```

## Estructura del Proyecto

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py           # Punto de entrada FastAPI
│   ├── config.py         # Configuración y variables de entorno
│   ├── database.py       # Configuración SQLAlchemy
│   ├── models/          # Modelos de base de datos
│   │   └── user.py
│   ├── routes/          # Endpoints de la API
│   │   └── auth.py
│   ├── schemas/         # Schemas Pydantic (validación)
│   │   └── user.py
│   └── utils/           # Utilidades
│       └── auth.py      # JWT, hashing, etc.
├── requirements.txt     # Dependencias Python
├── .env.example        # Plantilla de variables de entorno
└── .env               # Variables de entorno (NO commitear)
```

## Solución de Problemas

### Error de conexión a base de datos

```bash
# Verificar que DATABASE_URL es correcta
echo $DATABASE_URL

# Probar conexión con psql
psql $DATABASE_URL -c "SELECT version();"
```

### Error de importación de módulos

```bash
# Reinstalar dependencias
pip install -r requirements.txt --force-reinstall
```

### Puerto 8000 en uso

```bash
# Usar otro puerto
uvicorn app.main:app --reload --port 8001

# O matar el proceso
lsof -ti:8000 | xargs kill -9
```

## Variables de Entorno

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `DATABASE_URL` | URI de PostgreSQL | `postgresql://user:pass@host/db` |
| `SECRET_KEY` | Clave secreta JWT | `abc123...` (32+ caracteres) |
| `ALGORITHM` | Algoritmo JWT | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Expiración del token | `30` |
| `GEMINI_API_KEY` | API Key de Google Gemini | `AIza...` |
| `HOST` | Host del servidor | `0.0.0.0` |
| `PORT` | Puerto del servidor | `8000` |
| `FRONTEND_URL` | URL del frontend (CORS) | `http://localhost:5173` |

## Desarrollo

### Agregar una nueva ruta

1. Crear archivo en `app/routes/`
2. Importar en `app/main.py`
3. Incluir router: `app.include_router(router, prefix="/api/ruta")`

### Agregar un nuevo modelo

1. Crear clase en `app/models/`
2. Heredar de `Base` (SQLAlchemy)
3. Ejecutar para crear tabla: `Base.metadata.create_all(bind=engine)`

### Migraciones con Alembic

```bash
# Inicializar Alembic (solo primera vez)
alembic init alembic

# Crear migración
alembic revision --autogenerate -m "descripción"

# Aplicar migraciones
alembic upgrade head
```

## Producción

- Usar servidor WSGI/ASGI en producción (Gunicorn + Uvicorn)
- Configurar HTTPS
- Usar variables de entorno del proveedor de hosting
- Habilitar logging estructurado
- Configurar rate limiting
- Implementar monitoreo (Sentry, DataDog, etc.)

## Recursos

- [FastAPI Docs](https://fastapi.tiangolo.com/)
- [SQLAlchemy ORM](https://docs.sqlalchemy.org/en/20/)
- [Pydantic Validation](https://docs.pydantic.dev/)
- [Neon Database](https://neon.tech/docs/)
