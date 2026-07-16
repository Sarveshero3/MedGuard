const express = require('express');
const { sseClients, extractionQueue } = require('../services/queueService');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * GET /api/status/stream/:jobId
 * Establishes an SSE connection to stream extraction status updates.
 */
router.get('/status/stream/:jobId', (req, res) => {
  const { jobId } = req.params;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  // Register SSE client
  sseClients.set(jobId, res);
  logger.info('SSE_CLIENT_CONNECTED', `SSE stream established for job ${jobId}`);

  // Send initial signal
  res.write(`data: ${JSON.stringify({ status: 'queued', message: 'Job is queued...' })}\n\n`);

  // Check if job has already completed or failed, and push the status immediately
  (async () => {
    try {
      if (extractionQueue && typeof extractionQueue.getJob === 'function') {
        const job = await extractionQueue.getJob(jobId);
        if (job) {
          const state = await job.getState();
          if (state === 'completed') {
            res.write(`data: ${JSON.stringify({
              status: 'completed',
              message: 'Extraction complete.',
              data: job.returnvalue
            })}\n\n`);
          } else if (state === 'failed') {
            res.write(`data: ${JSON.stringify({
              status: 'failed',
              message: 'Extraction failed.',
              error: job.failedReason || 'Previous extraction failed.'
            })}\n\n`);
          }
        }
      }
    } catch (err) {
      logger.warn('SSE_INIT_CHECK_FAILED', `Failed to check initial job state for SSE: ${err.message}`);
    }
  })();

  req.on('close', () => {
    sseClients.delete(jobId);
    logger.info('SSE_CLIENT_DISCONNECTED', `SSE stream closed for job ${jobId}`);
  });
});

module.exports = router;
