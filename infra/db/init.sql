-- ============================================================
-- MedGuard — PostgreSQL Schema v1
-- Matches docs/schema.md exactly
-- Run once on fresh database via docker-compose init
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────────────────────
-- ENUM types
-- ─────────────────────────────────────────────────────────────
CREATE TYPE user_role          AS ENUM ('patient', 'caregiver', 'admin');
CREATE TYPE permission_level   AS ENUM ('full_view', 'alerts_only');
CREATE TYPE link_status        AS ENUM ('pending', 'active', 'revoked');
CREATE TYPE resolution_status  AS ENUM ('resolved', 'generic_unresolved', 'manually_resolved');
CREATE TYPE medicine_status    AS ENUM ('active', 'discontinued');
CREATE TYPE interaction_severity AS ENUM ('avoid_combination', 'monitor_closely', 'minor', 'no_action');
CREATE TYPE flag_status        AS ENUM ('pending_review', 'shown', 'acknowledged_by_patient', 'acknowledged_by_caregiver');

-- ─────────────────────────────────────────────────────────────
-- 1. users
-- ─────────────────────────────────────────────────────────────
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name          VARCHAR(255)   NOT NULL,
    email         VARCHAR(255)   NOT NULL UNIQUE,
    password_hash VARCHAR(255)   NOT NULL,
    role          user_role      NOT NULL DEFAULT 'patient',
    created_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role  ON users(role);

-- ─────────────────────────────────────────────────────────────
-- 2. caregiver_links
-- ─────────────────────────────────────────────────────────────
CREATE TABLE caregiver_links (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id       UUID             NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    caregiver_id     UUID             NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission_level permission_level NOT NULL DEFAULT 'alerts_only',
    status           link_status      NOT NULL DEFAULT 'pending',
    created_at       TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_caregiver_link UNIQUE (patient_id, caregiver_id)
);
CREATE INDEX idx_caregiver_links_patient   ON caregiver_links(patient_id);
CREATE INDEX idx_caregiver_links_caregiver ON caregiver_links(caregiver_id);

-- ─────────────────────────────────────────────────────────────
-- 3. brand_generic_map  (append-only, versioned)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE brand_generic_map (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_name     VARCHAR(255)   NOT NULL,
    generic_name   VARCHAR(255)   NOT NULL,
    composition    TEXT,
    source         VARCHAR(100)   NOT NULL DEFAULT 'kaggle_seed',
    version        VARCHAR(20)    NOT NULL DEFAULT 'v1',
    effective_date TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_brand_version UNIQUE (brand_name, version)
);
CREATE INDEX idx_brand_generic_brand ON brand_generic_map(brand_name);
CREATE INDEX idx_brand_generic_date  ON brand_generic_map(effective_date DESC);

-- Append-only guard: prevent UPDATE and DELETE
CREATE OR REPLACE FUNCTION prevent_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'This table is append-only. UPDATE and DELETE are not allowed.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_brand_generic_no_update
    BEFORE UPDATE ON brand_generic_map FOR EACH ROW
    EXECUTE FUNCTION prevent_mutation();

CREATE TRIGGER trg_brand_generic_no_delete
    BEFORE DELETE ON brand_generic_map FOR EACH ROW
    EXECUTE FUNCTION prevent_mutation();

-- ─────────────────────────────────────────────────────────────
-- 4. medicines
-- ─────────────────────────────────────────────────────────────
CREATE TABLE medicines (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id        UUID              NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    brand_name        VARCHAR(255)      NOT NULL,
    generic_name      VARCHAR(255),
    dosage            VARCHAR(100)      NOT NULL,
    frequency         VARCHAR(255)      NOT NULL,
    source_photo_id   VARCHAR(255),
    resolution_status resolution_status NOT NULL DEFAULT 'generic_unresolved',
    added_at          TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    status            medicine_status   NOT NULL DEFAULT 'active'
);
CREATE INDEX idx_medicines_patient ON medicines(patient_id);
CREATE INDEX idx_medicines_status  ON medicines(patient_id, status);
CREATE INDEX idx_medicines_generic ON medicines(generic_name);

