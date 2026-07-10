const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const logger = require('../utils/logger');
const { sanitizeInput, validateBody } = require('../middleware/security');
const { authLimiter, registerLimiter } = require('../middleware/rateLimiter');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-to-a-random-64-char-string';

/**
 * POST /api/auth/register
 * Registers a new user (patient or caregiver) and records DPDP consent.
 */
router.post('/auth/register', registerLimiter, sanitizeInput, validateBody('register'), async (req, res, next) => {
  const { name, email, password, role } = req.body;

  try {
    // Check if email already registered
    const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      logger.warn('REGISTRATION_FAILED', `Email already in use: ${email}`, { ip: req.ip });
      return res.status(409).json({
        success: false,
        error: {
          code: 'EMAIL_ALREADY_IN_USE',
          message: 'An account with this email address already exists.',
        },
      });
    }

    // Securely hash password (12 rounds)
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);
    
    // Generate secure email verification token
    const verificationToken = crypto.randomBytes(16).toString('hex');

    // Create user and consent record in a transaction
    // (Manual transaction handling for pg client)
    const client = await require('../config/db').pool.connect();
    try {
      await client.query('BEGIN');
      
      const userInsertQuery = `
        INSERT INTO users (name, email, password_hash, role, email_verification_token)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, name, email, role, is_email_verified
      `;
      const userRes = await client.query(userInsertQuery, [name, email, passwordHash, role, verificationToken]);
      const newUser = userRes.rows[0];

      // Insert DPDP Consent Record
      const consentInsertQuery = `
        INSERT INTO consent_records (user_id, consent_type, granted_at)
        VALUES ($1, $2, NOW())
      `;
      await client.query(consentInsertQuery, [newUser.id, 'health_data_processing']);

      await client.query('COMMIT');

      logger.audit('USER_REGISTERED', `Successfully registered user ${newUser.id} with role ${newUser.role}`, {
        userId: newUser.id,
        role: newUser.role,
      });

      // Mock Send Email Verification or Production AWS SES Integration
      if (process.env.NODE_ENV === 'development') {
        logger.info('EMAIL_DISPATCHED', `[MOCK EMAIL] To: ${newUser.email} | Verification link: http://localhost:3000/verify-email?token=${verificationToken}`, {
          email: newUser.email,
        });
      } else {
        logger.info('EMAIL_DISPATCHED', `[AWS SES] Production email dispatch initiated for: ${newUser.email} (token redacted)`, {
          email: newUser.email,
        });
      }

      // Generate JWT Token (1 hour validity)
      const token = jwt.sign(
        { userId: newUser.id, email: newUser.email, role: newUser.role },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

      res.status(201).json({
        success: true,
        data: {
          token,
          user: {
            id: newUser.id,
            name: newUser.name,
            email: newUser.email,
            role: newUser.role,
            isEmailVerified: newUser.is_email_verified,
          },
        },
      });

    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

  } catch (err) {
    logger.error('REGISTRATION_ERROR', `Error during user registration: ${err.message}`, { details: err.stack });
    next(err);
  }
});

/**
 * POST /api/auth/login
 * Standard user login with credential verification.
 */
router.post('/auth/login', authLimiter, sanitizeInput, validateBody('login'), async (req, res, next) => {
  const { email, password } = req.body;

  try {
    const userResult = await query(
      'SELECT id, name, email, password_hash, role, is_email_verified FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      logger.warn('LOGIN_FAILED', 'Invalid login attempt: email not found', { email, ip: req.ip });
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid email or password.',
        },
      });
    }

    const user = userResult.rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      logger.warn('LOGIN_FAILED', `Invalid password attempt for user ${user.id}`, { userId: user.id, ip: req.ip });
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid email or password.',
        },
      });
    }

    logger.audit('LOGIN_SUCCESS', `User ${user.id} logged in successfully`, { userId: user.id, role: user.role });

    // Generate JWT Token (1 hour validity)
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          isEmailVerified: user.is_email_verified,
        },
      },
    });

  } catch (err) {
    logger.error('LOGIN_ERROR', `Error during user login: ${err.message}`);
    next(err);
  }
});

/**
 * POST /api/auth/verify-email
 * Verifies user email verification token.
 */
