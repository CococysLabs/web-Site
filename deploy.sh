#!/bin/bash

# ==================================
# Script de Deploy - COCOCYS
# ==================================

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-production}
COMPOSE_FILE="docker-compose.prod.yml"
BACKUP_DIR="./backups"
LOG_FILE="./deploy-$(date +%Y%m%d-%H%M%S).log"

echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo -e "${GREEN}  COCOCYS Deploy Script${NC}"
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo -e "Environment: ${YELLOW}${ENVIRONMENT}${NC}"
echo -e "Log file: ${LOG_FILE}"
echo ""

# Function to log messages
log() {
    echo -e "$1" | tee -a "$LOG_FILE"
}

# Pre-deploy checks
log "${BLUE}[1/8] Pre-deploy checks...${NC}"

if [ ! -f "backend/.env" ]; then
    log "${RED}❌ Error: backend/.env not found${NC}"
    exit 1
fi

if [ ! -f "backend/cococys-driv-105652f59c31.json" ]; then
    log "${RED}❌ Error: Google Drive credentials not found${NC}"
    exit 1
fi

log "${GREEN}✅ Pre-deploy checks passed${NC}"

# Backup current state
log "${BLUE}[2/8] Creating backup...${NC}"
mkdir -p "$BACKUP_DIR"

if docker ps | grep -q cococys; then
    docker-compose -f "$COMPOSE_FILE" exec -T backend tar czf /tmp/backup.tar.gz /app/logs 2>/dev/null || true
    docker cp $(docker-compose -f "$COMPOSE_FILE" ps -q backend):/tmp/backup.tar.gz "$BACKUP_DIR/backup-$(date +%Y%m%d-%H%M%S).tar.gz" 2>/dev/null || true
    log "${GREEN}✅ Backup created${NC}"
else
    log "${YELLOW}⚠️  No running containers to backup${NC}"
fi

# Pull latest code
log "${BLUE}[3/8] Pulling latest code...${NC}"
git fetch origin
git pull origin main
log "${GREEN}✅ Code updated${NC}"

# Build images
log "${BLUE}[4/8] Building Docker images...${NC}"
docker-compose -f "$COMPOSE_FILE" build --no-cache
log "${GREEN}✅ Images built${NC}"

# Stop old containers
log "${BLUE}[5/8] Stopping old containers...${NC}"
docker-compose -f "$COMPOSE_FILE" down
log "${GREEN}✅ Old containers stopped${NC}"

# Start new containers
log "${BLUE}[6/8] Starting new containers...${NC}"
docker-compose -f "$COMPOSE_FILE" up -d
log "${GREEN}✅ New containers started${NC}"

# Wait for services
log "${BLUE}[7/8] Waiting for services...${NC}"
sleep 10

# Health check
log "${BLUE}[8/8] Health check...${NC}"

BACKEND_HEALTHY=false
FRONTEND_HEALTHY=false

for i in {1..30}; do
    if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
        BACKEND_HEALTHY=true
        break
    fi
    echo -n "."
    sleep 2
done
echo ""

if $BACKEND_HEALTHY; then
    log "${GREEN}✅ Backend is healthy${NC}"
else
    log "${RED}❌ Backend health check failed${NC}"
    log "${YELLOW}Showing backend logs:${NC}"
    docker-compose -f "$COMPOSE_FILE" logs backend | tail -n 50
    exit 1
fi

if curl -sf http://localhost/ > /dev/null 2>&1; then
    FRONTEND_HEALTHY=true
    log "${GREEN}✅ Frontend is healthy${NC}"
else
    log "${YELLOW}⚠️  Frontend health check warning${NC}"
fi

# Summary
echo ""
log "${BLUE}═══════════════════════════════════════════${NC}"
log "${GREEN}  Deploy Completed Successfully!${NC}"
log "${BLUE}═══════════════════════════════════════════${NC}"
log "Frontend: ${GREEN}http://localhost${NC}"
log "Backend:  ${GREEN}http://localhost:8000${NC}"
log "Docs:     ${GREEN}http://localhost:8000/docs${NC}"
log ""
log "To view logs: ${YELLOW}docker-compose -f $COMPOSE_FILE logs -f${NC}"
log "To stop:      ${YELLOW}docker-compose -f $COMPOSE_FILE down${NC}"
echo ""

exit 0
