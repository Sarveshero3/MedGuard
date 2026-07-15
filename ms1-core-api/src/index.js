require('dotenv').config();
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
const { apiLimiter } = require('./middleware/rateLimiter');
const logger = require('./utils/logger');

const app = express();
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

// Fallback path to log unusual traffic patterns (unknown endpoints)
app.use((req, res, next) => {
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
