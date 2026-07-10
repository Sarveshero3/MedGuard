const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

// Handler when rate limit is exceeded
const limitReachedHandler = (type) => (req, res, next, options) => {
  logger.warn('RATE_LIMIT_EXCEEDED', `IP ${req.ip} exceeded ${type} rate limit`, {
    ip: req.ip,
    path: req.originalUrl,
    method: req.method,
    type
  });
  
  res.status(options.statusCode).json({
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: options.message,
    },
  });
};

// Rate limiter for login/auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: 'Too many authentication attempts. Please try again after 15 minutes.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: limitReachedHandler('auth'),
});

// Rate limiter for account creation
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 account creations per hour
  message: 'Too many account registrations. Please try again after an hour.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: limitReachedHandler('register'),
});

// Rate limiter for prescription photo uploads & AI analysis
const uploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5, // Limit to 5 uploads/extractions per 10 minutes
  message: 'Too many upload requests. Please try again after 10 minutes.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: limitReachedHandler('upload'),
});

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit to 100 requests per 15 minutes
  message: 'Too many requests. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: limitReachedHandler('api'),
});

module.exports = {
  authLimiter,
  registerLimiter,
  uploadLimiter,
  apiLimiter,
};
