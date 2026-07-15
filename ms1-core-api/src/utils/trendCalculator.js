/**
 * Deterministic Trend Calculator
 * Safety-adjacent clinical checks running in ms1 (Express.js)
 */

/**
 * Calculates if a new lab value represents a meaningful clinical change compared to history.
 * @param {string} testType - Canonical test type (e.g. 'HbA1c', 'TSH', 'LDL')
 * @param {number} newValue - Newly recorded lab value
 * @param {Array} history - Array of past records sorted by date descending, e.g. [{ value, recorded_at }]
 * @returns {object} - { isMeaningfulChange: boolean, direction: string, message: string }
 */
function calculateTrend(testType, newValue, history) {
  if (!history || history.length === 0) {
    return { isMeaningfulChange: false };
  }

  const lastRecord = history[0];
  const lastValue = parseFloat(lastRecord.value);
  const currentVal = parseFloat(newValue);

  if (isNaN(lastValue) || isNaN(currentVal)) {
    return { isMeaningfulChange: false };
  }

  // 1. Special rule for HbA1c (absolute increase >= 0.3)
  if (testType.toLowerCase() === 'hba1c') {
    const diff = currentVal - lastValue;
    if (diff >= 0.3) {
      return {
        isMeaningfulChange: true,
        direction: 'rising',
        message: `HbA1c has rose from ${lastValue}% to ${currentVal}% (absolute increase of ${diff.toFixed(2)}%).`,
      };
    } else if (diff <= -0.3) {
      return {
        isMeaningfulChange: false,
        direction: 'falling',
        message: `HbA1c decreased from ${lastValue}% to ${currentVal}%.`,
      };
    }
  } else {
    // 2. Relative increase > 10% for other tests
    const relativeChange = (currentVal - lastValue) / lastValue;
    if (relativeChange >= 0.10) {
      return {
        isMeaningfulChange: true,
        direction: 'rising',
        message: `${testType} has increased significantly from ${lastValue} to ${currentVal} (relative increase of ${(relativeChange * 100).toFixed(1)}%).`,
      };
    } else if (relativeChange <= -0.10) {
      return {
        isMeaningfulChange: false,
        direction: 'falling',
        message: `${testType} decreased from ${lastValue} to ${currentVal}.`,
      };
    }
  }

  return { isMeaningfulChange: false };
}

module.exports = {
  calculateTrend,
};
