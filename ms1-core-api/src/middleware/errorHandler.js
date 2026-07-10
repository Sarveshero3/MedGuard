/**
 * Central error handling middleware for ms1-core-api.
 * Returns structured JSON errors matching docs/design.md conventions.
 */
function errorHandler(err, req, res, _next) {
  console.error(`[ERROR] ${err.code || 'INTERNAL_ERROR'}:`, err.message);

  const statusCode = err.statusCode || 500;
  const errorCode = err.code || 'INTERNAL_ERROR';

  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message: err.message || 'An unexpected error occurred',
      details: err.details || [],
    },
  });
}

module.exports = errorHandler;
