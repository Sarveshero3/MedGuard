const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is missing. PostgreSQL is required.');
}

const pool = new Pool({
  connectionString: DATABASE_URL,
});

const logger = require('../utils/logger');

async function testConnection() {
  const client = await pool.connect();
  try {
    await client.query('SELECT NOW()');
    logger.info('DB_CONNECTED', 'Successfully connected to PostgreSQL database');
    return true;
  } catch (err) {
    logger.error('DB_CONNECTION_FAILED', `Failed to connect to PostgreSQL: ${err.message}`);
    throw err;
  } finally {
    client.release();
  }
}

async function query(text, params = []) {
  return pool.query(text, params);
}

module.exports = { 
  pool, 
  query, 
  testConnection 
};

