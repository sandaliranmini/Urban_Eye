const jwt = require('jsonwebtoken');

/**
 * Authentication Middleware
 * Validates Bearer token from Authorization header.
 * In development/test mode, provides fallback to dev headers if no token is provided.
 */
function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    // Non-production fallback for development and automated testing
    if (process.env.NODE_ENV !== 'production') {
      const devOfficerId = req.headers['x-dev-officer-id'];
      const devCitizenId = req.headers['x-dev-citizen-id'];
      const devRole = req.headers['x-dev-role'];

      if (devOfficerId) {
        req.user = {
          id: Number(devOfficerId),
          kind: 'officer',
          role: devRole || 'field_officer',
          officer_id: Number(devOfficerId),
          ward_id: Number(req.headers['x-dev-ward-id']) || 1,
        };
        return next();
      }

      if (devCitizenId || (!scheme && !token)) {
        req.user = {
          id: Number(devCitizenId) || 1,
          kind: 'citizen',
          role: 'citizen',
          citizen_id: Number(devCitizenId) || 1,
          ward_id: Number(req.headers['x-dev-ward-id']) || 1,
        };
        return next();
      }
    }
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    const kind = payload.kind || 'citizen';
    req.user = {
      id: payload.sub,
      kind,
      role: payload.role || 'citizen',
      ward_id: payload.ward_id ?? null,
      council_id: payload.council_id ?? null,
      citizen_id: kind === 'citizen' ? payload.sub : undefined,
      officer_id: kind === 'officer' ? payload.sub : undefined,
    };
    next();
  } catch (err) {
    const message = err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
    return res.status(401).json({ success: false, message });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    const role = req.user?.role;
    const kind = req.user?.kind;
    if (roles.includes(role) || roles.includes(kind)) {
      return next();
    }
    return res.status(403).json({ success: false, message: 'Forbidden: Insufficient privileges' });
  };
}

module.exports = { authenticate, requireRole };
