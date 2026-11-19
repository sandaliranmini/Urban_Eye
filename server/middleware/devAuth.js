// TEMPORARY: delete when the real JWT middleware is merged
module.exports = function devAuth(req, res, next) {
  if (process.env.NODE_ENV === 'production') {
    return res.status(500).json({ success: false, message: 'devAuth must not run in production' });
  }
  req.user = { id: Number(req.headers['x-dev-citizen-id']) || 1, role: 'citizen' };
  next();
};