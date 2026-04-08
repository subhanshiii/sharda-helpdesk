const jwt  = require('jsonwebtoken');
const User = require('../models/User');
const Permission = require('../models/Permission');
const { DEFAULT_ROLE_PERMISSIONS, sanitizePermissions } = require('../utils/permissionDefaults');

// ── protect: verify JWT from httpOnly cookie OR Bearer header ──
// We support BOTH so existing clients still work during migration
const attachAuthenticatedUser = async (req, token) => {
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const user = await User.findById(decoded.id).select('-password');

  if (!user) {
    const error = new Error('User no longer exists');
    error.statusCode = 401;
    throw error;
  }

  if (!user.isActive) {
    const error = new Error('Account is deactivated. Contact admin.');
    error.statusCode = 401;
    throw error;
  }

  req.user = user;
};

const getAuthToken = (req, { allowQueryToken = false } = {}) => {
  let token;

  if (req.cookies && req.cookies.token && req.cookies.token !== 'none') {
    token = req.cookies.token;
  }
  if (!token && req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token && allowQueryToken && req.query?.token) {
    token = req.query.token;
  }

  return token;
};

const buildUnauthorizedResponse = (res, err) => {
  if (err?.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
  }

  if (err?.statusCode === 401 && err.message) {
    return res.status(401).json({ success: false, message: err.message });
  }

  return res.status(401).json({ success: false, message: 'Invalid token. Please log in again.' });
};

exports.protect = async (req, res, next) => {
  const token = getAuthToken(req);

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized. Please log in.' });
  }

  try {
    await attachAuthenticatedUser(req, token);
    next();
  } catch (err) {
    return buildUnauthorizedResponse(res, err);
  }
};

exports.protectFileAccess = async (req, res, next) => {
  const token = getAuthToken(req, { allowQueryToken: true });

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized. Please log in.' });
  }

  try {
    await attachAuthenticatedUser(req, token);
    next();
  } catch (err) {
    return buildUnauthorizedResponse(res, err);
  }
};

// ── authorize: role-based access control ──────────────
exports.authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: `Access denied. Required role: ${roles.join(' or ')}. Your role: ${req.user.role}`,
    });
  }
  next();
};

exports.permissionMiddleware = (permissionKey) => async (req, res, next) => {
  try {
    if (!req.user?.role) {
      return res.status(401).json({ success: false, message: 'Not authorized. Please log in.' });
    }

    const permissionDoc = await Permission.getRolePermissions(req.user.role);
    const permissions = sanitizePermissions(
      req.user.role,
      permissionDoc?.permissions || DEFAULT_ROLE_PERMISSIONS[req.user.role]
    );

    req.permissions = permissions;

    if (!permissions[permissionKey]) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Missing permission: ${permissionKey}`,
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};
