const express = require('express');
const fs = require('fs');
const { query } = require('../config/db');
const logger = require('../utils/logger');
const { authenticateUser, enforcePatientAccess, verifyPatientAccess, enforceEmailVerified } = require('../middleware/auth');
const { sanitizeInput, upload } = require('../middleware/security');
const { enforceConsent } = require('../middleware/consent');
const { uploadLimiter } = require('../middleware/rateLimiter');
const { extractionQueue } = require('../services/queueService');
const { getCanonicalTestType } = require('../utils/testNormalizer');
const { calculateTrend } = require('../utils/trendCalculator');

const router = express.Router();

/**
 * GET /api/lab-reports
 * Retrieves lab reports list for a patient.
 */
router.get('/lab-reports', authenticateUser, enforcePatientAccess('full_view'), enforceConsent('health_data_processing'), async (req, res, next) => {
  const patientId = req.query.patient_id;
  try {
    const result = await query(
      `SELECT lr.id, lr.patient_id, lr.visit_id, lr.source_photo_id, lr.uploaded_at, v.doctor_name, v.scheduled_date 
       FROM lab_reports lr
       LEFT JOIN visits v ON lr.visit_id = v.id
       WHERE lr.patient_id = $1 
       ORDER BY lr.uploaded_at DESC`,
      [patientId]
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (err) {
    logger.error('LAB_REPORT_FETCH_ERROR', `Error fetching lab reports for patient ${patientId}: ${err.message}`);
    next(err);
  }
});

/**
 * GET /api/lab-reports/:id
 * Retrieve details for a specific lab report and its values.
 */
router.get('/lab-reports/:id', authenticateUser, enforceConsent('health_data_processing'), async (req, res, next) => {
  const reportId = req.params.id;
  try {
    const reportRes = await query('SELECT * FROM lab_reports WHERE id = $1', [reportId]);
    if (reportRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Lab report not found.' },
      });
    }

    const report = reportRes.rows[0];
    const isAuthorized = await verifyPatientAccess(req, report.patient_id, 'full_view');
    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied. Unauthorized resource access.' },
      });
    }

    const valuesRes = await query(
      'SELECT id, test_type, panel_name, value, unit, resolution_status, confidence, recorded_at FROM lab_values WHERE report_id = $1',
      [reportId]
    );

    res.json({
      success: true,
      data: {
        ...report,
        values: valuesRes.rows,
      },
    });
  } catch (err) {
    logger.error('LAB_REPORT_DETAIL_ERROR', `Error fetching detail for lab report ${reportId}: ${err.message}`);
    next(err);
  }
});

/**
 * POST /api/lab-reports/upload
 * Handle lab report photo upload and run extraction with visit context proximity linking.
 */
router.post('/lab-reports/upload', authenticateUser, enforceConsent('health_data_processing'), enforceEmailVerified, uploadLimiter, upload.single('photo'), async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'photo field containing JPG/PNG/PDF is required.' },
    });
  }

  const patientId = req.body.patient_id;
  if (!patientId) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'patient_id is required.' },
    });
  }

  try {
    const isAuthorized = await verifyPatientAccess(req, patientId, 'full_view');
    if (!isAuthorized) {
      fs.unlinkSync(req.file.path);
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied. Unauthorized resource access.' },
      });
    }

    // Retrieve patient's existing visits to pass to auto-linker context
    const visitsResult = await query(
      'SELECT id, scheduled_date, doctor_name, specialty, disease_type FROM visits WHERE patient_id = $1',
      [patientId]
    );

    // Compute SHA-256 hash of file content for idempotency check (Step 10)
    const crypto = require('crypto');
    const fileBuffer = fs.readFileSync(req.file.path);
    const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    const idempotencyKey = `idempotency:file:${fileHash}`;

    const redisConnection = require('../config/redis');
    try {
      const cachedJobId = await redisConnection.get(idempotencyKey);
      if (cachedJobId) {
        logger.info('IDEMPOTENT_UPLOAD_HIT', `Duplicate upload detected. Mapping to existing job ${cachedJobId}`);
        fs.unlinkSync(req.file.path);
        return res.status(202).json({
          success: true,
          data: {
            jobId: cachedJobId,
            message: 'Lab report analysis job already queued.',
          },
        });
      }
    } catch (err) {
      logger.warn('IDEMPOTENCY_CHECK_FAILED', `Failed to check idempotency key in Redis: ${err.message}`);
    }

    logger.info('QUEUE_EXTRACTION_JOB', `Enqueuing lab report extraction job for patient ${patientId}`);

    // Generate traceparent context (Step 11)
    const traceId = crypto.randomBytes(16).toString('hex');
    const spanId = crypto.randomBytes(8).toString('hex');
    const traceparent = `00-${traceId}-${spanId}-01`;

    // Push extraction job to BullMQ
    const job = await extractionQueue.add('extract', {
      type: 'lab_report',
      filePath: req.file.path,
      fileName: req.file.originalname || req.file.filename,
      patientId,
      visitsContext: visitsResult.rows,
      _traceparent: traceparent,
    });

    try {
      await redisConnection.setex(idempotencyKey, 3600, job.id); // Cache idempotency for 1 hour
    } catch (err) {
      logger.warn('IDEMPOTENCY_SET_FAILED', `Failed to set idempotency key in Redis: ${err.message}`);
    }

    res.status(202).json({
      success: true,
      data: {
        jobId: job.id,
        message: 'Lab report analysis job queued.',
      },
    });

  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    logger.error('LAB_REPORT_UPLOAD_ERROR', `Error processing lab report upload: ${err.message}`);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to enqueue extraction job.',
        details: [err.message],
      },
    });
  }
});

