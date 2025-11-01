# COCOCYS - Web Oficial

Sitio web oficial de COCOCYS, una biblioteca digital con enlaces a recursos en Drive y GitHub.

## Tecnologías

- **Framework**: React 19
- **Build Tool**: Vite 7
- **Hosting**: GitHub Pages
- **CI/CD**: GitHub Actions
- **Gestión de Branches**: GitFlow

## Entornos

### Producción
- **URL**: https://[tu-usuario].github.io/web-Site
- **Branch**: `main`
- **Deploy**: Automático al hacer push a `main`

### Staging
- **URL**: https://[tu-usuario].github.io/web-Site/staging
- **Branch**: `develop`
- **Deploy**: Automático al hacer push a `develop`

## Inicio Rápido

### Instalación

```bash
# Clonar el repositorio
git clone https://github.com/[tu-usuario]/web-Site.git
cd web-Site

# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev
```

### Comandos Disponibles

```bash
npm run dev        # Servidor de desarrollo (http://localhost:5173)
npm run build      # Build para producción
npm run preview    # Preview del build
npm run lint       # Ejecutar ESLint
```

## Flujo de Trabajo (GitFlow)

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
   - **Branch**: `gh-pages` / `root`

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