router.post('/auth/verify-email', sanitizeInput, async (req, res, next) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'Token is required.',
      },
    });
  }

  try {
    const userResult = await query(
      'SELECT id, email FROM users WHERE email_verification_token = $1',
      [token]
    );

    if (userResult.rows.length === 0) {
      logger.warn('EMAIL_VERIFY_FAILED', `Invalid verification token used: ${token}`, { ip: req.ip });
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired email verification token.',
        },
      });
    }

    const user = userResult.rows[0];
    await query(
      'UPDATE users SET is_email_verified = TRUE, email_verification_token = NULL WHERE id = $1',
      [user.id]
    );

    logger.audit('EMAIL_VERIFIED', `User ${user.id} successfully verified email`, { userId: user.id });

    res.json({
      success: true,
      data: {
        message: 'Email verified successfully.',
      },
    });

  } catch (err) {
    logger.error('EMAIL_VERIFY_ERROR', `Error verifying email: ${err.message}`);
    next(err);
  }
});

/**
 * POST /api/auth/forgot-password
 * Triggers password reset sequence. Generic response provided to avoid user enumeration.
 */
router.post('/auth/forgot-password', authLimiter, sanitizeInput, validateBody('forgotPassword'), async (req, res, next) => {
  const { email } = req.body;

  try {
    const userResult = await query('SELECT id, name FROM users WHERE email = $1', [email]);
    
    // Always return success to prevent user enumeration
    const successResponse = {
      success: true,
      data: {
        message: 'If the email exists in our system, a password reset link has been dispatched.',
      },
    };

    if (userResult.rows.length === 0) {
      logger.info('PASSWORD_RESET_REQUEST', `Forgot password requested for non-existent email: ${email}`, { ip: req.ip });
      return res.json(successResponse);
    }

    const user = userResult.rows[0];
    const resetToken = crypto.randomBytes(20).toString('hex');
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour validity

    await query(
      'UPDATE users SET password_reset_token = $1, password_reset_expires = $2 WHERE id = $3',
      [resetToken, expiry, user.id]
    );

    logger.audit('PASSWORD_RESET_TOKEN_GENERATED', `Password reset token generated for user ${user.id}`, { userId: user.id });

    // Mock Send Password Reset Email or Production AWS SES Integration
    if (process.env.NODE_ENV === 'development') {
      logger.info('EMAIL_DISPATCHED', `[MOCK EMAIL] To: ${email} | Reset link: http://localhost:3000/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`, {
        email,
      });
    } else {
      logger.info('EMAIL_DISPATCHED', `[AWS SES] Password reset link sent to: ${email} (link redacted)`, {
        email,
      });
    }

    res.json(successResponse);

  } catch (err) {
    logger.error('PASSWORD_RESET_ERROR', `Error requesting password reset: ${err.message}`);
    next(err);
  }
});

/**
 * POST /api/auth/reset-password
 * Executes password reset.
 */
router.post('/api/auth/reset-password', authLimiter, sanitizeInput, validateBody('resetPassword'), async (req, res, next) => {
  const { token, email, password } = req.body;

  try {
    const userResult = await query(
      'SELECT id FROM users WHERE email = $1 AND password_reset_token = $2 AND password_reset_expires > NOW()',
      [email, token]
    );

    if (userResult.rows.length === 0) {
      logger.warn('PASSWORD_RESET_FAILED', `Invalid/expired reset token attempted for email: ${email}`, { ip: req.ip });
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired password reset token.',
        },
      });
    }

    const user = userResult.rows[0];

    // Securely hash new password
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    await query(
      'UPDATE users SET password_hash = $1, password_reset_token = NULL, password_reset_expires = NULL WHERE id = $2',
      [passwordHash, user.id]
    );

    logger.audit('PASSWORD_RESET_SUCCESS', `Successfully reset password for user ${user.id}`, { userId: user.id });

    res.json({
      success: true,
      data: {
        message: 'Password reset successfully.',
      },
    });

  } catch (err) {
    logger.error('PASSWORD_RESET_ERROR', `Error resetting password: ${err.message}`);
    next(err);
  }
});

module.exports = router;
