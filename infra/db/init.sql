-- ============================================================
-- MedGuard — PostgreSQL Schema v2
-- Matches implementation_plan.md exactly
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────────────────────
-- ENUM types
-- ─────────────────────────────────────────────────────────────
CREATE TYPE user_role          AS ENUM ('patient', 'caregiver');
CREATE TYPE link_status        AS ENUM ('active', 'revoked');
CREATE TYPE resolution_status  AS ENUM ('resolved', 'generic_unresolved', 'manually_resolved');
CREATE TYPE medicine_status    AS ENUM ('active', 'discontinued');
CREATE TYPE interaction_severity AS ENUM ('avoid_combination', 'monitor_closely', 'minor', 'no_action');
CREATE TYPE flag_status        AS ENUM ('shown', 'acknowledged_by_patient', 'acknowledged_by_caregiver');
CREATE TYPE visit_type_enum    AS ENUM ('user_added', 'system_suggested');

-- ─────────────────────────────────────────────────────────────
-- 1. users
-- ─────────────────────────────────────────────────────────────
CREATE TABLE users (
    id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name                     VARCHAR(255)   NOT NULL,
    email                    VARCHAR(255)   NOT NULL UNIQUE,
    password_hash            VARCHAR(255)   NOT NULL,
    role                     user_role      NOT NULL DEFAULT 'patient',
    is_email_verified        BOOLEAN        NOT NULL DEFAULT FALSE,
    email_verification_token VARCHAR(255),
    password_reset_token     VARCHAR(255),
    password_reset_expires   TIMESTAMPTZ,
    consent_given_at         TIMESTAMPTZ,
    linking_otp              VARCHAR(6),
    linking_otp_expires_at   TIMESTAMPTZ,
    mfa_code                 VARCHAR(6),
    mfa_expires_at           TIMESTAMPTZ,
    created_at               TIMESTAMPTZ    NOT NULL DEFAULT NOW()
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
    permission_level VARCHAR(25)      NOT NULL DEFAULT 'full_view',
    status           link_status      NOT NULL DEFAULT 'active',
    created_at       TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_caregiver_link UNIQUE (patient_id, caregiver_id)
);
CREATE INDEX idx_caregiver_links_patient   ON caregiver_links(patient_id);
CREATE INDEX idx_caregiver_links_caregiver ON caregiver_links(caregiver_id);

