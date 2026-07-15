const Redis = require('ioredis');
const logger = require('../utils/logger');

const redisUrl = process.env.REDIS_URL;

let redisConnection;

if (!redisUrl) {
  logger.info('REDIS_MOCK_ACTIVE', 'No REDIS_URL configured. Utilizing in-memory Redis mock.');
  redisConnection = {
    get: async () => null,
    setex: async () => 'OK',
    on: () => {},
    isMock: true
  };
} else {
  redisConnection = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
  });

  redisConnection.on('connect', () => {
    logger.info('REDIS_CONNECTED', 'Successfully connected to Redis instance');
  });

  redisConnection.on('error', (err) => {
    logger.warn('REDIS_ERROR', `Redis connection failure: ${err.message}`);
  });
}

module.exports = redisConnection;
