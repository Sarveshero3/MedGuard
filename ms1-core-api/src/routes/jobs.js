const express = require('express');
const { sseClients } = require('../services/queueService');
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

  req.on('close', () => {
    sseClients.delete(jobId);
    logger.info('SSE_CLIENT_DISCONNECTED', `SSE stream closed for job ${jobId}`);
  });
});

module.exports = router;
