# GitFlow - Flujo de Trabajo COCOCYS

Este documento describe el flujo de trabajo de Git que utilizamos en el proyecto COCOCYS.

## Estructura de Branches

```
main (producción)
  └── develop (desarrollo)
       ├── feature/* (nuevas características)
       ├── release/* (preparación para producción)
       └── hotfix/* (correcciones urgentes en producción)
```

## Branches Principales

### `main`
- **Propósito**: Código en producción
- **Deploy**: GitHub Pages (https://[usuario].github.io/web-Site)
- **Protección**: Requiere PR aprobado y CI passing
- **Solo acepta merges desde**: `develop`, `hotfix/*`, `release/*`

### `develop`
- **Propósito**: Integración de desarrollo
- **Deploy**: GitHub Pages Staging (https://[usuario].github.io/web-Site/staging)
- **Protección**: Requiere PR aprobado
- **Solo acepta merges desde**: `feature/*`, `release/*`, `hotfix/*`

## Branches de Soporte

### `feature/*` - Nuevas Características
Crear desde: `develop`
Merge hacia: `develop`

```bash
# Crear nueva feature
git checkout develop
git pull origin develop
git checkout -b feature/nombre-feature

# Trabajar en la feature...
git add .
git commit -m "feat: descripción del cambio"

# Pushear y crear PR
git push origin feature/nombre-feature
# Crear PR en GitHub: feature/nombre-feature → develop
```

### `release/*` - Preparación de Release
Crear desde: `develop`
Merge hacia: `main` y `develop`

```bash
# Crear release branch
git checkout develop
git pull origin develop
git checkout -b release/v1.0.0

# Ajustes finales (versiones, changelog, etc.)
git add .
git commit -m "chore: prepare release v1.0.0"

# Pushear
git push origin release/v1.0.0

# Crear PR hacia main
# Una vez aprobado, también hacer merge a develop
```

### `hotfix/*` - Correcciones Urgentes
Crear desde: `main`
Merge hacia: `main` y `develop`

```bash
# Crear hotfix
git checkout main
git pull origin main
git checkout -b hotfix/descripcion-bug

# Corregir el bug
git add .
git commit -m "fix: descripción de la corrección"

# Pushear y crear PR
git push origin hotfix/descripcion-bug
# Crear PR en GitHub: hotfix/descripcion-bug → main
# Después hacer merge también a develop
```

## Convenciones de Commits

Usamos [Conventional Commits](https://www.conventionalcommits.org/):

```
<tipo>(<scope>): <descripción>

[cuerpo opcional]

[footer opcional]
```

### Tipos de Commits:
- `feat`: Nueva característica
- `fix`: Corrección de bug
- `docs`: Cambios en documentación
- `style`: Cambios de formato (no afectan el código)
- `refactor`: Refactorización de código
- `test`: Agregar o modificar tests
- `chore`: Tareas de mantenimiento
- `perf`: Mejoras de performance

### Ejemplos:
```bash
git commit -m "feat: agregar componente de búsqueda"
git commit -m "fix: corregir error en redirección a Drive"
git commit -m "docs: actualizar README con instrucciones de deploy"
git commit -m "refactor: mejorar estructura de carpetas"
```

## Flujo de Trabajo Completo

### 1. Trabajar en una Nueva Feature

```bash
# Asegurarse de estar actualizado
git checkout develop
git pull origin develop

# Crear feature branch
git checkout -b feature/mi-nueva-feature

# Hacer cambios y commits
git add .
git commit -m "feat: descripción"

# Pushear
git push origin feature/mi-nueva-feature

# Ir a GitHub y crear Pull Request hacia develop
```

### 2. Preparar un Release

```bash
# Crear release branch desde develop
git checkout develop
git pull origin develop
git checkout -b release/v1.0.0

# Actualizar versión en package.json si es necesario
# Hacer últimos ajustes

git add .
git commit -m "chore: prepare release v1.0.0"
git push origin release/v1.0.0

# Crear PR hacia main
# Una vez aprobado y mergeado, también mergear a develop
```

### 3. Hotfix en Producción

```bash
# Crear hotfix desde main
git checkout main
git pull origin main
git checkout -b hotfix/fix-critical-bug

# Hacer la corrección
git add .
git commit -m "fix: corregir bug crítico"

git push origin hotfix/fix-critical-bug

# Crear PR hacia main
# Después de merge, también mergear a develop
```

## CI/CD Automático

### Triggers de CI (Verificación)
- Pull Requests hacia `main` o `develop`
- Push a `develop`, `feature/*`, `hotfix/*`, `release/*`

**Acciones**:
- Linting con ESLint
- Build del proyecto
- Verificación de calidad

### Triggers de CD (Deploy)

#### Staging
- Push a `develop`
- Deploy automático a: https://[usuario].github.io/web-Site/staging

#### Production
- Push a `main`
- Deploy automático a: https://[usuario].github.io/web-Site

## Reglas Importantes

1. **Nunca hacer push directo a `main` o `develop`**
2. **Siempre crear Pull Requests**
3. **Esperar aprobación de CI antes de mergear**
4. **Un revisor debe aprobar los PRs a `main`**
5. **Mantener commits pequeños y descriptivos**
6. **Actualizar tu branch antes de crear PR**:
   ```bash
   git checkout develop
   git pull origin develop
   git checkout feature/mi-feature
   git rebase develop
   ```

## Comandos Útiles

```bash
# Ver todas las branches
git branch -a

# Eliminar branch local
git branch -d feature/nombre-feature

# Eliminar branch remota
git push origin --delete feature/nombre-feature

# Ver estado de tu branch vs origin
git status

# Ver log de commits
git log --oneline --graph --all

# Actualizar tu branch con cambios de develop
git checkout feature/mi-feature
git rebase develop
```

## Recursos

- [Git Flow Cheatsheet](https://danielkummer.github.io/git-flow-cheatsheet/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [GitHub Flow](https://guides.github.com/introduction/flow/)