-- ─────────────────────────────────────────────────────────────
-- 3. brand_generic_map  (append-only, versioned)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE brand_generic_map (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_name        VARCHAR(255)   NOT NULL,
    generic_name      VARCHAR(255)   NOT NULL,
    composition       TEXT,
    source            VARCHAR(100)   NOT NULL DEFAULT 'kaggle_seed',
    version           VARCHAR(20)    NOT NULL DEFAULT 'v1',
    effective_date    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    resolution_status VARCHAR(50)    NOT NULL DEFAULT 'resolved',
    resolution_source VARCHAR(255)   NOT NULL DEFAULT 'seed',
    resolved_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
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
-- 4. visits
-- ─────────────────────────────────────────────────────────────
CREATE TABLE visits (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    doctor_name    VARCHAR(255),
    specialty      VARCHAR(100),
    disease_type   VARCHAR(255),
    scheduled_date TIMESTAMPTZ NOT NULL,
    visit_type     visit_type_enum NOT NULL DEFAULT 'user_added',
    brief_id       UUID,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_visits_patient ON visits(patient_id);
CREATE INDEX idx_visits_date    ON visits(scheduled_date);

-- ─────────────────────────────────────────────────────────────
-- 5. medicines
-- ─────────────────────────────────────────────────────────────
CREATE TABLE medicines (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id        UUID              NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    visit_id          UUID              REFERENCES visits(id) ON DELETE SET NULL,
    brand_name        VARCHAR(255)      NOT NULL,
    generic_name      VARCHAR(255),
    dosage            VARCHAR(100)      NOT NULL,
    frequency         VARCHAR(255)      NOT NULL,
    source_photo_id   VARCHAR(255),
    resolution_status resolution_status NOT NULL DEFAULT 'generic_unresolved',
    duration_text     VARCHAR(255),
    course_end_date   DATE,
    added_at          TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    status            medicine_status   NOT NULL DEFAULT 'active'
);
CREATE INDEX idx_medicines_patient ON medicines(patient_id);
CREATE INDEX idx_medicines_status  ON medicines(patient_id, status);
CREATE INDEX idx_medicines_generic ON medicines(generic_name);

-- ─────────────────────────────────────────────────────────────
-- 6. interaction_kb  (append-only, versioned)
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
-- 7. interaction_flags
-- ─────────────────────────────────────────────────────────────
CREATE TABLE interaction_flags (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id          UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    new_medicine_id     UUID          NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
    existing_medicine_id UUID         NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
    kb_entry_id         UUID          NOT NULL REFERENCES interaction_kb(id),
    severity            VARCHAR(50)   NOT NULL,
    confidence          DECIMAL(5,4)  NOT NULL DEFAULT 1.0,
    status              flag_status   NOT NULL DEFAULT 'shown',
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_flags_patient ON interaction_flags(patient_id);
CREATE INDEX idx_flags_status  ON interaction_flags(status);

-- ─────────────────────────────────────────────────────────────
-- 8. lab_reports
-- ─────────────────────────────────────────────────────────────
CREATE TABLE lab_reports (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id          UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    visit_id            UUID          REFERENCES visits(id) ON DELETE SET NULL,
    source_photo_id     VARCHAR(255),
    raw_docling_output  JSONB,
    uploaded_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_lab_reports_patient ON lab_reports(patient_id);

-- ─────────────────────────────────────────────────────────────
-- 9. lab_values
-- ─────────────────────────────────────────────────────────────
CREATE TABLE lab_values (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id          UUID          NOT NULL REFERENCES lab_reports(id) ON DELETE CASCADE,
    test_type          VARCHAR(50)   NOT NULL,
    panel_name         VARCHAR(255),
    value              DECIMAL(10,4) NOT NULL,
    unit               VARCHAR(30)   NOT NULL,
    resolution_status  resolution_status NOT NULL DEFAULT 'generic_unresolved',
    confidence         DECIMAL(5,4)  NOT NULL DEFAULT 1.0,
    recorded_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_lab_values_report ON lab_values(report_id);
CREATE INDEX idx_lab_values_type   ON lab_values(test_type);

-- ─────────────────────────────────────────────────────────────
-- 10. briefs
-- ─────────────────────────────────────────────────────────────
CREATE TABLE briefs (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    visit_id     UUID        REFERENCES visits(id) ON DELETE CASCADE,
    content      JSONB       NOT NULL DEFAULT '{}',
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_briefs_patient ON briefs(patient_id);
CREATE INDEX idx_briefs_visit   ON briefs(visit_id);

-- Add FK from visits → briefs (deferred to avoid circular)
ALTER TABLE visits ADD CONSTRAINT fk_visits_brief
    FOREIGN KEY (brief_id) REFERENCES briefs(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────
-- 11. test_type_normalization (append-only, versioned)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE test_type_normalization (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    test_variant   VARCHAR(255) NOT NULL,
    canonical_type VARCHAR(100) NOT NULL,
    source         VARCHAR(100) NOT NULL DEFAULT 'system_seed',
    version        VARCHAR(20)  NOT NULL DEFAULT 'v1',
    effective_date TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_test_variant_version UNIQUE (test_variant, version)
);
CREATE INDEX idx_test_normalization_variant ON test_type_normalization(test_variant);

CREATE TRIGGER trg_test_normalization_no_update
    BEFORE UPDATE ON test_type_normalization FOR EACH ROW
    EXECUTE FUNCTION prevent_mutation();

CREATE TRIGGER trg_test_normalization_no_delete
    BEFORE DELETE ON test_type_normalization FOR EACH ROW
    EXECUTE FUNCTION prevent_mutation();

-- ─────────────────────────────────────────────────────────────
-- 12. refresh_tokens (for JWT refresh token rotation)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE refresh_tokens (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID             NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255)     NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ      NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash);

-- ─────────────────────────────────────────────────────────────
-- Schema version tracking
-- ─────────────────────────────────────────────────────────────
CREATE TABLE schema_migrations (
    version    VARCHAR(20) PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO schema_migrations (version) VALUES ('v2.1.0');

-- ─────────────────────────────────────────────────────────────
-- Seed Data Mappings & Interactions & Normalization
-- ─────────────────────────────────────────────────────────────

INSERT INTO brand_generic_map (brand_name, generic_name, composition, source, version, effective_date) VALUES
('Glycomet', 'Metformin', 'Metformin Hydrochloride 500mg', 'kaggle_seed', 'v1', NOW()),
('Crocin', 'Paracetamol', 'Paracetamol 650mg', 'kaggle_seed', 'v1', NOW()),
('Amoxil', 'Amoxicillin', 'Amoxicillin Trihydrate 500mg', 'kaggle_seed', 'v1', NOW()),
('Lipitor', 'Atorvastatin', 'Atorvastatin Calcium 10mg', 'kaggle_seed', 'v1', NOW()),
('Zantac', 'Ranitidine', 'Ranitidine Hydrochloride 150mg', 'kaggle_seed', 'v1', NOW()),
('Disprin', 'Aspirin', 'Aspirin 325mg', 'kaggle_seed', 'v1', NOW()),
('Coumadin', 'Warfarin', 'Warfarin Sodium 5mg', 'kaggle_seed', 'v1', NOW())
ON CONFLICT (brand_name, version) DO NOTHING;

INSERT INTO interaction_kb (generic_a, generic_b, severity, explanation, source, version, effective_date) VALUES
('Warfarin', 'Aspirin', 'avoid_combination', 'Combining Warfarin and Aspirin significantly increases the risk of severe bleeding. Avoid combination unless specifically directed by your doctor.', 'DDInter', 'v1', NOW()),
('Metformin', 'Contrast Media', 'monitor_closely', 'Iodinated contrast media may cause temporary kidney impairment, increasing Metformin accumulation and risk of lactic acidosis.', 'DDInter', 'v1', NOW()),
('Ibuprofen', 'Aspirin', 'minor', 'Ibuprofen may decrease the cardioprotective effect of low-dose Aspirin. Space doses or monitor.', 'DDInter', 'v1', NOW())
ON CONFLICT (generic_a, generic_b, version) DO NOTHING;

INSERT INTO test_type_normalization (test_variant, canonical_type, source, version, effective_date) VALUES
('HbA1c', 'HbA1c', 'system_seed', 'v1', NOW()),
('Hb A1c', 'HbA1c', 'system_seed', 'v1', NOW()),
('Glycated Hemoglobin', 'HbA1c', 'system_seed', 'v1', NOW()),
('A1c', 'HbA1c', 'system_seed', 'v1', NOW()),
('Thyroid Stimulating Hormone', 'TSH', 'system_seed', 'v1', NOW()),
('TSH', 'TSH', 'system_seed', 'v1', NOW()),
('S.TSH', 'TSH', 'system_seed', 'v1', NOW()),
('LDL', 'LDL', 'system_seed', 'v1', NOW()),
('LDL Cholesterol', 'LDL', 'system_seed', 'v1', NOW()),
('Low Density Lipoprotein', 'LDL', 'system_seed', 'v1', NOW()),
('HDL', 'HDL', 'system_seed', 'v1', NOW()),
('HDL Cholesterol', 'HDL', 'system_seed', 'v1', NOW()),
('High Density Lipoprotein', 'HDL', 'system_seed', 'v1', NOW()),
('Fasting Blood Sugar', 'FBS', 'system_seed', 'v1', NOW()),
('FBS', 'FBS', 'system_seed', 'v1', NOW()),
('Fasting Glucose', 'FBS', 'system_seed', 'v1', NOW()),
-- Seed new test types normalizations
('Creatinine',       'Creatinine',     'system_seed', 'v1', NOW()),
('Serum Creatinine', 'Creatinine',     'system_seed', 'v1', NOW()),
('S.Creatinine',     'Creatinine',     'system_seed', 'v1', NOW()),
('eGFR',             'eGFR',           'system_seed', 'v1', NOW()),
('GFR',              'eGFR',           'system_seed', 'v1', NOW()),
('INR',              'INR',            'system_seed', 'v1', NOW()),
('Prothrombin INR',  'INR',            'system_seed', 'v1', NOW()),
('PT/INR',           'INR',            'system_seed', 'v1', NOW()),
('Platelet Count',   'Platelet Count', 'system_seed', 'v1', NOW()),
('Platelets',        'Platelet Count', 'system_seed', 'v1', NOW()),
('PLT',              'Platelet Count', 'system_seed', 'v1', NOW()),
('ALT',              'ALT',            'system_seed', 'v1', NOW()),
('SGPT',             'ALT',            'system_seed', 'v1', NOW()),
('Alanine Transaminase', 'ALT',        'system_seed', 'v1', NOW())
ON CONFLICT (test_variant, version) DO NOTHING;

-- Lab-medicine safety rules (deterministic, append-only)
CREATE TABLE IF NOT EXISTS lab_medicine_rules (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    generic_name   VARCHAR(255)         NOT NULL,
    test_type      VARCHAR(100)         NOT NULL,
    condition      VARCHAR(5)           NOT NULL,   -- '>' or '<'
    threshold      DECIMAL(10,4)        NOT NULL,
    unit           VARCHAR(30)          NOT NULL,
    severity       interaction_severity NOT NULL,
    rationale      TEXT                 NOT NULL,
    source         VARCHAR(100)         NOT NULL DEFAULT 'system_seed',
    version        VARCHAR(20)          NOT NULL DEFAULT 'v1',
    effective_date TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_lab_rule_version UNIQUE (generic_name, test_type, version)
);
CREATE INDEX IF NOT EXISTS idx_lab_rules_generic ON lab_medicine_rules(generic_name);

CREATE TRIGGER trg_lab_rules_no_update
    BEFORE UPDATE ON lab_medicine_rules FOR EACH ROW
    EXECUTE FUNCTION prevent_mutation();
CREATE TRIGGER trg_lab_rules_no_delete
    BEFORE DELETE ON lab_medicine_rules FOR EACH ROW
    EXECUTE FUNCTION prevent_mutation();

-- Lab-medicine alert flags
CREATE TABLE IF NOT EXISTS lab_medicine_flags (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id    UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    medicine_id   UUID          NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
    lab_value_id  UUID          NOT NULL REFERENCES lab_values(id) ON DELETE CASCADE,
    rule_id       UUID          NOT NULL REFERENCES lab_medicine_rules(id),
    severity      VARCHAR(50)   NOT NULL,
    status        flag_status   NOT NULL DEFAULT 'shown',
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lab_med_flags_patient ON lab_medicine_flags(patient_id);
CREATE INDEX IF NOT EXISTS idx_lab_med_flags_status  ON lab_medicine_flags(status);

-- Seed lab-medicine rules
INSERT INTO lab_medicine_rules (generic_name, test_type, condition, threshold, unit, severity, rationale) VALUES
('Metformin',    'Creatinine',     '>', 1.5,    'mg/dL',      'monitor_closely',  'Elevated creatinine signals renal impairment; Metformin accumulation increases lactic acidosis risk.'),
('Metformin',    'eGFR',           '<', 30,     'mL/min',     'avoid_combination','Metformin is contraindicated in severe renal failure (eGFR < 30).'),
('Warfarin',     'INR',            '>', 4.0,    '',           'avoid_combination','Supratherapeutic INR indicates high bleeding risk requiring immediate clinical review.'),
('Warfarin',     'Platelet Count', '<', 100,    '×10³/μL',    'monitor_closely',  'Low platelets compound anticoagulant bleeding risk.'),
('Aspirin',      'Platelet Count', '<', 100,    '×10³/μL',    'monitor_closely',  'Antiplatelet effect on already-low platelets increases hemorrhage risk.'),
('Atorvastatin', 'ALT',            '>', 120,    'U/L',        'monitor_closely',  'ALT > 3× upper limit suggests hepatotoxicity; statin review indicated.')
ON CONFLICT (generic_name, test_type, version) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 13. adherence_logs
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS adherence_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    medicine_id UUID NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
    scheduled_date DATE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'taken',
    logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_adherence_log UNIQUE (patient_id, medicine_id, scheduled_date)
);
CREATE INDEX IF NOT EXISTS idx_adherence_patient_date ON adherence_logs(patient_id, scheduled_date);

