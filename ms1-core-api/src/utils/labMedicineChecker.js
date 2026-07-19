const { query } = require('../config/db');
const logger = require('./logger');
const brandResolutionService = require('../services/brandResolutionService');

// Helper function for case-insensitive trim check
function LOWER(str) {
  return str ? str.toLowerCase().trim() : '';
}

/**
 * Checks for clinical safety conflicts between newly confirmed lab values and the patient's active medicines.
 * Supports primary name matching and fallback generic mapping via brand_generic_map.
 * Includes unit compatibility checking and condition evaluation.
 * 
 * @param {string} patientId - UUID of the patient.
 * @param {Array<string>} labValueIds - Array of newly saved lab_value UUIDs.
 * @returns {Promise<Array<object>>} - List of flagged conflicts inserted into lab_medicine_flags.
 */
async function checkLabMedicineConflicts(patientId, labValueIds) {
  if (!patientId || !labValueIds || labValueIds.length === 0) {
    return [];
  }

  try {
    // 1. Fetch the confirmed lab values
    const labValuesRes = await query(
      `SELECT id, test_type, value, unit 
       FROM lab_values 
       WHERE id = ANY($1)`,
      [labValueIds]
    );
    const labValues = labValuesRes.rows;
    if (labValues.length === 0) {
      return [];
    }

    // 2. Fetch all active medicines for this patient
    const medicinesRes = await query(
      `SELECT id, brand_name, generic_name 
       FROM medicines 
       WHERE patient_id = $1 AND status = 'active'`,
      [patientId]
    );
    const activeMedicines = medicinesRes.rows;
    if (activeMedicines.length === 0) {
      return [];
    }

    const flaggedConflicts = [];

    // 3. For each medicine and lab value, check for rules
    for (const medicine of activeMedicines) {
      const genericName = medicine.generic_name;
      const brandName = medicine.brand_name;

      for (const labValue of labValues) {
        const testType = labValue.test_type;
        const numericVal = parseFloat(labValue.value);

        if (isNaN(numericVal)) {
          logger.warn('INVALID_LAB_VALUE_FOR_COMPARE', `Lab value ${labValue.value} for test ${testType} is not a valid number. Skipping comparison.`);
          continue;
        }

        // Try primary match first
        let matchedRules = [];
        if (genericName) {
          const rulesRes = await query(
            `SELECT id, generic_name, test_type, condition, threshold, unit, severity, rationale
             FROM lab_medicine_rules
             WHERE LOWER(generic_name) = LOWER($1) AND LOWER(test_type) = LOWER($2)`,
            [genericName.trim(), testType.trim()]
          );
          matchedRules = rulesRes.rows;
        }

        // Try fallback if primary returned no rules (useful if LLM output had HCl etc, check brand map)
        if (matchedRules.length === 0 && brandName) {
          // Look up brand in brand_generic_map to find canonical generic
          const cacheRow = await brandResolutionService.queryCache(brandName.trim());
          if (cacheRow && cacheRow.resolution_status === 'resolved') {
            const canonicalGeneric = cacheRow.generic_name;
            if (canonicalGeneric && LOWER(canonicalGeneric) !== LOWER(genericName || '')) {
              const rulesRes = await query(
                `SELECT id, generic_name, test_type, condition, threshold, unit, severity, rationale
                 FROM lab_medicine_rules
                 WHERE LOWER(generic_name) = LOWER($1) AND LOWER(test_type) = LOWER($2)`,
                [canonicalGeneric.trim(), testType.trim()]
              );
              matchedRules = rulesRes.rows;
            }
          }
        }

        // Process matched rules
        for (const rule of matchedRules) {
          // Unit guard: If rule.unit is empty (unitless, e.g. INR), bypass.
          // Otherwise, check if trimmed case-insensitive strings match.
          const ruleUnit = LOWER(rule.unit);
          const valUnit = LOWER(labValue.unit);
          
          if (ruleUnit !== '' && ruleUnit !== valUnit) {
            logger.warn('UNIT_MISMATCH_SKIPPED', `Skipping rule match for drug ${rule.generic_name} and lab ${testType}: lab unit is '${labValue.unit}', rule expects '${rule.unit}'.`);
            continue;
          }

          // Evaluate condition
          let conditionMet = false;
          if (rule.condition === '>') {
            conditionMet = numericVal > parseFloat(rule.threshold);
          } else if (rule.condition === '<') {
            conditionMet = numericVal < parseFloat(rule.threshold);
          } else if (rule.condition === '>=') {
            conditionMet = numericVal >= parseFloat(rule.threshold);
          } else if (rule.condition === '<=') {
            conditionMet = numericVal <= parseFloat(rule.threshold);
          } else if (rule.condition === '=') {
            conditionMet = numericVal === parseFloat(rule.threshold);
          }

          if (conditionMet) {
            // Check if already exists to prevent duplicate flags
            const existingFlag = await query(
              `SELECT id FROM lab_medicine_flags 
               WHERE patient_id = $1 AND medicine_id = $2 AND lab_value_id = $3 AND rule_id = $4`,
              [patientId, medicine.id, labValue.id, rule.id]
            );
            
            if (existingFlag.rows.length === 0) {
              // Save flagged conflict
              const insertRes = await query(
                `INSERT INTO lab_medicine_flags (patient_id, medicine_id, lab_value_id, rule_id, severity, status)
                 VALUES ($1, $2, $3, $4, $5, 'shown')
                 RETURNING *`,
                [patientId, medicine.id, labValue.id, rule.id, rule.severity]
              );
              
              logger.info('LAB_MEDICINE_ALERT_CREATED', `Created safety alert for ${rule.generic_name} + ${testType} (${numericVal} ${labValue.unit})`);
              flaggedConflicts.push(insertRes.rows[0]);
            }
          }
        }
      }
    }

    return flaggedConflicts;

  } catch (err) {
    logger.error('LAB_MEDICINE_CHECK_ERROR', `Error checking lab-medicine safety for patient ${patientId}: ${err.message}`);
    throw err;
  }
}

module.exports = {
  checkLabMedicineConflicts,
};
