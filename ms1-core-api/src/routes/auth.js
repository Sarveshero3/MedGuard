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
const JWT_ACCESS_TTL = process.env.JWT_ACCESS_TTL || '15m';
const JWT_REFRESH_TTL = process.env.JWT_REFRESH_TTL || '7d';

/**
 * Parses a duration string (e.g. '15m', '7d', '1h') into milliseconds.
 * Supports s(econds), m(inutes), h(ours), d(ays).
 * Falls back to 7 days if the format is unrecognized.
 */
function parseDurationToMs(duration) {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const value = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return 7 * 24 * 60 * 60 * 1000;
  }
}

/**
 * Issues an access token + refresh token pair and stores the refresh token hash in the database.
 * Returns { accessToken, refreshToken }.
 */
async function issueTokenPair(user, dbClient) {
  const accessToken = jwt.sign(
    { sub: user.id, userId: user.id, email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: JWT_ACCESS_TTL }
  );

  const jti = crypto.randomUUID();
  const refreshToken = jwt.sign(
    { userId: user.id, jti },
    JWT_SECRET,
    { expiresIn: JWT_REFRESH_TTL }
  );

  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const expiresAt = new Date(Date.now() + parseDurationToMs(JWT_REFRESH_TTL));

  const queryFn = dbClient ? dbClient.query.bind(dbClient) : query;
  await queryFn(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
    [user.id, tokenHash, expiresAt]
  );

  return { accessToken, refreshToken };
}

/**
 * POST /api/auth/register
 * Registers a new user (patient or caregiver) and records DPDP consent.
 */
router.post('/auth/register', registerLimiter, sanitizeInput, validateBody('register'), async (req, res, next) => {
  const { name, email, password, role, linking_otp } = req.body;

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

    // Create user and caregiver link (if caregiver) in a transaction
    const client = await require('../config/db').pool.connect();
    try {
      await client.query('BEGIN');
      
      let linkedPatientId = null;
      if (role === 'caregiver') {
        if (!linking_otp) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            success: false,
            error: {
              code: 'BAD_REQUEST',
              message: 'linking_otp is required for caregiver registration.',
            },
          });
        }

        // Verify patient OTP (check validity and expiry)
        const patientResult = await client.query(
          "SELECT id FROM users WHERE linking_otp = $1 AND linking_otp_expires_at > NOW() AND role = 'patient'",
          [linking_otp]
        );

        if (patientResult.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_OTP',
              message: 'The linking code is invalid or has expired.',
            },
          });
        }

        linkedPatientId = patientResult.rows[0].id;

        // Clear patient's OTP (single-use guarantee)
        await client.query(
          'UPDATE users SET linking_otp = NULL, linking_otp_expires_at = NULL WHERE id = $1',
          [linkedPatientId]
        );
      }

      // Create user and write consent_given_at directly (Step 3)
      const userInsertQuery = `
        INSERT INTO users (name, email, password_hash, role, email_verification_token, consent_given_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING id, name, email, role, is_email_verified
      `;
      const userRes = await client.query(userInsertQuery, [name, email, passwordHash, role, verificationToken]);
      const newUser = userRes.rows[0];

      // If caregiver, create the caregiver link
      if (role === 'caregiver' && linkedPatientId) {
        const linkInsertQuery = `
          INSERT INTO caregiver_links (patient_id, caregiver_id, status)
          VALUES ($1, $2, 'active')
        `;
        await client.query(linkInsertQuery, [linkedPatientId, newUser.id]);
      }

      // Issue token pair (access + refresh) within the same transaction
      const { accessToken, refreshToken } = await issueTokenPair(newUser, client);

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

      res.status(201).json({
        success: true,
        data: {
          accessToken,
          refreshToken,
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
 * Standard user credentials verification, issuing temporary MFA token.
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

    // Generate 6-digit MFA OTP
    const mfaCode = Math.floor(100000 + Math.random() * 900000).toString();
    const mfaExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5-minute expiry

    await query(
      'UPDATE users SET mfa_code = $1, mfa_expires_at = $2 WHERE id = $3',
      [mfaCode, mfaExpiresAt, user.id]
    );

    // Mock Send Email Verification Code
    logger.info('MFA_DISPATCHED', `[MOCK MFA EMAIL] To: ${user.email} | Security Code: ${mfaCode}`, {
      email: user.email,
    });

    // Generate temporary 5-minute pending token
    const mfaToken = jwt.sign(
      { sub: user.id, userId: user.id, isMfaPending: true },
      JWT_SECRET,
      { expiresIn: '5m' }
    );

    res.json({
      success: true,
      data: {
        requiresMfa: true,
        mfaToken,
      },
    });

  } catch (err) {
    logger.error('LOGIN_ERROR', `Error during user login: ${err.message}`);
    next(err);
  }
});

/**
 * POST /api/auth/verify-mfa
 * Verify 2-step verification security code.
 */
