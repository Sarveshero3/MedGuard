const { query } = require('../config/db');
const axios = require('axios');
const logger = require('../utils/logger');

const MS2_BASE_URL = process.env.MS2_BASE_URL || 'http://ms2-agent-service:8000';
const MS2_INTERNAL_SECRET = process.env.MS2_INTERNAL_SECRET || 'dev-secret';
const NOT_FOUND_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days TTL for not_found caching
const BRAND_RESOLUTION_MODEL = process.env.BRAND_RESOLUTION_MODEL || 'llama-3.3-70b-versatile';

/**
 * Service managing cache queries, LLM resolution requests, retries, and corrections.
 */
class BrandResolutionService {
  /**
   * Resolves a brand name to its canonical generic name.
   * @param {string} brandName
   * @returns {Promise<{success: boolean, generic_name: string, exists: boolean}>}
   */
  async resolveBrand(brandName) {
    if (!brandName || !brandName.trim()) {
      return { success: true, generic_name: 'no such medicine found', exists: false };
    }

    const brand = brandName.trim();

    // 1. Check local cache
    const cacheRow = await this.queryCache(brand);

    if (cacheRow) {
      const { generic_name, resolution_status, resolved_at } = cacheRow;

      if (resolution_status === 'resolved') {
        return {
          success: true,
          generic_name: generic_name,
          exists: generic_name.toLowerCase() !== 'no such medicine found'
        };
      }

      if (resolution_status === 'not_found' || resolution_status === 'not_found_unconfirmed') {
        const age = Date.now() - new Date(resolved_at).getTime();
        if (age < NOT_FOUND_TTL_MS) {
          logger.info('BRAND_RESOLUTION_CACHE_HIT', `Cache hit: '${brand}' is known ${resolution_status}.`);
          return {
            success: true,
            generic_name: 'no such medicine found',
            exists: false
          };
        }
        logger.info('BRAND_RESOLUTION_CACHE_EXPIRED', `Cache expired for ${resolution_status} entry '${brand}'. Retrying resolution.`);
      }

      // If 'unresolved_error', we automatically retry.
      if (resolution_status === 'unresolved_error') {
        logger.info('BRAND_RESOLUTION_RETRY', `Retrying resolution for unresolved_error entry '${brand}'.`);
      }
    }

    // 2. Fallback to MS2 call with retries and backoff
    try {
      const { generic_name, exists } = await this._callMS2WithRetry(brand);

      const isResolved = exists && generic_name.toLowerCase() !== 'no such medicine found';
      if (!isResolved) {
        // AI returned not found: cache immediately as 'not_found_unconfirmed'
        await this._saveToCache(brand, 'no such medicine found', 'not_found_unconfirmed', `llm_tavily:${BRAND_RESOLUTION_MODEL}`);
      } else {
        // AI found generic: DO NOT save to database yet (only on human confirmation)
        logger.info('BRAND_RESOLUTION_AI_SUGGESTION', `AI suggested '${brand}' -> '${generic_name}' (session only, not persisted to cache)`);
      }

      return {
        success: true,
        generic_name,
        exists
      };
    } catch (err) {
      logger.error('BRAND_RESOLUTION_API_FAILURE', `Failed to resolve brand '${brand}': ${err.message}`);
      
      // Save failure status to cache so we know it's a technical error
      await this._saveToCache(brand, 'no such medicine found', 'unresolved_error', `api_error:${err.message}`);

      // Return 'no such medicine found' so workflow can continue without throwing validation error
      return {
        success: true,
        generic_name: 'no such medicine found',
        exists: false
      };
    }
  }

