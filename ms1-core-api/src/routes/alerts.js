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
    // Drug-drug interaction alerts
    const drugDrugResult = await query(
      `SELECT f.id, f.patient_id, f.severity, f.confidence, f.status, f.created_at,
              nm.brand_name as new_medicine_brand, nm.generic_name as new_medicine_generic,
              em.brand_name as existing_medicine_brand, em.generic_name as existing_medicine_generic,
              COALESCE(em.generic_name, em.brand_name) as drug_name_a,
              COALESCE(nm.generic_name, nm.brand_name) as drug_name_b,
              kb.explanation,
              'drug_drug' as alert_type
       FROM interaction_flags f
       JOIN medicines nm ON f.new_medicine_id = nm.id
       JOIN medicines em ON f.existing_medicine_id = em.id
       JOIN interaction_kb kb ON f.kb_entry_id = kb.id
       WHERE f.patient_id = $1
       ORDER BY f.created_at DESC`,
      [patientId]
    );

    // Lab-medicine safety alerts
    let labMedResult = { rows: [] };
    try {
      labMedResult = await query(
        `SELECT lmf.id, lmf.patient_id, lmf.severity, 1.0 as confidence, lmf.status, lmf.created_at,
                COALESCE(m.generic_name, m.brand_name) as drug_name_a,
                (lv.test_type || ' = ' || lv.value || ' ' || lv.unit) as drug_name_b,
                r.rationale as explanation,
                'lab_medicine' as alert_type
         FROM lab_medicine_flags lmf
         JOIN medicines m ON lmf.medicine_id = m.id
         JOIN lab_values lv ON lmf.lab_value_id = lv.id
         JOIN lab_medicine_rules r ON lmf.rule_id = r.id
         WHERE lmf.patient_id = $1
         ORDER BY lmf.created_at DESC`,
        [patientId]
      );
    } catch (labErr) {
      // Table may not exist yet (pre-migration) — gracefully degrade
      logger.warn('LAB_MED_FLAGS_QUERY_SKIP', `lab_medicine_flags query skipped: ${labErr.message}`);
    }

    // Merge both alert types and sort by created_at DESC
    const allAlerts = [...drugDrugResult.rows, ...labMedResult.rows]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json({
      success: true,
      data: allAlerts,
    });
  } catch (err) {
    logger.error('ALERTS_FETCH_ERROR', `Error fetching alerts for patient ${patientId}: ${err.message}`);
    next(err);
  }
});

/**
 * Acknowledge an alert by a patient or their caregiver (POST, PUT, or PATCH).
 */
const acknowledgeAlertHandler = async (req, res, next) => {
  const alertId = req.params.id;

  try {
    let targetTable = null;
    let flagResult = await query('SELECT patient_id FROM interaction_flags WHERE id = $1', [alertId]);
    
    if (flagResult.rows.length > 0) {
      targetTable = 'interaction_flags';
    } else {
      flagResult = await query('SELECT patient_id FROM lab_medicine_flags WHERE id = $1', [alertId]);
      if (flagResult.rows.length > 0) {
        targetTable = 'lab_medicine_flags';
      }
    }

    if (!targetTable) {
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
      `UPDATE ${targetTable} SET status = $1 WHERE id = $2 RETURNING *`,
      [statusUpdate, alertId]
    );

    logger.audit('ALERT_ACKNOWLEDGED', `User ${req.user.id} (${req.user.role}) acknowledged alert ${alertId} in ${targetTable}`, {
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
};

router.post('/alerts/:id/acknowledge', authenticateUser, validateUUID('id'), acknowledgeAlertHandler);
router.put('/alerts/:id/acknowledge', authenticateUser, validateUUID('id'), acknowledgeAlertHandler);
router.patch('/alerts/:id/acknowledge', authenticateUser, validateUUID('id'), acknowledgeAlertHandler);

module.exports = router;