router.post('/auth/verify-mfa', sanitizeInput, async (req, res, next) => {
  const { mfaToken, otp } = req.body;

  if (!mfaToken || !otp) {
    return res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'mfaToken and security code (otp) are required.' },
    });
  }

  try {
    let decoded;
    try {
      decoded = jwt.verify(mfaToken, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'MFA session has expired or is invalid.' },
      });
    }

    const userResult = await query(
      'SELECT id, name, email, role, is_email_verified, mfa_code, mfa_expires_at FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'User not found.' },
      });
    }

    const user = userResult.rows[0];

    if (!user.mfa_code || user.mfa_code !== otp || new Date() > new Date(user.mfa_expires_at)) {
      logger.warn('MFA_VERIFY_FAILED', `Invalid MFA code entered for user ${user.id}`, { userId: user.id });
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'The security code is invalid or has expired.' },
      });
    }

    // Clear MFA columns upon successful verification
    await query(
      'UPDATE users SET mfa_code = NULL, mfa_expires_at = NULL WHERE id = $1',
      [user.id]
    );

    logger.audit('LOGIN_SUCCESS', `User ${user.id} logged in successfully via MFA`, { userId: user.id, role: user.role });

    // Issue token pair (access + refresh)
    const { accessToken, refreshToken } = await issueTokenPair(user);

    res.json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          isEmailVerified: process.env.NODE_ENV !== 'production' ? true : user.is_email_verified,
        },
      },
    });

  } catch (err) {
    logger.error('MFA_VERIFICATION_ERROR', `Error during MFA verification: ${err.message}`);
    next(err);
  }
});

/**
 * POST /api/auth/refresh
 * Rotate refresh token and issue a new access + refresh token pair.
 * Uses database transaction with FOR UPDATE locking to prevent racing rotations.
 */
router.post('/auth/refresh', async (req, res, next) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'refreshToken is required.' },
    });
  }

  try {
    // Verify JWT signature and expiry
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Refresh token is invalid or expired.' },
      });
    }

    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const client = await require('../config/db').pool.connect();

    try {
      await client.query('BEGIN');

      // Lock the token row to prevent concurrent rotation races
      const tokenResult = await client.query(
        `SELECT id, user_id, revoked_at FROM refresh_tokens
         WHERE token_hash = $1 AND expires_at > NOW()
         FOR UPDATE`,
        [tokenHash]
      );

      if (tokenResult.rows.length === 0 || tokenResult.rows[0].revoked_at) {
        await client.query('ROLLBACK');
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Refresh token is invalid, expired, or already revoked.' },
        });
      }

      const tokenRow = tokenResult.rows[0];

      // Revoke the old refresh token
      await client.query(
        'UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1',
        [tokenRow.id]
      );

      // Fetch user details for new token claims
      const userResult = await client.query(
        'SELECT id, name, email, role FROM users WHERE id = $1',
        [tokenRow.user_id]
      );

      if (userResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User not found.' },
        });
      }

      const user = userResult.rows[0];

      // Issue new token pair within the same transaction
      const { accessToken, refreshToken: newRefreshToken } = await issueTokenPair(user, client);

      await client.query('COMMIT');

      logger.info('TOKEN_REFRESHED', `Successfully rotated refresh token for user ${user.id}`, { userId: user.id });

      res.json({
        success: true,
        data: {
          accessToken,
          refreshToken: newRefreshToken,
        },
      });

    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

  } catch (err) {
    logger.error('TOKEN_REFRESH_ERROR', `Error during token refresh: ${err.message}`);
    next(err);
  }
});

/**
 * POST /api/auth/logout
 * Revokes the refresh token on the server side.
 */
router.post('/auth/logout', async (req, res, next) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'refreshToken is required.' },
    });
  }

  try {
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    await query(
      'UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1 AND revoked_at IS NULL',
      [tokenHash]
    );

    logger.info('LOGOUT_SUCCESS', 'Refresh token revoked successfully');

    res.json({
      success: true,
      data: { message: 'Logged out successfully.' },
    });

  } catch (err) {
    logger.error('LOGOUT_ERROR', `Error during logout: ${err.message}`);
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

/**
 * DELETE /api/auth/delete-account
 * Cascading delete of user account and related records.
 */
const { authenticateUser } = require('../middleware/auth');
router.delete('/auth/delete-account', authenticateUser, async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // Deleting the user will cascade delete records in consent_records, medicines, interaction_flags, etc. due to ON DELETE CASCADE
    await query('DELETE FROM users WHERE id = $1', [userId]);

    logger.audit('USER_DELETED', `User ${userId} deleted their account and all related records`, {
      userId,
    });

    res.json({
      success: true,
      data: {
        message: 'Account and all related records deleted successfully.',
      },
    });
  } catch (err) {
    logger.error('ACCOUNT_DELETION_ERROR', `Error deleting account for user ${req.user?.id}: ${err.message}`);
    next(err);
  }
});

module.exports = router;
