const express = require('express');
const axios = require('axios');
const fs = require('fs');
const { query } = require('../config/db');
const logger = require('../utils/logger');
const { authenticateUser, enforcePatientAccess, verifyPatientAccess, enforceEmailVerified } = require('../middleware/auth');
const { sanitizeInput, validateBody, validateUUID, upload } = require('../middleware/security');
const { enforceConsent } = require('../middleware/consent');
const { uploadLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

/**
 * Parses duration_text and computes course_end_date.
 * E.g., "5 days" -> added_at + 5 days
 */
function computeCourseEndDate(addedAt, durationText) {
  if (!durationText) return null;
  const cleaned = durationText.trim().toLowerCase();
  if (cleaned === 'ongoing' || cleaned === 'unresolved' || cleaned === '') return null;

  const match = cleaned.match(/^(\d+)\s+(day|days|week|weeks|month|months|year|years)$/);
  if (!match) return null;

  const quantity = parseInt(match[1], 10);
  const unit = match[2];

  const date = new Date(addedAt);
  if (unit.startsWith('day')) {
    date.setDate(date.getDate() + quantity);
  } else if (unit.startsWith('week')) {
    date.setDate(date.getDate() + quantity * 7);
  } else if (unit.startsWith('month')) {
    date.setMonth(date.getMonth() + quantity);
  } else if (unit.startsWith('year')) {
    date.setFullYear(date.getFullYear() + quantity);
  } else {
    return null;
  }
  return date;
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
      'SELECT id, brand_name, generic_name, dosage, frequency, source_photo_id, resolution_status, status, added_at FROM medicines WHERE patient_id = $1 ORDER BY added_at DESC',
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
  const { patient_id, brand_name, generic_name, dosage, frequency, duration_text, brand_mapping_correction, resolution_status } = req.body;

  try {
    const client = await require('../config/db').pool.connect();
    try {
      await client.query('BEGIN');

      // If user submitted a correction to brand generic map during follow-up, write it append-only
      if (brand_mapping_correction) {
        const { brand_name: correctedBrand, generic_name: correctedGeneric } = brand_mapping_correction;
        const versionResult = await client.query(
          'SELECT version FROM brand_generic_map WHERE brand_name = $1 ORDER BY effective_date DESC LIMIT 1',
          [correctedBrand]
        );
        let nextVersion = 'v1';
        if (versionResult.rows.length > 0) {
          const currentVersion = versionResult.rows[0].version;
          const currentNum = parseInt(currentVersion.replace('v', ''), 10) || 1;
          nextVersion = `v${currentNum + 1}`;
        }
        await client.query(
          `INSERT INTO brand_generic_map (brand_name, generic_name, source, version, effective_date)
           VALUES ($1, $2, 'user_confirmed', $3, NOW())
           ON CONFLICT (brand_name, version) DO NOTHING`,
          [correctedBrand, correctedGeneric, nextVersion]
        );
      }

      // Compute course_end_date if duration_text is provided
      let courseEndDate = null;
      if (duration_text) {
        courseEndDate = computeCourseEndDate(new Date(), duration_text);
      }

      const resolvedGeneric = generic_name || (brand_mapping_correction && brand_mapping_correction.generic_name) || null;
      let finalResolutionStatus = resolvedGeneric ? 'resolved' : 'generic_unresolved';
      if (resolution_status) {
        finalResolutionStatus = resolution_status;
      }

      // Find existing active medicines for this patient to check interactions
      const existingMedsRes = await client.query(
        "SELECT id, generic_name FROM medicines WHERE patient_id = $1 AND status = 'active'",
        [patient_id]
      );
      const existingMeds = existingMedsRes.rows;
      const existingGenerics = existingMeds.map(m => m.generic_name).filter(Boolean);

      // Save the medicine
      const result = await client.query(
        `INSERT INTO medicines (patient_id, brand_name, generic_name, dosage, frequency, duration_text, course_end_date, resolution_status, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active')
         RETURNING *`,
        [patient_id, brand_name, resolvedGeneric, dosage, frequency, duration_text || null, courseEndDate, finalResolutionStatus]
      );
      const newMed = result.rows[0];

      // Perform interaction check
      let flaggedInteractions = [];
      if (resolvedGeneric && existingGenerics.length > 0) {
        const { checkInteractions } = require('../utils/interactionEngine');
        flaggedInteractions = await checkInteractions(resolvedGeneric, existingGenerics);
      }

      // Save flagged interactions and send emails
      if (flaggedInteractions.length > 0) {
        const { sendEmail } = require('../utils/email');

        for (const interaction of flaggedInteractions) {
          // Identify which generic name is the existing one
          const existingGenName = [interaction.generic_a.toLowerCase(), interaction.generic_b.toLowerCase()]
            .find(g => g !== resolvedGeneric.toLowerCase());

          const conflictingMed = existingMeds.find(m => m.generic_name && m.generic_name.toLowerCase() === existingGenName);
          if (conflictingMed) {
            await client.query(
              `INSERT INTO interaction_flags (patient_id, new_medicine_id, existing_medicine_id, kb_entry_id, severity, confidence, status)
               VALUES ($1, $2, $3, $4, $5, 1.0, 'shown')`,
              [patient_id, newMed.id, conflictingMed.id, interaction.id, interaction.severity]
            );
          }
        }

        // Fetch patient and caregiver emails for notification
        const patientEmailRes = await client.query("SELECT email, name FROM users WHERE id = $1", [patient_id]);
        const patient = patientEmailRes.rows[0];

        const caregiversRes = await client.query(
          `SELECT u.email, u.name FROM caregiver_links cl
           JOIN users u ON cl.caregiver_id = u.id
           WHERE cl.patient_id = $1 AND cl.status = 'active'`,
          [patient_id]
        );
        const caregivers = caregiversRes.rows;

        // Send alert emails
        const alertSubject = `🛡️ MedGuard Safety Alert: Drug Interaction Flagged`;
        const alertBody = `Hello,

A drug interaction has been flagged in your MedGuard profile.

Details:
- New Medicine: ${newMed.brand_name} (${resolvedGeneric})
- Flagged Interactions:
${flaggedInteractions.map(i => `  * Conflicting drugs: ${i.generic_a} & ${i.generic_b} (Severity: ${i.severity.replace('_', ' ').toUpperCase()})\n    Explanation: ${i.explanation}`).join('\n')}

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

      await client.query('COMMIT');

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
 * POST /api/medicines/upload
 * Secure prescription upload endpoint. Checks file properties and sends request internally to ms2.
 */
const { extractPrescription } = require('../services/visionService');
router.post('/medicines/upload', authenticateUser, enforceConsent('health_data_processing'), enforceEmailVerified, uploadLimiter, upload.single('photo'), async (req, res, next) => {
  // Multer runs first and populates req.file and req.body.patient_id.
  // Validate file exists.
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'photo field containing JPG/PNG is required.' },
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

    // Call internal visionService for prescription extraction
    logger.info('INTERNAL_SERVICE_CALL', `Forwarding prescription extraction to visionService for patient ${patientId}`, {
      filename: req.file.filename,
    });

    const extractionResult = await extractPrescription(req.file.path, req.file.originalname || req.file.filename);

    logger.info('INTERNAL_SERVICE_RESPONSE', `visionService returned response for prescription extraction`);

    // Clean up physical file after extraction
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.json({
      success: true,
      data: extractionResult,
    });

  } catch (err) {
    // Ensure uploaded file is cleaned up on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    logger.error('MEDICINE_UPLOAD_ERROR', `Error processing prescription upload: ${err.message}`, { details: err.stack });
    
    res.status(502).json({
      success: false,
      error: {
        code: 'BAD_GATEWAY',
        message: 'Agent service extraction failure.',
        details: [err.message],
      },
    });
  }
});

module.exports = router;
