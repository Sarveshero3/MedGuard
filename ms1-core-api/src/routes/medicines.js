const express = require('express');
const axios = require('axios');
const fs = require('fs');
const { query } = require('../config/db');
const logger = require('../utils/logger');
const { authenticateUser, enforcePatientAccess, verifyPatientAccess, enforceEmailVerified } = require('../middleware/auth');
const { sanitizeInput, validateBody, validateUUID, upload } = require('../middleware/security');
const { enforceConsent } = require('../middleware/consent');
const { uploadLimiter } = require('../middleware/rateLimiter');
const { extractionQueue } = require('../services/queueService');
const brandResolutionService = require('../services/brandResolutionService');

const router = express.Router();

/**
 * Parses duration_text and computes course_end_date.
 * E.g., "5 days" -> added_at + 5 days
 */
function computeCourseEndDate(addedAt, duration_value, duration_unit, is_lifetime) {
  if (is_lifetime) {
    return null; // Lifetime medicine has no course end date
  }

  const startDate = new Date(addedAt);
  
  if (duration_value === null || duration_value === undefined) {
    return null;
  }
  
  const val = parseInt(duration_value, 10);
  if (isNaN(val) || val <= 0) return null;
  
  const unit = (duration_unit || 'day').toLowerCase().trim();
  if (unit.startsWith('day')) {
    startDate.setDate(startDate.getDate() + val);
  } else if (unit.startsWith('week')) {
    startDate.setDate(startDate.getDate() + val * 7);
  } else if (unit.startsWith('month')) {
    startDate.setMonth(startDate.getMonth() + val);
  } else if (unit.startsWith('year')) {
    startDate.setFullYear(startDate.getFullYear() + val);
  } else {
    return null;
  }
  
  return startDate;
}
const MS2_BASE_URL = process.env.MS2_BASE_URL || 'http://ms2-agent-service:8000';

/**
 * GET /api/medicines
 * Retrieve medicines list for a patient.
 * Secured against IDOR via enforcePatientAccess('full_view').
 */
router.get('/medicines', authenticateUser, enforcePatientAccess('full_view'), enforceConsent('health_data_processing'), async (req, res, next) => {
  const patientId = req.query.patient_id;

  try {
    const result = await query(
      'SELECT id, brand_name, generic_name, dosage, frequency, source_photo_id, resolution_status, status, added_at, duration_text, course_end_date, duration_value, duration_unit, is_lifetime FROM medicines WHERE patient_id = $1 ORDER BY added_at DESC',
      [patientId]
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (err) {
    logger.error('MEDICINE_FETCH_ERROR', `Error fetching medicines for patient ${patientId}: ${err.message}`);
    next(err);
  }
});

/**
 * GET /api/medicines/:id
 * Retrieve details for a specific medicine.
 * Secured against IDOR: checks medicine ownership.
 */
router.get('/medicines/:id', authenticateUser, validateUUID('id'), enforceConsent('health_data_processing'), async (req, res, next) => {
  const medicineId = req.params.id;

  try {
    const medResult = await query('SELECT * FROM medicines WHERE id = $1', [medicineId]);
    if (medResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Medicine not found.' },
      });
    }

    const medicine = medResult.rows[0];
    const isAuthorized = await verifyPatientAccess(req, medicine.patient_id, 'full_view');
    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied. Unauthorized resource access.' },
      });
    }

    res.json({
      success: true,
      data: medicine,
    });
  } catch (err) {
    logger.error('MEDICINE_FETCH_DETAIL_ERROR', `Error fetching medicine ${medicineId}: ${err.message}`);
    next(err);
  }
});

/**
 * POST /api/medicines
 * Manually add a medicine record.
 * Secured: enforce patient access and validate payload.
 */
