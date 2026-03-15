#!/bin/bash

# 🔒 Script de actualización segura de credenciales
# COCOCYS Backend Setup

set -e

echo "🔒 COCOCYS - Configuración Segura de Credenciales"
echo "=================================================="
echo ""

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verificar que estamos en el directorio correcto
if [ ! -f "backend/.env.example" ]; then
    echo -e "${RED}❌ Error: Ejecuta este script desde la raíz del proyecto${NC}"
    exit 1
fi

# Crear .env desde .env.example si no existe
if [ ! -f "backend/.env" ]; then
    echo -e "${YELLOW}📝 Creando backend/.env desde .env.example...${NC}"
    cp backend/.env.example backend/.env
    echo -e "${GREEN}✅ Archivo backend/.env creado${NC}"
else
    echo -e "${YELLOW}⚠️  backend/.env ya existe${NC}"
    read -p "¿Deseas sobrescribirlo? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        cp backend/.env.example backend/.env
        echo -e "${GREEN}✅ Archivo backend/.env sobrescrito${NC}"
    fi
fi

echo ""
echo "📋 Ahora necesitas configurar las siguientes credenciales:"
echo ""

# DATABASE_URL
echo -e "${YELLOW}1. DATABASE_URL (PostgreSQL de Neon)${NC}"
echo "   Obtener desde: https://console.neon.tech"
echo "   Formato: postgresql://user:password@host/database?sslmode=require"
read -p "   Pega tu DATABASE_URL: " DATABASE_URL

# SECRET_KEY
echo ""
echo -e "${YELLOW}2. SECRET_KEY (para JWT)${NC}"
echo "   Generando una clave segura..."
SECRET_KEY=$(openssl rand -hex 32)
echo "   Generada: ${SECRET_KEY:0:20}... (32 bytes)"

# GEMINI_API_KEY
echo ""
echo -e "${YELLOW}3. GEMINI_API_KEY (Google AI)${NC}"
echo "   Obtener desde: https://makersuite.google.com/app/apikey"
read -p "   Pega tu GEMINI_API_KEY (o presiona Enter para omitir): " GEMINI_API_KEY

if [ -z "$GEMINI_API_KEY" ]; then
    GEMINI_API_KEY="tu-api-key-aqui"
fi

# Escribir al archivo .env
echo ""
echo -e "${YELLOW}📝 Escribiendo credenciales a backend/.env...${NC}"

cat > backend/.env << EOF
# Base de datos Neon PostgreSQL
DATABASE_URL=${DATABASE_URL}

# Seguridad JWT
SECRET_KEY=${SECRET_KEY}
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Google Gemini API
GEMINI_API_KEY=${GEMINI_API_KEY}

# Configuración del servidor
HOST=0.0.0.0
PORT=8000

# CORS - Frontend URL
FRONTEND_URL=http://localhost:5173
EOF

echo -e "${GREEN}✅ Credenciales guardadas en backend/.env${NC}"

# Verificar que .env está en .gitignore
echo ""
echo -e "${YELLOW}🔍 Verificando .gitignore...${NC}"

if git check-ignore backend/.env > /dev/null 2>&1; then
    echo -e "${GREEN}✅ backend/.env está protegido por .gitignore${NC}"
else
    echo -e "${RED}⚠️  backend/.env NO está en .gitignore!${NC}"
    echo "   Agregando manualmente..."
    echo "" >> .gitignore
    echo "# Environment variables" >> .gitignore
    echo "backend/.env" >> .gitignore
    echo -e "${GREEN}✅ Agregado a .gitignore${NC}"
fi

# Probar conexión a base de datos
echo ""
echo -e "${YELLOW}🔌 ¿Deseas probar la conexión a la base de datos?${NC}"
read -p "   (Requiere psql instalado) (y/N): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    if command -v psql &> /dev/null; then
        echo "   Probando conexión..."
        if psql "$DATABASE_URL" -c "SELECT version();" > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Conexión exitosa a PostgreSQL${NC}"
        else
            echo -e "${RED}❌ Error al conectar a la base de datos${NC}"
            echo "   Verifica que la URL sea correcta"
        fi
    else
        echo -e "${YELLOW}⚠️  psql no está instalado${NC}"
        echo "   Instalar en macOS: brew install postgresql"
    fi
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Configuración completada!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "📝 Próximos pasos:"
echo "   1. cd backend"
echo "   2. python -m venv venv"
echo "   3. source venv/bin/activate"
echo "   4. pip install -r requirements.txt"
echo "   5. python -m app.main"
echo ""
echo "📚 Documentación:"
echo "   - Backend: backend/SETUP.md"
echo "   - Seguridad: SECURITY.md"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANTE: NUNCA commitear el archivo backend/.env${NC}"
echo ""
