# 🐳 Docker Professional Setup - COCOCYS

Sistema completamente dockerizado con las mejores prácticas de la industria.

## 📁 Estructura de Archivos Docker

```
web-Site/
├── backend/
│   ├── Dockerfile              # Multi-stage, no-root, optimizado
│   └── .dockerignore           # Exclusiones backend
├── frontend/
│   ├── Dockerfile              # Multi-stage build + Nginx
│   ├── nginx.conf              # Config avanzado con seguridad
│   └── .dockerignore           # Exclusiones frontend
├── docker-compose.yml          # Desarrollo
├── docker-compose.prod.yml     # Producción
├── Makefile                    # Automatización de comandos
├── deploy.sh                   # Script de despliegue
├── .env.docker                 # Variables Docker
├── .dockerignore               # Exclusiones root
└── DOCKER.md                   # Documentación completa
```

## 🚀 Quick Start

```bash
# Ver comandos disponibles
make help

# Inicio rápido (build + up + logs)
make quick-start

# O manualmente
make build
make up
```

Acceso:
- **Frontend**: http://localhost
- **Backend**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

## 🎯 Características Profesionales

### ✨ Backend
- ✅ **Multi-stage build**: Separación de builder y runtime
- ✅ **Usuario no-root**: Seguridad mejorada
- ✅ **Virtualenv optimizado**: Cacheo eficiente de dependencias
- ✅ **Health checks**: Liveness + Readiness + Metrics
- ✅ **Resource limits**: CPU y memoria controlados
- ✅ **Logging configurado**: Rotación automática

### ✨ Frontend
- ✅ **Multi-stage build**: Node build + Nginx serve
- ✅ **Usuario no-root en Nginx**: Seguridad
- ✅ **Compresión gzip**: Optimización de transferencia
- ✅ **Cache de assets**: 1 año para estáticos
- ✅ **Rate limiting**: Protección contra abuso
- ✅ **Security headers**: CSP, XSS, Frame Options
- ✅ **Proxy pass**: API routing automático

### ✨ Orchestration
- ✅ **Profiles dev/prod**: Configuraciones separadas
- ✅ **Health checks**: Monitoreo automático
- ✅ **Depends on**: Orden de inicio correcto
- ✅ **Resource limits**: Control de recursos
- ✅ **Logging**: JSON con rotación
- ✅ **Networks**: Aislamiento de servicios
- ✅ **Volumes**: Persistencia de datos

## 🛠️ Comandos Makefile

```bash
# Gestión de servicios
make build          # Construir imágenes
make up             # Levantar (desarrollo)
make up-prod        # Levantar (producción)
make down           # Detener servicios
make restart        # Reiniciar todo
make ps             # Ver estado

# Logs
make logs           # Todos los logs
make logs-backend   # Solo backend
make logs-frontend  # Solo frontend

# Shell access
make shell-backend  # Bash en backend
make shell-frontend # Sh en frontend

# Utilidades
make health         # Verificar salud
make test           # Ejecutar tests
make clean          # Limpiar recursos
make monitor        # Stats en tiempo real

# Mantenimiento
make backup-logs    # Backup de logs
make update         # Git pull + rebuild
make deploy         # Deploy producción
```

## 📊 Monitoring y Health Checks

### Endpoints Disponibles

```bash
# Liveness (¿está vivo?)
curl http://localhost:8000/health

# Readiness (¿está listo para recibir tráfico?)
curl http://localhost:8000/ready

# Metrics (métricas de sistema)
curl http://localhost:8000/metrics
```

### Response Examples

**Health:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "service": "cococys-backend"
}
```

**Ready:**
```json
{
  "status": "ready",
  "database": "connected",
  "version": "1.0.0"
}
```

**Metrics:**
```json
{
  "cpu_percent": 15.2,
  "memory_percent": 45.8,
  "disk_percent": 62.1,
  "process_memory_mb": 156.3,
  "uptime_seconds": 86400
}
```

## 🔒 Seguridad

### Implementado:
- ✅ Usuario no-root en todos los contenedores
- ✅ Security headers (CSP, X-Frame-Options, etc.)
- ✅ Rate limiting en API y login
- ✅ Secrets como volúmenes read-only
- ✅ Resource limits para prevenir DoS
- ✅ Logs con rotación automática
- ✅ Health checks para auto-healing

### Best Practices:
- 🔐 Nunca incluir credenciales en imágenes
- 🔐 Usar `.env` y `.dockerignore` correctamente
- 🔐 Montar secrets como volúmenes read-only
- 🔐 Actualizar imágenes base regularmente
- 🔐 Escanear imágenes con `docker scan`

## 🏭 Producción

### Deploy Script

```bash
# Deploy automático
./deploy.sh