router.post('/medicines', authenticateUser, enforcePatientAccess('full_view'), enforceConsent('health_data_processing'), enforceEmailVerified, sanitizeInput, validateBody('medicine'), async (req, res, next) => {
  const { 
    patient_id, 
    brand_name, 
    generic_name, 
    dosage, 
    frequency, 
    duration_text, 
    duration_value, 
    duration_unit, 
    is_lifetime, 
    brand_mapping_correction, 
    resolution_status, 
    visit_id, 
    added_at 
  } = req.body;

  try {
    const client = await require('../config/db').pool.connect();
    try {
      await client.query('BEGIN');

      // If user submitted a correction to brand generic map during follow-up, write it append-only
      if (brand_mapping_correction) {
        const { brand_name: correctedBrand, generic_name: correctedGeneric, is_correction } = brand_mapping_correction;
        await brandResolutionService.saveCorrection({
          brandName: correctedBrand,
          genericName: correctedGeneric,
          resolutionSource: is_correction ? 'user_correction' : 'user_confirmed',
          client
        });
      }

      // Server-side validation of duration_value (clean positive integer check)
      let cleanDurationValue = null;
      if (duration_value !== undefined && duration_value !== null && duration_value !== '') {
        const parsed = Number(duration_value);
        if (Number.isInteger(parsed) && parsed > 0) {
          cleanDurationValue = parsed;
        }
      }
      
      const cleanIsLifetime = !!is_lifetime;
      const cleanDurationUnit = duration_unit || null;

      // Compute course_end_date using calendar-correct logic
      const addedDate = added_at ? new Date(added_at) : new Date();
      const courseEndDate = computeCourseEndDate(addedDate, cleanDurationValue, cleanDurationUnit, cleanIsLifetime);

      // Deterministic fallback: if generic_name wasn't extracted, look it up in brand_generic_map (Phase 5 Architectural Rule)
      let fallbackGeneric = generic_name;
      if (!fallbackGeneric && brand_name) {
        const cacheRow = await brandResolutionService.queryCache(brand_name);
        if (cacheRow && cacheRow.resolution_status === 'resolved') {
          fallbackGeneric = cacheRow.generic_name;
        }
      }

      const resolvedGeneric = fallbackGeneric || (brand_mapping_correction && brand_mapping_correction.generic_name) || null;
      let finalResolutionStatus = resolvedGeneric ? 'resolved' : 'generic_unresolved';
      if (resolution_status) {
        finalResolutionStatus = resolution_status;
      }

      // Lock existing active medicines for this patient to prevent concurrent races
      const existingMedsRes = await client.query(
        "SELECT id, generic_name FROM medicines WHERE patient_id = $1 AND status = 'active' FOR UPDATE",
        [patient_id]
      );
      const existingMeds = existingMedsRes.rows;
      const existingGenerics = existingMeds.map(m => m.generic_name).filter(Boolean);

      // Save the medicine
      const result = await client.query(
        `INSERT INTO medicines (patient_id, brand_name, generic_name, dosage, frequency, duration_text, course_end_date, resolution_status, status, visit_id, added_at, duration_value, duration_unit, is_lifetime)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', $9, $10, $11, $12, $13)
         RETURNING *`,
        [patient_id, brand_name, resolvedGeneric, dosage, frequency, duration_text || null, courseEndDate, finalResolutionStatus, visit_id || null, addedDate, cleanDurationValue, cleanDurationUnit, cleanIsLifetime]
      );
      const newMed = result.rows[0];

      // Process interactions (RAG + db flags)
      const { processInteractions } = require('../services/interactionService');
      const flaggedInteractions = await processInteractions(patient_id, newMed, resolvedGeneric, existingMeds, client);

      await client.query('COMMIT');

      // === Side effects run AFTER successful COMMIT ===
      // Send alert emails outside the transaction
      if (flaggedInteractions.length > 0) {
        const { sendEmail } = require('../utils/email');
        const { buildInteractionAlertEmail } = require('../templates/interactionAlertEmail');
        
        const patientEmailRes = await query("SELECT email, name FROM users WHERE id = $1", [patient_id]);
        const patient = patientEmailRes.rows[0];

        const caregiversRes = await query(
          `SELECT u.email, u.name FROM caregiver_links cl
           JOIN users u ON cl.caregiver_id = u.id
           WHERE cl.patient_id = $1 AND cl.status = 'active'`,
          [patient_id]
        );
        const caregivers = caregiversRes.rows;

        const { subject, body } = buildInteractionAlertEmail(newMed, resolvedGeneric, flaggedInteractions);

        if (patient) {
          await sendEmail({ to: patient.email, subject, body });
        }
        for (const cg of caregivers) {
          await sendEmail({ to: cg.email, subject, body });
        }
      }

      logger.audit('MEDICINE_CREATED', `User ${req.user.id} manually created medicine ${newMed.id} for patient ${patient_id}`, {
        userId: req.user.id,
        patientId: patient_id,
        medicineId: newMed.id,
      });

      res.status(201).json({
        success: true,
        data: newMed,
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    logger.error('MEDICINE_CREATE_ERROR', `Error creating medicine: ${err.message}`);
    next(err);
  }
});

/**
 * PUT /api/medicines/:id
 * Modify / update medicine details (e.g. status discontinued).
 * Secured: verify ownership of the medicine before updating.
 */
router.put('/medicines/:id', authenticateUser, validateUUID('id'), enforceConsent('health_data_processing'), enforceEmailVerified, sanitizeInput, async (req, res, next) => {
  const medicineId = req.params.id;
  const { dosage, frequency, status, duration_text } = req.body;

  try {
    const medResult = await query('SELECT patient_id, added_at FROM medicines WHERE id = $1', [medicineId]);
    if (medResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Medicine not found.' },
      });
    }

    const { patient_id: patientId, added_at: addedAt } = medResult.rows[0];
    const isAuthorized = await verifyPatientAccess(req, patientId, 'full_view');
    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied. Unauthorized resource access.' },
      });
    }

    // Dynamic field update (parameterized)
    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (dosage !== undefined) {
      updates.push(`dosage = $${paramIndex++}`);
      params.push(dosage);
    }
    if (frequency !== undefined) {
      updates.push(`frequency = $${paramIndex++}`);
      params.push(frequency);
    }
    if (status !== undefined) {
      const allowedStatuses = ['active', 'discontinued'];
      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid medicine status' },
        });
      }
      updates.push(`status = $${paramIndex++}`);
      params.push(status);
    }
    if (duration_text !== undefined) {
      updates.push(`duration_text = $${paramIndex++}`);
      params.push(duration_text || null);

      // Recompute course_end_date
      const courseEndDate = duration_text ? computeCourseEndDate(addedAt, duration_text) : null;
      updates.push(`course_end_date = $${paramIndex++}`);
      params.push(courseEndDate);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'No fields provided for update.' },
      });
    }

    params.push(medicineId);
    const updateQuery = `
      UPDATE medicines 
      SET ${updates.join(', ')} 
      WHERE id = $${paramIndex} 
      RETURNING *
    `;

    const result = await query(updateQuery, params);
    const updatedMed = result.rows[0];

    logger.audit('MEDICINE_UPDATED', `User ${req.user.id} updated medicine ${medicineId}`, {
      userId: req.user.id,
      medicineId,
    });

    res.json({
      success: true,
      data: updatedMed,
    });

  } catch (err) {
    logger.error('MEDICINE_UPDATE_ERROR', `Error updating medicine ${medicineId}: ${err.message}`);
    next(err);
  }
});

