const express = require('express');
const { query } = require('../config/db');
const logger = require('../utils/logger');
const { authenticateUser, enforcePatientAccess, verifyPatientAccess } = require('../middleware/auth');
const { validateUUID } = require('../middleware/security');

const router = express.Router();

/**
 * GET /api/alerts
 * Retrieve interaction alerts for a patient.
 * Secured: enforcePatientAccess('alerts_only') allows patients or authorized caregivers to read alerts.
 */
router.get('/alerts', authenticateUser, enforcePatientAccess('alerts_only'), async (req, res, next) => {
  const patientId = req.query.patient_id;

  try {
    const result = await query(
      `SELECT f.id, f.patient_id, f.severity, f.confidence, f.status, f.created_at,
              nm.brand_name as new_medicine_brand, nm.generic_name as new_medicine_generic,
              em.brand_name as existing_medicine_brand, em.generic_name as existing_medicine_generic,
              kb.explanation
       FROM interaction_flags f
       JOIN medicines nm ON f.new_medicine_id = nm.id
       JOIN medicines em ON f.existing_medicine_id = em.id
       JOIN interaction_kb kb ON f.kb_entry_id = kb.id
       WHERE f.patient_id = $1
       ORDER BY f.created_at DESC`,
      [patientId]
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (err) {
    logger.error('ALERTS_FETCH_ERROR', `Error fetching alerts for patient ${patientId}: ${err.message}`);
    next(err);
  }
});

/**
 * POST /api/alerts/:id/acknowledge
 * Acknowledge an alert by a patient or their caregiver.
 */
router.post('/alerts/:id/acknowledge', authenticateUser, validateUUID('id'), async (req, res, next) => {
  const alertId = req.params.id;

  try {
    const flagResult = await query('SELECT patient_id FROM interaction_flags WHERE id = $1', [alertId]);
    if (flagResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Alert flag not found.' },
      });
    }

    const patientId = flagResult.rows[0].patient_id;
    const isAuthorized = await verifyPatientAccess(req, patientId, 'alerts_only');
    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied. Unauthorized resource access.' },
      });
    }

    let statusUpdate;
    if (req.user.role === 'patient') {
      statusUpdate = 'acknowledged_by_patient';
    } else if (req.user.role === 'caregiver') {
      statusUpdate = 'acknowledged_by_caregiver';
    } else {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied.' },
      });
    }

    const result = await query(
      'UPDATE interaction_flags SET status = $1 WHERE id = $2 RETURNING *',
      [statusUpdate, alertId]
    );

    logger.audit('ALERT_ACKNOWLEDGED', `User ${req.user.id} (${req.user.role}) acknowledged alert ${alertId}`, {
      userId: req.user.id,
      role: req.user.role,
      alertId,
      status: statusUpdate,
    });

    res.json({
      success: true,
      data: result.rows[0],
    });

  } catch (err) {
    logger.error('ALERT_ACKNOWLEDGE_ERROR', `Error acknowledging alert ${alertId}: ${err.message}`);
    next(err);
  }
});

module.exports = router;
