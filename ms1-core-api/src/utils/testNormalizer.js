const { query } = require('../config/db');

/**
 * Normalizes test name variants (e.g. "Hb A1c", "Glycated Hemoglobin") to canonical types ("HbA1c")
 * @param {string} testVariant - Raw extracted test variant name
 * @returns {Promise<string>} - Canonical test type
 */
async function getCanonicalTestType(testVariant) {
  if (!testVariant) return 'UNKNOWN';
  const cleaned = testVariant.trim();

  try {
    const result = await query(
      'SELECT canonical_type FROM test_type_normalization WHERE LOWER(test_variant) = LOWER($1) ORDER BY effective_date DESC LIMIT 1',
      [cleaned]
    );

    if (result.rows.length > 0) {
      return result.rows[0].canonical_type;
    }
  } catch (err) {
    // Fallback on database failure
  }
  return cleaned; // Default fallback to raw name
}

module.exports = {
  getCanonicalTestType,
};
