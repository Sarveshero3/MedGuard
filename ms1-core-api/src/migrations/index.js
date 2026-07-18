const { pool } = require('../config/db');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');

async function runMigrations() {
  logger.info('MIGRATION_START', 'Starting database migrations...');
  const dbClient = await pool.connect();
  try {
    // 1. Fetch already executed migrations (from the existing schema_migrations table)
    const { rows } = await dbClient.query('SELECT version FROM schema_migrations');
    const executed = new Set(rows.map(r => r.version));

    // 2. Find migration files in the migrations directory
    const migrationsDir = __dirname;
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.js') && f !== 'index.js')
      .sort(); // Sort so they run in order

    for (const file of files) {
      // The version is the filename without extension (e.g. 'v2.3.0')
      const version = path.basename(file, '.js');
      
      if (executed.has(version)) {
        continue;
      }

      logger.info('MIGRATION_RUNNING', `Running migration: ${version}`);
      const migration = require(path.join(migrationsDir, file));

      await dbClient.query('BEGIN');
      try {
        await migration.up(dbClient);
        await dbClient.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version]);
        await dbClient.query('COMMIT');
        logger.info('MIGRATION_SUCCESS', `Successfully completed migration: ${version}`);
      } catch (err) {
        await dbClient.query('ROLLBACK');
        logger.error('MIGRATION_FAILED', `Failed migration ${version}: ${err.message}`);
        throw err;
      }
    }

    logger.info('MIGRATION_END', 'Database migrations check completed.');
  } catch (err) {
    logger.error('MIGRATION_FATAL', `Migration runner encountered a fatal error: ${err.message}`);
    throw err;
  } finally {
    dbClient.release();
  }
}

module.exports = { runMigrations };