/**
 * POST /api/lab-reports/confirm
 * Submit verified/corrected lab values and link them to visits.
 */
router.post('/lab-reports/confirm', authenticateUser, enforceConsent('health_data_processing'), enforceEmailVerified, sanitizeInput, async (req, res, next) => {
  const { patient_id, source_photo_id, values, visit_id, disease_type } = req.body;

  if (!patient_id || !values || !Array.isArray(values)) {
    return res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'patient_id and values array are required.' },
    });
  }

  try {
    const isAuthorized = await verifyPatientAccess(req, patient_id, 'full_view');
    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied. Unauthorized resource access.' },
      });
    }

    const client = await require('../config/db').pool.connect();
    try {
      await client.query('BEGIN');

      // 1. If visit is linked and disease_type is provided, save it on visits (Component 3)
      if (visit_id && disease_type) {
        await client.query(
          'UPDATE visits SET disease_type = $1 WHERE id = $2 AND patient_id = $3',
          [disease_type, visit_id, patient_id]
        );
      }

      // 2. Insert into lab_reports
      const reportRes = await client.query(
        `INSERT INTO lab_reports (patient_id, visit_id, source_photo_id, uploaded_at) 
         VALUES ($1, $2, $3, $4) 
         RETURNING id`,
        [patient_id, visit_id || null, source_photo_id || null, values[0]?.recorded_at ? new Date(values[0].recorded_at) : new Date()]
      );
      const reportId = reportRes.rows[0].id;

      // 3. For each value, normalize canonical type, check trend, and save
      for (const val of values) {
        const canonicalType = await getCanonicalTestType(val.test_type);
        
        // Retrieve historical values for this specific canonical type
        const historyRes = await client.query(
          `SELECT lv.value, lv.recorded_at 
           FROM lab_values lv
           JOIN lab_reports lr ON lv.report_id = lr.id
           WHERE lr.patient_id = $1 AND lv.test_type = $2 AND lv.resolution_status = 'resolved'
           ORDER BY lv.recorded_at DESC LIMIT 5`,
          [patient_id, canonicalType]
        );

        const trendResult = calculateTrend(canonicalType, val.value, historyRes.rows);
        if (trendResult.isMeaningfulChange) {
          logger.audit('LAB_TREND_FLAGGED', `Significant change in ${canonicalType} for patient ${patient_id}: ${trendResult.message}`);
        }

        // Save value
        await client.query(
          `INSERT INTO lab_values (report_id, test_type, panel_name, value, unit, resolution_status, confidence, recorded_at)
           VALUES ($1, $2, $3, $4, $5, 'resolved', $6, $7)`,
          [reportId, canonicalType, val.panel_name || null, val.value, val.unit || '', val.confidence || 1.0, val.recorded_at ? new Date(val.recorded_at) : new Date()]
        );
      }

      await client.query('COMMIT');

      logger.audit('LAB_REPORT_CONFIRMED', `User ${req.user.id} confirmed lab report ${reportId} for patient ${patient_id}`, {
        userId: req.user.id,
        patientId: patient_id,
        reportId,
      });

      res.status(201).json({
        success: true,
        data: {
          report_id: reportId,
          message: 'Lab report values saved and normalized successfully.',
        },
      });

    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

  } catch (err) {
    logger.error('LAB_REPORT_CONFIRM_ERROR', `Error confirming lab report: ${err.message}`);
    next(err);
  }
});

module.exports = router;
