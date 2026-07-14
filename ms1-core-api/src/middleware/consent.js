const { query } = require('../config/db');
const logger = require('../utils/logger');

/**
 * Middleware to enforce active DPDP consent.
 * Gated actions return 403 Forbidden with code INSUFFICIENT_CONSENT if consent is missing or revoked.
 */
function enforceConsent(consentType = 'health_data_processing') {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
      });
    }

    try {
      // The target of the consent is the patient whose data is being accessed or modified.
      // Fallback to the logged-in user if patient_id is not specified.
      const targetUserId = req.query.patient_id || req.body.patient_id || req.params.patientId || req.user.id;

      const consentResult = await query(
        'SELECT granted_at, revoked_at FROM consent_records WHERE user_id = $1 AND consent_type = $2',
        [targetUserId, consentType]
      );

      if (consentResult.rows.length === 0 || !consentResult.rows[0].granted_at || consentResult.rows[0].revoked_at) {
        logger.warn('INSUFFICIENT_CONSENT', `Blocked action for user ${req.user.id} targeting patient ${targetUserId} due to missing or revoked consent: ${consentType}`);
        
        return res.status(403).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_CONSENT',
            message: 'DPDP compliance: health data processing consent is required to perform this action.',
          },
        });
      }

      next();
    } catch (err) {
      logger.error('CONSENT_MIDDLEWARE_ERROR', `Error in consent middleware: ${err.message}`);
      next(err);
    }
  };
}

module.exports = {
  enforceConsent,
};
