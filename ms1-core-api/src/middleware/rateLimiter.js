const bypassLimiter = (req, res, next) => next();

module.exports = {
  authLimiter: bypassLimiter,
  registerLimiter: bypassLimiter,
  uploadLimiter: bypassLimiter,
  apiLimiter: bypassLimiter,
};
