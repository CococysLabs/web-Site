# 🔒 Política de Seguridad - COCOCYS

## Configuración de Variables de Entorno

### ⚠️ NUNCA commitear archivos con credenciales reales

Los archivos `.env` contienen información sensible y **NUNCA** deben ser incluidos en Git.

### Archivo `.env.example`

Este archivo es una plantilla y debe contener solo **valores placeholder**:

```bash
# ❌ INCORRECTO
DATABASE_URL=postgresql://real_user:real_password@host/db

# ✅ CORRECTO
DATABASE_URL=postgresql://user:password@host:5432/dbname
```

### Configuración Local

1. **Copiar el archivo de ejemplo:**
   ```bash
   cp backend/.env.example backend/.env
   ```

2. **Editar con credenciales reales:**
   ```bash
   nano backend/.env
   ```

3. **Verificar que .env está en .gitignore:**
   ```bash
   git check-ignore backend/.env
   # Debe retornar: backend/.env
   ```

## Credenciales Sensibles

### Base de Datos (Neon PostgreSQL)
- Obtener desde: https://console.neon.tech
- Formato: `postgresql://user:password@host/database?sslmode=require`
- **Rotar cada 90 días**

### JWT Secret Key
- Generar con:
  ```bash
  openssl rand -hex 32
  ```
- Mínimo 32 caracteres
- **Nunca reutilizar entre ambientes**

### Google Gemini API Key
- Obtener desde: https://makersuite.google.com/app/apikey
- **No compartir ni exponer**

## Verificación antes de Commit

```bash
# Verificar que no hay credenciales expuestas
git diff backend/.env.example

# Verificar archivos staged
git status

# Verificar contenido antes de push
git log -1 -p
```

## Rotación de Credenciales

Si las credenciales fueron expuestas:

1. ✅ Cambiar contraseña en Neon Console inmediatamente
2. ✅ Generar nuevo SECRET_KEY
3. ✅ Actualizar archivo `.env` local
4. ✅ Limpiar `.env.example` con placeholders
5. ✅ Commit y push cambios
6. ⚠️ Considerar limpiar historial de Git

## Reportar Vulnerabilidades

Si encuentras una vulnerabilidad de seguridad:

1. **NO** crear un issue público
2. Contactar a: [tu-email@ejemplo.com]
3. Incluir detalles del problema
4. Esperar respuesta antes de divulgar

## Recursos

- [Neon Security Docs](https://neon.tech/docs/security/security-overview)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [GitHub Secret Scanning](https://docs.github.com/en/code-security/secret-scanning)

---

**Última actualización:** 30 de enero de 2026  
**Incidente anterior:** Credenciales expuestas en `.env.example` - Resuelto ✅
