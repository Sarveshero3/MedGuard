const express = require('express');
const { query } = require('../config/db');
const logger = require('../utils/logger');
const { authenticateUser } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/consent
 * Returns whether DPDP consent is active for the logged-in user.
 */
router.get('/consent', authenticateUser, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const result = await query(
      'SELECT consent_given_at FROM users WHERE id = $1',
      [userId]
    );

    const consentGranted = result.rows.length > 0 && !!result.rows[0].consent_given_at;

    res.json({
      success: true,
      data: {
        consentGranted,
      },
    });
  } catch (err) {
    logger.error('CONSENT_FETCH_ERROR', `Error fetching consent for user ${req.user?.id}: ${err.message}`);
    next(err);
  }
});

module.exports = router;
