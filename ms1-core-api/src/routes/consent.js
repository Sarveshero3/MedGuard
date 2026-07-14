const express = require('express');
const { query } = require('../config/db');
const logger = require('../utils/logger');
const { authenticateUser } = require('../middleware/auth');
const { sanitizeInput } = require('../middleware/security');

const router = express.Router();

/**
 * GET /api/consent
 * Returns the current consent records for the logged-in user.
 */
router.get('/consent', authenticateUser, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const result = await query(
      'SELECT id, consent_type, granted_at, revoked_at FROM consent_records WHERE user_id = $1',
      [userId]
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (err) {
    logger.error('CONSENT_FETCH_ERROR', `Error fetching consent for user ${req.user?.id}: ${err.message}`);
    next(err);
  }
});

/**
 * POST /api/consent
 * Grants or revokes consent for a consent type.
 */
router.post('/consent', authenticateUser, sanitizeInput, async (req, res, next) => {
  const { consent_type, action } = req.body;

  if (!consent_type || !action) {
    return res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'consent_type and action are required.' },
    });
  }

  const allowedActions = ['grant', 'revoke'];
  if (!allowedActions.includes(action)) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Action must be grant or revoke.' },
    });
  }

  try {
    const userId = req.user.id;

    // Verify if record already exists
    const checkResult = await query(
      'SELECT id FROM consent_records WHERE user_id = $1 AND consent_type = $2',
      [userId, consent_type]
    );

    let result;
    if (action === 'grant') {
      if (checkResult.rows.length > 0) {
        result = await query(
          'UPDATE consent_records SET granted_at = NOW(), revoked_at = NULL WHERE user_id = $1 AND consent_type = $2 RETURNING *',
          [userId, consent_type]
        );
      } else {
        result = await query(
          'INSERT INTO consent_records (user_id, consent_type, granted_at, revoked_at) VALUES ($1, $2, NOW(), NULL) RETURNING *',
          [userId, consent_type]
        );
      }
      logger.audit('CONSENT_GRANTED', `User ${userId} granted consent for ${consent_type}`, { userId, consent_type });
    } else { // revoke
      if (checkResult.rows.length > 0) {
        result = await query(
          'UPDATE consent_records SET revoked_at = NOW(), granted_at = NULL WHERE user_id = $1 AND consent_type = $2 RETURNING *',
          [userId, consent_type]
        );
      } else {
        result = await query(
          'INSERT INTO consent_records (user_id, consent_type, granted_at, revoked_at) VALUES ($1, $2, NULL, NOW()) RETURNING *',
          [userId, consent_type]
        );
      }
      logger.audit('CONSENT_REVOKED', `User ${userId} revoked consent for ${consent_type}`, { userId, consent_type });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (err) {
    logger.error('CONSENT_UPDATE_ERROR', `Error updating consent for user ${req.user?.id}: ${err.message}`);
    next(err);
  }
});

module.exports = router;
