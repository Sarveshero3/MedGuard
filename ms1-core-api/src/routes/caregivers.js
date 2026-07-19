const express = require('express');
const { query } = require('../config/db');
const logger = require('../utils/logger');
const { authenticateUser, requireRoles } = require('../middleware/auth');
const { validateUUID } = require('../middleware/security');

const router = express.Router();

/**
 * POST /api/caregivers/otp
 * Patient generates a unique short-lived caregiver linking OTP.
 */
router.post('/caregivers/otp', authenticateUser, requireRoles(['patient']), async (req, res, next) => {
  try {
    // Generate a 6-digit random numeric code
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15-minute expiry

    await query(
      'UPDATE users SET linking_otp = $1, linking_otp_expires_at = $2 WHERE id = $3',
      [otp, expiresAt, req.user.id]
    );

    logger.audit('CAREGIVER_OTP_GENERATED', `Patient ${req.user.id} generated caregiver linking OTP`, {
      patientId: req.user.id,
    });

    res.json({
      success: true,
      data: {
        otp,
        expires_at: expiresAt,
      },
    });
  } catch (err) {
    logger.error('OTP_GENERATION_ERROR', `Error generating caregiver OTP: ${err.message}`);
    next(err);
  }
});

/**
 * GET /api/caregivers/links
 * Retrieves caregiver links for the logged-in patient or caregiver (active only).
 */
router.get('/caregivers/links', authenticateUser, async (req, res, next) => {
  try {
    let result;
    if (req.user.role === 'patient') {
      result = await query(
        `SELECT cl.id, cl.status, cl.permission_level, cl.created_at, u.id as caregiver_id, u.name, u.email 
         FROM caregiver_links cl 
         JOIN users u ON cl.caregiver_id = u.id 
         WHERE cl.patient_id = $1 AND cl.status = 'active'`,
        [req.user.id]
      );
    } else if (req.user.role === 'caregiver') {
      result = await query(
        `SELECT cl.id, cl.status, cl.permission_level, cl.created_at, u.id as patient_id, u.name, u.email 
         FROM caregiver_links cl 
         JOIN users u ON cl.patient_id = u.id 
         WHERE cl.caregiver_id = $1 AND cl.status = 'active'`,
        [req.user.id]
      );
    } else {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied.' },
      });
    }

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (err) {
    logger.error('CAREGIVER_LINKS_FETCH_ERROR', `Error fetching links for user ${req.user.id}: ${err.message}`);
    next(err);
  }
});

/**
 * PUT /api/caregivers/links/:id/permission
 * Patient updates the permission level of a linked caregiver.
 */
router.put('/caregivers/links/:id/permission', authenticateUser, requireRoles(['patient']), validateUUID('id'), async (req, res, next) => {
  const linkId = req.params.id;
  const { permission_level } = req.body;

  if (permission_level !== 'full_view' && permission_level !== 'alerts_only') {
    return res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'permission_level must be either full_view or alerts_only.' },
    });
  }

  try {
    const linkResult = await query('SELECT patient_id FROM caregiver_links WHERE id = $1', [linkId]);
    
    if (linkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Caregiver link not found.' },
      });
    }

    if (linkResult.rows[0].patient_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied. You can only update permissions for your own caregivers.' },
      });
    }

    const result = await query(
      `UPDATE caregiver_links 
       SET permission_level = $1 
       WHERE id = $2 
       RETURNING *`,
      [permission_level, linkId]
    );

    logger.audit('CAREGIVER_PERMISSION_UPDATED', `Patient ${req.user.id} updated caregiver link ${linkId} permission to ${permission_level}`, {
      patientId: req.user.id,
      linkId,
      permissionLevel: permission_level,
    });

    res.json({
      success: true,
      message: 'Caregiver permission updated successfully.',
      data: result.rows[0],
    });
  } catch (err) {
    logger.error('CAREGIVER_PERMISSION_UPDATE_ERROR', `Error updating caregiver permission: ${err.message}`);
    next(err);
  }
});

/**
 * DELETE /api/caregivers/links/:id
 * Remove/revoke a caregiver link.
 */
router.delete('/caregivers/links/:id', authenticateUser, validateUUID('id'), async (req, res, next) => {
  const linkId = req.params.id;

  try {
    // Delete link if logged in user is either the patient or the caregiver of this link
    const result = await query(
      `DELETE FROM caregiver_links 
       WHERE id = $1 AND (patient_id = $2 OR caregiver_id = $2) 
       RETURNING *`,
      [linkId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Caregiver link not found or unauthorized.' },
      });
    }

    logger.audit('CAREGIVER_LINK_DELETED', `User ${req.user.id} broke caregiver link ${linkId}`, {
      userId: req.user.id,
      linkId,
    });

    res.json({
      success: true,
      data: {
        message: 'Caregiver link removed successfully.',
      },
    });
  } catch (err) {
    logger.error('CAREGIVER_LINK_DELETE_ERROR', `Error deleting caregiver link: ${err.message}`);
    next(err);
  }
});

module.exports = router;
