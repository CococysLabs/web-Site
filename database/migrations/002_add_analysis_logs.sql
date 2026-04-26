-- Migración 002: Historial unificado de análisis de IA
-- Registra: quién analizó, qué analizó y con qué proveedor/API key.

CREATE TABLE IF NOT EXISTS analysis_logs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
    user_name     VARCHAR(200),
    analyzed_what VARCHAR(500) NOT NULL,
    drive_file_id VARCHAR(200),
    analysis_type VARCHAR(30) NOT NULL,   -- document | structure | content | course
    provider      VARCHAR(30) NOT NULL DEFAULT 'basic',
    key_source    VARCHAR(20) NOT NULL DEFAULT 'none',
    status        VARCHAR(20) NOT NULL DEFAULT 'completed',
    score         FLOAT,
    course_name   VARCHAR(300),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analysis_logs_user_id   ON analysis_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_analysis_logs_created_at ON analysis_logs(created_at DESC);
