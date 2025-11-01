# Configuración de Protección de Branches

Este documento describe las reglas de protección que deben configurarse en GitHub para las branches principales del proyecto.

## Configuración Manual en GitHub

Ve a: **Settings → Branches → Branch protection rules**

### Protección para `main` (Producción)

1. **Branch name pattern**: `main`
2. **Reglas requeridas**:
   - ✅ Require a pull request before merging
     - Require approvals: **1**
     - Dismiss stale pull request approvals when new commits are pushed
   - ✅ Require status checks to pass before merging
     - Require branches to be up to date before merging
     - Status checks requeridos:
       - `Lint and Build`
       - `Code Quality Checks`
   - ✅ Require conversation resolution before merging
   - ✅ Do not allow bypassing the above settings
   - ✅ Restrict who can push to matching branches (opcional, solo administradores)

### Protección para `develop` (Desarrollo)

1. **Branch name pattern**: `develop`
2. **Reglas requeridas**:
   - ✅ Require a pull request before merging
     - Require approvals: **1**
   - ✅ Require status checks to pass before merging
     - Status checks requeridos:
       - `Lint and Build`
   - ✅ Require conversation resolution before merging

### Protección para branches de Release

1. **Branch name pattern**: `release/**`
2. **Reglas requeridas**:
   - ✅ Require a pull request before merging
     - Require approvals: **1**
   - ✅ Require status checks to pass before merging

## Entornos de GitHub (Environments)

Configura los siguientes entornos en: **Settings → Environments**

### Environment: `production`
- **Deployment branches**: Only `main`
- **Required reviewers**: 1 reviewer mínimo
- **Wait timer**: 0 minutos (o el tiempo que desees)

### Environment: `staging`
- **Deployment branches**: Only `develop`
- **Required reviewers**: No requerido
- **Wait timer**: 0 minutos

## Configuración de GitHub Pages

Ve a: **Settings → Pages**

1. **Source**: Deploy from a branch
2. **Branch**: `gh-pages` / `/ (root)`
   - Nota: La branch `gh-pages` se creará automáticamente en el primer deploy desde `main`
   - Si ves un error inicial, espera a que el workflow cree la branch
3. **Custom domain** (opcional): Configura tu dominio personalizado si lo tienes

### Solución de Problemas Comunes

Si ves el error "Not Found" en el workflow:
1. Ve a **Settings → Pages**
2. Asegúrate de que la opción esté habilitada
3. Selecciona **Source: Deploy from a branch**
4. Deja la configuración de branch vacía hasta que el workflow cree `gh-pages`
5. Una vez creada, selecciona `gh-pages` / `/ (root)`

## Notas Importantes

- Estas reglas deben configurarse manualmente en GitHub
- No se pueden automatizar completamente vía archivos de configuración
- Se recomienda tener al menos 2 colaboradores para las aprobaciones de PR
- Los administradores del repositorio pueden configurar excepciones
