/**
 * Structured logger utility for MedGuard Core API.
 * Ensures consistent output and compliance with privacy constraints (never logs secrets).
 */

function formatLog(level, event, message, details = {}) {
  // Deep copy details to avoid modifying original objects
  const safeDetails = JSON.parse(JSON.stringify(details));

  // Redact potentially sensitive keys
  const sensitiveKeys = ['password', 'password_hash', 'token', 'jwt', 'secret', 'authorization', 'cookie'];
  
  const redact = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    for (const key in obj) {
      if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
        obj[key] = '[REDACTED]';
      } else if (typeof obj[key] === 'object') {
        redact(obj[key]);
      }
    }
  };
  
  redact(safeDetails);

  return JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    message,
    details: safeDetails,
  });
}

const logger = {
  info: (event, message, details) => {
    console.log(formatLog('INFO', event, message, details));
  },
  warn: (event, message, details) => {
    console.warn(formatLog('WARN', event, message, details));
  },
  error: (event, message, details) => {
    console.error(formatLog('ERROR', event, message, details));
  },
  audit: (event, message, details) => {
    console.log(formatLog('AUDIT', event, message, details));
  }
};

module.exports = logger;