/**
 * DELETE /api/medicines/:id
 * Delete medicine record.
 * Secured: verify ownership of the medicine before deleting.
 */
router.delete('/medicines/:id', authenticateUser, validateUUID('id'), enforceConsent('health_data_processing'), enforceEmailVerified, async (req, res, next) => {
  const medicineId = req.params.id;

  try {
    const medResult = await query('SELECT patient_id FROM medicines WHERE id = $1', [medicineId]);
    if (medResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Medicine not found.' },
      });
    }

    const patientId = medResult.rows[0].patient_id;
    const isAuthorized = await verifyPatientAccess(req, patientId, 'full_view');
    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied. Unauthorized resource access.' },
      });
    }

    await query('DELETE FROM medicines WHERE id = $1', [medicineId]);

    logger.audit('MEDICINE_DELETED', `User ${req.user.id} deleted medicine ${medicineId} for patient ${patientId}`, {
      userId: req.user.id,
      patientId,
      medicineId,
    });

    res.json({
      success: true,
      data: {
        message: 'Medicine deleted successfully.',
      },
    });

  } catch (err) {
    logger.error('MEDICINE_DELETE_ERROR', `Error deleting medicine ${medicineId}: ${err.message}`);
    next(err);
  }
});

/**
 * POST /api/documents/upload
 * Unified document upload endpoint. Accepts any image/PDF, hashes it,
 * checks Redis for idempotency, and queues it with job type 'auto'.
 */
