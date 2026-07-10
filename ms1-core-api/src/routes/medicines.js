const express = require('express');
const axios = require('axios');
const fs = require('fs');
const { query } = require('../config/db');
const logger = require('../utils/logger');
const { authenticateUser, enforcePatientAccess, verifyPatientAccess, enforceEmailVerified } = require('../middleware/auth');
const { sanitizeInput, validateBody, validateUUID, upload } = require('../middleware/security');
const { uploadLimiter } = require('../middleware/rateLimiter');

const router = express.Router();
const MS2_BASE_URL = process.env.MS2_BASE_URL || 'http://ms2-agent-service:8000';

/**
 * GET /api/medicines
 * Retrieve medicines list for a patient.
 * Secured against IDOR via enforcePatientAccess('full_view').
 */
router.get('/medicines', authenticateUser, enforcePatientAccess('full_view'), async (req, res, next) => {
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
router.get('/medicines/:id', authenticateUser, validateUUID('id'), async (req, res, next) => {
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
router.post('/medicines', authenticateUser, enforcePatientAccess('full_view'), enforceEmailVerified, sanitizeInput, validateBody('medicine'), async (req, res, next) => {
  const { patient_id, brand_name, generic_name, dosage, frequency } = req.body;

  try {
    const result = await query(
      `INSERT INTO medicines (patient_id, brand_name, generic_name, dosage, frequency, resolution_status, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'active')
       RETURNING *`,
      [patient_id, brand_name, generic_name || null, dosage, frequency, generic_name ? 'resolved' : 'generic_unresolved']
    );

    const newMed = result.rows[0];
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
    logger.error('MEDICINE_CREATE_ERROR', `Error creating medicine: ${err.message}`);
    next(err);
  }
});

/**
 * PUT /api/medicines/:id
 * Modify / update medicine details (e.g. status discontinued).
 * Secured: verify ownership of the medicine before updating.
 */
router.put('/medicines/:id', authenticateUser, validateUUID('id'), enforceEmailVerified, sanitizeInput, async (req, res, next) => {
  const medicineId = req.params.id;
  const { dosage, frequency, status } = req.body;

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
router.delete('/medicines/:id', authenticateUser, validateUUID('id'), enforceEmailVerified, async (req, res, next) => {
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
router.post('/medicines/upload', authenticateUser, enforceEmailVerified, uploadLimiter, upload.single('photo'), async (req, res, next) => {
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

    // Call ms2-agent-service internal service endpoint via HTTP
    logger.info('INTERNAL_SERVICE_CALL', `Forwarding prescription extraction to ms2 for patient ${patientId}`, {
      filename: req.file.filename,
    });

    // Create a mock call to ms2 or forward using FormData. Since we want an end-to-end integration, we make the request
    // to ms2 at MS2_BASE_URL/api/extract/prescription
    const formData = new FormData();
    const fileStream = fs.createReadStream(req.file.path);
    formData.append('photo', fileStream, req.file.filename);

    const ms2Response = await axios.post(`${MS2_BASE_URL}/api/extract/prescription`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    logger.info('INTERNAL_SERVICE_RESPONSE', `ms2 returned response for prescription extraction`, {
      status: ms2Response.status,
    });

    res.json({
      success: true,
      data: {
        filename: req.file.filename,
        message: 'File uploaded and analysis completed.',
        extraction: ms2Response.data,
      },
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
