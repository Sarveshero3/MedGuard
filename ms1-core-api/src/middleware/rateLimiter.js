const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

const isDev = process.env.NODE_ENV === 'development';

// General handler for rate limit exceedance to log the event
const handleLimitReached = (limitName) => (req, res, next, options) => {
  logger.warn('RATE_LIMIT_EXCEEDED', `IP ${req.ip} exceeded rate limit for ${limitName}`, {
    ip: req.ip,
    url: req.originalUrl,
    limitName,
  });

  const opt = typeof next === 'object' ? next : options;
  const message = (opt && opt.message) || 'Too many requests, please try again later.';

  res.status(429).json({
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: message,
    },
  });
};

// apiLimiter: Max 10000 requests per 15 minutes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 100000 : 10000,
  message: 'Too many API requests from this IP. Please try again after 15 minutes.',
  handler: handleLimitReached('apiLimiter'),
  standardHeaders: true,
  legacyHeaders: false,
});

// authLimiter: Max 10000 login attempts per 15 minutes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 100000 : 10000,
  message: 'Too many login attempts. Please try again after 15 minutes.',
  handler: handleLimitReached('authLimiter'),
  standardHeaders: true,
  legacyHeaders: false,
});

// registerLimiter: Max 10000 registrations per hour
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: isDev ? 100000 : 10000,
  message: 'Too many accounts created from this IP. Please try again after an hour.',
  handler: handleLimitReached('registerLimiter'),
  standardHeaders: true,
  legacyHeaders: false,
});

// uploadLimiter: Max 5000 uploads per 10 minutes for dev/testing ease
const uploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: isDev ? 50000 : 5000,
  message: 'Too many document uploads. Please try again after 10 minutes.',
  handler: handleLimitReached('uploadLimiter'),
  standardHeaders: true,
  legacyHeaders: false,
});

// otpCooldownLimiter: Max 1 request per 30 seconds (cooldown)
const otpCooldownLimiter = rateLimit({
  windowMs: isDev ? 500 : 30 * 1000, // 0.5s for dev, 30s for prod
  max: 1,
  message: 'Please wait 30 seconds before requesting another code.',
  handler: handleLimitReached('otpCooldownLimiter'),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip + '_' + (req.body.email || '');
  }
});

// otpLockoutLimiter: Max 5 attempts per 15 minutes (lockout)
const otpLockoutLimiter = rateLimit({
  windowMs: isDev ? 500 : 15 * 60 * 1000, // 0.5s for dev, 15m for prod
  max: isDev ? 100000 : 5,
  message: 'Too many OTP attempts. You have been locked out for 15 minutes.',
  handler: handleLimitReached('otpLockoutLimiter'),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip + '_' + (req.body.email || '');
  }
});

module.exports = {
  authLimiter,
  registerLimiter,
  uploadLimiter,
  apiLimiter,
  otpCooldownLimiter,
  otpLockoutLimiter
};