router.post('/documents/upload', authenticateUser, enforceConsent('health_data_processing'), enforceEmailVerified, uploadLimiter, upload.single('photo'), async (req, res, _next) => {
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

    const visitsResult = await query(
      'SELECT id, scheduled_date, doctor_name, specialty, disease_type FROM visits WHERE patient_id = $1',
      [patientId]
    );

    const crypto = require('crypto');
    const fileBuffer = fs.readFileSync(req.file.path);
    const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    const idempotencyKey = `idempotency:file:${fileHash}`;

    const redisConnection = require('../config/redis');
    try {
      const cachedJobId = await redisConnection.get(idempotencyKey);
      if (cachedJobId) {
        let shouldReuse = true;
        try {
          if (!redisConnection.isMock && extractionQueue && typeof extractionQueue.getJob === 'function') {
            const job = await extractionQueue.getJob(cachedJobId);
            if (job) {
              const state = await job.getState();
              if (state === 'failed') {
                shouldReuse = false;
                logger.info('IDEMPOTENT_UPLOAD_RETRY', `Cached job ${cachedJobId} was failed. Enqueuing a new job.`);
              }
            } else {
              shouldReuse = false;
            }
          }
        } catch (err) {
          logger.warn('JOB_STATE_CHECK_FAILED', `Failed to check job state: ${err.message}`);
        }

        if (shouldReuse) {
          logger.info('IDEMPOTENT_UPLOAD_HIT', `Duplicate upload detected. Mapping to existing job ${cachedJobId}`);
          fs.unlinkSync(req.file.path);
          return res.status(202).json({
            success: true,
            data: {
              jobId: cachedJobId,
              message: 'Document analysis job already queued.',
            },
          });
        }
      }
    } catch (err) {
      logger.warn('IDEMPOTENCY_CHECK_FAILED', `Failed to check idempotency key in Redis: ${err.message}`);
    }

    logger.info('QUEUE_EXTRACTION_JOB', `Enqueuing document auto-extraction job for patient ${patientId}`);

    const traceId = crypto.randomBytes(16).toString('hex');
    const spanId = crypto.randomBytes(8).toString('hex');
    const traceparent = `00-${traceId}-${spanId}-01`;

    const job = await extractionQueue.add('extract', {
      type: 'auto',
      filePath: req.file.path,
      fileName: req.file.originalname || req.file.filename,
      patientId,
      visitsContext: visitsResult.rows,
      _traceparent: traceparent,
    });

    try {
      await redisConnection.setex(idempotencyKey, 3600, job.id);
    } catch (err) {
      logger.warn('IDEMPOTENCY_SET_FAILED', `Failed to set idempotency key in Redis: ${err.message}`);
    }

    res.status(202).json({
      success: true,
      data: {
        jobId: job.id,
        message: 'Document analysis job queued.',
      },
    });

  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    logger.error('DOCUMENT_UPLOAD_ERROR', `Error processing document upload: ${err.message}`);
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

router.post('/medicines/upload', authenticateUser, enforceConsent('health_data_processing'), enforceEmailVerified, uploadLimiter, upload.single('photo'), async (req, res, _next) => {
  // Multer runs first and populates req.file and req.body.patient_id.
  // Validate file exists.
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'photo field containing JPG/PNG/PDF is required.' },
    });
  }

  const patientId = req.body.patient_id;
  if (!patientId) {
    // Cleanup physical file on upload failure
    fs.unlinkSync(req.file.path);
    return res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'patient_id is required.' },
    });
  }

  try {
    // Validate patient_id access before processing
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
            message: 'Prescription analysis job already queued.',
          },
        });
      }
    } catch (err) {
      logger.warn('IDEMPOTENCY_CHECK_FAILED', `Failed to check idempotency key in Redis: ${err.message}`);
    }

    logger.info('QUEUE_EXTRACTION_JOB', `Enqueuing prescription extraction job for patient ${patientId}`);

    // Generate traceparent context (Step 11)
    const traceId = crypto.randomBytes(16).toString('hex');
    const spanId = crypto.randomBytes(8).toString('hex');
    const traceparent = `00-${traceId}-${spanId}-01`;

    // Push extraction job to BullMQ
    const job = await extractionQueue.add('extract', {
      type: 'prescription',
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
        message: 'Prescription analysis job queued.',
      },
    });

  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    logger.error('MEDICINE_UPLOAD_ERROR', `Error enqueuing prescription upload: ${err.message}`);
    
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
 * POST /api/medicines/batch
 * Add multiple medicines from a prescription in a single transaction.
 */
