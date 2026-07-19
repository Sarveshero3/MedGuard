const axios = require('axios');
const logger = require('./logger');

const SITEVERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';

/**
 * Verify a reCAPTCHA v3 token against Google's siteverify API.
 *
 * Requires RECAPTCHA_SECRET_KEY in process.env.
 * Set RECAPTCHA_ENABLED=false to bypass verification in development/testing.
 *
 * @param {string} token - The reCAPTCHA response token from the client.
 * @param {string} [expectedAction] - Optional expected action name (e.g. 'login', 'register').
 * @returns {Promise<{ valid: boolean, score: number|null, reason: string }>}
 */
async function verifyRecaptcha(token, expectedAction) {
  // Allow bypassing reCAPTCHA in development/testing via env var
  if (process.env.RECAPTCHA_ENABLED === 'false') {
    logger.info('RECAPTCHA_BYPASSED', 'reCAPTCHA verification bypassed (RECAPTCHA_ENABLED=false)');
    return { valid: true, score: null, reason: 'bypassed' };
  }

  const secretKey = process.env.RECAPTCHA_SECRET_KEY;
  if (!secretKey) {
    logger.error('RECAPTCHA_CONFIG_MISSING', 'RECAPTCHA_SECRET_KEY is not set in environment variables. reCAPTCHA verification cannot proceed.');
    return { valid: false, score: null, reason: 'Server misconfiguration: reCAPTCHA secret key missing' };
  }

  if (!token) {
    return { valid: false, score: null, reason: 'reCAPTCHA token is missing' };
  }

  try {
    const params = new URLSearchParams();
    params.append('secret', secretKey);
    params.append('response', token);

    const response = await axios.post(
      SITEVERIFY_URL,
      params,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 5000, // 5s timeout to prevent hanging on Google API issues
      }
    );

    const { success, score, action, 'error-codes': errorCodes } = response.data;

    if (!success) {
      logger.warn('RECAPTCHA_VERIFY_FAILED', `reCAPTCHA verification failed: ${JSON.stringify(errorCodes || [])}`, {
        errorCodes,
      });
      return { valid: false, score: null, reason: `reCAPTCHA verification failed: ${(errorCodes || []).join(', ')}` };
    }

    // reCAPTCHA v3 returns a score between 0.0 (bot) and 1.0 (human)
    const SCORE_THRESHOLD = 0.5;
    if (score < SCORE_THRESHOLD) {
      logger.warn('RECAPTCHA_LOW_SCORE', `reCAPTCHA score too low: ${score} (threshold: ${SCORE_THRESHOLD})`, {
        score,
        action,
      });
      return { valid: false, score, reason: `reCAPTCHA score too low (${score})` };
    }

    // Optionally verify the action matches what we expected
    if (expectedAction && action !== expectedAction) {
      logger.warn('RECAPTCHA_ACTION_MISMATCH', `reCAPTCHA action mismatch: expected '${expectedAction}', got '${action}'`, {
        expectedAction,
        actualAction: action,
      });
      // Action mismatch is a soft warning — still allow if score is high enough
    }

    logger.info('RECAPTCHA_VERIFIED', `reCAPTCHA verified successfully (score: ${score}, action: ${action})`);
    return { valid: true, score, reason: 'ok' };
  } catch (err) {
    logger.error('RECAPTCHA_ERROR', `reCAPTCHA verification request failed: ${err.message}`, {
      error: err.message,
    });
    return { valid: false, score: null, reason: `reCAPTCHA verification request failed: ${err.message}` };
  }
}

module.exports = { verifyRecaptcha };
