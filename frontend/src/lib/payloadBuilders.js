export function buildPrescriptionPayload(userId, finalVisitId, prescriptionMedicines, activeItem) {
  return {
    patient_id: userId,
    visit_id: finalVisitId,
    medicines: prescriptionMedicines.map(m => ({
      brand_name: m.brand_name,
      generic_name: m.generic_name,
      dosage: m.dosage,
      frequency: m.frequency,
      duration_text: m.duration_text,
      added_at: m.added_at,
      source_photo_id: activeItem.extraction.source_photo_id,
      brand_mapping_correction: m.generic_name && (m.generic_name !== 'generic_unresolved' && m.generic_name !== 'no such medicine found') ? {
        brand_name: m.brand_name,
        generic_name: m.generic_name,
        is_correction: m.generic_name !== m.original_generic_name
      } : undefined
    }))
  };
}

export function buildLabReportPayload(userId, finalVisitId, labFields, activeItem) {
  return {
    patient_id: userId,
    source_photo_id: activeItem.extraction.source_photo_id,
    visit_id: finalVisitId,
    disease_type: labFields.disease_type || undefined,
    values: [{
      test_type: labFields.test_type,
      panel_name: labFields.panel_name,
      value: parseFloat(labFields.value),
      unit: labFields.unit,
      confidence: activeItem.extraction.confidence_scores?.value || 1.0,
      recorded_at: labFields.recorded_at,
    }]
  };
}
