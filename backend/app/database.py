"""
Configuración de la base de datos con SQLAlchemy
"""
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import settings

# Crear engine de SQLAlchemy con psycopg2
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,  # Verifica conexiones antes de usarlas
    pool_size=5,         # Número de conexiones en el pool
    max_overflow=10      # Máximo de conexiones adicionales
)

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base para los modelos
Base = declarative_base()


def get_db():
    """
    Dependency para obtener sesión de base de datos
    Uso: db: Session = Depends(get_db)
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """
    Inicializar base de datos (crear tablas si no existen)
    """
    Base.metadata.create_all(bind=engine)
    _run_migrations()


def _run_migrations():
    """Aplica columnas nuevas que no existen aún (idempotente)."""
    migrations = [
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS personal_api_keys JSONB",
        """CREATE TABLE IF NOT EXISTS validation_jobs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL,
            job_type VARCHAR(20) NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'pending',
            progress TEXT,
            result_json JSONB,
            error TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            completed_at TIMESTAMPTZ
        )""",
        "CREATE INDEX IF NOT EXISTS idx_validation_jobs_user_id ON validation_jobs(user_id)",
        "CREATE INDEX IF NOT EXISTS idx_validation_jobs_created_at ON validation_jobs(created_at)",
        """CREATE TABLE IF NOT EXISTS audit_logs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID,
            user_email VARCHAR(255),
            action VARCHAR(100) NOT NULL,
            target_type VARCHAR(50),
            target_id VARCHAR(255),
            details JSONB,
            ip_address INET,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )""",
        "CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id)",
        "CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action)",
        "CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at)",
    ]
    with engine.connect() as conn:
        for sql in migrations:
            try:
                conn.execute(__import__('sqlalchemy').text(sql))
                conn.commit()
            except Exception as e:
                conn.rollback()
                print(f"  ⚠️  Migration skipped ({sql[:40]}…): {e}")
