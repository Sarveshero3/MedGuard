const { Queue, Worker } = require('bullmq');
const redisConnection = require('../config/redis');
const logger = require('../utils/logger');
const fs = require('fs');

const MS2_BASE_URL = process.env.MS2_BASE_URL || 'http://localhost:8000';
const MS2_INTERNAL_SECRET = process.env.MS2_INTERNAL_SECRET || 'dev-secret';

// Minimal circuit breaker for ms1 -> ms2 communication
// ponytail: native object state instead of opossum/opossum dependency.
const circuitBreaker = {
  failures: 0,
  lastFailureTime: 0,
  threshold: 5,
  cooldownMs: 30000,
  isOpen() {
    if (this.failures >= this.threshold) {
      if (Date.now() - this.lastFailureTime > this.cooldownMs) {
        this.failures = 0; // Half-open
        return false;
      }
      return true;
    }
    return false;
  },
  recordSuccess() {
    this.failures = 0;
  },
  recordFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
  }
};

async function fetchWithResilience(url, options = {}, retries = 3, timeoutMs = 15000) {
  if (circuitBreaker.isOpen()) {
    throw new Error('Circuit breaker open: ms2 service is currently unavailable');
  }

  options.headers = {
    ...options.headers,
    'x-internal-auth': MS2_INTERNAL_SECRET
  };

  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(id);

      if (!res.ok && res.status >= 500) {
        throw new Error(`ms2 returned 5xx: ${res.status}`);
      }
      
      circuitBreaker.recordSuccess();
      return res;
    } catch (err) {
      if (i === retries - 1) {
        circuitBreaker.recordFailure();
        throw err;
      }
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i))); // exponential backoff
    }
  }
}

