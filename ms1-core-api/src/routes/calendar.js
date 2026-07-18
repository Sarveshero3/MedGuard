const express = require('express');
const { query } = require('../config/db');
const logger = require('../utils/logger');
const { authenticateUser, enforcePatientAccess, enforceEmailVerified } = require('../middleware/auth');
const { sanitizeInput } = require('../middleware/security');

const router = express.Router();

/**
 * GET /api/calendar
 * Fetch merged view of active medicine course end-dates and user-added doctor appointments.
 */
router.get('/calendar', authenticateUser, enforcePatientAccess('full_view'), async (req, res, next) => {
  const patientId = req.query.patient_id;

  try {
    const medsResult = await query(
      `SELECT id, brand_name, generic_name, dosage, frequency, added_at, duration_text, course_end_date
       FROM medicines
       WHERE patient_id = $1 AND status = 'active'
       ORDER BY added_at DESC`,
      [patientId]
    );

    const visitsResult = await query(
      `SELECT id, doctor_name, specialty, disease_type, scheduled_date, visit_type, brief_id
       FROM visits
       WHERE patient_id = $1 AND visit_type = 'user_added'
       ORDER BY scheduled_date ASC`,
      [patientId]
    );

    const medicines = medsResult.rows;
    const visits = visitsResult.rows;

    const timeline = [];

    // Map medicines to timeline events
    medicines.forEach((med) => {
      if (med.course_end_date) {
        timeline.push({
          type: 'medicine_course',
          id: med.id,
          title: `${med.brand_name || med.generic_name} Course Ends`,
          date: med.course_end_date,
          details: med,
        });
      }
    });

    // Map visits to timeline events
    visits.forEach((visit) => {
      timeline.push({
        type: 'doctor_visit',
        id: visit.id,
        title: `Visit with ${visit.doctor_name || 'Clinician'}${visit.specialty ? ` (${visit.specialty})` : ''}`,
        date: visit.scheduled_date,
        details: visit,
      });
    });

    // Sort timeline chronologically (earliest date first)
    timeline.sort((a, b) => new Date(a.date) - new Date(b.date));

    res.json({
      success: true,
      data: {
        medicines,
        visits,
        timeline,
      },
    });
  } catch (err) {
    logger.error('CALENDAR_FETCH_ERROR', `Error fetching calendar data for patient ${patientId}: ${err.message}`);
    next(err);
  }
});

/**
 * Add a new user doctor appointment manually (supports both /calendar/visits and /appointments).
 */
const createVisitHandler = async (req, res, next) => {
  const { patient_id, doctor_name, specialty, visit_type, scheduled_date, disease_type } = req.body;

  if (!scheduled_date) {
    return res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'scheduled_date is required.' },
    });
  }

  try {
    const finalSpecialty = specialty || visit_type || null;
    const result = await query(
      `INSERT INTO visits (patient_id, doctor_name, specialty, scheduled_date, disease_type, visit_type)
       VALUES ($1, $2, $3, $4, $5, 'user_added')
       RETURNING *`,
      [patient_id, doctor_name || null, finalSpecialty, scheduled_date, disease_type || null]
    );

    logger.audit('VISIT_CREATED', `User ${req.user.id} manually created doctor visit ${result.rows[0].id} for patient ${patient_id}`, {
      userId: req.user.id,
      patientId: patient_id,
      visitId: result.rows[0].id,
    });

    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (err) {
    logger.error('VISIT_CREATE_ERROR', `Error creating doctor visit: ${err.message}`);
    next(err);
  }
};

router.post('/calendar/visits', authenticateUser, enforcePatientAccess('full_view'), enforceEmailVerified, sanitizeInput, createVisitHandler);
router.post('/appointments', authenticateUser, enforcePatientAccess('full_view'), enforceEmailVerified, sanitizeInput, createVisitHandler);

// --- Adherence Tracking Endpoints ---

// Auto-run migration for adherence logs
(async () => {
  try {
    await query(`
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
    `);
    logger.info('DB_MIGRATION', 'Adherence logs table initialized');
  } catch (err) {
    logger.error('DB_MIGRATION', 'Failed to initialize adherence logs: ' + err.message);
  }
})();

/**
 * GET /api/adherence
 * Fetch adherence logs for a patient within an optional date range.
 */
router.get('/adherence', authenticateUser, enforcePatientAccess('full_view'), async (req, res, next) => {
  const patientId = req.query.patient_id;
  try {
    const result = await query(
      `SELECT id, medicine_id, scheduled_date, status, logged_at 
       FROM adherence_logs 
       WHERE patient_id = $1
       ORDER BY scheduled_date ASC`,
      [patientId]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/adherence
 * Log adherence for a specific medicine on a specific date.
 */
router.post('/adherence', authenticateUser, enforcePatientAccess('full_view'), enforceEmailVerified, sanitizeInput, async (req, res, next) => {
  const { patient_id, medicine_id, scheduled_date, status } = req.body;
  
  if (!medicine_id || !scheduled_date || !status) {
    return res.status(400).json({ success: false, error: { message: 'Missing required fields' } });
  }

  try {
    const result = await query(
      `INSERT INTO adherence_logs (patient_id, medicine_id, scheduled_date, status, logged_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (patient_id, medicine_id, scheduled_date) 
       DO UPDATE SET status = EXCLUDED.status, logged_at = NOW()
       RETURNING *`,
      [patient_id, medicine_id, scheduled_date, status]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