router.post('/medicines/batch', authenticateUser, enforcePatientAccess('full_view'), enforceConsent('health_data_processing'), enforceEmailVerified, sanitizeInput, async (req, res, next) => {
  const { patient_id, medicines, visit_id } = req.body;

  if (!patient_id) {
    return res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'patient_id is required.' },
    });
  }

  if (!Array.isArray(medicines) || medicines.length === 0) {
    return res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'medicines must be a non-empty array.' },
    });
  }

  try {
    const client = await require('../config/db').pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Lock existing active medicines for this patient to prevent concurrent races
      const existingMedsRes = await client.query(
        "SELECT id, generic_name FROM medicines WHERE patient_id = $1 AND status = 'active' FOR UPDATE",
        [patient_id]
      );
      const existingMeds = existingMedsRes.rows;
      const existingGenerics = existingMeds.map(m => m.generic_name).filter(Boolean);

      const savedMedicines = [];
      const allFlaggedInteractions = [];

      for (const med of medicines) {
        const { 
          brand_name, 
          generic_name, 
          dosage, 
          frequency, 
          duration_text, 
          duration_value, 
          duration_unit, 
          is_lifetime, 
          brand_mapping_correction, 
          resolution_status, 
          added_at, 
          source_photo_id 
        } = med;

        // If user submitted a correction to brand generic map
        if (brand_mapping_correction) {
          const { brand_name: correctedBrand, generic_name: correctedGeneric, is_correction } = brand_mapping_correction;
          await brandResolutionService.saveCorrection({
            brandName: correctedBrand,
            genericName: correctedGeneric,
            resolutionSource: is_correction ? 'user_correction' : 'user_confirmed',
            client
          });
        }

        // Server-side validation of duration_value (clean positive integer check)
        let cleanDurationValue = null;
        if (duration_value !== undefined && duration_value !== null && duration_value !== '') {
          const parsed = Number(duration_value);
          if (Number.isInteger(parsed) && parsed > 0) {
            cleanDurationValue = parsed;
          }
        }
        
        const cleanIsLifetime = !!is_lifetime;
        const cleanDurationUnit = duration_unit || null;

        // Compute course_end_date using calendar-correct logic
        const addedDate = added_at ? new Date(added_at) : new Date();
        const courseEndDate = computeCourseEndDate(addedDate, cleanDurationValue, cleanDurationUnit, cleanIsLifetime);

        // Deterministic fallback: if generic_name wasn't extracted, look it up in brand_generic_map (Phase 5 Architectural Rule)
        let fallbackGeneric = generic_name;
        if (!fallbackGeneric && brand_name) {
          const cacheRow = await brandResolutionService.queryCache(brand_name);
          if (cacheRow && cacheRow.resolution_status === 'resolved') {
            fallbackGeneric = cacheRow.generic_name;
          }
        }

        const resolvedGeneric = fallbackGeneric || (brand_mapping_correction && brand_mapping_correction.generic_name) || null;
        let finalResolutionStatus = resolvedGeneric ? 'resolved' : 'generic_unresolved';
        if (resolution_status) {
          finalResolutionStatus = resolution_status;
        }

        // Diagnostic log to verify parameter counts
        const queryParams = [
          patient_id,
          brand_name,
          resolvedGeneric,
          dosage,
          frequency,
          duration_text || null,
          courseEndDate,
          finalResolutionStatus,
          visit_id || null,
          addedDate,
          source_photo_id || null,
          cleanDurationValue,
          cleanDurationUnit,
          cleanIsLifetime
        ];
        console.log(`[SQL DIAGNOSTIC] Placeholder count: 14, Parameter array length: ${queryParams.length}`);
        
        // Save the medicine
        const result = await client.query(
          `INSERT INTO medicines (patient_id, brand_name, generic_name, dosage, frequency, duration_text, course_end_date, resolution_status, status, visit_id, added_at, source_photo_id, duration_value, duration_unit, is_lifetime)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', $9, $10, $11, $12, $13, $14)
           RETURNING *`,
          queryParams
        );
        const newMed = result.rows[0];
        savedMedicines.push(newMed);

        // Perform interaction check with existing generics + newly added generics in this batch
        const currentActiveGenerics = [...existingGenerics, ...savedMedicines.filter(m => m.id !== newMed.id).map(m => m.generic_name).filter(Boolean)];
        let flaggedInteractions = [];
        if (resolvedGeneric && currentActiveGenerics.length > 0) {
          const { checkInteractions } = require('../utils/interactionEngine');
          flaggedInteractions = await checkInteractions(resolvedGeneric, currentActiveGenerics);
        }

        // Save flagged interactions
        if (flaggedInteractions.length > 0) {
          for (const interaction of flaggedInteractions) {
            const existingGenName = [interaction.generic_a.toLowerCase(), interaction.generic_b.toLowerCase()]
              .find(g => g !== resolvedGeneric.toLowerCase());

            const conflictingMed = existingMeds.find(m => m.generic_name && m.generic_name.toLowerCase() === existingGenName) ||
                                   savedMedicines.find(m => m.generic_name && m.generic_name.toLowerCase() === existingGenName);

            if (conflictingMed) {
              await client.query(
                `INSERT INTO interaction_flags (patient_id, new_medicine_id, existing_medicine_id, kb_entry_id, severity, confidence, status)
                 VALUES ($1, $2, $3, $4, $5, 1.0, 'shown')`,
                [patient_id, newMed.id, conflictingMed.id, interaction.id, interaction.severity]
              );
              allFlaggedInteractions.push(interaction);
            }
          }
        }
      }

      await client.query('COMMIT');

      // Trigger background research loops for each resolved new medicine
      for (const newMed of savedMedicines) {
        if (newMed.generic_name) {
          (async () => {
            const { pool } = require('../config/db');
            let bgClient;
            try {
              bgClient = await pool.connect();
              const otherMeds = [...existingMeds, ...savedMedicines.filter(m => m.id !== newMed.id)];
              for (const conflictingMed of otherMeds) {
                if (!conflictingMed.generic_name) continue;
                if (conflictingMed.generic_name.toLowerCase() === newMed.generic_name.toLowerCase()) continue;

                // Check if already flagged in DB or transaction
                const alreadyFlagged = allFlaggedInteractions.some(f => 
                  (f.generic_a.toLowerCase() === newMed.generic_name.toLowerCase() && f.generic_b.toLowerCase() === conflictingMed.generic_name.toLowerCase()) ||
                  (f.generic_b.toLowerCase() === newMed.generic_name.toLowerCase() && f.generic_a.toLowerCase() === conflictingMed.generic_name.toLowerCase())
                );
                
                if (!alreadyFlagged) {
                  try {
                    logger.info('AGENT_RESEARCH_TRIGGER_BG', `Triggering background LLM research agent for ${newMed.generic_name} and ${conflictingMed.generic_name}`);
                    const ms2Res = await axios.post(`${MS2_BASE_URL}/api/research-interaction`, {
                      generic_a: newMed.generic_name,
                      generic_b: conflictingMed.generic_name
                    }, { timeout: 45000 });
                    
                    if (ms2Res.data && ms2Res.data.success) {
                      const researchResult = ms2Res.data.data;
                      const explanation = researchResult.explanation || '';
                      const lowercaseExp = explanation.toLowerCase();
                      const isNoInteraction = lowercaseExp.includes("no significant interaction") || 
                                              lowercaseExp.includes("no known interaction") || 
                                              (lowercaseExp.includes("no interaction") && lowercaseExp.includes("safe"));
                      
                      if (explanation && !isNoInteraction) {
                        const sorted = [newMed.generic_name.toLowerCase(), conflictingMed.generic_name.toLowerCase()].sort();
                        const kbRes = await bgClient.query(
                          `INSERT INTO interaction_kb (generic_a, generic_b, severity, explanation, source, version)
                           VALUES ($1, $2, 'monitor_closely', $3, 'Groq Research Agent', 'v1')
                           RETURNING id`,
                          [sorted[0], sorted[1], explanation]
                        );
                        const kbEntryId = kbRes.rows[0].id;
                        
                        await bgClient.query(
                          `INSERT INTO interaction_flags (patient_id, new_medicine_id, existing_medicine_id, kb_entry_id, severity, confidence, status)
                           VALUES ($1, $2, $3, $4, 'monitor_closely', 1.0, 'shown')`,
                          [patient_id, newMed.id, conflictingMed.id, kbEntryId]
                        );
                        logger.info('AGENT_ALERT_CREATED_BG', `Researched and created custom interaction flag in background for ${newMed.generic_name} and ${conflictingMed.generic_name}`);
                      }
                    }
                  } catch (agentErr) {
                    logger.error('AGENT_RESEARCH_FAILED_BG', `Background research failed: ${agentErr.message}`);
                  }
                }
              }
            } catch (connErr) {
              logger.error('BG_DB_CONNECTION_FAILED', `Failed to open connection for background research: ${connErr.message}`);
            } finally {
              if (bgClient) bgClient.release();
            }
          })();
        }
      }

      // Send alert emails outside the transaction if interactions were flagged
      if (allFlaggedInteractions.length > 0) {
        const { sendEmail } = require('../utils/email');
        const patientEmailRes = await query("SELECT email, name FROM users WHERE id = $1", [patient_id]);
        const patient = patientEmailRes.rows[0];

        const caregiversRes = await query(
          `SELECT u.email, u.name FROM caregiver_links cl
           JOIN users u ON cl.caregiver_id = u.id
           WHERE cl.patient_id = $1 AND cl.status = 'active'`,
          [patient_id]
        );
        const caregivers = caregiversRes.rows;

        const alertSubject = `🛡️ MedGuard Safety Alert: Drug Interaction Flagged`;
        const alertBody = `Hello,

A drug interaction has been flagged in your MedGuard profile.

Details of interactions:
${allFlaggedInteractions.map(i => `  * Conflicting drugs: ${i.generic_a} & ${i.generic_b} (Severity: ${i.severity.replace('_', ' ').toUpperCase()})\n    Explanation: ${i.explanation}`).join('\n')}

Please review your dashboard and discuss these details with your doctor.

Best,
The MedGuard Team`;

        if (patient) {
          await sendEmail({ to: patient.email, subject: alertSubject, body: alertBody });
        }
        for (const cg of caregivers) {
          await sendEmail({ to: cg.email, subject: alertSubject, body: alertBody });
        }
      }

      // Audit logs
      for (const newMed of savedMedicines) {
        logger.audit('MEDICINE_CREATED', `User ${req.user.id} manually created medicine ${newMed.id} for patient ${patient_id}`, {
          userId: req.user.id,
          patientId: patient_id,
          medicineId: newMed.id,
        });
      }

      res.status(201).json({
        success: true,
        data: {
          medicines: savedMedicines,
          interactions: allFlaggedInteractions
        }
      });

    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    logger.error('MEDICINE_BATCH_ERROR', `Error saving medicine batch: ${err.message}`);
    next(err);
  }
});

