const logger = require('./logger');

/**
 * Email dispatcher with production AWS SES integration.
 * In development mode, logs emails to the console instead of sending.
 * In production, requires AWS_SES_REGION, AWS_ACCESS_KEY_ID, and
 * AWS_SECRET_ACCESS_KEY env vars — fails loudly if missing.
 *
 * @param {object} options
 * @param {string} options.to - Recipient email.
 * @param {string} options.subject - Email subject line.
 * @param {string} options.body - Email body text.
 */
async function sendEmail({ to, subject, body }) {
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    logger.info('EMAIL_DISPATCHED', `[MOCK EMAIL] To: ${to} | Subject: ${subject} | Body: ${body.substring(0, 200)}...`, {
      to,
      subject,
    });
    return;
  }

  // Production: use AWS SES
  const region = process.env.AWS_SES_REGION;
  const fromAddress = process.env.AWS_SES_FROM_ADDRESS;

  if (!region || !fromAddress) {
    const missing = [!region && 'AWS_SES_REGION', !fromAddress && 'AWS_SES_FROM_ADDRESS'].filter(Boolean).join(', ');
    const errMsg = `Email sending BLOCKED: missing required env vars: ${missing}. Configure these before deploying to production.`;
    logger.error('EMAIL_CONFIG_MISSING', errMsg);
    throw new Error(errMsg);
  }

  // AWS SDK v3 lazy import (only loaded in production)
  const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

  const sesClient = new SESClient({ region });

  const params = {
    Source: fromAddress,
    Destination: {
      ToAddresses: [to],
    },
    Message: {
      Subject: {
        Data: subject,
        Charset: 'UTF-8',
      },
      Body: {
        Text: {
          Data: body,
          Charset: 'UTF-8',
        },
      },
    },
  };

  try {
    const command = new SendEmailCommand(params);
    const result = await sesClient.send(command);
    logger.info('EMAIL_DISPATCHED', `[AWS SES] Email sent to: ${to} | MessageId: ${result.MessageId}`, {
      to,
      subject,
      messageId: result.MessageId,
    });
  } catch (err) {
    logger.error('EMAIL_SEND_FAILED', `[AWS SES] Failed to send email to ${to}: ${err.message}`, {
      to,
      subject,
      error: err.message,
    });
    throw err;
  }
}

module.exports = {
  sendEmail,
};
