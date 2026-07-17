-- 1. Allow standalone briefs (not tied to a visit)
ALTER TABLE briefs ALTER COLUMN visit_id DROP NOT NULL;

-- 2. Lab-medicine safety rules (deterministic, append-only)
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

-- Check if triggers already exist before creating
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_lab_rules_no_update') THEN
        CREATE TRIGGER trg_lab_rules_no_update
            BEFORE UPDATE ON lab_medicine_rules FOR EACH ROW
            EXECUTE FUNCTION prevent_mutation();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_lab_rules_no_delete') THEN
        CREATE TRIGGER trg_lab_rules_no_delete
            BEFORE DELETE ON lab_medicine_rules FOR EACH ROW
            EXECUTE FUNCTION prevent_mutation();
    END IF;
END $$;

-- 3. Lab-medicine alert flags
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

-- 4. Seed lab-medicine rules
INSERT INTO lab_medicine_rules (generic_name, test_type, condition, threshold, unit, severity, rationale) VALUES
('Metformin',    'Creatinine',     '>', 1.5,    'mg/dL',      'monitor_closely',  'Elevated creatinine signals renal impairment; Metformin accumulation increases lactic acidosis risk.'),
('Metformin',    'eGFR',           '<', 30,     'mL/min',     'avoid_combination','Metformin is contraindicated in severe renal failure (eGFR < 30).'),
('Warfarin',     'INR',            '>', 4.0,    '',           'avoid_combination','Supratherapeutic INR indicates high bleeding risk requiring immediate clinical review.'),
('Warfarin',     'Platelet Count', '<', 100,    '×10³/μL',    'monitor_closely',  'Low platelets compound anticoagulant bleeding risk.'),
('Aspirin',      'Platelet Count', '<', 100,    '×10³/μL',    'monitor_closely',  'Antiplatelet effect on already-low platelets increases hemorrhage risk.'),
('Atorvastatin', 'ALT',            '>', 120,    'U/L',        'monitor_closely',  'ALT > 3× upper limit suggests hepatotoxicity; statin review indicated.')
ON CONFLICT (generic_name, test_type, version) DO NOTHING;

-- 5. Add test_type_normalization entries for new canonical types
INSERT INTO test_type_normalization (test_variant, canonical_type, source, version) VALUES
('Creatinine',       'Creatinine',     'system_seed', 'v1'),
('Serum Creatinine', 'Creatinine',     'system_seed', 'v1'),
('S.Creatinine',     'Creatinine',     'system_seed', 'v1'),
('eGFR',             'eGFR',           'system_seed', 'v1'),
('GFR',              'eGFR',           'system_seed', 'v1'),
('INR',              'INR',            'system_seed', 'v1'),
('Prothrombin INR',  'INR',            'system_seed', 'v1'),
('PT/INR',           'INR',            'system_seed', 'v1'),
('Platelet Count',   'Platelet Count', 'system_seed', 'v1'),
('Platelets',        'Platelet Count', 'system_seed', 'v1'),
('PLT',              'Platelet Count', 'system_seed', 'v1'),
('ALT',              'ALT',            'system_seed', 'v1'),
('SGPT',             'ALT',            'system_seed', 'v1'),
('Alanine Transaminase', 'ALT',        'system_seed', 'v1')
ON CONFLICT (test_variant, version) DO NOTHING;
