# ==================================
# Makefile - COCOCYS Docker Management
# Automation for common Docker operations
# ==================================

.PHONY: help build up down restart logs clean test deploy backup monitor

# Variables
COMPOSE_DEV = docker-compose.yml
COMPOSE_PROD = docker-compose.prod.yml
PROJECT_NAME = cococys
BACKUP_DIR = ./backups

# Colors for output
BLUE = \033[0;34m
GREEN = \033[0;32m
YELLOW = \033[1;33m
RED = \033[0;31m
NC = \033[0m # No Color

## help: Mostrar este mensaje de ayuda
help:
	@echo "$(BLUE)═══════════════════════════════════════════$(NC)"
	@echo "$(GREEN)  COCOCYS Docker Management Commands$(NC)"
	@echo "$(BLUE)═══════════════════════════════════════════$(NC)"
	@grep -E '^## ' $(MAKEFILE_LIST) | sed 's/## /  $(GREEN)/' | sed 's/:/ $(NC)-/'
	@echo ""

## build: Construir todas las imágenes
build:
	@echo "$(BLUE)🔨 Construyendo imágenes...$(NC)"
	docker-compose -f $(COMPOSE_DEV) build --no-cache

## up: Levantar servicios en modo desarrollo
up:
	@echo "$(GREEN)🚀 Levantando servicios (desarrollo)...$(NC)"
	docker-compose -f $(COMPOSE_DEV) up -d
	@echo "$(GREEN)✅ Servicios iniciados$(NC)"
	@echo "  Frontend: http://localhost"
	@echo "  Backend:  http://localhost:8000"
	@echo "  Docs:     http://localhost:8000/docs"

## up-prod: Levantar servicios en modo producción
up-prod:
	@echo "$(GREEN)🚀 Levantando servicios (producción)...$(NC)"
	docker-compose -f $(COMPOSE_PROD) up -d
	@echo "$(GREEN)✅ Servicios iniciados en modo producción$(NC)"

## down: Detener todos los servicios
down:
	@echo "$(YELLOW)⏹️  Deteniendo servicios...$(NC)"
	docker-compose -f $(COMPOSE_DEV) down

## down-prod: Detener servicios de producción
down-prod:
	@echo "$(YELLOW)⏹️  Deteniendo servicios de producción...$(NC)"
	docker-compose -f $(COMPOSE_PROD) down

## restart: Reiniciar todos los servicios
restart: down up
	@echo "$(GREEN)♻️  Servicios reiniciados$(NC)"

## logs: Ver logs de todos los servicios
logs:
	docker-compose -f $(COMPOSE_DEV) logs -f

## logs-backend: Ver logs solo del backend
logs-backend:
	docker-compose -f $(COMPOSE_DEV) logs -f backend

## logs-frontend: Ver logs solo del frontend
logs-frontend:
	docker-compose -f $(COMPOSE_DEV) logs -f frontend

## ps: Ver estado de los contenedores
ps:
	@echo "$(BLUE)📊 Estado de los servicios:$(NC)"
	docker-compose -f $(COMPOSE_DEV) ps

## shell-backend: Entrar al contenedor del backend
shell-backend:
	@echo "$(BLUE)🐚 Accediendo al backend...$(NC)"
	docker-compose -f $(COMPOSE_DEV) exec backend bash

## shell-frontend: Entrar al contenedor del frontend
shell-frontend:
	@echo "$(BLUE)🐚 Accediendo al frontend...$(NC)"
	docker-compose -f $(COMPOSE_DEV) exec frontend sh

## test: Ejecutar tests del backend
test:
	@echo "$(BLUE)🧪 Ejecutando tests...$(NC)"
	docker-compose -f $(COMPOSE_DEV) exec backend pytest -v

## health: Verificar salud de los servicios
health:
	@echo "$(BLUE)🏥 Verificando salud de servicios...$(NC)"
	@echo -n "Backend:  "
	@curl -sf http://localhost:8000/health > /dev/null && echo "$(GREEN)✅ OK$(NC)" || echo "$(RED)❌ FAIL$(NC)"
	@echo -n "Frontend: "
	@curl -sf http://localhost/ > /dev/null && echo "$(GREEN)✅ OK$(NC)" || echo "$(RED)❌ FAIL$(NC)"

## clean: Limpiar contenedores, imágenes y volúmenes no utilizados
clean:
	@echo "$(YELLOW)🧹 Limpiando recursos Docker...$(NC)"
	docker-compose -f $(COMPOSE_DEV) down -v
	docker system prune -f
	@echo "$(GREEN)✅ Limpieza completa$(NC)"

## clean-all: Limpieza profunda (CUIDADO: elimina TODO)
clean-all:
	@echo "$(RED)⚠️  ADVERTENCIA: Esto eliminará TODAS las imágenes, contenedores y volúmenes$(NC)"
	@read -p "¿Estás seguro? [y/N] " -n 1 -r; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		echo ""; \
		docker-compose -f $(COMPOSE_DEV) down -v --rmi all; \
		docker system prune -a --volumes -f; \
		echo "$(GREEN)✅ Limpieza profunda completa$(NC)"; \
	else \
		echo ""; \
		echo "$(YELLOW)Operación cancelada$(NC)"; \
	fi

## backup-logs: Hacer backup de los logs
backup-logs:
	@echo "$(BLUE)💾 Creando backup de logs...$(NC)"
	@mkdir -p $(BACKUP_DIR)/logs
	docker-compose -f $(COMPOSE_DEV) exec backend tar czf /tmp/logs-backup.tar.gz /app/logs
	docker cp $$(docker-compose -f $(COMPOSE_DEV) ps -q backend):/tmp/logs-backup.tar.gz $(BACKUP_DIR)/logs/logs-$$(date +%Y%m%d-%H%M%S).tar.gz
	@echo "$(GREEN)✅ Backup creado en $(BACKUP_DIR)/logs/$(NC)"

## deploy: Deploy completo (build + up en producción)
deploy:
	@echo "$(BLUE)🚀 Iniciando deploy de producción...$(NC)"
	git pull origin main
	docker-compose -f $(COMPOSE_PROD) build --no-cache
	docker-compose -f $(COMPOSE_PROD) up -d
	@echo "$(GREEN)✅ Deploy completado$(NC)"
	@make health

## monitor: Monitoreo en tiempo real de recursos
monitor:
	@echo "$(BLUE)📊 Monitoreando recursos (Ctrl+C para salir)...$(NC)"
	docker stats $$(docker-compose -f $(COMPOSE_DEV) ps -q)

## init-admin: Crear usuario admin inicial
init-admin:
	@echo "$(BLUE)👤 Creando usuario administrador...$(NC)"
	docker-compose -f $(COMPOSE_DEV) exec backend python init_admin.py
	@echo "$(GREEN)✅ Usuario admin creado$(NC)"

## db-migrate: Ejecutar migraciones de base de datos
db-migrate:
	@echo "$(BLUE)🗄️  Ejecutando migraciones...$(NC)"
	docker-compose -f $(COMPOSE_DEV) exec backend alembic upgrade head
	@echo "$(GREEN)✅ Migraciones aplicadas$(NC)"

## update: Actualizar todo (git pull + rebuild + restart)
update:
	@echo "$(BLUE)⬆️  Actualizando sistema...$(NC)"
	git pull origin develop
	docker-compose -f $(COMPOSE_DEV) build
	docker-compose -f $(COMPOSE_DEV) up -d
	@echo "$(GREEN)✅ Sistema actualizado$(NC)"

## version: Mostrar versiones de las imágenes
version:
	@echo "$(BLUE)📦 Versiones de imágenes:$(NC)"
	@docker images | grep cococys

## env-check: Verificar variables de entorno
env-check:
	@echo "$(BLUE)🔍 Verificando configuración...$(NC)"
	@test -f backend/.env && echo "  $(GREEN)✅$(NC) backend/.env existe" || echo "  $(RED)❌$(NC) backend/.env no encontrado"
	@test -f backend/cococys-driv-105652f59c31.json && echo "  $(GREEN)✅$(NC) Credenciales de Google Drive existen" || echo "  $(RED)❌$(NC) Credenciales de Google Drive no encontradas"
	@echo ""
	@echo "$(BLUE)Variables críticas:$(NC)"
	@grep -q "DATABASE_URL" backend/.env && echo "  $(GREEN)✅$(NC) DATABASE_URL configurada" || echo "  $(RED)❌$(NC) DATABASE_URL faltante"
	@grep -q "SECRET_KEY" backend/.env && echo "  $(GREEN)✅$(NC) SECRET_KEY configurada" || echo "  $(RED)❌$(NC) SECRET_KEY faltante"
	@grep -q "GOOGLE_DRIVE_FOLDER_ID" backend/.env && echo "  $(GREEN)✅$(NC) GOOGLE_DRIVE_FOLDER_ID configurada" || echo "  $(RED)❌$(NC) GOOGLE_DRIVE_FOLDER_ID faltante"

## quick-start: Inicio rápido (build + up + logs)
quick-start: build up
	@echo "$(GREEN)🎉 Sistema iniciado!$(NC)"
	@sleep 5
	@make health
	@echo ""
	@echo "$(YELLOW)Siguiendo logs (Ctrl+C para salir)...$(NC)"
	@make logs

# Default target
.DEFAULT_GOAL := help
