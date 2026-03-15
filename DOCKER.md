# 🐳 Docker Setup - COCOCYS

Este proyecto está completamente dockerizado para facilitar el desarrollo y despliegue.

## 📋 Prerequisitos

- Docker Engine 20.10+
- Docker Compose 2.0+

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────┐
│         Docker Compose                  │
├─────────────────────────────────────────┤
│  ┌──────────────┐   ┌───────────────┐  │
│  │   Frontend   │   │    Backend    │  │
│  │ React + Nginx│◄──┤    FastAPI    │  │
│  │   Port: 80   │   │   Port: 8000  │  │
│  └──────────────┘   └───────┬───────┘  │
│                              │          │
└──────────────────────────────┼──────────┘
                               │
                               ▼
                    ┌──────────────────┐
                    │  PostgreSQL DB   │
                    │   (Neon Cloud)   │
                    └──────────────────┘
```

## 🚀 Quick Start

### 1. Configurar Variables de Entorno

```bash
# Copiar el archivo de ejemplo
cp backend/.env.example backend/.env

# Editar con tus credenciales reales
nano backend/.env
```

### 2. Asegurar que tienes las credenciales de Google Drive

```bash
# Verificar que existe el archivo de credenciales
ls backend/cococys-driv-105652f59c31.json
```

### 3. Construir y Levantar los Contenedores

```bash
# Construir las imágenes y levantar los servicios
docker-compose up --build

# O en modo detached (background)
docker-compose up -d --build
```

### 4. Verificar que todo está funcionando

```bash
# Ver logs
docker-compose logs -f

# Ver estado de los contenedores
docker-compose ps

# Verificar health checks
docker-compose ps
```

## 🔧 Comandos Útiles

### Desarrollo

```bash
# Levantar servicios
docker-compose up

# Levantar en background
docker-compose up -d

# Ver logs en tiempo real
docker-compose logs -f

# Ver logs de un servicio específico
docker-compose logs -f backend
docker-compose logs -f frontend

# Reconstruir sin cache
docker-compose build --no-cache

# Reiniciar un servicio
docker-compose restart backend
```

### Mantenimiento

```bash
# Detener todos los servicios
docker-compose down

# Detener y eliminar volúmenes
docker-compose down -v

# Ver recursos utilizados
docker stats

# Limpiar imágenes no utilizadas
docker system prune -a
```

### Acceso a Contenedores

```bash
# Entrar al contenedor del backend
docker-compose exec backend bash

# Entrar al contenedor del frontend
docker-compose exec frontend sh

# Ejecutar comando en el backend
docker-compose exec backend python backend/init_admin.py
```

## 🌐 URLs de Acceso

- **Frontend**: http://localhost
- **Backend API**: http://localhost:8000
- **Backend Docs**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/health

## 📦 Volúmenes

- `backend-logs`: Logs del backend persistentes
- `./backend/cococys-driv-105652f59c31.json`: Credenciales de Google Drive (montado como volumen)

## 🔒 Seguridad

### Archivos que NO deben estar en el repositorio:

- ✅ `backend/.env` - Variables de entorno con secretos
- ✅ `backend/cococys-driv-105652f59c31.json` - Credenciales de Google
- ✅ `backend/__pycache__/` - Cache de Python
- ✅ `frontend/node_modules/` - Dependencias de Node
- ✅ `frontend/dist/` - Build de producción

### Archivos que SÍ deben estar:

- ✅ `backend/.env.example` - Plantilla de variables
- ✅ `backend/Dockerfile` - Configuración Docker backend
- ✅ `frontend/Dockerfile` - Configuración Docker frontend
- ✅ `docker-compose.yml` - Orquestación de servicios
- ✅ `backend/.dockerignore` - Exclusiones backend
- ✅ `frontend/.dockerignore` - Exclusiones frontend

## 🏭 Producción

### Cambios recomendados para producción:

1. **docker-compose.yml**:
   ```yaml
   # Comentar volumen de hot-reload
   # - ./backend/app:/app/app
   ```

2. **backend/Dockerfile**:
   ```dockerfile
   # Cambiar reload a producción
   CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
   ```

3. **Variables de entorno**:
   ```bash
   ENVIRONMENT=production
   ```

### Despliegue en servidor

```bash
# Clonar repositorio
git clone https://github.com/CococysLabs/web-Site.git
cd web-Site

# Configurar .env
cp backend/.env.example backend/.env
nano backend/.env

# Copiar credenciales de Google Drive
# (transferir de forma segura el archivo cococys-driv-*.json)

# Levantar en producción
docker-compose up -d --build

# Ver logs
docker-compose logs -f
```

## 🐛 Troubleshooting

### El backend no inicia

```bash
# Ver logs detallados
docker-compose logs backend

# Verificar variables de entorno
docker-compose exec backend env | grep DATABASE_URL

# Verificar conexión a la base de datos
docker-compose exec backend python -c "from app.database import engine; print(engine.url)"
```

### El frontend no carga

```bash
# Ver logs de Nginx
docker-compose logs frontend

# Verificar build
docker-compose exec frontend ls -la /usr/share/nginx/html

# Probar conexión al backend desde frontend
docker-compose exec frontend wget -O- http://backend:8000/health
```

### Error con credenciales de Google Drive

```bash
# Verificar que el archivo existe en el contenedor
docker-compose exec backend ls -la /app/cococys-driv-*.json

# Verificar permisos
docker-compose exec backend cat /app/cococys-driv-*.json | head -n 2
```

### Hot Reload no funciona en desarrollo

```bash
# Verificar volúmenes montados
docker-compose exec backend ls -la /app/app

# Si no funciona, reiniciar contenedor
docker-compose restart backend
```

## 📊 Monitoreo

### Health Checks

Los contenedores tienen health checks configurados:

```bash
# Ver estado de salud
docker-compose ps

# Backend health
curl http://localhost:8000/health

# Frontend health
curl http://localhost/
```

### Logs

```bash
# Logs de todos los servicios
docker-compose logs -f

# Últimas 100 líneas
docker-compose logs --tail=100

# Logs desde hace 1 hora
docker-compose logs --since 1h
```

## 🔄 Actualizaciones

```bash
# Actualizar código
git pull origin develop

# Reconstruir imágenes
docker-compose build --no-cache

# Reiniciar servicios
docker-compose down && docker-compose up -d
```

## 💡 Tips

- **Desarrollo**: Mantén los volúmenes de hot-reload activos
- **Producción**: Usa workers múltiples en uvicorn
- **Logs**: Configura rotación de logs para producción
- **Backups**: La BD en Neon ya tiene backups automáticos
- **Secrets**: Usa Docker secrets o servicios de gestión de secretos en producción

## 📞 Soporte

Si encuentras problemas:

1. Revisa los logs: `docker-compose logs -f`
2. Verifica health checks: `docker-compose ps`
3. Prueba conexión a DB: Verifica que DATABASE_URL es correcta
4. Revisa credenciales: Asegúrate que el archivo JSON existe

---

**Autor**: COCOCYS Team  
**Fecha**: Febrero 2026  
**Versión**: 1.0.0
