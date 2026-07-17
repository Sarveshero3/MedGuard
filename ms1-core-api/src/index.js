const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { pool, testConnection } = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const healthRoutes = require('./routes/health');
const authRoutes = require('./routes/auth');
const medicineRoutes = require('./routes/medicines');
const caregiverRoutes = require('./routes/caregivers');
const alertRoutes = require('./routes/alerts');
const calendarRoutes = require('./routes/calendar');
const consentRoutes = require('./routes/consent');
const labReportRoutes = require('./routes/labReports');
const jobRoutes = require('./routes/jobs');
const briefRoutes = require('./routes/briefs');
const { apiLimiter } = require('./middleware/rateLimiter');
const logger = require('./utils/logger');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.MS1_PORT || 4000;

// ── Middleware ────────────────────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '8mb' })); // Strict 8MB limit per PRD
app.use(express.urlencoded({ extended: true, limit: '8mb' }));

// Apply rate limiter to all API endpoints
app.use('/api', apiLimiter);

// ── Routes ───────────────────────────────────────────────────
app.use('/api', healthRoutes);
app.use('/api', authRoutes);
app.use('/api', medicineRoutes);
app.use('/api', caregiverRoutes);
app.use('/api', alertRoutes);
app.use('/api', calendarRoutes);
app.use('/api', consentRoutes);
app.use('/api', labReportRoutes);
app.use('/api', jobRoutes);
app.use('/api', briefRoutes);

// Fallback path to log unusual traffic patterns (unknown endpoints)
app.use((req, res, _next) => {
  logger.warn('UNKNOWN_ENDPOINT_ACCESS', `IP ${req.ip} requested non-existent endpoint: ${req.method} ${req.originalUrl}`, {
    ip: req.ip,
    method: req.method,
    path: req.originalUrl,
  });
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found.',
    },
  });
});

// ── Error handling ───────────────────────────────────────────
app.use(errorHandler);

// ── Start server ─────────────────────────────────────────────
async function start() {
  try {
    await testConnection();
    console.log('✅ PostgreSQL connected');

    // Reinitialize DB if CLEAN_DB=true is passed
    if (process.env.CLEAN_DB === 'true') {
      logger.info('DB_CLEANUP_START', 'CLEAN_DB is set to true. Resetting schema and cleaning up old data...');
      const fs = require('fs');
      const initSqlPath = path.resolve(__dirname, '../infra/db/init.sql');
      if (fs.existsSync(initSqlPath)) {
        const initSql = fs.readFileSync(initSqlPath, 'utf8');
        const client = await pool.connect();
        try {
          await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
          await client.query(initSql);
          logger.info('DB_CLEANUP_SUCCESS', 'Successfully reset database schema and loaded clinical seed data.');
          
          // Also flush Redis
          const redisConnection = require('./config/redis');
          if (redisConnection && typeof redisConnection.flushall === 'function') {
            await redisConnection.flushall();
            logger.info('REDIS_CLEANUP_SUCCESS', 'Successfully flushed all Redis cache data.');
          }
        } catch (err) {
          logger.error('DB_CLEANUP_FAILED', `Failed to cleanup database: ${err.message}`);
        } finally {
          client.release();
        }
      } else {
        logger.warn('DB_CLEANUP_WARNING', `Could not find init.sql at ${initSqlPath}. Skipping cleanup.`);
      }
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 ms1-core-api running on port ${PORT}`);
    });
  } catch (err) {
    console.error('❌ Failed to start ms1:', err.message);
    process.exit(1);
  }
}

start();

// ── Graceful shutdown ────────────────────────────────────────
const shutdown = async (signal) => {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  await pool.end();
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = app;
