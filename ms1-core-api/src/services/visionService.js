const crypto = require('crypto');

/**
 * Mock Vision Service simulating the ms2 LangGraph Prescription Extraction.
 * Determines mock confidence tiers based on the filename for testing.
 * 
 * @param {string} filePath - Local path to the uploaded image.
 * @param {string} fileName - Original uploaded filename.
 * @returns {Promise<object>} - Structured extraction result matching design.md contracts.
 */
async function extractPrescription(filePath, fileName) {
  const isLowConfidence = fileName.toLowerCase().includes('low') || 
                          fileName.toLowerCase().includes('unresolved') || 
                          fileName.toLowerCase().includes('crocin');

  const sourcePhotoId = crypto.randomUUID();

  if (isLowConfidence) {
    return {
      source_photo_id: sourcePhotoId,
      raw_extraction: {
        brand_name: 'Croc1n',
        dosage: '650mg',
        frequency: 'Three times daily',
        prescribing_doctor: 'Dr. Ramesh Kumar',
        duration_text: '5 days',
      },
      confidence_scores: {
        brand_name: 0.72, // Below 0.85 (low confidence)
        dosage: 0.88,
        frequency: 0.65, // Below 0.85
        prescribing_doctor: 0.92,
      },
      resolution: {
        status: 'generic_unresolved',
        generic_name: null,
      },
      needs_follow_up: true,
      follow_up_question: 'Is the brand name intended to be Crocin?',
    };
  } else {
    return {
      source_photo_id: sourcePhotoId,
      raw_extraction: {
        brand_name: 'Glycomet',
        dosage: '500mg',
        frequency: 'Once daily',
        prescribing_doctor: 'Dr. Ramesh Kumar',
        duration_text: '30 days',
      },
      confidence_scores: {
        brand_name: 0.96, // High confidence
        dosage: 0.95,
        frequency: 0.92,
        prescribing_doctor: 0.98,
      },
      resolution: {
        status: 'resolved',
        generic_name: 'Metformin',
      },
      needs_follow_up: false,
      follow_up_question: null,
    };
  }
}

module.exports = {
  extractPrescription,
};
