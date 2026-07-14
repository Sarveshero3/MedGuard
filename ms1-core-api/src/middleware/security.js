const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const logger = require('../utils/logger');

// Escape HTML tags to prevent XSS (cross-site scripting / HTML injection)
function escapeHTML(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

// Recursively sanitize query, param, and body properties
function sanitize(input) {
  if (typeof input === 'string') {
    return escapeHTML(input.trim());
  }
  if (Array.isArray(input)) {
    return input.map(sanitize);
  }
  if (input !== null && typeof input === 'object') {
    const sanitized = {};
    for (const key in input) {
      if (Object.prototype.hasOwnProperty.call(input, key)) {
        sanitized[key] = sanitize(input[key]);
      }
    }
    return sanitized;
  }
  return input;
}

// Request sanitization middleware
const sanitizeInput = (req, res, next) => {
  req.body = sanitize(req.body);
  req.query = sanitize(req.query);
  req.params = sanitize(req.params);
  next();
};

// Validate that parameter matches UUIDv4 format
const validateUUID = (paramName) => (req, res, next) => {
  const value = req.params[paramName];
  const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[40-9a-fA-F]{4}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
  if (value && !uuidRegex.test(value)) {
    logger.warn('INPUT_VALIDATION_FAILED', `Invalid UUID parameter: ${paramName}=${value}`, { ip: req.ip });
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: `Invalid ID parameter format for ${paramName}`,
      },
    });
  }
  next();
};

// Multer Storage Configuration
// Restrict storage to a safe sub-directory in workspace, generate random secure UUID filenames to prevent path traversal
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Save inside the project workspace directory
    cb(null, path.join(__dirname, '../../uploads/'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = crypto.randomUUID();
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

// Multer File Filter: Accept only JPEG/PNG
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg'];
  const allowedExtensions = ['.jpg', '.jpeg', '.png'];
  
  const ext = path.extname(file.originalname).toLowerCase();
  const isMimeTypeValid = allowedMimeTypes.includes(file.mimetype);
  const isExtensionValid = allowedExtensions.includes(ext);

  if (isMimeTypeValid && isExtensionValid) {
    cb(null, true);
  } else {
    logger.warn('FILE_UPLOAD_REJECTED', `Rejected upload of file type ${file.mimetype} with ext ${ext}`, { ip: req.ip });
    cb(new Error('Invalid file type. Only JPEG and PNG are allowed.'), false);
  }
};

// Secure Multer configuration (max 8MB file size, matching PRD)
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 8 * 1024 * 1024, // 8MB
    files: 1, // Only 1 file per request
  },
});

// Common validation schemas
const schemas = {
  register: (body) => {
    const { name, email, password, role, consentGranted } = body;
    if (!name || name.trim().length < 2) return 'Name must be at least 2 characters long';
    
    // Strict email check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) return 'Invalid email address';
    
    // Password complexity check (at least 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char)
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!password || !passwordRegex.test(password)) {
      return 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)';
    }
    
    const allowedRoles = ['patient', 'caregiver'];
    if (!role || !allowedRoles.includes(role)) return 'Invalid user role';
    
    if (consentGranted !== true) return 'Consent is required under DPDP compliance regulations';
    
    return null; // Valid
  },
  login: (body) => {
    const { email, password } = body;
    if (!email || !password) return 'Email and password are required';
    return null;
  },
  forgotPassword: (body) => {
    const { email } = body;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) return 'Invalid email address';
    return null;
  },
  resetPassword: (body) => {
    const { token, email, password } = body;
    if (!token) return 'Reset token is required';
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) return 'Invalid email address';
    
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!password || !passwordRegex.test(password)) {
      return 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)';
    }
    return null;
  },
  medicine: (body) => {
    const { brand_name, dosage, frequency } = body;
    if (!brand_name || brand_name.trim().length < 2) return 'Brand name is required';
    if (!dosage || dosage.trim().length < 1) return 'Dosage description is required';
    if (!frequency || frequency.trim().length < 1) return 'Frequency description is required';
    return null;
  }
};

const validateBody = (type) => (req, res, next) => {
  const validator = schemas[type];
  if (!validator) return next();

  const errMessage = validator(req.body);
  if (errMessage) {
    logger.warn('INPUT_VALIDATION_FAILED', `Request body validation failed for ${type}: ${errMessage}`, { ip: req.ip });
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: errMessage,
      },
    });
  }
  next();
};

module.exports = {
  sanitizeInput,
  validateUUID,
  upload,
  validateBody,
};
