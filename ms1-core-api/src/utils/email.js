const logger = require('./logger');

/**
 * Mock email dispatcher using the same format and logger events as auth.js.
 * Simulates AWS SES integration for development.
 * 
 * @param {object} options
 * @param {string} options.to - Recipient email.
 * @param {string} options.subject - Email subject line.
 * @param {string} options.body - Email body text.
 */
async function sendEmail({ to, subject, body }) {
  if (process.env.NODE_ENV === 'development') {
    logger.info('EMAIL_DISPATCHED', `[MOCK EMAIL] To: ${to} | Subject: ${subject} | Body: ${body}`, {
      to,
      subject,
    });
  } else {
    logger.info('EMAIL_DISPATCHED', `[AWS SES] Production email dispatch initiated for: ${to} (subject: ${subject})`, {
      to,
      subject,
    });
  }
}

module.exports = {
  sendEmail,
};
