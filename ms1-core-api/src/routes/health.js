const express = require('express');
const { query } = require('../config/db');

const router = express.Router();

/**
 * GET /api/health
 * Returns service status and database connectivity.
 */
router.get('/health', async (req, res) => {
  try {
    const dbResult = await query('SELECT NOW() AS now');
    res.json({
      success: true,
      data: {
        service: 'ms1-core-api',
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: {
          connected: true,
          time: dbResult.rows[0].now,
        },
      },
    });
  } catch (err) {
    res.status(503).json({
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Database connection failed',
        details: [err.message],
      },
    });
  }
});

module.exports = router;
