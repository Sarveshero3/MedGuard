const fs = require('fs');
const crypto = require('crypto');
const logger = require('../utils/logger');

const MS2_BASE_URL = process.env.MS2_BASE_URL || 'http://localhost:8000';

/**
 * Service to parse document classification and extraction by calling the real ms2 FastAPI endpoint.
 */
async function extractDocument(filePath, fileName, visitsContext = []) {
  logger.info('VISION_SERVICE_MS2_CALL', `Forwarding document extraction/classification to ms2 at ${MS2_BASE_URL}`);

  const fileBuffer = fs.readFileSync(filePath);
  const fileBlob = new Blob([fileBuffer]);
  
  const formData = new FormData();
  formData.append('photo', fileBlob, fileName);
  formData.append('existing_visits', JSON.stringify(visitsContext));

  const res = await fetch(`${MS2_BASE_URL}/api/extract/document`, {
    method: 'POST',
    body: formData
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ms2 returned status ${res.status}: ${text}`);
  }

  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error?.message || 'Agent service extraction failed.');
  }

  logger.info('VISION_SERVICE_MS2_SUCCESS', 'Successfully received document extraction and classification from ms2');
  return json.data;
}

/**
 * Service to parse prescription documents calling the real ms2 FastAPI endpoints.
 */
async function extractPrescription(filePath, fileName, visitsContext = []) {
  logger.info('VISION_SERVICE_MS2_CALL', `Forwarding prescription extraction to ms2 at ${MS2_BASE_URL}`);

  const fileBuffer = fs.readFileSync(filePath);
  const fileBlob = new Blob([fileBuffer]);
  
  const formData = new FormData();
  formData.append('photo', fileBlob, fileName);
  formData.append('existing_visits', JSON.stringify(visitsContext));

  const res = await fetch(`${MS2_BASE_URL}/api/extract/prescription`, {
    method: 'POST',
    body: formData
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ms2 returned status ${res.status}: ${text}`);
  }

  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error?.message || 'Prescription extraction failed.');
  }

  logger.info('VISION_SERVICE_MS2_SUCCESS', 'Successfully received prescription extraction from ms2');
  return json.data;
}

/**
 * Service to parse clinical lab results calling the real ms2 FastAPI endpoints.
 */
async function extractLabReport(filePath, fileName, visitsContext = []) {
  logger.info('VISION_SERVICE_MS2_CALL', `Forwarding lab report extraction to ms2 at ${MS2_BASE_URL}`);

  const fileBuffer = fs.readFileSync(filePath);
  const fileBlob = new Blob([fileBuffer]);
  
  const formData = new FormData();
  formData.append('photo', fileBlob, fileName);
  formData.append('existing_visits', JSON.stringify(visitsContext));

  const res = await fetch(`${MS2_BASE_URL}/api/extract/lab-report`, {
    method: 'POST',
    body: formData
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ms2 returned status ${res.status}: ${text}`);
  }

  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error?.message || 'Lab report extraction failed.');
  }

  logger.info('VISION_SERVICE_MS2_SUCCESS', 'Successfully received lab report extraction from ms2');
  return json.data;
}

module.exports = {
  extractDocument,
  extractPrescription,
  extractLabReport,
};
