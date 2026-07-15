const { query } = require('../config/db');
const redisConnection = require('../config/redis');
const logger = require('./logger');

/**
 * Pure database-driven safety module with version-aware Redis caching.
 * Checks for drug-drug interactions between a new generic name and a list of existing active generic names.
 * 
 * @param {string} newGeneric - Generic name of the medicine being added.
 * @param {Array<string>} existingGenerics - Array of active generic names currently prescribed.
 * @returns {Promise<Array<object>>} - List of flagged interactions matching active rules in interaction_kb.
 */
async function checkInteractions(newGeneric, existingGenerics) {
  if (!newGeneric || !existingGenerics || existingGenerics.length === 0) {
    return [];
  }

  const cleanExisting = existingGenerics.filter(g => g && g.trim());
  if (cleanExisting.length === 0) {
    return [];
  }

  const flagged = [];

  for (const existing of cleanExisting) {
    // Sort generics alphabetically to maintain consistent cache key names
    const sorted = [newGeneric.trim().toLowerCase(), existing.trim().toLowerCase()].sort();
    const genA = sorted[0];
    const genB = sorted[1];

    let dbRule = null;
    try {
      // Retrieve the latest versioned interaction rule from Postgres
      const dbRes = await query(
        `SELECT id, generic_a, generic_b, severity, explanation, version 
         FROM interaction_kb 
         WHERE (LOWER(generic_a) = $1 AND LOWER(generic_b) = $2)
         ORDER BY effective_date DESC LIMIT 1`,
        [genA, genB]
      );
      dbRule = dbRes.rows[0];
    } catch (dbErr) {
      logger.error('DB_INTERACTION_QUERY_FAILED', `DB query failed for ${genA} and ${genB}: ${dbErr.message}`);
      continue;
    }

    // Cache negative lookup (no interaction) to prevent recurrent database checks
    if (!dbRule) {
      const negKey = `kb:interaction:${genA}:${genB}:none`;
      try {
        await redisConnection.setex(negKey, 3600, 'none');
      } catch (cacheErr) {
        // Suppress cache write error
      }
      continue;
    }

    // Version-aware cache key
    const cacheKey = `kb:interaction:${genA}:${genB}:${dbRule.version}`;
    
    try {
      const cachedVal = await redisConnection.get(cacheKey);
      if (cachedVal) {
        logger.info('CACHE_HIT', `Cache hit for interaction rule ${cacheKey}`);
        flagged.push(JSON.parse(cachedVal));
        continue;
      }
    } catch (cacheErr) {
      logger.warn('CACHE_READ_FAILED', `Failed to read cache for key ${cacheKey}: ${cacheErr.message}`);
    }

    // Cache miss: cache details for 24 hours
    try {
      await redisConnection.setex(cacheKey, 86400, JSON.stringify(dbRule));
      logger.info('CACHE_MISS', `Cache write for interaction rule ${cacheKey}`);
    } catch (cacheErr) {
      logger.warn('CACHE_WRITE_FAILED', `Failed to write cache for key ${cacheKey}: ${cacheErr.message}`);
    }

    flagged.push(dbRule);
  }

  return flagged;
}

module.exports = {
  checkInteractions,
};
