-- Migración para agregar roles y sistema de aprobación
-- Fecha: 2026-02-05

-- 1. Agregar tipo enum para roles
CREATE TYPE user_role AS ENUM ('admin', 'student');

-- 2. Agregar nuevas columnas a la tabla users
ALTER TABLE users ADD COLUMN IF NOT EXISTS role user_role DEFAULT 'student' NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS approved_by UUID;
ALTER TABLE users ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;

-- 3. Crear índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_approved ON users(is_approved);
CREATE INDEX IF NOT EXISTS idx_users_approved_by ON users(approved_by);

-- 4. Agregar foreign key para approved_by
ALTER TABLE users ADD CONSTRAINT fk_users_approved_by 
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL;

-- 5. Comentarios para documentación
COMMENT ON COLUMN users.role IS 'Rol del usuario: admin o student';
COMMENT ON COLUMN users.is_approved IS 'Indica si el usuario ha sido aprobado por un administrador';
COMMENT ON COLUMN users.approved_by IS 'ID del administrador que aprobó al usuario';
COMMENT ON COLUMN users.approved_at IS 'Fecha y hora de aprobación del usuario';
