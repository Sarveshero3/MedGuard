const express = require('express');
const { query } = require('../config/db');
const logger = require('../utils/logger');
const { authenticateUser, enforcePatientAccess, enforceEmailVerified, verifyPatientAccess } = require('../middleware/auth');
const { sanitizeInput, validateUUID } = require('../middleware/security');

const router = express.Router();
const MS2_BASE_URL = process.env.MS2_BASE_URL || 'http://ms2-agent-service:8000';

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
 * POST /api/calendar/visits
 * Add a new user doctor appointment manually.
 */
router.post('/calendar/visits', authenticateUser, enforcePatientAccess('full_view'), enforceEmailVerified, sanitizeInput, async (req, res, next) => {
  const { patient_id, doctor_name, specialty, scheduled_date, disease_type } = req.body;

  if (!scheduled_date) {
    return res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'scheduled_date is required.' },
    });
  }

  try {
    const result = await query(
      `INSERT INTO visits (patient_id, doctor_name, specialty, scheduled_date, disease_type, visit_type)
       VALUES ($1, $2, $3, $4, $5, 'user_added')
       RETURNING *`,
      [patient_id, doctor_name || null, specialty || null, scheduled_date, disease_type || null]
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

/**
 * GET /api/visits/:id/brief
 * Generate or retrieve a cached visit prep brief.
 * Aggregates active medicines, interaction flags, and lab trends,
 * then calls ms2's visit-brief writer graph.
 * Pass ?regenerate=true to force regeneration.
 */
router.get('/visits/:id/brief', authenticateUser, validateUUID('id'), async (req, res, next) => {
  const visitId = req.params.id;
  const forceRegenerate = req.query.regenerate === 'true';

  try {
    // Fetch the visit and verify ownership
    const visitResult = await query('SELECT * FROM visits WHERE id = $1', [visitId]);
    if (visitResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Visit not found.' },
      });
    }

    const visit = visitResult.rows[0];
    const isAuthorized = await verifyPatientAccess(req, visit.patient_id, 'full_view');
    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied.' },
      });
    }

    // Check for cached brief
    if (!forceRegenerate && visit.brief_id) {
      const cachedBrief = await query('SELECT * FROM briefs WHERE id = $1', [visit.brief_id]);
      if (cachedBrief.rows.length > 0) {
        return res.json({
          success: true,
          data: {
            brief: cachedBrief.rows[0],
            cached: true,
          },
        });
      }
    }

    const patientId = visit.patient_id;

    // Aggregate patient data for the brief
    const [medsResult, flagsResult, labsResult] = await Promise.all([
      query("SELECT brand_name, generic_name, dosage, frequency, duration_text FROM medicines WHERE patient_id = $1 AND status = 'active'", [patientId]),
      query(`SELECT ifl.severity, ifl.status, kb.generic_a, kb.generic_b, kb.explanation
             FROM interaction_flags ifl
             JOIN interaction_kb kb ON ifl.kb_entry_id = kb.id
             WHERE ifl.patient_id = $1`, [patientId]),
      query(`SELECT lv.test_type, lv.value, lv.unit, lv.recorded_at
             FROM lab_values lv
             JOIN lab_reports lr ON lv.report_id = lr.id
             WHERE lr.patient_id = $1
             ORDER BY lv.recorded_at DESC`, [patientId]),
    ]);

    // Compute lab trends
    const { calculateTrend } = require('../utils/trendCalculator');
    const labsByType = {};
    for (const row of labsResult.rows) {
      if (!labsByType[row.test_type]) labsByType[row.test_type] = [];
      labsByType[row.test_type].push(row);
    }
    const labTrends = {};
    for (const [testType, values] of Object.entries(labsByType)) {
      labTrends[testType] = calculateTrend(values);
    }

    // Call ms2 visit-brief writer
    let briefContent;
    try {
      const ms2Response = await fetch(`${MS2_BASE_URL}/api/visit-brief`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          active_medicines: medsResult.rows,
          interaction_flags: flagsResult.rows,
          lab_trends: labTrends,
          reason_for_visit: visit.disease_type || visit.specialty || 'General Consult',
        }),
      });

      if (ms2Response.ok) {
        const ms2Json = await ms2Response.json();
        briefContent = ms2Json.data || ms2Json;
      } else {
        logger.warn('BRIEF_MS2_FALLBACK', `ms2 returned ${ms2Response.status}, generating local summary`);
        briefContent = generateLocalBrief(medsResult.rows, flagsResult.rows, labTrends, visit);
      }
    } catch (ms2Err) {
      logger.warn('BRIEF_MS2_UNREACHABLE', `ms2 unreachable: ${ms2Err.message}, generating local summary`);
      briefContent = generateLocalBrief(medsResult.rows, flagsResult.rows, labTrends, visit);
    }

    // Save the brief in a transaction
    const client = await require('../config/db').pool.connect();
    try {
      await client.query('BEGIN');
      const briefResult = await client.query(
        `INSERT INTO briefs (patient_id, visit_id, content) VALUES ($1, $2, $3) RETURNING *`,
        [patientId, visitId, JSON.stringify(briefContent)]
      );
      await client.query(
        `UPDATE visits SET brief_id = $1 WHERE id = $2`,
        [briefResult.rows[0].id, visitId]
      );
      await client.query('COMMIT');

      logger.audit('BRIEF_GENERATED', `Generated visit brief ${briefResult.rows[0].id} for visit ${visitId}`, {
        visitId,
        patientId,
      });

      res.json({
        success: true,
        data: {
          brief: briefResult.rows[0],
          cached: false,
        },
      });
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }

  } catch (err) {
    logger.error('BRIEF_GENERATION_ERROR', `Error generating brief for visit ${visitId}: ${err.message}`);
    next(err);
  }
});

/**
 * Local fallback brief generator when ms2 is unreachable.
 */
function generateLocalBrief(medicines, flags, labTrends, visit) {
  const medSummary = medicines.map(m => `${m.brand_name} (${m.generic_name || 'generic unknown'}) — ${m.dosage}, ${m.frequency}`);

  const warnings = flags
    .filter(f => f.severity === 'avoid_combination' || f.severity === 'monitor_closely')
    .map(f => `⚠️ ${f.generic_a} + ${f.generic_b}: ${f.explanation}`);

  const trends = Object.entries(labTrends)
    .filter(([, t]) => t && t.trend === 'rising')
    .map(([test, t]) => `📈 ${test}: ${t.previousValue} → ${t.currentValue} ${t.unit || ''}`);

  const questions = [
    medicines.length > 2 ? 'I am currently on multiple medications — are there any I should discuss adjusting?' : null,
    warnings.length > 0 ? `A drug interaction was flagged between ${flags[0]?.generic_a} and ${flags[0]?.generic_b} — is this something to be concerned about?` : null,
    trends.length > 0 ? `My ${Object.keys(labTrends).filter(k => labTrends[k]?.trend === 'rising').join(' and ')} values have been rising — what could be causing this?` : null,
    'Are there any lifestyle changes I should consider based on my current health data?',
  ].filter(Boolean);

  return {
    visit_type: visit.disease_type || visit.specialty || 'General Consult',
    generated_at: new Date().toISOString(),
    active_medicines: medSummary,
    warnings,
    lab_trends: trends,
    suggested_questions: questions,
    disclaimer: 'Discuss this with your doctor — this is not a diagnosis.',
  };
}

module.exports = router;
