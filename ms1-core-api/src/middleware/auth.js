const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-to-a-random-64-char-string';

// Authenticate JWT token and attach user to request
async function authenticateUser(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn('AUTHENTICATION_FAILED', 'No Bearer token provided', { ip: req.ip });
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Access denied. No authentication token provided.',
      },
    });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Check if user still exists in database
    const userResult = await query(
      'SELECT id, name, email, role, is_email_verified FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      logger.warn('AUTHENTICATION_FAILED', 'User token is valid, but user no longer exists', {
        userId: decoded.userId,
        ip: req.ip,
      });
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Access denied. User no longer exists.',
        },
      });
    }

    const user = userResult.rows[0];
    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isEmailVerified: user.is_email_verified,
    };

    next();
  } catch (err) {
    logger.warn('AUTHENTICATION_FAILED', `Token verification failed: ${err.message}`, { ip: req.ip });
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Access denied. Invalid or expired token.',
      },
    });
  }
}

// Enforce role requirements (RBAC)
function requireRoles(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Access denied. Authentication required.',
        },
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn('ACCESS_DENIED', `User ${req.user.id} with role ${req.user.role} attempted to access route requiring role(s) [${allowedRoles.join(', ')}]`, {
        userId: req.user.id,
        role: req.user.role,
        path: req.originalUrl,
      });

      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied. You do not have permissions to access this resource.',
        },
      });
    }

    next();
  };
}

// Access validator helper (IDOR protection)
// Checks if the logged-in user has permission to access patientId's data
async function verifyPatientAccess(req, patientId, requiredAccessLevel = 'alerts_only') {
  if (!req.user) return false;

  // 1. Patient accessing their own data: always allowed
  if (req.user.role === 'patient' && req.user.id === patientId) {
    return true;
  }

  // 2. Caregiver accessing linked patient data: verify caregiver link and status
  if (req.user.role === 'caregiver') {
    const linkResult = await query(
      `SELECT status 
       FROM caregiver_links 
       WHERE patient_id = $1 AND caregiver_id = $2 AND status = 'active'`,
      [patientId, req.user.id]
    );

    if (linkResult.rows.length === 0) {
      logger.warn('IDOR_PREVENTED', `Caregiver ${req.user.id} attempted unauthorized access to patient ${patientId}`, {
        caregiverId: req.user.id,
        patientId,
      });
      return false;
    }

    return true;
  }



  logger.warn('IDOR_PREVENTED', `User ${req.user.id} with role ${req.user.role} attempted unauthorized access to patient ${patientId}`, {
    userId: req.user.id,
    patientId,
  });
  return false;
}

// IDOR ownership check middleware for specific URL params containing patientId
const enforcePatientAccess = (requiredAccessLevel = 'alerts_only') => async (req, res, next) => {
  const patientId = req.query.patient_id || req.body.patient_id || req.params.patientId;
  
  if (!patientId) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'patient_id is required to access this resource.',
      },
    });
  }

  const isAuthorized = await verifyPatientAccess(req, patientId, requiredAccessLevel);
  if (!isAuthorized) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Access denied. You do not have permissions to access data for this patient.',
      },
    });
  }

  next();
};

// Middleware to restrict AI extraction, prescription upload or modifications to verified emails only
function enforceEmailVerified(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
    });
  }

  if (!req.user.isEmailVerified) {
    logger.warn('EMAIL_VERIFICATION_REQUIRED', `Unverified user ${req.user.id} attempted verification-locked action`, {
      userId: req.user.id,
      email: req.user.email,
    });
    return res.status(403).json({
      success: false,
      error: {
        code: 'EMAIL_UNVERIFIED',
        message: 'Your email address must be verified to perform this action. Please check your inbox for verification instructions.',
      },
    });
  }
  next();
}

module.exports = {
  authenticateUser,
  requireRoles,
  verifyPatientAccess,
  enforcePatientAccess,
  enforceEmailVerified,
};