router.get('/check-interaction', async (req, res, next) => {
  try {
    const { generic_a, generic_b } = req.query;
    if (!generic_a || !generic_b) {
      return res.status(400).json({
        success: false,
        error: 'Both generic_a and generic_b query parameters are required.'
      });
    }
    const genA = generic_a.trim().toLowerCase();
    const genB = generic_b.trim().toLowerCase();
    const sorted = [genA, genB].sort();
    
    const dbRes = await query(
      `SELECT id, generic_a, generic_b, severity, explanation, version 
       FROM interaction_kb 
       WHERE (LOWER(generic_a) = $1 AND LOWER(generic_b) = $2)
       ORDER BY effective_date DESC LIMIT 1`,
      [sorted[0], sorted[1]]
    );
    res.json({
      success: true,
      exists: dbRes.rows.length > 0,
      interaction: dbRes.rows[0] || null
    });
  } catch (err) {
    next(err);
  }
});

router.post('/medicines/resolve-brand', authenticateUser, sanitizeInput, async (req, res, next) => {
  try {
    const { brand_name } = req.body;
    if (!brand_name) {
      return res.status(400).json({ success: false, error: 'brand_name is required.' });
    }

    const result = await brandResolutionService.resolveBrand(brand_name);
    return res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/medicines/batch-delete
 * Deletes multiple medicines in a single transaction.
 */
router.post('/medicines/batch-delete', authenticateUser, enforcePatientAccess('full_view'), async (req, res, next) => {
  const { ids, patient_id } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'ids must be a non-empty array.' },
    });
  }

  try {
    const client = await require('../config/db').pool.connect();
    try {
      await client.query('BEGIN');

      // Delete the medicines (Postgres handles FK cascades for adherence_logs and interaction_flags automatically)
      const result = await client.query(
        `DELETE FROM medicines WHERE id = ANY($1) AND patient_id = $2 RETURNING *`,
        [ids, patient_id]
      );

      await client.query('COMMIT');

      logger.audit('MEDICINES_BATCH_DELETED', `Deleted ${result.rowCount} medicines for patient ${patient_id}`, {
        patientId: patient_id,
        deletedCount: result.rowCount,
      });

      res.json({
        success: true,
        message: `Successfully deleted ${result.rowCount} medicines.`,
        data: result.rows,
      });
    } catch (dbErr) {
      await client.query('ROLLBACK');
      throw dbErr;
    } finally {
      client.release();
    }
  } catch (err) {
    logger.error('BATCH_DELETE_MEDICINES_FAILED', `Failed to batch delete medicines: ${err.message}`);
    next(err);
  }
});

module.exports = router;
