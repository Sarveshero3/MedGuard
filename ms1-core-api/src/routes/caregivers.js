const express = require('express');
const { query } = require('../config/db');
const logger = require('../utils/logger');
const { authenticateUser, requireRoles } = require('../middleware/auth');
const { sanitizeInput, validateUUID } = require('../middleware/security');

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
        `SELECT cl.id, cl.status, cl.created_at, u.id as caregiver_id, u.name, u.email 
         FROM caregiver_links cl 
         JOIN users u ON cl.caregiver_id = u.id 
         WHERE cl.patient_id = $1 AND cl.status = 'active'`,
        [req.user.id]
      );
    } else if (req.user.role === 'caregiver') {
      result = await query(
        `SELECT cl.id, cl.status, cl.created_at, u.id as patient_id, u.name, u.email 
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