# O con Makefile
make deploy
```

### Diferencias Dev vs Prod

| Feature | Development | Production |
|---------|------------|------------|
| Hot reload | ✅ Enabled | ❌ Disabled |
| Workers | 1 | 4 |
| Log level | INFO | WARNING |
| Resource limits | Bajos | Altos |
| Restart policy | unless-stopped | always |
| Volumes | Code mounted | Solo datos |

### Variables de Entorno

**Development:**
```bash
ENVIRONMENT=development
LOG_LEVEL=info
```

**Production:**
```bash
ENVIRONMENT=production
LOG_LEVEL=warning
VERSION=v1.0.0
```

## 📈 Resource Limits

### Backend
```yaml
Limits:
  CPU: 1.0 (dev) / 2.0 (prod)
  Memory: 1G (dev) / 2G (prod)
Reservations:
  CPU: 0.5 (dev) / 1.0 (prod)
  Memory: 512M (dev) / 1G (prod)
```

### Frontend
```yaml
Limits:
  CPU: 0.5 (dev) / 1.0 (prod)
  Memory: 512M (dev) / 1G (prod)
Reservations:
  CPU: 0.25 (dev) / 0.5 (prod)
  Memory: 256M (dev) / 512M (prod)
```

## 🔧 Troubleshooting

### Build failed
```bash
# Rebuild sin cache
make build

# Ver logs de build
docker-compose build --progress=plain
```

### Servicios no inician
```bash
# Verificar logs
make logs

# Verificar health
make health

# Verificar configuración
make env-check
```

### Performance issues
```bash
# Monitorear recursos
make monitor

# Ver métricas
curl http://localhost:8000/metrics
```

## 📝 Logging

### Configuración
- **Driver**: json-file
- **Max size**: 10MB (backend) / 5MB (frontend)
- **Max files**: 3 (dev) / 10 (prod)
- **Compress**: Enabled (prod)

### Ver logs
```bash
# Tiempo real
docker-compose logs -f

# Últimas 100 líneas
docker-compose logs --tail=100

# Por servicio
docker-compose logs -f backend
```

## 🧪 Testing

```bash
# Ejecutar tests
make test

# En contenedor específico
docker-compose exec backend pytest -v

# Con coverage
docker-compose exec backend pytest --cov=app
```

## 📦 Volúmenes

```bash
# Listar volúmenes
docker volume ls | grep cococys

# Inspeccionar volumen
docker volume inspect cococys-backend-logs

# Backup de volumen
make backup-logs
```

## 🌐 Networking

### Red personalizada
- **Name**: cococys-network
- **Driver**: bridge
- **Subnet**: 172.25.0.0/16 (dev) / 172.26.0.0/16 (prod)

### DNS interno
Los servicios se comunican por nombre:
```
frontend → http://backend:8000
```

## 🚢 CI/CD Ready

### GitHub Actions Example
```yaml
- name: Build and Push
  run: |
    docker-compose -f docker-compose.prod.yml build
    docker tag cococys/backend:latest registry/cococys/backend:${{ github.sha }}
    docker push registry/cococys/backend:${{ github.sha }}
```

## 📚 Referencias

- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [FastAPI Deployment](https://fastapi.tiangolo.com/deployment/docker/)
- [Nginx Security](https://nginx.org/en/docs/http/ngx_http_headers_module.html)
- [OWASP Security Headers](https://owasp.org/www-project-secure-headers/)

---

**Mantenido por**: COCOCYS Team  
**Última actualización**: Febrero 2026  
**Versión Docker**: 1.0.0
