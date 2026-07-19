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
      duration_value: m.duration_value,
      duration_unit: m.duration_unit,
      is_lifetime: m.is_lifetime,
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

export function buildLabReportPayload(userId, finalVisitId, labTests, labFields, activeItem) {
  return {
    patient_id: userId,
    source_photo_id: activeItem.extraction.source_photo_id,
    visit_id: finalVisitId,
    disease_type: labFields.disease_type || undefined,
    values: labTests.map(t => ({
      test_type: t.test_type,
      panel_name: t.panel_name || labFields.panel_name || 'Lab Report',
      value: parseFloat(t.value),
      unit: t.unit,
      confidence: activeItem.extraction.confidence_scores?.value || 1.0,
      recorded_at: labFields.recorded_at,
    }))
  };
}