async function extractDocumentData(endpoint, filePath, fileName, visitsContext = []) {
  logger.info('MS2_CALL', `Calling ms2 ${endpoint}`);
  const fileBuffer = fs.readFileSync(filePath);
  const fileBlob = new Blob([fileBuffer]);
  const formData = new FormData();
  formData.append('photo', fileBlob, fileName);
  formData.append('existing_visits', JSON.stringify(visitsContext));

  const res = await fetchWithResilience(`${MS2_BASE_URL}/api/extract/${endpoint}`, {
    method: 'POST',
    body: formData
  }, 3, 45000);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ms2 returned status ${res.status}: ${text}`);
  }
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error?.message || 'Agent service extraction failed.');
  }
  return json.data;
}

// Map to hold active Server-Sent Events (SSE) connections
const sseClients = new Map();

let extractionQueue;
let extractionWorker;
let researchQueue;
let researchWorker;

if (redisConnection.isMock) {
  logger.info('QUEUE_MOCK_ACTIVE', 'Initializing in-memory mock extraction queue');
  
  extractionQueue = {
    add: async (name, data) => {
      const jobId = require('crypto').randomUUID();
      
      // Run execution asynchronously to simulate queue processing
      setTimeout(async () => {
        logger.info('MOCK_QUEUE_JOB_START', `Processing mock job ${jobId} of type ${data.type}`);
        sendSSEMessage(jobId, { status: 'processing', message: 'Analyzing document structure...' });
        
        try {
          let result;
          if (data.type === 'auto') {
            result = await extractDocumentData('document', data.filePath, data.fileName, data.visitsContext);
          } else if (data.type === 'prescription') {
            result = await extractDocumentData('prescription', data.filePath, data.fileName, data.visitsContext);
          } else {
            result = await extractDocumentData('lab-report', data.filePath, data.fileName, data.visitsContext);
          }

          // Clean up physical file after extraction
          if (fs.existsSync(data.filePath)) {
            fs.unlinkSync(data.filePath);
          }

          logger.info('MOCK_QUEUE_JOB_SUCCESS', `Successfully completed mock job ${jobId}`);
          sendSSEMessage(jobId, { 
            status: 'completed', 
            message: 'Extraction complete.',
            data: result,
          });
        } catch (err) {
          logger.error('MOCK_QUEUE_JOB_FAILED', `Mock job ${jobId} failed: ${err.message}`);
          sendSSEMessage(jobId, { 
            status: 'failed', 
            message: 'Extraction failed.',
            error: 'Extraction failed. Please try uploading again.',
          });
          if (fs.existsSync(data.filePath)) {
            fs.unlinkSync(data.filePath);
          }
        }
      }, 1500); // 1.5s simulated network/processing latency

      return { id: jobId };
    }
  };

  researchQueue = {
    add: async (name, data) => {
      logger.info('MOCK_QUEUE_JOB_START', `Mocking research job for ${data.resolvedGeneric}`);
      return { id: require('crypto').randomUUID() };
    }
  };
} else {
  // Initialize BullMQ Queue
  extractionQueue = new Queue('extractionQueue', {
    connection: redisConnection,
  });

  // Setup extraction job Worker
  extractionWorker = new Worker(
    'extractionQueue',
    async (job) => {
      const { type, filePath, fileName, patientId, visitsContext, _traceparent } = job.data;
      
      // Parse tracing context (Step 11)
      const crypto = require('crypto');
      let parentSpanId = 'unknown';
      let traceId = 'unknown';
      if (_traceparent) {
        const parts = _traceparent.split('-');
        traceId = parts[1] || 'unknown';
        parentSpanId = parts[2] || 'unknown';
      }
      const childSpanId = crypto.randomBytes(8).toString('hex');
      logger.info('SPAN_PROPAGATED', `BullMQ Worker span ${childSpanId} linked to parent trace ${traceId} (parent span ${parentSpanId})`);

      logger.info('QUEUE_JOB_START', `Processing job ${job.id} of type ${type} for patient ${patientId}`);
      sendSSEMessage(job.id, { status: 'processing', message: 'Analyzing document structure...' });

      try {
        let result;
        if (type === 'auto') {
          result = await extractDocumentData('document', filePath, fileName, visitsContext);
        } else if (type === 'prescription') {
          result = await extractDocumentData('prescription', filePath, fileName, visitsContext);
        } else {
          result = await extractDocumentData('lab-report', filePath, fileName, visitsContext);
        }

        // Clean up file
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }

        logger.info('QUEUE_JOB_SUCCESS', `Successfully completed job ${job.id}`);
        sendSSEMessage(job.id, { 
          status: 'completed', 
          message: 'Extraction complete.',
          data: result,
        });

        return result;
      } catch (err) {
        logger.error('QUEUE_JOB_FAILED', `Job ${job.id} failed: ${err.message}`);
        sendSSEMessage(job.id, { 
          status: 'failed', 
          message: 'Extraction failed.',
          error: 'Extraction failed. Please try uploading again.',
        });
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        throw err;
      }
    },
    {
      connection: redisConnection,
    }
  );

  // Worker error handler
  extractionWorker.on('error', (err) => {
    logger.error('WORKER_ERROR', `BullMQ Worker error: ${err.message}`);
  });

  // Initialize Research Queue
  researchQueue = new Queue('researchQueue', {
    connection: redisConnection,
  });

  // Setup research job Worker
  researchWorker = new Worker(
    'researchQueue',
    async (job) => {
      const { patient_id, newMedId, resolvedGeneric, conflictingGeneric, conflictingMedId } = job.data;
      logger.info('AGENT_RESEARCH_TRIGGER_BG', `Processing research job ${job.id} for ${resolvedGeneric} and ${conflictingGeneric}`);
      
      const payload = { generic_a: resolvedGeneric, generic_b: conflictingGeneric };
      const res = await fetchWithResilience(`${MS2_BASE_URL}/api/research-interaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }, 3, 45000); // 45s timeout for research

      if (!res.ok) {
        throw new Error(`ms2 returned status ${res.status}`);
      }
      const json = await res.json();
      if (!json.success || !json.data) return;

      const explanation = json.data.explanation || '';
      const lowercaseExp = explanation.toLowerCase();
      const isNoInteraction = lowercaseExp.includes("no significant interaction") || 
                              lowercaseExp.includes("no known interaction") || 
                              (lowercaseExp.includes("no interaction") && lowercaseExp.includes("safe"));
      
      if (explanation && !isNoInteraction) {
        const sorted = [resolvedGeneric.toLowerCase(), conflictingGeneric.toLowerCase()].sort();
        const { pool } = require('../config/db');
        const bgClient = await pool.connect();
        try {
          const kbRes = await bgClient.query(
            `INSERT INTO interaction_kb (generic_a, generic_b, severity, explanation, source, version)
             VALUES ($1, $2, 'monitor_closely', $3, 'Groq Research Agent', 'v1')
             RETURNING id`,
            [sorted[0], sorted[1], explanation]
          );
          const kbEntryId = kbRes.rows[0].id;
          
          await bgClient.query(
            `INSERT INTO interaction_flags (patient_id, new_medicine_id, existing_medicine_id, kb_entry_id, severity, confidence, status)
             VALUES ($1, $2, $3, $4, 'monitor_closely', 1.0, 'shown')
             ON CONFLICT DO NOTHING`,
            [patient_id, newMedId, conflictingMedId, kbEntryId]
          );
          logger.info('AGENT_ALERT_CREATED_BG', `Researched and created custom interaction flag in background for ${resolvedGeneric} and ${conflictingGeneric}`);
        } finally {
          bgClient.release();
        }
      }
    },
    { connection: redisConnection }
  );

  researchWorker.on('error', (err) => {
    logger.error('RESEARCH_WORKER_ERROR', `BullMQ Research Worker error: ${err.message}`);
  });
}

/**
 * Sends a message payload to a registered SSE client.
 * @param {string} jobId - Job ID
 * @param {object} payload - Message payload
 */
function sendSSEMessage(jobId, payload) {
  const client = sseClients.get(jobId);
  if (client) {
    client.write(`data: ${JSON.stringify(payload)}\n\n`);
  }
}

module.exports = {
  extractionQueue,
  researchQueue,
  sseClients,
};
