const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err);
});

/**
 * Test database connectivity on startup.
 */
async function testConnection() {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT NOW() AS now');
    console.log(`  DB time: ${result.rows[0].now}`);
  } finally {
    client.release();
  }
}

/**
 * Execute a parameterized query.
 * @param {string} text — SQL query string
 * @param {Array} params — Query parameters
 * @returns {Promise<import('pg').QueryResult>}
 */
async function query(text, params) {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;
  if (duration > 500) {
    console.warn(`⚠️  Slow query (${duration}ms): ${text.substring(0, 80)}`);
  }
  return result;
}

module.exports = { pool, query, testConnection };
