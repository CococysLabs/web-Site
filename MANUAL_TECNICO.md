# Manual Técnico — COCOCYS Web Platform

> **Versión:** 1.0.0 · **Fecha:** Marzo 2026 · **Audiencia:** Desarrolladores, DevOps, Arquitectos de Software

---

## Tabla de Contenidos

1. [Visión General del Sistema](#1-visión-general-del-sistema)
2. [Arquitectura del Sistema](#2-arquitectura-del-sistema)
3. [Stack Tecnológico](#3-stack-tecnológico)
4. [Estructura del Proyecto](#4-estructura-del-proyecto)
5. [Backend — FastAPI](#5-backend--fastapi)
6. [Frontend — React](#6-frontend--react)
7. [Base de Datos](#7-base-de-datos)
8. [Infraestructura Docker](#8-infraestructura-docker)
9. [Seguridad](#9-seguridad)
10. [API Reference](#10-api-reference)
11. [Flujos de Datos Internos](#11-flujos-de-datos-internos)
12. [Configuración y Variables de Entorno](#12-configuración-y-variables-de-entorno)
13. [DevOps y CI/CD](#13-devops-y-cicd)
14. [Guía de Instalación](#14-guía-de-instalación)

---

## 1. Visión General del Sistema

**COCOCYS** es una plataforma web fullstack para análisis automático de documentos académicos usando IA generativa. Permite a docentes y administradores evaluar documentos con criterios personalizados y obtener retroalimentación automatizada.

### Capacidades principales

- Autenticación y autorización basada en JWT con roles
- Procesamiento de documentos multi-formato (PDF, DOCX, PPTX, XLSX)
- Análisis de contenido mediante Google Gemini API
- Integración bidireccional con Google Drive
- API REST documentada con Swagger/OpenAPI
- Biblioteca digital de recursos educativos públicos
- Dashboard diferenciado por rol (admin / usuario)

---

## 2. Arquitectura del Sistema

### Diagrama de arquitectura general

```mermaid
graph TB
    subgraph Cliente["🌐 Cliente (Browser)"]
        FE["React 19 + Vite<br/>Puerto 80"]
    end

    subgraph Docker["🐳 Docker Network: cococys-network (172.25.0.0/16)"]
        direction TB
        NGX["Nginx Alpine<br/>(Reverse Proxy + Static)"]
        BE["FastAPI 0.115<br/>Python 3.9<br/>Puerto 8000"]
        NGX --> BE
    end

    subgraph Externo["☁️ Servicios Externos"]
        PG["PostgreSQL<br/>(Neon Serverless)"]
        GEM["Google Gemini API<br/>(IA Generativa)"]
        GDR["Google Drive API<br/>(Almacenamiento)"]
    end

    FE --> NGX
    BE --> PG
    BE --> GEM
    BE --> GDR
```

### Diagrama de capas

```mermaid
graph LR
    subgraph Presentacion["Capa de Presentación"]
        A[React Components]
        B[React Context / Hooks]
        C[Axios HTTP Client]
    end

    subgraph API["Capa de API"]
        D[FastAPI Routes]
        E[Pydantic Schemas]
        F[JWT Middleware]
    end

    subgraph Negocio["Capa de Negocio"]
        G[analysis_service]
        H[document_content_validation_service]
        I[structure_validation_service]
        J[drive_service]
        K[settings_service]
    end

    subgraph Datos["Capa de Datos"]
        L[SQLAlchemy ORM]
        M[PostgreSQL Neon]
    end

    subgraph IA["Servicios IA / Storage"]
        N[Google Gemini API]
        O[Google Drive API]
    end

    C --> D
    D --> E
    D --> F
    D --> G
    D --> H
    D --> I
    D --> J
    D --> K
    G --> L
    H --> N
    I --> L
    J --> O
    L --> M
```

### Diagrama de despliegue (Docker)

```mermaid
graph TB
    subgraph Host["Host: Windows 11 / Linux Server"]
        subgraph Compose["docker-compose.yml"]
            subgraph Net["Network: cococys-network"]
                FEC["cococys-frontend<br/>nginx:alpine<br/>:80 → :80<br/>CPU: 0.5 | RAM: 512M"]
                BEC["cococys-backend<br/>python:3.9-slim<br/>:8000 → :8000<br/>CPU: 1.0 | RAM: 1G"]
            end
            VOL["Volume: cococys-backend-logs"]
        end
    end

    BEC --> VOL
    FEC -.depends_on.-> BEC
```

---

## 3. Stack Tecnológico

### Resumen completo

| Capa | Tecnología | Versión | Función |
|------|-----------|---------|---------|
| Frontend | React | 19.1.1 | UI declarativa |
| Frontend | Vite | 7.1.7 | Build tool + HMR |
| Frontend | React Router | 7.13.0 | Navegación SPA |
| Frontend | Axios | 1.13.2 | HTTP client |
| Frontend | React Hook Form | 7.71.1 | Formularios |
| Frontend | Nginx | Alpine | Servidor web / proxy |
| Backend | FastAPI | 0.115.5 | Framework REST API |
| Backend | Python | 3.9 | Lenguaje base |
| Backend | Uvicorn | 0.32.1 | ASGI server |
| Backend | SQLAlchemy | 2.0.36 | ORM |
| Backend | Alembic | 1.14.0 | Migraciones BD |
| Backend | Pydantic | 2.10.3 | Validación / Settings |
| Backend | python-jose | 3.3.0 | JWT tokens |
| Backend | passlib + bcrypt | 1.7.4 / 4.0.1 | Hashing contraseñas |
| Backend | python-docx | 1.1.2 | Procesamiento Word |
| Backend | PyPDF2 | 3.0.1 | Procesamiento PDF |
| Backend | python-pptx | 1.0.2 | Procesamiento PPT |
| Backend | openpyxl + pandas | 3.1.5 / 2.2.3 | Procesamiento Excel |
| IA | google-generativeai | 0.8.3 | Google Gemini API |
| Drive | google-api-python-client | 2.154.0 | Google Drive API |
| DB | PostgreSQL (Neon) | Serverless | Base de datos principal |
| DevOps | Docker + Compose | Latest | Contenedores |
| DevOps | GitHub Actions | — | CI/CD |

---

## 4. Estructura del Proyecto

```
web-Site/
├── 📄 README.md                    ← Documentación general
├── 📄 MANUAL_USUARIO.md            ← Manual de usuario
├── 📄 MANUAL_TECNICO.md            ← Este documento
├── 📄 SECURITY.md                  ← Política de seguridad
├── 📄 CONFIGURE_DATABASE.md        ← Configuración de BD
├── 📄 DOCKER.md                    ← Docker (desarrollo)
├── 📄 DOCKER_PROFESSIONAL.md       ← Docker (producción)
├── 📄 Makefile                     ← Automatización de tareas
├── 📄 docker-compose.yml           ← Desarrollo
├── 📄 docker-compose.prod.yml      ← Producción
├── 📄 deploy.sh                    ← Script de despliegue
├── 📄 .env.docker                  ← Variables Docker
│
├── 📁 .github/
│   ├── GITFLOW.md
│   ├── BRANCH_PROTECTION.md
│   ├── workflows/                  ← GitHub Actions CI/CD
│   ├── ISSUE_TEMPLATE/
│   └── pull_request_template.md
│
├── 📁 backend/
│   ├── Dockerfile                  ← Multi-stage build
│   ├── requirements.txt
│   ├── .env.example
│   ├── init_admin.py               ← Seed usuario admin
│   ├── test_db_connection.py
│   └── app/
│       ├── main.py                 ← Entry point FastAPI
│       ├── config.py               ← Settings (Pydantic)
│       ├── database.py             ← SQLAlchemy engine/session
│       ├── models/                 ← ORM models
│       │   ├── user.py
│       │   ├── document.py
│       │   ├── validation.py
│       │   ├── validation_record.py
│       │   └── system_setting.py
│       ├── routes/                 ← FastAPI routers
│       │   ├── auth.py             ← /api/auth
│       │   ├── documents.py        ← /api/documents
│       │   ├── analysis.py         ← /api/analysis
│       │   ├── validation.py       ← /api/validation
│       │   ├── drive.py            ← Google Drive
│       │   └── admin_settings.py   ← /api/settings
│       ├── services/               ← Business logic
│       │   ├── analysis_service.py
│       │   ├── document_content_validation_service.py
│       │   ├── drive_service.py
│       │   ├── settings_service.py
│       │   └── structure_validation_service.py
│       ├── schemas/                ← Pydantic schemas
│       │   └── user.py
│       └── utils/
│           └── auth.py             ← JWT helpers
│
├── 📁 frontend/
│   ├── Dockerfile                  ← Multi-stage build
│   ├── nginx.conf                  ← Configuración Nginx
│   ├── vite.config.js
│   ├── package.json
│   └── src/
│       ├── App.jsx                 ← Root + Routing
│       ├── main.jsx                ← React DOM entry
│       ├── components/
│       │   ├── auth/               ← Login, Register
│       │   ├── admin/              ← AdminDashboard, DocumentAnalyzer
│       │   ├── Dashboard.jsx       ← Dashboard usuario
│       │   └── ProtectedRoute.jsx  ← Auth guard
│       ├── contexts/
│       │   └── AuthContext.jsx     ← Global auth state
│       ├── hooks/
│       │   └── useAuth.js
│       └── services/
│           └── api.js              ← Axios instance
│
└── 📁 database/
    ├── schema.sql
    └── migrations/
```

---

## 5. Backend — FastAPI

### Diagrama de rutas completo

```mermaid
graph LR
    Client([HTTP Client])

    Client --> ROOT["GET /"]
    Client --> HEALTH["GET /health"]
    Client --> READY["GET /ready"]
    Client --> METRICS["GET /metrics"]
    Client --> DOCS["GET /docs"]

    subgraph Auth["/api/auth"]
        A1["POST /register"]
        A2["POST /login"]
        A3["GET /me"]
    end

    subgraph Documents["/api/documents"]
        D1["POST /upload"]
        D2["GET /list"]
        D3["GET /{id}"]
    end

    subgraph Analysis["/api/analysis"]
        AN1["POST /analyze"]
        AN2["GET /results/{id}"]
    end

    subgraph Validation["/api/validation"]
        V1["POST /validate"]
        V2["GET /criteria"]
        V3["POST /criteria"]
    end

    subgraph Drive["/api/drive"]
        DR1["GET /files"]
        DR2["POST /upload"]
        DR3["GET /folder"]
    end

    subgraph Settings["/api/settings"]
        S1["GET /"]
        S2["PUT /"]
    end

    Client --> Auth
    Client --> Documents
    Client --> Analysis
    Client --> Validation
    Client --> Drive
    Client --> Settings
```

### Modelos de base de datos (ORM)

```mermaid
erDiagram
    users {
        UUID id PK
        string nombre
        string apellidos
        string correo UK
        string password_hash
        boolean is_teacher
        string drive_folder_id
        timestamp created_at
        timestamp updated_at
    }

    documents {
        UUID id PK
        UUID user_id FK
        string filename
        string file_type
        json analysis_result
        string status
        timestamp created_at
    }

    validations {
        UUID id PK
        UUID user_id FK
        string name
        json criteria_data
        timestamp created_at
    }

    validation_records {
        UUID id PK
        UUID document_id FK
        UUID validation_id FK
        json result
        integer score
        text feedback
        timestamp created_at
    }

    system_settings {
        UUID id PK
        string key UK
        text value
        timestamp updated_at
    }

    users ||--o{ documents : "sube"
    users ||--o{ validations : "crea"
    documents ||--o{ validation_records : "tiene"
    validations ||--o{ validation_records : "aplica"
```

### Ciclo de vida de una petición

```mermaid
sequenceDiagram
    participant C as Cliente
    participant N as Nginx
    participant F as FastAPI
    participant M as Middleware CORS+JWT
    participant R as Router
    participant S as Service
    participant DB as PostgreSQL

    C->>N: HTTP Request
    N->>F: Proxy /api/*
    F->>M: Validate CORS
    M->>M: Verify JWT Token
    M->>R: Route to handler
    R->>S: Call service layer
    S->>DB: Query / Write
    DB-->>S: Result
    S-->>R: Business result
    R-->>F: Response model
    F-->>N: JSON Response
    N-->>C: HTTP Response
```

### Startup del backend

```mermaid
flowchart TD
    A([uvicorn start]) --> B[FastAPI init]
    B --> C[CORS middleware setup]
    C --> D[startup_event]
    D --> E[init_db: create tables]
    E --> F[ALTER TABLE migrations]
    F --> G[Initialize system settings defaults]
    G --> H[API Ready ✓]
```

### Servicios de IA y procesamiento

```mermaid
graph TB
    subgraph Input
        DOC[".docx / .pdf / .pptx"]
        XLS[".xlsx (criterios)"]
    end

    subgraph analysis_service
        E1[Extrae texto del documento]
        E2[Parsea criterios de evaluación]
        E3[Construye prompt Gemini]
    end

    subgraph gemini["Google Gemini API"]
        G1[Batch evaluation]
        G2[Genera feedback por criterio]
        G3[Calcula puntuación]
    end

    subgraph Output
        R1[JSON con resultados]
        R2[Score 0-100]
        R3[Feedback por criterio]
    end

    DOC --> E1
    XLS --> E2
    E1 --> E3
    E2 --> E3
    E3 --> G1
    G1 --> G2
    G2 --> G3
    G3 --> R1
    G3 --> R2
    G3 --> R3
```

---

## 6. Frontend — React

### Árbol de componentes

```mermaid
graph TD
    MAIN[main.jsx] --> APP[App.jsx]
    APP --> BROWSER[BrowserRouter]
    BROWSER --> AUTH_CTX[AuthProvider]

    AUTH_CTX --> ROUTES[Routes]

    ROUTES --> HOME["/ → HomePage"]
    ROUTES --> LOGIN["/login → Login"]
    ROUTES --> REGISTER["/register → Register"]
    ROUTES --> PROTECTED["/dashboard → ProtectedRoute"]

    PROTECTED --> ROLE[RoleDashboard]
    ROLE -- "role=admin" --> ADMIN[AdminDashboard]
    ROLE -- "role=user/teacher" --> DASH[Dashboard]

    ADMIN --> ANALYZER[DocumentAnalyzer]

    HOME --> NAVBAR[Navbar]
    HOME --> HERO[Hero Section]
    HOME --> SEARCH[Search + Filters]
    HOME --> GRID[Resources Grid]
    HOME --> FOOTER[Footer]
```

### Flujo de autenticación (Context)

```mermaid
stateDiagram-v2
    [*] --> Unauthenticated: App load

    Unauthenticated --> CheckStorage: useEffect
    CheckStorage --> Authenticated: Token en localStorage
    CheckStorage --> Unauthenticated: Sin token

    Unauthenticated --> Login: /login
    Login --> Authenticated: POST /api/auth/login OK
    Login --> Unauthenticated: Error credenciales

    Authenticated --> Unauthenticated: Logout / Token expirado
    Authenticated --> Dashboard: Acceso protegido
```

### Servicios HTTP (api.js)

```javascript
// Configuración de Axios
Base URL: VITE_API_URL (env)
Interceptors:
  - Request: agrega Authorization: Bearer {token}
  - Response: maneja 401 → redirect a /login
```

---

## 7. Base de Datos

### PostgreSQL en Neon (Serverless)

**Características:**
- Serverless auto-scaling
- Branching para ambientes de test
- SSL obligatorio (`?sslmode=require`)
- Backups automáticos

### Configuración SQLAlchemy

```python
ENGINE_ARGS = {
    "pool_size": 5,
    "max_overflow": 10,
    "pool_pre_ping": True,  # Reconexión automática
    "connect_args": {"sslmode": "require"}
}
```

### Estrategia de migraciones

```mermaid
flowchart TD
    A[Alembic: Migraciones formales] --> B[alembic upgrade head]
    C[Startup migrations: ALTER TABLE IF NOT EXISTS] --> D[Columnas opcionales seguras]
    B --> E[Base de datos actualizada]
    D --> E
```

**Convención:** Cambios de esquema mayores van en Alembic. Columnas opcionales nuevas se agregan vía `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` en el startup del backend.

---

## 8. Infraestructura Docker

### Arquitectura de contenedores

```mermaid
graph TB
    subgraph Externo["Puerto Externo"]
        P80["0.0.0.0:80"]
        P8000["0.0.0.0:8000"]
    end

    subgraph Network["Red Docker: cococys-network (172.25.0.0/16)"]
        subgraph FrontContainer["cococys-frontend"]
            NGINX["Nginx Alpine"]
            STATIC["Static Files (React Build)"]
            PROXY["Proxy /api → backend:8000"]
        end

        subgraph BackContainer["cococys-backend"]
            UVICORN["Uvicorn ASGI"]
            APP["FastAPI App"]
            CREDS["Google Creds (read-only)"]
        end
    end

    subgraph Volumes["Volúmenes"]
        LOGS["cococys-backend-logs"]
    end

    P80 --> NGINX
    P8000 --> UVICORN
    NGINX --> STATIC
    NGINX --> PROXY
    PROXY --> UVICORN
    UVICORN --> APP
    APP --> CREDS
    APP --> LOGS
```

### Multi-stage builds

**Backend Dockerfile (2 stages):**
```
Stage 1 (builder): python:3.9-slim
  → Instala gcc, g++, libpq-dev
  → Crea virtualenv
  → pip install -r requirements.txt

Stage 2 (runtime): python:3.9-slim
  → Solo libpq5 + curl (runtime deps)
  → Usuario no-root: appuser (UID 1000)
  → HEALTHCHECK: curl /health cada 30s
  → CMD: uvicorn app.main:app --host 0.0.0.0 --port 8000
```

**Frontend Dockerfile (3 stages):**
```
Stage 1 (deps): node:20-alpine
  → npm ci

Stage 2 (builder): node:20-alpine
  → npm run build (Vite production)

Stage 3 (production): nginx:alpine
  → Copia dist/ a /usr/share/nginx/html
  → Usuario no-root: appuser
  → nginx.conf personalizado
```

### Recursos Docker (desarrollo vs producción)

| Servicio | Dev CPU | Dev RAM | Prod CPU | Prod RAM |
|---------|---------|---------|----------|----------|
| Backend | 1.0 / 0.5 | 1G / 512M | 2.0 / 1.0 | 2G / 1G |
| Frontend | 0.5 / 0.25 | 512M / 256M | 1.0 / 0.5 | 1G / 512M |

### Comandos Makefile

```bash
make up          # Levantar desarrollo
make up-prod     # Levantar producción
make down        # Detener servicios
make build       # Reconstruir imágenes
make logs        # Ver logs en tiempo real
make health      # Verificar salud
make clean       # Limpiar contenedores + imágenes
make deploy      # Deploy a producción
make monitor     # Monitoreo en tiempo real
make db-migrate  # Ejecutar migraciones Alembic
```

---

## 9. Seguridad

### Capas de seguridad implementadas

```mermaid
graph TB
    subgraph Network["Capa de Red"]
        N1["CORS configurado por origen"]
        N2["Rate limiting Nginx (API: 10r/s, Login: 5r/m)"]
    end

    subgraph App["Capa de Aplicación"]
        A1["JWT con expiración (30 min)"]
        A2["Bcrypt para contraseñas"]
        A3["Validación Pydantic en todos los inputs"]
        A4["Roles: admin / teacher / user"]
    end

    subgraph Container["Capa de Contenedor"]
        C1["Usuarios no-root (appuser, UID 1000)"]
        C2["Credenciales montadas read-only"]
        C3["Secrets en .env (no en imagen)"]
    end

    subgraph HTTP["Headers HTTP (Nginx)"]
        H1["X-Frame-Options: SAMEORIGIN"]
        H2["X-Content-Type-Options: nosniff"]
        H3["X-XSS-Protection: 1; mode=block"]
        H4["Content-Security-Policy (CSP)"]
    end
```

### Política de JWT

| Parámetro | Valor |
|-----------|-------|
| Algoritmo | HS256 |
| Expiración | 30 minutos |
| Almacenamiento cliente | `localStorage` |
| Header | `Authorization: Bearer <token>` |

### Archivos sensibles (NO en git)

```
backend/.env          ← DATABASE_URL, SECRET_KEY, API keys
backend/cococys-driv-*.json  ← Credenciales Google Service Account
.env.docker           ← Variables para Docker Compose
```

---

## 10. API Reference

### Endpoints del sistema

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/` | No | Información de la API |
| GET | `/health` | No | Liveness probe |
| GET | `/ready` | No | Readiness probe (verifica DB) |
| GET | `/metrics` | No | CPU, RAM, disco, uptime |
| GET | `/docs` | No | Swagger UI interactivo |
| GET | `/redoc` | No | ReDoc documentation |

### Autenticación

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/api/auth/register` | No | Crear nueva cuenta |
| POST | `/api/auth/login` | No | Obtener JWT token |
| GET | `/api/auth/me` | JWT | Datos del usuario actual |

### Documentos

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/api/documents/upload` | JWT | Subir documento |
| GET | `/api/documents/` | JWT | Listar documentos del usuario |
| GET | `/api/documents/{id}` | JWT | Obtener documento por ID |

### Análisis

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/api/analysis/analyze` | JWT | Analizar documento con IA |
| GET | `/api/analysis/results/{id}` | JWT | Obtener resultados de análisis |

### Validación

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/validation/criteria` | JWT | Listar criterios de evaluación |
| POST | `/api/validation/criteria` | JWT | Crear criterio |
| POST | `/api/validation/validate` | JWT | Ejecutar validación |

### Google Drive

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/drive/files` | JWT | Listar archivos en Drive |
| POST | `/api/drive/upload` | JWT | Subir archivo a Drive |
| GET | `/api/drive/folder` | JWT | Info de carpeta vinculada |

### Configuración Admin

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/settings/` | JWT+Admin | Ver configuración del sistema |
| PUT | `/api/settings/` | JWT+Admin | Actualizar configuración |

---

## 11. Flujos de Datos Internos

### Flujo de análisis de documentos con IA

```mermaid
sequenceDiagram
    participant U as Usuario
    participant FE as React Frontend
    participant RT as FastAPI Router
    participant AS as analysis_service
    participant CS as content_validation_service
    participant SS as structure_validation_service
    participant GEM as Google Gemini
    participant DB as PostgreSQL

    U->>FE: Sube documento + criterios
    FE->>RT: POST /api/analysis/analyze (multipart)
    RT->>AS: analyze(document, criteria)

    par Procesamiento paralelo
        AS->>CS: validate_content(document)
        CS->>CS: Extrae texto (docx/pdf/pptx)
        CS-->>AS: content_data
    and
        AS->>SS: validate_structure(document)
        SS-->>AS: structure_data
    end

    AS->>AS: build_gemini_prompt(content+criteria)
    AS->>GEM: Batch evaluation request (1 call/group)
    GEM-->>AS: JSON con scores + feedback por criterio

    AS->>DB: INSERT validation_record (result, score, feedback)
    DB-->>AS: record_id
    AS-->>RT: AnalysisResult
    RT-->>FE: JSON Response
    FE->>U: Muestra resultados
```

### Flujo de autenticación completo

```mermaid
sequenceDiagram
    participant C as Cliente
    participant FE as React
    participant API as FastAPI /auth
    participant DB as PostgreSQL

    Note over C,DB: REGISTRO
    C->>FE: Formulario registro
    FE->>API: POST /api/auth/register {nombre, correo, password}
    API->>API: bcrypt.hash(password)
    API->>DB: INSERT INTO users
    DB-->>API: user record
    API-->>FE: {id, nombre, correo}
    FE-->>C: Redirige a /login

    Note over C,DB: LOGIN
    C->>FE: Formulario login
    FE->>API: POST /api/auth/login {correo, password}
    API->>DB: SELECT user WHERE correo=?
    DB-->>API: user record
    API->>API: bcrypt.verify(password, hash)
    API->>API: jwt.encode({sub: id, exp: +30min})
    API-->>FE: {access_token, token_type}
    FE->>FE: localStorage.set(token)
    FE-->>C: Redirige a /dashboard

    Note over C,DB: REQUEST AUTENTICADO
    C->>FE: Acción protegida
    FE->>API: GET /api/auth/me + Authorization: Bearer TOKEN
    API->>API: jwt.decode(token)
    API->>DB: SELECT user WHERE id=?
    DB-->>API: user record
    API-->>FE: {id, nombre, role, ...}
```

---

## 12. Configuración y Variables de Entorno

### Variables del backend (`backend/.env`)

```bash
# ── Base de Datos ──────────────────────────────────
DATABASE_URL=postgresql://user:pass@host.neon.tech/db?sslmode=require

# ── Autenticación JWT ──────────────────────────────
SECRET_KEY=clave_secreta_minimo_32_caracteres_aleatoria
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# ── Google Gemini IA ───────────────────────────────
GEMINI_API_KEY=AIzaSy...primary_key
GEMINI_API_KEYS=AIzaSy...key2,AIzaSy...key3   # Claves de respaldo (fallback)

# ── Google Drive ───────────────────────────────────
GOOGLE_CREDENTIALS_FILE=cococys-driv-105652f59c31.json
GOOGLE_DRIVE_FOLDER_ID=1xxxxxxxxxxxxxxxxxxxxxxxxxxx

# ── Proveedores IA Alternativos ────────────────────
GROQ_API_KEY=gsk_...          # Fallback IA
OPENROUTER_API_KEY=sk-or-...  # Fallback IA

# ── CORS ───────────────────────────────────────────
CORS_ORIGINS=http://localhost:5173,http://localhost:80
FRONTEND_URL=http://localhost

# ── Servidor ───────────────────────────────────────
HOST=0.0.0.0
PORT=8000
ENVIRONMENT=development     # development | production

# ── Archivos ───────────────────────────────────────
MAX_FILE_SIZE=10485760      # 10 MB en bytes
ALLOWED_EXTENSIONS=.pdf,.docx,.pptx,.xlsx
```

### Variables Docker (`.env.docker`)

```bash
BACKEND_PORT=8000
FRONTEND_PORT=80
VITE_API_URL=http://localhost:8000
```

### Prioridad de claves Gemini

```mermaid
flowchart LR
    A[Request a Gemini] --> B{GEMINI_API_KEY disponible?}
    B -- Sí --> C[Usar clave primaria]
    B -- No / Error --> D{GEMINI_API_KEYS definidas?}
    D -- Sí --> E[Rotar entre claves de respaldo]
    D -- No --> F{GROQ_API_KEY?}
    F -- Sí --> G[Usar Groq como fallback]
    F -- No --> H{OPENROUTER_API_KEY?}
    H -- Sí --> I[Usar OpenRouter]
    H -- No --> J[Error: sin proveedor IA]
```

---

## 13. DevOps y CI/CD

### Estrategia de ramas (GitFlow)

```mermaid
gitGraph
    commit id: "Initial"
    branch develop
    checkout develop
    commit id: "feat: setup"
    branch feature/auth
    checkout feature/auth
    commit id: "add JWT"
    commit id: "add login"
    checkout develop
    merge feature/auth id: "merge auth"
    branch feature/drive
    checkout feature/drive
    commit id: "drive integration"
    checkout develop
    merge feature/drive id: "merge drive"
    checkout main
    merge develop id: "v1.0.0" tag: "v1.0.0"
```

### Flujo de despliegue

```mermaid
flowchart TD
    A[git push origin develop] --> B[GitHub Actions CI]
    B --> C{Tests pasan?}
    C -- No --> D[❌ Notificación de fallo]
    C -- Sí --> E[Build Docker images]
    E --> F[Push a registry]
    F --> G[PR a main]
    G --> H[Code Review]
    H --> I[Merge a main]
    I --> J[deploy.sh en servidor]
    J --> K[docker compose -f docker-compose.prod.yml up -d]
    K --> L[Health checks automáticos]
    L --> M[✅ Deploy exitoso]
```

### Monitoreo y Observabilidad

| Endpoint | Descripción | Uso |
|----------|-------------|-----|
| `GET /health` | Liveness: ¿está vivo? | Docker HEALTHCHECK |
| `GET /ready` | Readiness: ¿DB conectada? | Load balancer |
| `GET /metrics` | CPU, RAM, disco | Monitoreo externo |

**Logging:**
- Driver: `json-file`
- Desarrollo: max 10MB / 3 archivos (backend), 5MB / 3 (frontend)
- Producción: max 50MB / 10 archivos (backend), 20MB / 5 (frontend)
- Compresión habilitada en producción

---

## 14. Guía de Instalación

### Requisitos del sistema

| Componente | Mínimo | Recomendado |
|-----------|--------|-------------|
| CPU | 2 cores | 4 cores |
| RAM | 2 GB | 4 GB |
| Disco | 5 GB | 10 GB |
| Docker | 24.0+ | Latest |
| Docker Compose | 2.0+ | Latest |

### Instalación rápida (Docker)

```bash
# 1. Clonar repositorio
git clone https://github.com/CococysLabs/web-Site.git
cd web-Site

# 2. Configurar variables de entorno
cp backend/.env.example backend/.env
# Editar backend/.env con credenciales reales

# 3. Agregar credenciales de Google Drive
# Colocar archivo JSON en: backend/cococys-driv-*.json

# 4. Levantar servicios
docker compose up -d

# 5. Verificar estado
docker compose ps
curl http://localhost:8000/health
curl http://localhost/

# 6. (Opcional) Crear usuario administrador
docker compose exec backend python init_admin.py
```

### Verificación post-instalación

```bash
# Backend health
curl http://localhost:8000/health
# → {"status":"healthy","version":"1.0.0","service":"cococys-backend"}

# Backend ready (verifica DB)
curl http://localhost:8000/ready
# → {"status":"ready","database":"connected"}

# Frontend
curl -I http://localhost
# → HTTP/1.1 200 OK

# API docs
# Abrir en browser: http://localhost:8000/docs
```

### Actualización del sistema

```bash
# 1. Pull últimos cambios
git pull origin main

# 2. Reconstruir imágenes
docker compose build --no-cache

# 3. Reiniciar servicios
docker compose up -d

# 4. Ejecutar migraciones si las hay
docker compose exec backend alembic upgrade head
```

---

*Manual Técnico generado en base al código fuente de COCOCYS v1.0.0*
*Rama: develop · Último commit: a602837 (Complet v01)*
*Desarrollado por RivaldoTJ y el equipo de COCOCYS*
