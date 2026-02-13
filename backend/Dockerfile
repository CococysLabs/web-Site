# ==================================
# Multi-stage Dockerfile para COCOCYS Backend
# Python 3.9 + FastAPI
# ==================================

# ============ Stage 1: Builder ============
FROM python:3.9-slim AS builder

# Variables de entorno para optimizar Python
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_DEFAULT_TIMEOUT=100

WORKDIR /app

# Instalar dependencias del sistema para compilación
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copiar solo requirements primero (mejor cacheo de Docker layers)
COPY requirements.txt .

# Instalar dependencias en virtualenv
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --upgrade pip setuptools wheel && \
    pip install -r requirements.txt

# ============ Stage 2: Runtime ============
FROM python:3.9-slim AS runtime

# Metadata
LABEL maintainer="cococys@team.com" \
      version="1.0.0" \
      description="COCOCYS Backend API - Document Analysis System"

# Variables de entorno
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH" \
    PYTHONPATH=/app

WORKDIR /app

# Instalar solo dependencias runtime (no build tools)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Crear usuario no-root para seguridad
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Copiar virtualenv desde builder
COPY --from=builder /opt/venv /opt/venv

# Copiar código de aplicación
COPY --chown=appuser:appuser . .

# Crear directorios necesarios con permisos
RUN mkdir -p /app/logs /app/tmp && \
    chown -R appuser:appuser /app

# Cambiar a usuario no-root
USER appuser

# Exponer puerto
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Comando por defecto (puede sobrescribirse en docker-compose)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
