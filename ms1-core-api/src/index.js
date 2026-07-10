require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { pool, testConnection } = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const healthRoutes = require('./routes/health');

const app = express();
const PORT = process.env.MS1_PORT || 4000;

// ── Middleware ────────────────────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Routes ───────────────────────────────────────────────────
app.use('/api', healthRoutes);

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
