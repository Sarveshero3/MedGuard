const express = require('express');
const { query } = require('../config/db');
const logger = require('../utils/logger');
const { authenticateUser, verifyPatientAccess } = require('../middleware/auth');
const { validateUUID } = require('../middleware/security');
const axios = require('axios');

const router = express.Router();

/**
 * POST /api/briefs
 * Generate a new doctor visit preparation brief for a patient.
 */
router.post('/briefs', authenticateUser, async (req, res, next) => {
  const { patient_id, visit_date } = req.body;

  if (!patient_id) {
    return res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'patient_id is required.' },
    });
  }

  try {
    const isAuthorized = await verifyPatientAccess(req, patient_id, 'full_view');
    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied.' },
      });
    }

    let targetDate = visit_date;
    if (!targetDate) {
      // Find the nearest upcoming appointment
      const upcomingRes = await query(
        `SELECT scheduled_date FROM visits 
         WHERE patient_id = $1 AND scheduled_date >= NOW() 
         ORDER BY scheduled_date ASC LIMIT 1`,
        [patient_id]
      );
      if (upcomingRes.rows.length > 0) {
        targetDate = new Date(upcomingRes.rows[0].scheduled_date).toISOString().split('T')[0];
      } else {
        targetDate = new Date().toISOString().split('T')[0];
      }
    }

    // Aggregate patient data for the brief
    const [medsResult, flagsResult, labFlagsResult, labsResult] = await Promise.all([
      query("SELECT brand_name, generic_name, dosage, frequency, duration_text FROM medicines WHERE patient_id = $1 AND status = 'active'", [patient_id]),
      query(`SELECT ifl.severity, ifl.status, kb.generic_a, kb.generic_b, kb.explanation
             FROM interaction_flags ifl
             JOIN interaction_kb kb ON ifl.kb_entry_id = kb.id
             WHERE ifl.patient_id = $1 AND ifl.status = 'shown'`, [patient_id]),
      query(`SELECT lmf.severity, lmf.status, m.generic_name as generic_a, 
                    (lv.test_type || ' = ' || lv.value || ' ' || lv.unit) as generic_b, 
                    r.rationale as explanation
             FROM lab_medicine_flags lmf
             JOIN medicines m ON lmf.medicine_id = m.id
             JOIN lab_values lv ON lmf.lab_value_id = lv.id
             JOIN lab_medicine_rules r ON lmf.rule_id = r.id
             WHERE lmf.patient_id = $1 AND lmf.status = 'shown'`, [patient_id]),
      query(`SELECT lv.test_type, lv.value, lv.unit, lv.recorded_at
             FROM lab_values lv
             JOIN lab_reports lr ON lv.report_id = lr.id
             WHERE lr.patient_id = $1
             ORDER BY lv.recorded_at DESC`, [patient_id]),
    ]);

    // Merge drug-drug and lab-medicine interaction flags
    const combinedFlags = [
      ...flagsResult.rows,
      ...labFlagsResult.rows
    ];

    // Compute lab trends
    const { calculateTrend } = require('../utils/trendCalculator');
    const labsByType = {};
    for (const row of labsResult.rows) {
      if (!labsByType[row.test_type]) labsByType[row.test_type] = [];
      labsByType[row.test_type].push(row);
    }
    const labTrends = [];
    for (const [testType, values] of Object.entries(labsByType)) {
      if (values.length > 0) {
        const currentRecord = values[0];
        const historyRecords = values.slice(1);
        const trendResult = calculateTrend(testType, currentRecord.value, historyRecords);
        if (trendResult.isMeaningfulChange) {
          labTrends.push({
            test_type: testType,
            trend: trendResult.direction || 'stable',
            message: trendResult.message,
            current_value: currentRecord.value,
            previous_value: historyRecords[0]?.value || null,
            unit: currentRecord.unit
          });
        }
      }
    }

    // Call ms2 visit-brief writer
    const MS2_BASE_URL = process.env.MS2_BASE_URL || 'http://localhost:8000';
    let briefContent;
    try {
      const ms2Response = await axios.post(`${MS2_BASE_URL}/api/visit-brief`, {
        active_medicines: medsResult.rows,
        interaction_flags: combinedFlags,
        lab_trends: labTrends,
        reason_for_visit: `General Consult on ${targetDate}`,
      }, { timeout: 15000 });

      if (ms2Response.data && ms2Response.data.success) {
        briefContent = ms2Response.data.data;
      } else {
        logger.warn('BRIEF_MS2_FALLBACK', `ms2 returned unsuccessful state, generating local summary`);
        briefContent = generateLocalBrief(medsResult.rows, combinedFlags, labTrends, targetDate);
      }
    } catch (ms2Err) {
      logger.warn('BRIEF_MS2_UNREACHABLE', `ms2 unreachable: ${ms2Err.message}, generating local summary`);
      briefContent = generateLocalBrief(medsResult.rows, combinedFlags, labTrends, targetDate);
    }

    // Store for_date inside content
    briefContent.for_date = targetDate;

    // Save the brief (visit_id is NULL)
    const briefResult = await query(
      `INSERT INTO briefs (patient_id, visit_id, content) VALUES ($1, NULL, $2) RETURNING *`,
      [patient_id, JSON.stringify(briefContent)]
    );

    logger.audit('BRIEF_GENERATED', `Generated standalone brief ${briefResult.rows[0].id} for patient ${patient_id}`, {
      patientId: patient_id,
      briefId: briefResult.rows[0].id,
    });

    res.status(201).json({
      success: true,
      data: briefResult.rows[0],
    });

  } catch (err) {
    logger.error('BRIEF_GENERATION_ERROR', `Error generating brief: ${err.message}`);
    next(err);
  }
});