  /**
   * Saves a user confirmation / correction directly to cache.
   * Accepts a named parameters object.
   * @param {object} params
   * @param {string} params.brandName
   * @param {string} params.genericName
   * @param {string} [params.resolutionSource] - Default 'user_correction'
   * @param {object} [params.client] - Optional transactional PG client
   */
  async saveCorrection({ brandName, genericName, resolutionSource = 'user_correction', client = null }) {
    if (!brandName || !brandName.trim() || !genericName || !genericName.trim()) {
      return;
    }

    const brand = brandName.trim();
    const generic = genericName.trim();
    const queryFn = client ? client.query.bind(client) : query;

    // Get the maximum version number for this brand
    const versionResult = await queryFn(
      'SELECT version FROM brand_generic_map WHERE brand_name = $1 ORDER BY effective_date DESC LIMIT 1',
      [brand]
    );

    let nextVersion = 'v1';
    if (versionResult.rows.length > 0) {
      const currentVersion = versionResult.rows[0].version;
      const currentNum = parseInt(currentVersion.replace('v', ''), 10) || 1;
      nextVersion = `v${currentNum + 1}`;
    }

    logger.info('BRAND_RESOLUTION_CORRECTION', `Writing manual confirmation/correction for '${brand}' -> '${generic}' (version: ${nextVersion}, source: ${resolutionSource})`);
    await queryFn(
      `INSERT INTO brand_generic_map (
        brand_name, 
        generic_name, 
        source, 
        version, 
        effective_date, 
        resolution_status, 
        resolution_source, 
        resolved_at
      ) VALUES ($1, $2, 'user_confirmed', $3, NOW(), 'resolved', $4, NOW())
       ON CONFLICT (brand_name, version) DO NOTHING`,
      [brand, generic, nextVersion, resolutionSource]
    );
  }

  // --- Private Helpers ---

  async queryCache(brand) {
    const res = await query(
      `SELECT generic_name, resolution_status, resolution_source, resolved_at 
       FROM brand_generic_map 
       WHERE brand_name = $1 
       ORDER BY 
         CASE 
           WHEN resolution_status = 'resolved' THEN 1 
           WHEN resolution_status = 'not_found' THEN 2
           WHEN resolution_status = 'not_found_unconfirmed' THEN 3
           ELSE 4 
         END ASC,
         effective_date DESC 
       LIMIT 1`,
      [brand]
    );
    return res.rows.length > 0 ? res.rows[0] : null;
  }

  async _saveToCache(brand, genericName, status, source) {
    try {
      const versionResult = await query(
        'SELECT version FROM brand_generic_map WHERE brand_name = $1 ORDER BY effective_date DESC LIMIT 1',
        [brand]
      );
      let nextVersion = 'v1';
      if (versionResult.rows.length > 0) {
        const currentVersion = versionResult.rows[0].version;
        const currentNum = parseInt(currentVersion.replace('v', ''), 10) || 1;
        nextVersion = `v${currentNum + 1}`;
      }

      await query(
        `INSERT INTO brand_generic_map (
          brand_name, 
          generic_name, 
          source, 
          version, 
          effective_date, 
          resolution_status, 
          resolution_source, 
          resolved_at
        ) VALUES ($1, $2, 'vlm_resolved', $3, NOW(), $4, $5, NOW())
        ON CONFLICT (brand_name, version) DO NOTHING`,
        [brand, genericName, nextVersion, status, source]
      );
    } catch (err) {
      logger.error('BRAND_RESOLUTION_CACHE_SAVE_ERROR', `Failed to save resolution result to cache: ${err.message}`);
    }
  }

  async _callMS2WithRetry(brand, maxRetries = 2, baseDelayMs = 1000) {
    let attempt = 0;
    while (attempt <= maxRetries) {
      try {
        const res = await axios.post(`${MS2_BASE_URL}/api/extract/resolve-brand`, 
          { brand_name: brand },
          { 
            timeout: 10000, // strict 10s timeout
            headers: {
              'x-internal-auth': MS2_INTERNAL_SECRET
            }
          }
        );
        
        if (res.status === 200 && res.data && res.data.success) {
          return {
            generic_name: res.data.generic_name || 'no such medicine found',
            exists: !!res.data.exists
          };
        }
        
        throw new Error(res.data ? res.data.error : `Status code ${res.status}`);
      } catch (err) {
        if (attempt >= maxRetries) {
          throw err;
        }
        attempt++;
        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        logger.warn('BRAND_RESOLUTION_RETRY_ATTEMPT', `Attempt ${attempt} failed to resolve '${brand}'. Retrying in ${delay}ms... Error: ${err.message}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
}

module.exports = new BrandResolutionService();
