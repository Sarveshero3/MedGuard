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
INSERT INTO schema_migrations (version) VALUES ('v2.2.0') ON CONFLICT DO NOTHING;
