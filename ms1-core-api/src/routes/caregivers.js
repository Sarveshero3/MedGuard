const express = require('express');
const { query } = require('../config/db');
const logger = require('../utils/logger');
const { authenticateUser, requireRoles } = require('../middleware/auth');
const { sanitizeInput, validateUUID } = require('../middleware/security');

const router = express.Router();

/**
 * POST /api/caregivers/invite
 * Patient invites a caregiver by email.
 */
router.post('/caregivers/invite', authenticateUser, requireRoles(['patient']), sanitizeInput, async (req, res, next) => {
  const { email, permission_level } = req.body;

  if (!email || !permission_level) {
    return res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'Email and permission_level are required.' },
    });
  }

  const allowedLevels = ['full_view', 'alerts_only'];
  if (!allowedLevels.includes(permission_level)) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid permission_level.' },
    });
  }

  try {
    // Look up caregiver user
    const cgResult = await query('SELECT id, role FROM users WHERE email = $1', [email]);
    if (cgResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Caregiver account with this email not found. Caregivers must sign up first.' },
      });
    }

    const caregiver = cgResult.rows[0];
    if (caregiver.role !== 'caregiver') {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'The user associated with this email is not registered as a caregiver.' },
      });
    }

    if (caregiver.id === req.user.id) {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'You cannot invite yourself as a caregiver.' },
      });
    }

    // Insert caregiver link
    const result = await query(
      `INSERT INTO caregiver_links (patient_id, caregiver_id, permission_level, status)
       VALUES ($1, $2, $3, 'pending')
       ON CONFLICT (patient_id, caregiver_id) 
       DO UPDATE SET permission_level = EXCLUDED.permission_level, status = 'pending'
       RETURNING *`,
      [req.user.id, caregiver.id, permission_level]
    );

    logger.audit('CAREGIVER_INVITED', `Patient ${req.user.id} invited caregiver ${caregiver.id} with access ${permission_level}`, {
      patientId: req.user.id,
      caregiverId: caregiver.id,
      linkId: result.rows[0].id,
    });

    res.status(201).json({
      success: true,
      data: result.rows[0],
    });

  } catch (err) {
    logger.error('CAREGIVER_INVITE_ERROR', `Error inviting caregiver: ${err.message}`);
    next(err);
  }
});

/**
 * POST /api/caregivers/respond
 * Caregiver accepts or rejects/revokes an invite.
 */
router.post('/caregivers/respond', authenticateUser, requireRoles(['caregiver']), sanitizeInput, async (req, res, next) => {
  const { link_id, action } = req.body;

  if (!link_id || !action) {
    return res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'link_id and action are required.' },
    });
  }

  const allowedActions = ['active', 'revoked'];
  if (!allowedActions.includes(action)) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Action must be active or revoked.' },
    });
  }

  try {
    const linkResult = await query('SELECT * FROM caregiver_links WHERE id = $1', [link_id]);
    if (linkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Invitation link not found.' },
      });
    }

    const link = linkResult.rows[0];
    
    // Ownership check: Caregiver can only respond to links targeted to them
    if (link.caregiver_id !== req.user.id) {
      logger.warn('IDOR_PREVENTED', `Caregiver ${req.user.id} tried to modify link ${link_id} owned by caregiver ${link.caregiver_id}`, {
        caregiverId: req.user.id,
        linkId: link_id,
      });
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied. Unauthorized request.' },
      });
    }

    const result = await query(
      'UPDATE caregiver_links SET status = $1 WHERE id = $2 RETURNING *',
      [action, link_id]
    );

    logger.audit('CAREGIVER_RESPONSE', `Caregiver ${req.user.id} set link ${link_id} status to ${action}`, {
      caregiverId: req.user.id,
      linkId: link_id,
      status: action,
    });

    res.json({
      success: true,
      data: result.rows[0],
    });

  } catch (err) {
    logger.error('CAREGIVER_RESPOND_ERROR', `Error responding to invitation: ${err.message}`);
    next(err);
  }
});

/**
 * GET /api/caregivers/links
 * Retrieves caregiver links for the logged-in patient or caregiver.
 */
router.get('/caregivers/links', authenticateUser, async (req, res, next) => {
  try {
    let result;
    if (req.user.role === 'patient') {
      result = await query(
        `SELECT cl.id, cl.permission_level, cl.status, cl.created_at, u.id as caregiver_id, u.name, u.email 
         FROM caregiver_links cl 
         JOIN users u ON cl.caregiver_id = u.id 
         WHERE cl.patient_id = $1`,
        [req.user.id]
      );
    } else if (req.user.role === 'caregiver') {
      result = await query(
        `SELECT cl.id, cl.permission_level, cl.status, cl.created_at, u.id as patient_id, u.name, u.email 
         FROM caregiver_links cl 
         JOIN users u ON cl.patient_id = u.id 
         WHERE cl.caregiver_id = $1`,
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

module.exports = router;
