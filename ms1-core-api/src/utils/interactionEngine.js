const { query } = require('../config/db');

/**
 * Pure database-driven safety module.
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

  // Filter out invalid/null names
  const cleanExisting = existingGenerics.filter(g => g && g.trim());
  if (cleanExisting.length === 0) {
    return [];
  }

  // Append-only logic: active checkers query the latest version of rules by effective_date.
  // We use DISTINCT ON (generic_a, generic_b) to retrieve only the newest rule for each interaction pair.
  const sql = `
    WITH latest_rules AS (
      SELECT DISTINCT ON (generic_a, generic_b) 
        id, generic_a, generic_b, severity, explanation, version, effective_date
      FROM interaction_kb
      ORDER BY generic_a, generic_b, effective_date DESC
    )
    SELECT * 
    FROM latest_rules
    WHERE 
      (LOWER(generic_a) = LOWER($1) AND LOWER(generic_b) = ANY($2::text[]))
      OR 
      (LOWER(generic_b) = LOWER($1) AND LOWER(generic_a) = ANY($2::text[]))
  `;

  const cleanExistingLower = cleanExisting.map(g => g.trim().toLowerCase());
  const result = await query(sql, [newGeneric.trim().toLowerCase(), cleanExistingLower]);

  return result.rows;
}

module.exports = {
  checkInteractions,
};
