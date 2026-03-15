# ==================================
# Multi-stage Dockerfile para COCOCYS Frontend
# React + Vite + Nginx
# ==================================

# ============ Stage 1: Dependencies ============
FROM node:20-alpine AS deps

# Metadata
LABEL maintainer="cococys@team.com" \
      version="1.0.0" \
      description="COCOCYS Frontend - Document Analysis Dashboard"

WORKDIR /app

# Copiar solo archivos de dependencias primero
COPY package.json package-lock.json* ./

# Instalar dependencias con optimizaciones
RUN npm ci --silent --prefer-offline --no-audit

# ============ Stage 2: Builder ============
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar dependencias desde deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copiar código fuente
COPY . .

# Variables de build (pueden sobrescribirse)
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

# Build optimizado de producción
RUN npm run build && \
    # Verificar que el build existe
    ls -la dist/

# ============ Stage 3: Production Server ============
FROM nginx:alpine AS production

# Instalar curl para health checks
RUN apk add --no-cache curl

# Copiar configuración custom de Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiar archivos estáticos desde builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Crear usuario no-root
RUN addgroup -g 1001 -S appuser && \
    adduser -S -D -H -u 1001 -h /usr/share/nginx/html -s /sbin/nologin -G appuser -g appuser appuser

# Ajustar permisos para Nginx
RUN chown -R appuser:appuser /usr/share/nginx/html && \
    chown -R appuser:appuser /var/cache/nginx && \
    chown -R appuser:appuser /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown -R appuser:appuser /var/run/nginx.pid

# Exponer puerto 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/ || exit 1

# Usuario no-root
USER appuser

# Ejecutar Nginx en foreground
CMD ["nginx", "-g", "daemon off;"]
