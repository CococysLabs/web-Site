CREATE TABLE
    IF NOT EXISTS course_catalog (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
        area VARCHAR(100) NOT NULL,
        code VARCHAR(20) NOT NULL,
        name VARCHAR(300) NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW (),
        updated_at TIMESTAMPTZ DEFAULT NOW (),
        CONSTRAINT uq_course_catalog_area_code UNIQUE (area, code)
    );

CREATE INDEX IF NOT EXISTS idx_course_catalog_area ON course_catalog (area);

CREATE INDEX IF NOT EXISTS idx_course_catalog_code ON course_catalog (code);