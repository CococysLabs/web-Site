# Database - COCOCYS

Esquema y configuración de la base de datos PostgreSQL en Neon.

## 🗄️ Estructura

- **users**: Usuarios del sistema
- **documents**: Documentos subidos (Word, PDF, PowerPoint)
- **evaluation_criteria**: Plantillas de criterios (archivos Excel)
- **analyses**: Resultados de análisis de documentos
- **user_sessions**: Control de sesiones JWT

## 🚀 Setup en Neon

### 1. Crear proyecto en Neon

1. Ve a [neon.tech](https://neon.tech)
2. Crea una cuenta o inicia sesión
3. Crea un nuevo proyecto: "cococys-db"
4. Región recomendada: US East (Ohio) - `us-east-2`

### 2. Ejecutar schema

```bash
# Opción 1: Desde la consola web de Neon
# Copia el contenido de schema.sql y ejecútalo en SQL Editor

# Opción 2: Usando psql
psql "postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/dbname?sslmode=require" -f schema.sql
```

### 3. Obtener connection string

```
postgresql://[user]:[password]@[host]/[dbname]?sslmode=require
```

Copia esta URL y agrégala a `backend/.env`:
```
DATABASE_URL=postgresql://...
```

## 📊 Modelo de Datos

### Users
- `id`: UUID (PK)
- `nombre`: String(100)
- `apellidos`: String(100)
- `correo`: String(255) UNIQUE
- `password_hash`: String(255)
- `created_at`, `updated_at`: Timestamps

### Documents
- `id`: UUID (PK)
- `user_id`: UUID (FK → users)
- `filename`: String
- `file_type`: String (docx, pdf, pptx)
- `analysis_result`: JSONB
- `status`: Enum (uploaded, processing, completed, failed)

### Evaluation Criteria
- `id`: UUID (PK)
- `user_id`: UUID (FK → users)
- `name`: String
- `criteria_data`: JSONB (datos del Excel)

### Analyses
- `id`: UUID (PK)
- `document_id`: UUID (FK → documents)
- `criteria_id`: UUID (FK → evaluation_criteria)
- `result`: JSONB
- `score`: Decimal (0-100)
- `feedback`: Text

## 🔧 Migrations con Alembic

```bash
cd backend

# Inicializar Alembic (ya incluido en requirements.txt)
alembic init migrations

# Crear nueva migración
alembic revision --autogenerate -m "descripción"

# Aplicar migraciones
alembic upgrade head

# Revertir migración
alembic downgrade -1
```

## 🧪 Seeds / Datos de Prueba

Crear en `database/seeds/`:
- `users.sql`: Usuarios de prueba
- `criteria.sql`: Criterios de ejemplo

## 📝 Notas

- Neon es serverless, se escala automáticamente
- Plan gratuito: 0.5GB storage, 10GB data transfer/mes
- Backups automáticos incluidos
- Soporta branching para testing

## 🔗 Enlaces Útiles

- [Neon Console](https://console.neon.tech)
- [Neon Docs](https://neon.tech/docs/introduction)
- [SQLAlchemy Docs](https://docs.sqlalchemy.org/)
