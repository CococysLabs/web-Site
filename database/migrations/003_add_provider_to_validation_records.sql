-- Migración 003: Proveedor e origen de key en registros de validación
ALTER TABLE validation_records
  ADD COLUMN IF NOT EXISTS provider   VARCHAR(30) DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS key_source VARCHAR(20) DEFAULT 'none';
