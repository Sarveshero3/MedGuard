/**
 * Email template for interaction safety alerts.
 * 
 * @param {object} newMed - The newly added medicine object
 * @param {string} resolvedGeneric - The generic name of the new medicine
 * @param {Array<object>} flaggedInteractions - Array of interaction objects from interactionEngine
 * @returns {object} { subject, body }
 */
function buildInteractionAlertEmail(newMed, resolvedGeneric, flaggedInteractions) {
  const subject = `🛡️ MedGuard Safety Alert: Drug Interaction Flagged`;
  
  const interactionsList = flaggedInteractions.map(i => {
    return `  * Conflicting drugs: ${i.generic_a} & ${i.generic_b} (Severity: ${i.severity.replace('_', ' ').toUpperCase()})\n    Explanation: ${i.explanation}`;
  }).join('\n');

  const body = `Hello,

A drug interaction has been flagged in your MedGuard profile.

Details:
- New Medicine: ${newMed.brand_name || 'Unknown Brand'} (${resolvedGeneric})
- Flagged Interactions:
${interactionsList}

Please review your dashboard and discuss these details with your doctor.

Best,
The MedGuard Team`;

  return { subject, body };
}

module.exports = { buildInteractionAlertEmail };
