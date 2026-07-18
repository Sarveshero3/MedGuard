const { query } = require('../config/db');
const { checkInteractions } = require('../utils/interactionEngine');
const { researchQueue } = require('./queueService');
const logger = require('../utils/logger');

/**
 * Handles RAG safety checks, database flagging, and triggers async research.
 */
async function processInteractions(patient_id, newMed, resolvedGeneric, existingMeds, client) {
  const existingGenerics = existingMeds.map(m => m.generic_name).filter(Boolean);
  
  if (!resolvedGeneric || resolvedGeneric.toLowerCase() === 'no such medicine found' || existingGenerics.length === 0) {
    return [];
  }

  // Pure database-driven safety module
  const flaggedInteractions = await checkInteractions(resolvedGeneric, existingGenerics);

  if (flaggedInteractions.length > 0) {
    for (const interaction of flaggedInteractions) {
      const existingGenName = [interaction.generic_a.toLowerCase(), interaction.generic_b.toLowerCase()]
        .find(g => g !== resolvedGeneric.toLowerCase());

      const conflictingMed = existingMeds.find(m => m.generic_name && m.generic_name.toLowerCase() === existingGenName);
      
      if (conflictingMed) {
        await client.query(
          `INSERT INTO interaction_flags (patient_id, new_medicine_id, existing_medicine_id, kb_entry_id, severity, confidence, status)
           VALUES ($1, $2, $3, $4, $5, 1.0, 'shown')
           ON CONFLICT DO NOTHING`,
          [patient_id, newMed.id, conflictingMed.id, interaction.id, interaction.severity]
        );
      }
    }
  }

  // Identify interactions that haven't been flagged yet to send to the background RAG agent
  const flaggedPairs = flaggedInteractions.map(f => {
    return [f.generic_a.toLowerCase(), f.generic_b.toLowerCase()].sort().join('|');
  });

  for (const conflictingMed of existingMeds) {
    if (!conflictingMed.generic_name) continue;
    
    const pair = [resolvedGeneric.toLowerCase(), conflictingMed.generic_name.toLowerCase()].sort().join('|');
    
    if (!flaggedPairs.includes(pair)) {
      // Not flagged yet -> queue it for RAG agent research
      await researchQueue.add('research-interaction', {
        patient_id,
        newMedId: newMed.id,
        resolvedGeneric,
        conflictingGeneric: conflictingMed.generic_name,
        conflictingMedId: conflictingMed.id
      });
    }
  }

  return flaggedInteractions;
}

module.exports = { processInteractions };
