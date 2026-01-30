# COCOCYS Backend API

Backend en Python con FastAPI para análisis de documentos con IA.

## 🚀 Tecnologías

- **FastAPI** - Framework web moderno y rápido
- **PostgreSQL (Neon)** - Base de datos serverless
- **SQLAlchemy** - ORM para Python
- **Google Gemini** - IA para análisis de documentos
- **JWT** - Autenticación basada en tokens

## 📋 Requisitos

- Python 3.10+
- pip
- Cuenta en [Neon](https://neon.tech) (PostgreSQL)
- API Key de [Google Gemini](https://makersuite.google.com/app/apikey)

## 🛠️ Instalación

### 1. Crear entorno virtual

```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # En Windows: venv\Scripts\activate
```

### 2. Instalar dependencias

```bash
pip install -r requirements.txt
```

### 3. Configurar variables de entorno

Copia el archivo `.env.example` a `.env` y completa las variables:

```bash
cp .env.example .env
```

Edita `.env` con tus credenciales:
- `DATABASE_URL`: Tu connection string de Neon
- `SECRET_KEY`: Genera una clave segura (usa `openssl rand -hex 32`)
- `GEMINI_API_KEY`: Tu API key de Google Gemini

### 4. Crear base de datos

Las migraciones se ejecutarán automáticamente al iniciar la app.

## 🏃‍♂️ Ejecutar

```bash
# Desarrollo con hot-reload
python -m app.main

# O con uvicorn directamente
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

La API estará disponible en:
- **API**: http://localhost:8000
- **Documentación**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## 📁 Estructura del Proyecto

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # Punto de entrada
│   ├── config.py            # Configuración
│   ├── database.py          # Conexión a BD
│   ├── models/              # Modelos SQLAlchemy
│   │   ├── __init__.py
│   │   ├── user.py
│   │   └── document.py
│   ├── schemas/             # Schemas Pydantic
│   │   ├── __init__.py
│   │   ├── user.py
│   │   └── document.py
│   ├── routes/              # Endpoints
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   └── documents.py
│   ├── services/            # Lógica de negocio
│   │   ├── __init__.py
│   │   ├── document_processor.py
│   │   └── gemini_service.py
│   └── utils/               # Utilidades
│       ├── __init__.py
│       ├── auth.py
│       └── validators.py
├── uploads/                 # Archivos subidos (git ignored)
├── requirements.txt
├── .env.example
├── .gitignore
└── README.md
```

## 🔐 Autenticación

La API usa JWT para autenticación. Endpoints:

- `POST /api/auth/register` - Registrar nuevo usuario
- `POST /api/auth/login` - Iniciar sesión (retorna token)
- Incluye el token en headers: `Authorization: Bearer <token>`

## 📄 Procesamiento de Documentos

Formatos soportados:
- `.docx` - Microsoft Word
- `.pdf` - PDF
- `.pptx` - PowerPoint
- `.xlsx` - Excel (criterios de evaluación)

## 🧠 Análisis con IA

El sistema usa Google Gemini para:
1. Extraer información de documentos
2. Comparar contra criterios del Excel
3. Generar informe de retroalimentación automático

## 🔗 API Endpoints

### Autenticación
- `POST /api/auth/register` - Registro
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Usuario actual

### Documentos
- `POST /api/documents/upload` - Subir documento
- `POST /api/documents/analyze` - Analizar documento
- `GET /api/documents/` - Listar documentos
- `GET /api/documents/{id}` - Obtener documento

## 📝 Notas

- Los archivos se almacenan temporalmente en `/uploads`
- Los tokens JWT expiran en 30 minutos (configurable)
- El límite de tamaño de archivo es 10MB (configurable)
