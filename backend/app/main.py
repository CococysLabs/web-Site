"""
Punto de entrada principal de la aplicación FastAPI
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import init_db
from app.routes import auth, drive, documents, analysis, validation

app = FastAPI(
    title="COCOCYS API",
    description="API para análisis de documentos con IA",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configurar CORS
allow_origins = [
    settings.FRONTEND_URL,
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost",
    "http://localhost:80",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    """Inicializar base de datos al iniciar"""
    init_db()


@app.get("/")
async def root():
    """Endpoint raíz para verificar que la API está funcionando"""
    return {
        "message": "COCOCYS API v1.0.0",
        "status": "online",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    """Endpoint de salud para monitoreo (liveness probe)"""
    return {
        "status": "healthy",
        "version": "1.0.0",
        "service": "cococys-backend"
    }


@app.get("/ready")
async def readiness_check():
    """Endpoint de readiness para verificar que el servicio está listo"""
    from app.database import engine
    try:
        # Verificar conexión a la base de datos
        with engine.connect() as conn:
            conn.execute("SELECT 1")
        return {
            "status": "ready",
            "database": "connected",
            "version": "1.0.0"
        }
    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail=f"Service not ready: {str(e)}")


@app.get("/metrics")
async def metrics():
    """Endpoint de métricas básicas para monitoreo"""
    import psutil
    import os
    
    return {
        "cpu_percent": psutil.cpu_percent(interval=1),
        "memory_percent": psutil.virtual_memory().percent,
        "disk_percent": psutil.disk_usage('/').percent,
        "process_memory_mb": psutil.Process(os.getpid()).memory_info().rss / 1024 / 1024,
        "uptime_seconds": int(psutil.time.time() - psutil.boot_time()),
    }


# Incluir routers
app.include_router(auth.router, prefix="/api/auth", tags=["Autenticación"])
app.include_router(drive.router, tags=["Google Drive"])
app.include_router(documents.router, tags=["Documentos"])
app.include_router(analysis.router, tags=["Análisis"])
app.include_router(validation.router, tags=["Validación"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True
    )
