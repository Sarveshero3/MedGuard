const { Queue, Worker } = require('bullmq');
const redisConnection = require('../config/redis');
const logger = require('../utils/logger');
const { extractDocument, extractPrescription, extractLabReport } = require('./visionService');
const fs = require('fs');

// Map to hold active Server-Sent Events (SSE) connections
const sseClients = new Map();

let extractionQueue;
let extractionWorker;

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
            result = await extractDocument(data.filePath, data.fileName, data.visitsContext);
          } else if (data.type === 'prescription') {
            result = await extractPrescription(data.filePath, data.fileName, data.visitsContext);
          } else {
            result = await extractLabReport(data.filePath, data.fileName, data.visitsContext);
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
            error: err.message,
          });
          if (fs.existsSync(data.filePath)) {
            fs.unlinkSync(data.filePath);
          }
        }
      }, 1500); // 1.5s simulated network/processing latency

      return { id: jobId };
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
          result = await extractDocument(filePath, fileName, visitsContext);
        } else if (type === 'prescription') {
          result = await extractPrescription(filePath, fileName, visitsContext);
        } else {
          result = await extractLabReport(filePath, fileName, visitsContext);
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
          error: err.message,
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
  sseClients,
};
