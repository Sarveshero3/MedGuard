const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

// General handler for rate limit exceedance to log the event
const handleLimitReached = (limitName) => (req, res, options) => {
  logger.warn('RATE_LIMIT_EXCEEDED', `IP ${req.ip} exceeded rate limit for ${limitName}`, {
    ip: req.ip,
    url: req.originalUrl,
    limitName,
  });
  res.status(429).json({
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: options.message || 'Too many requests, please try again later.',
    },
  });
};

// apiLimiter: Max 10000 requests per 15 minutes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10000,
  message: 'Too many API requests from this IP. Please try again after 15 minutes.',
  handler: handleLimitReached('apiLimiter'),
  standardHeaders: true,
  legacyHeaders: false,
});

// authLimiter: Max 10000 login attempts per 15 minutes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10000,
  message: 'Too many login attempts. Please try again after 15 minutes.',
  handler: handleLimitReached('authLimiter'),
  standardHeaders: true,
  legacyHeaders: false,
});

// registerLimiter: Max 10000 registrations per hour
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10000,
  message: 'Too many accounts created from this IP. Please try again after an hour.',
  handler: handleLimitReached('registerLimiter'),
  standardHeaders: true,
  legacyHeaders: false,
});

// uploadLimiter: Max 5000 uploads per 10 minutes for dev/testing ease
const uploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5000,
  message: 'Too many document uploads. Please try again after 10 minutes.',
  handler: handleLimitReached('uploadLimiter'),
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  authLimiter,
  registerLimiter,
  uploadLimiter,
  apiLimiter,
};