/**
 * GET /api/briefs
 * List patient's briefs.
 */
router.get('/briefs', authenticateUser, async (req, res, next) => {
  const patientId = req.query.patient_id;
  if (!patientId) {
    return res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'patient_id is required.' },
    });
  }

  try {
    const isAuthorized = await verifyPatientAccess(req, patientId, 'full_view');
    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied.' },
      });
    }

    const result = await query(
      `SELECT id, patient_id, visit_id, content, generated_at 
       FROM briefs 
       WHERE patient_id = $1 
       ORDER BY generated_at DESC`,
      [patientId]
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (err) {
    logger.error('BRIEFS_FETCH_ERROR', `Error fetching briefs: ${err.message}`);
    next(err);
  }
});

/**
 * GET /api/briefs/:id
 * Retrieve a specific brief by UUID.
 */
router.get('/briefs/:id', authenticateUser, validateUUID('id'), async (req, res, next) => {
  const briefId = req.params.id;

  try {
    const briefResult = await query('SELECT * FROM briefs WHERE id = $1', [briefId]);
    if (briefResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Brief not found.' },
      });
    }

    const brief = briefResult.rows[0];
    const isAuthorized = await verifyPatientAccess(req, brief.patient_id, 'full_view');
    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied.' },
      });
    }

    res.json({
      success: true,
      data: brief,
    });
  } catch (err) {
    logger.error('BRIEF_GET_ERROR', `Error getting brief: ${err.message}`);
    next(err);
  }
});

/**
 * PUT /api/briefs/:id
 * Update/save edits to a brief.
 */
router.put('/briefs/:id', authenticateUser, validateUUID('id'), async (req, res, next) => {
  const briefId = req.params.id;
  const { content } = req.body;

  if (!content) {
    return res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'content is required.' },
    });
  }

  try {
    const briefResult = await query('SELECT patient_id FROM briefs WHERE id = $1', [briefId]);
    if (briefResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Brief not found.' },
      });
    }

    const brief = briefResult.rows[0];
    const isAuthorized = await verifyPatientAccess(req, brief.patient_id, 'full_view');
    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied.' },
      });
    }

    const updateResult = await query(
      `UPDATE briefs SET content = $1 WHERE id = $2 RETURNING *`,
      [JSON.stringify(content), briefId]
    );

    logger.audit('BRIEF_UPDATED', `User ${req.user.id} updated brief ${briefId}`, {
      userId: req.user.id,
      briefId,
    });

    res.json({
      success: true,
      data: updateResult.rows[0],
    });
  } catch (err) {
    logger.error('BRIEF_UPDATE_ERROR', `Error updating brief: ${err.message}`);
    next(err);
  }
});

/**
 * Local fallback brief generator when ms2 is unreachable.
 */
function generateLocalBrief(medicines, flags, labTrends, targetDate) {
  const medSummary = medicines.map(m => `${m.brand_name} (${m.generic_name || 'generic unknown'}) — ${m.dosage}, ${m.frequency}`);

  const warnings = flags
    .filter(f => f.severity === 'avoid_combination' || f.severity === 'monitor_closely')
    .map(f => `⚠️ ${f.generic_a} + ${f.generic_b}: ${f.explanation}`);

  const trends = labTrends.map(t => `📈 ${t.test_type}: ${t.message}`);

  const questions = [
    medicines.length > 2 ? 'I am currently on multiple medications — are there any I should discuss adjusting?' : null,
    warnings.length > 0 ? `A drug interaction was flagged between ${flags[0]?.generic_a} and ${flags[0]?.generic_b} — is this something to be concerned about?` : null,
    trends.length > 0 ? `Some of my lab trends have changed significantly — what could be causing this?` : null,
    'Are there any lifestyle changes I should consider based on my current health data?',
  ].filter(Boolean);

  return {
    summary: `Active regimen of ${medicines.length} medications review complete.`,
    changes_since_last_visit: warnings.length > 0 || trends.length > 0 
      ? `Warnings flagged: ${warnings.length} medication interactions, ${trends.length} lab changes.` 
      : "No significant medication conflicts or lab changes flagged since last visit.",
    questions: questions.slice(0, 4),
    disclaimer: 'Discuss this with your doctor — this is not a diagnosis.',
  };
}

module.exports = router;