-- ─────────────────────────────────────────────────────────────
-- 5. interaction_kb  (append-only, versioned)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE interaction_kb (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    generic_a      VARCHAR(255)         NOT NULL,
    generic_b      VARCHAR(255)         NOT NULL,
    severity       interaction_severity NOT NULL,
    explanation    TEXT                 NOT NULL,
    source         VARCHAR(100)         NOT NULL DEFAULT 'DDInter',
    version        VARCHAR(20)          NOT NULL DEFAULT 'v1',
    effective_date TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_interaction_version UNIQUE (generic_a, generic_b, version)
);
CREATE INDEX idx_interaction_kb_generics ON interaction_kb(generic_a, generic_b);
CREATE INDEX idx_interaction_kb_date     ON interaction_kb(effective_date DESC);

-- Append-only guard
CREATE TRIGGER trg_interaction_kb_no_update
    BEFORE UPDATE ON interaction_kb FOR EACH ROW
    EXECUTE FUNCTION prevent_mutation();

CREATE TRIGGER trg_interaction_kb_no_delete
    BEFORE DELETE ON interaction_kb FOR EACH ROW
    EXECUTE FUNCTION prevent_mutation();

-- ─────────────────────────────────────────────────────────────
-- 6. interaction_flags
-- ─────────────────────────────────────────────────────────────
CREATE TABLE interaction_flags (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id          UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    new_medicine_id     UUID          NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
    existing_medicine_id UUID         NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
    kb_entry_id         UUID          NOT NULL REFERENCES interaction_kb(id),
    severity            VARCHAR(50)   NOT NULL,
    confidence          DECIMAL(5,4)  NOT NULL DEFAULT 1.0,
    status              flag_status   NOT NULL DEFAULT 'pending_review',
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_flags_patient ON interaction_flags(patient_id);
CREATE INDEX idx_flags_status  ON interaction_flags(status);

-- ─────────────────────────────────────────────────────────────
-- 7. lab_reports
-- ─────────────────────────────────────────────────────────────
CREATE TABLE lab_reports (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id      UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_photo_id VARCHAR(255),
    uploaded_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_lab_reports_patient ON lab_reports(patient_id);

-- ─────────────────────────────────────────────────────────────
-- 8. lab_values
-- ─────────────────────────────────────────────────────────────
CREATE TABLE lab_values (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id   UUID          NOT NULL REFERENCES lab_reports(id) ON DELETE CASCADE,
    test_type   VARCHAR(50)   NOT NULL,
    value       DECIMAL(10,4) NOT NULL,
    unit        VARCHAR(30)   NOT NULL,
    recorded_at TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_lab_values_report ON lab_values(report_id);
CREATE INDEX idx_lab_values_type   ON lab_values(test_type);

-- ─────────────────────────────────────────────────────────────
-- 9. visits
-- ─────────────────────────────────────────────────────────────
CREATE TABLE visits (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    doctor_name    VARCHAR(255),
    specialty      VARCHAR(100),
    scheduled_date TIMESTAMPTZ NOT NULL,
    brief_id       UUID,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_visits_patient ON visits(patient_id);
CREATE INDEX idx_visits_date    ON visits(scheduled_date);

-- ─────────────────────────────────────────────────────────────
-- 10. briefs
-- ─────────────────────────────────────────────────────────────
CREATE TABLE briefs (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    visit_id     UUID        NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
    content      JSONB       NOT NULL DEFAULT '{}',
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_briefs_patient ON briefs(patient_id);
CREATE INDEX idx_briefs_visit   ON briefs(visit_id);

-- Add FK from visits → briefs (deferred to avoid circular)
ALTER TABLE visits ADD CONSTRAINT fk_visits_brief
    FOREIGN KEY (brief_id) REFERENCES briefs(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────
-- 11. consent_records
-- ─────────────────────────────────────────────────────────────
CREATE TABLE consent_records (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id      UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    consent_type VARCHAR(100) NOT NULL,
    granted_at   TIMESTAMPTZ,
    revoked_at   TIMESTAMPTZ
);
CREATE INDEX idx_consent_user ON consent_records(user_id);
CREATE INDEX idx_consent_type ON consent_records(consent_type);

-- ─────────────────────────────────────────────────────────────
-- Schema version tracking
-- ─────────────────────────────────────────────────────────────
CREATE TABLE schema_migrations (
    version    VARCHAR(20) PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO schema_migrations (version) VALUES ('v1.0.0');
