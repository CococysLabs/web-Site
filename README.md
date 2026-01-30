# COCOCYS - Sistema de Análisis de Documentos con IA

Plataforma web para análisis automático de documentos académicos utilizando inteligencia artificial (Google Gemini) y criterios de evaluación personalizados.

## 🏗️ Arquitectura del Proyecto

```
web-Site/
├── frontend/          # React + Vite
│   ├── src/          # Componentes React
│   ├── public/       # Assets estáticos
│   └── package.json
├── backend/          # FastAPI + Python
│   ├── app/         # Aplicación FastAPI
│   └── requirements.txt
├── database/        # Schemas SQL y documentación
│   ├── schema.sql
│   └── migrations/
└── README.md        # Este archivo
```

## 🚀 Stack Tecnológico

### Frontend
- **React 19** - Framework UI
- **Vite 7** - Build tool
- **React Router** - Navegación
- **Axios** - HTTP client

### Backend
- **Python 3.10+** - Lenguaje
- **FastAPI** - Framework web
- **SQLAlchemy** - ORM
- **Google Gemini** - IA generativa
- **JWT** - Autenticación

### Database
- **PostgreSQL (Neon)** - Base de datos serverless
- **Alembic** - Migraciones

### Procesamiento de Documentos
- **python-docx** - Microsoft Word
- **PyPDF2** - PDF
- **python-pptx** - PowerPoint
- **openpyxl/pandas** - Excel

## 📋 Características

- ✅ **Autenticación completa**: Registro, login, JWT
- 📄 **Multi-formato**: Soporta Word, PDF, PowerPoint
- 📊 **Criterios Excel**: Define criterios de evaluación en Excel
- 🤖 **Análisis con IA**: Google Gemini analiza documentos
- 📈 **Retroalimentación**: Informes detallados automáticos
- 🎨 **UI moderna**: Diseño responsive y profesional

## 🛠️ Instalación

### Prerrequisitos

