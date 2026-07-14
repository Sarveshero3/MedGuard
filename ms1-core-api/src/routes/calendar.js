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
      `SELECT id, doctor_name, specialty, scheduled_date, visit_type, brief_id
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
 * POST /api/calendar/visits
 * Add a new user doctor appointment manually.
 */
router.post('/calendar/visits', authenticateUser, enforcePatientAccess('full_view'), enforceEmailVerified, sanitizeInput, async (req, res, next) => {
  const { patient_id, doctor_name, specialty, scheduled_date } = req.body;

  if (!scheduled_date) {
    return res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'scheduled_date is required.' },
    });
  }

  try {
    const result = await query(
      `INSERT INTO visits (patient_id, doctor_name, specialty, scheduled_date, visit_type)
       VALUES ($1, $2, $3, $4, 'user_added')
       RETURNING *`,
      [patient_id, doctor_name || null, specialty || null, scheduled_date]
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
});

module.exports = router;
