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
              COALESCE(em.brand_name, em.generic_name) as drug_name_a,
              COALESCE(nm.brand_name, nm.generic_name) as drug_name_b,
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
                COALESCE(m.brand_name, m.generic_name) as drug_name_a,
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

/**
 * POST /api/alerts/safety-check
 * Triggers a manual safety check run for drug-drug and lab-medicine interactions.
 * Uses a Redis-based state hash check for idempotency.
 */
router.post('/alerts/safety-check', authenticateUser, enforcePatientAccess('full_view'), async (req, res, next) => {
  const patientId = req.body.patient_id;
  if (!patientId) {
    return res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'patient_id is required.' },
    });
  }

  try {
    // 1. Fetch active medicines
    const medicinesRes = await query(
      `SELECT id, brand_name, generic_name, added_at 
       FROM medicines 
       WHERE patient_id = $1 AND status = 'active'
       ORDER BY id`,
      [patientId]
    );
    const activeMeds = medicinesRes.rows;

    // 2. Fetch all lab values
    const labValuesRes = await query(
      `SELECT lv.id, lv.recorded_at 
       FROM lab_values lv
       JOIN lab_reports lr ON lv.report_id = lr.id
       WHERE lr.patient_id = $1
       ORDER BY lv.id`,
      [patientId]
    );
    const activeLabs = labValuesRes.rows;

    // 3. Generate status hash for idempotency check
    const crypto = require('crypto');
    const stateStr = activeMeds.map(m => `${m.id}:${new Date(m.added_at).getTime()}`).join('|') + 
                     '@' + 
                     activeLabs.map(l => `${l.id}`).join('|');
    const currentHash = crypto.createHash('sha256').update(stateStr).digest('hex');
    const cacheKey = `safety_check:last_hash:${patientId}`;

    const redisConnection = require('../config/redis');
    const lastHash = await redisConnection.get(cacheKey);

    if (lastHash === currentHash) {
      return res.json({
        success: false,
        code: 'UP_TO_DATE',
        message: 'Clinical checks are already up-to-date. No new prescriptions or lab reports have been added since the last check.'
      });
    }

    // 4. Run safety checks!
    let newDrugDrugAlerts = 0;
    
    // A. Drug-Drug Interactions Check
    const { checkInteractions } = require('../utils/interactionEngine');
    const axios = require('axios');
    const MS2_BASE_URL = process.env.MS2_BASE_URL || 'http://localhost:8000';

    for (let i = 0; i < activeMeds.length; i++) {
      for (let j = i + 1; j < activeMeds.length; j++) {
        const medA = activeMeds[i];
        const medB = activeMeds[j];
        if (!medA.generic_name || !medB.generic_name) continue;
        if (medA.generic_name.toLowerCase() === medB.generic_name.toLowerCase()) continue;

        // Check if already flagged in DB
        const flaggedRes = await query(
          `SELECT id FROM interaction_flags 
           WHERE patient_id = $1 
             AND ((new_medicine_id = $2 AND existing_medicine_id = $3) 
               OR (new_medicine_id = $3 AND existing_medicine_id = $2))`,
          [patientId, medA.id, medB.id]
        );

        if (flaggedRes.rows.length === 0) {
          // Check local KB
          const localRules = await checkInteractions(medA.generic_name, [medB.generic_name]);
          if (localRules.length > 0) {
            for (const rule of localRules) {
              await query(
                `INSERT INTO interaction_flags (patient_id, new_medicine_id, existing_medicine_id, kb_entry_id, severity, confidence, status)
                 VALUES ($1, $2, $3, $4, $5, 1.0, 'shown')
                 ON CONFLICT DO NOTHING`,
                [patientId, medA.id, medB.id, rule.id, rule.severity]
              );
              newDrugDrugAlerts++;
            }
          } else {
            // Call MS2
            try {
              const ms2Res = await axios.post(`${MS2_BASE_URL}/api/research-interaction`, {
                generic_a: medA.generic_name,
                generic_b: medB.generic_name
              }, { 
                headers: { 'x-internal-auth': process.env.MS2_INTERNAL_SECRET || 'dev-secret' },
                timeout: 35000 
              });

              if (ms2Res.data && ms2Res.data.success && ms2Res.data.data) {
                const result = ms2Res.data.data;
                if (result.severity && result.severity !== 'no_action' && result.severity !== 'unknown') {
                  let ruleId;
                  const kbRes = await query(
                    `SELECT id FROM interaction_kb 
                     WHERE (LOWER(generic_a) = LOWER($1) AND LOWER(generic_b) = LOWER($2))
                        OR (LOWER(generic_a) = LOWER($2) AND LOWER(generic_b) = LOWER($1))`,
                    [medA.generic_name, medB.generic_name]
                  );
                  
                  if (kbRes.rows.length > 0) {
                    ruleId = kbRes.rows[0].id;
                  } else {
                    const insertKb = await query(
                      `INSERT INTO interaction_kb (generic_a, generic_b, severity, explanation, source, version)
                       VALUES ($1, $2, $3, $4, 'manual_check', 'v1')
                       RETURNING id`,
                      [medA.generic_name, medB.generic_name, result.severity, result.explanation]
                    );
                    ruleId = insertKb.rows[0].id;
                  }

                  await query(
                    `INSERT INTO interaction_flags (patient_id, new_medicine_id, existing_medicine_id, kb_entry_id, severity, confidence, status)
                     VALUES ($1, $2, $3, $4, $5, 1.0, 'shown')
                     ON CONFLICT DO NOTHING`,
                    [patientId, medA.id, medB.id, ruleId, result.severity]
                  );
                  newDrugDrugAlerts++;
                }
              }
            } catch (ms2Err) {
              logger.warn('MANUAL_SAFETY_RESEARCH_FAILED', `Failed to research interaction between ${medA.generic_name} and ${medB.generic_name}: ${ms2Err.message}`);
            }
          }
        }
      }
    }

    // B. Lab-Medicine Safety Check
    let newLabMedAlerts = 0;
    if (activeLabs.length > 0) {
      const { checkLabMedicineConflicts } = require('../utils/labMedicineChecker');
      const labValueIds = activeLabs.map(l => l.id);
      const flaggedConflicts = await checkLabMedicineConflicts(patientId, labValueIds);
      newLabMedAlerts = flaggedConflicts.length;
    }

    // 5. Update cached state hash to prevent repeated executions
    await redisConnection.setex(cacheKey, 86400 * 7, currentHash); // Cache for 7 days

    res.json({
      success: true,
      message: `Safety check completed. Found ${newDrugDrugAlerts} new drug interactions and ${newLabMedAlerts} lab-medicine alerts.`,
      data: {
        newDrugDrugAlerts,
        newLabMedAlerts,
      }
    });

  } catch (err) {
    logger.error('MANUAL_SAFETY_CHECK_ERROR', `Error running manual safety check for patient ${patientId}: ${err.message}`, err);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: "We couldn't complete the safety check right now — please try again shortly."
      }
    });
  }
});

module.exports = router;