- Node.js 18+ y npm
- Python 3.10+
- Cuenta en [Neon](https://neon.tech)
- API Key de [Google Gemini](https://makersuite.google.com/app/apikey)

### 1. Clonar repositorio

```bash
git clone https://github.com/[usuario]/web-Site.git
cd web-Site
```

### 2. Configurar Frontend

```bash
cd frontend
npm install
cp .env.example .env
# Editar .env si es necesario
npm run dev
```

Frontend: http://localhost:5173

### 3. Configurar Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Editar .env con tus credenciales
python -m app.main
```

Backend: http://localhost:8000  
Docs: http://localhost:8000/docs

### 4. Configurar Base de Datos

1. Crear proyecto en [Neon](https://neon.tech)
2. Copiar connection string
3. Ejecutar `database/schema.sql` en Neon SQL Editor
4. Agregar `DATABASE_URL` en `backend/.env`

## 📖 Uso

1. **Registro/Login**: Crear cuenta o iniciar sesión
2. **Subir criterios**: Cargar archivo Excel con criterios de evaluación
3. **Subir documento**: Cargar Word/PDF/PowerPoint a analizar
4. **Análisis**: El sistema procesa con Gemini
5. **Resultados**: Ver informe de retroalimentación detallado

## 🔗 API Endpoints

### Autenticación
- `POST /api/auth/register` - Registrar usuario
- `POST /api/auth/login` - Iniciar sesión
- `GET /api/auth/me` - Usuario actual

### Documentos
- `POST /api/documents/upload` - Subir documento
- `POST /api/documents/analyze` - Analizar documento
- `GET /api/documents/` - Listar documentos
- `GET /api/documents/{id}` - Obtener documento

## 📁 Documentación Detallada

- [Frontend README](frontend/README.md)
- [Backend README](backend/README.md)
- [Database README](database/README.md)

## 🧪 Testing

```bash
# Frontend
cd frontend
npm run test

# Backend
cd backend
pytest
```

## 🚀 Deployment

### Frontend (GitHub Pages)
```bash
cd frontend
npm run build
npm run deploy
```

### Backend (Railway, Render, etc.)
```bash
cd backend
# Configurar según plataforma
```

## 🤝 Contribuir

1. Fork el proyecto
2. Crear feature branch (`git checkout -b feature/amazing`)
3. Commit cambios (`git commit -m 'Add amazing feature'`)
4. Push branch (`git push origin feature/amazing`)
5. Abrir Pull Request

## 📝 Flujo de Trabajo (GitFlow)

Este proyecto utiliza GitFlow. Lee la documentación completa en [.github/GITFLOW.md](.github/GITFLOW.md).

### Estructura de Branches

- `main` - Producción (protegida)
- `develop` - Desarrollo (protegida)
- `feature/*` - Nuevas características
- `release/*` - Preparación de releases
- `hotfix/*` - Correcciones urgentes

### Crear una Nueva Feature

```bash
# Asegurarte de estar en develop actualizado
git checkout develop
git pull origin develop

# Crear feature branch
git checkout -b feature/nombre-de-tu-feature

# Hacer cambios y commits
git add .
git commit -m "feat: descripción de tu cambio"

# Pushear y crear Pull Request
git push origin feature/nombre-de-tu-feature
```

Luego ve a GitHub y crea un Pull Request de `feature/nombre-de-tu-feature` hacia `develop`.

## CI/CD

### Integración Continua (CI)

Se ejecuta automáticamente en:
- Pull Requests hacia `main` o `develop`
- Push a branches de `develop`, `feature/*`, `hotfix/*`, `release/*`

**Verificaciones**:
- ESLint (linting)
- Build exitoso
- Chequeo de calidad de código

### Despliegue Continuo (CD)

#### Staging
- **Trigger**: Push a `develop`
- **Destino**: GitHub Pages (branch `gh-pages-staging`)
- **URL**: https://[tu-usuario].github.io/web-Site/staging

#### Production
- **Trigger**: Push a `main`
- **Destino**: GitHub Pages (branch `gh-pages`)
- **URL**: https://[tu-usuario].github.io/web-Site

## Configuración Inicial

### 1. Configurar GitHub Pages

1. Ve a **Settings → Pages** en tu repositorio
2. Selecciona:
   - **Source**: Deploy from a branch
   - **Branch**: `gh-pages` / `/ (root)`
3. El workflow creará automáticamente la branch `gh-pages` en el primer deploy

### 2. Configurar Protección de Branches

Sigue las instrucciones en [.github/BRANCH_PROTECTION.md](.github/BRANCH_PROTECTION.md).

### 3. Crear Branch `develop`

```bash
git checkout -b develop
git push -u origin develop
```

### 4. Configurar Entornos en GitHub

Ve a **Settings → Environments** y crea:

**Environment: production**
- Deployment branches: `main`
- Required reviewers: 1

**Environment: staging**
- Deployment branches: `develop`

## Convenciones de Código

### Commits

Usamos [Conventional Commits](https://www.conventionalcommits.org/):

```
<tipo>: <descripción corta>

[descripción larga opcional]
```

**Tipos**:
- `feat`: Nueva característica
- `fix`: Corrección de bug
- `docs`: Documentación
- `style`: Formateo
- `refactor`: Refactorización
- `test`: Tests
- `chore`: Mantenimiento

**Ejemplos**:
```bash
git commit -m "feat: agregar componente de navegación"
git commit -m "fix: corregir enlaces rotos a Drive"
git commit -m "docs: actualizar README"
```

### ESLint

El proyecto incluye configuración de ESLint. Ejecuta antes de hacer commit:

```bash
npm run lint
```

## Estructura del Proyecto

```
web-Site/
├── .github/
│   ├── workflows/           # GitHub Actions
│   │   ├── ci.yml          # Integración continua
│   │   ├── deploy-staging.yml
│   │   └── deploy-production.yml
│   ├── GITFLOW.md          # Documentación de GitFlow
│   └── BRANCH_PROTECTION.md
├── public/                  # Archivos estáticos
├── src/                     # Código fuente React
│   ├── assets/             # Imágenes, estilos, etc.
│   ├── components/         # Componentes React
│   ├── App.jsx            # Componente principal
│   └── main.jsx           # Entry point
├── index.html
├── package.json
├── vite.config.js
└── README.md
```

## Contribuir

1. Crea una branch desde `develop`:
   ```bash
   git checkout develop
   git checkout -b feature/mi-feature
   ```

2. Haz tus cambios y commits:
   ```bash
   git add .
   git commit -m "feat: descripción"
   ```

3. Push y crea Pull Request:
   ```bash
   git push origin feature/mi-feature
   ```

4. Espera la revisión y aprobación del CI

## Recursos

- [Documentación de GitFlow](.github/GITFLOW.md)
- [Configuración de Protección de Branches](.github/BRANCH_PROTECTION.md)
- [Vite Documentation](https://vitejs.dev/)
- [React Documentation](https://react.dev/)
- [GitHub Actions](https://docs.github.com/en/actions)

## Licencia

Ver archivo [LICENSE](LICENSE)

## Soporte

Para preguntas o problemas, abre un issue en GitHub.
