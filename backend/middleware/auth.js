const jwt  = require('jsonwebtoken');
const User = require('../models/User');
const Permission = require('../models/Permission');
const { DEFAULT_ROLE_PERMISSIONS, ADMIN_TIER_ORDER, buildResolvedPermissions, resolveEffectiveTier } = require('../utils/permissionDefaults');
const { isSeededSuperAdmin } = require('../utils/initialAdmin');
const { canAccessResource, normalizeResourcePermissions } = require('../utils/rbacPolicy');
const { normalizeRole } = require('../utils/roleHelpers');

const isSuperAdmin = (user) => resolveEffectiveTier(user?.role, user?.adminTier) === 'super_admin';
const normalizeTier = (role, tier) => resolveEffectiveTier(role, tier) || 'none';
const tierRank = (tier) => ADMIN_TIER_ORDER.indexOf(tier || 'none');

// ── Shared JWT → user resolution (HTTP protect + Socket.IO) ──
const loadAuthenticatedUser = async (token) => {
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const user = await User.findById(decoded.id).select('-password');

  if (!user) {
    const error = new Error('User no longer exists');
    error.statusCode = 401;
    throw error;
  }

  if (isSeededSuperAdmin(user)) {
    return user;
  }

  if (!user.isActive) {
    const error = new Error('Account is deactivated. Contact admin.');
    error.statusCode = 401;
    throw error;
  }

  if (!user.emailVerified) {
    const error = new Error('Please verify your email');
    error.statusCode = 403;
    throw error;
  }

  if (user.status && user.status !== 'approved') {
    const error = new Error(
      user.status === 'pending'
        ? 'Waiting for admin approval'
        : user.status === 'rejected'
          ? 'Your account has been rejected. Contact the administrator.'
          : 'Account is not allowed to sign in.'
    );
    error.statusCode = 403;
    throw error;
  }

  if (user.expiryDate && new Date() >= user.expiryDate) {
    const error = new Error('Account access has expired.');
    error.statusCode = 403;
    throw error;
  }

  return user;
};

// ── protect: verify JWT from httpOnly cookie OR Bearer header ──
// We support BOTH so existing clients still work during migration
const attachAuthenticatedUser = async (req, token) => {
  const user = await loadAuthenticatedUser(token);
  const actuallySuperAdmin = isSuperAdmin(user);

  if (actuallySuperAdmin && req.headers['x-preview-role']) {
    user.role = req.headers['x-preview-role'];
    user.adminTier = req.headers['x-preview-tier'] || null;
    req.user = user;
    req.isSuperAdmin = false; // Subject them to normal role checks
  } else {
    req.user = user;
    req.isSuperAdmin = actuallySuperAdmin;
  }
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

  if (err?.statusCode === 403 && err.message) {
    return res.status(403).json({ success: false, message: err.message });
  }

  if (err?.statusCode === 401 && err.message) {
    return res.status(401).json({ success: false, message: err.message });
  }

  return res.status(401).json({ success: false, message: 'Invalid token. Please log in again.' });
};

// ── In-memory permission cache (avoids DB upsert on every request) ──
const permissionCache = new Map();
const PERMISSION_CACHE_TTL_MS = 60 * 1000; // 60 seconds

const getCachedPermissions = (cacheKey) => {
  const entry = permissionCache.get(cacheKey);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > PERMISSION_CACHE_TTL_MS) {
    permissionCache.delete(cacheKey);
    return null;
  }
  return entry.value;
};

const setCachedPermissions = (cacheKey, value) => {
  permissionCache.set(cacheKey, { value, timestamp: Date.now() });
};

/** Exported so that permission updates can bust the cache. */
const invalidatePermissionCache = (role) => {
  if (role) {
    permissionCache.delete(role);
  } else {
    permissionCache.clear();
  }
};

const resolveRequestPermissions = async (user) => {
  const cacheKey = normalizeRole(user.role);
  const cached = getCachedPermissions(cacheKey);

  let permissionDoc;
  if (cached) {
    permissionDoc = cached;
  } else {
    permissionDoc = await Permission.getRolePermissions(user.role);
    if (permissionDoc) setCachedPermissions(cacheKey, permissionDoc);
  }

  const permissions = buildResolvedPermissions(
    user.role,
    permissionDoc?.permissions || DEFAULT_ROLE_PERMISSIONS[user.role],
    user.adminTier
  );
  const resourcePermissions = normalizeResourcePermissions(
    user.role,
    permissionDoc?.resourcePermissions,
    user.adminTier
  );

  return {
    permissions,
    resourcePermissions,
    can: (action, resource) => canAccessResource({ role: user.role, resourcePermissions, adminTier: user.adminTier }, action, resource),
  };
};

exports.loadAuthenticatedUser = loadAuthenticatedUser;

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
  const normalizedUserRole = normalizeRole(req.user?.role);
  const normalizedRoles = roles.map((role) => normalizeRole(role));

  if (!normalizedRoles.includes(normalizedUserRole)) {
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

    const access = await resolveRequestPermissions(req.user);
    req.permissions = access.permissions;
    req.resourcePermissions = access.resourcePermissions;
    req.can = access.can;

    if (!access.permissions[permissionKey]) {
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

exports.anyPermissionMiddleware = (...permissionKeys) => async (req, res, next) => {
  try {
    if (!req.user?.role) {
      return res.status(401).json({ success: false, message: 'Not authorized. Please log in.' });
    }

    const access = await resolveRequestPermissions(req.user);
    req.permissions = access.permissions;
    req.resourcePermissions = access.resourcePermissions;
    req.can = access.can;

    if (!permissionKeys.some((permissionKey) => access.permissions[permissionKey])) {
      return res.status(403).json({
        success: false,
        message: `Access denied. One of these permissions is required: ${permissionKeys.join(', ')}`,
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};

exports.requireAdminTier = (...tiers) => (req, res, next) => {
  const effectiveTier = resolveEffectiveTier(req.user?.role, req.user?.adminTier);

  if (!effectiveTier || !tiers.includes(effectiveTier)) {
    return res.status(403).json({ success: false, message: 'Your admin tier cannot access this action' });
  }

  next();
};

exports.requireMinTier = (tier) => (req, res, next) => {
  const effectiveTier = resolveEffectiveTier(req.user?.role, req.user?.adminTier);
  const requesterRank = tierRank(effectiveTier);
  const requiredRank = tierRank(tier);

  if (requesterRank === -1 || requiredRank === -1 || requesterRank < requiredRank) {
    return res.status(403).json({ success: false, message: 'Your admin tier cannot access this action' });
  }

  next();
};

exports.verifyAuth = exports.protect;
exports.checkRole = (...roles) => exports.authorize(...roles);
exports.checkPermission = (action, resource) => async (req, res, next) => {
  try {
    if (!req.user?.role) {
      return res.status(401).json({ success: false, message: 'Not authorized. Please log in.' });
    }

    const access = await resolveRequestPermissions(req.user);
    req.permissions = access.permissions;
    req.resourcePermissions = access.resourcePermissions;
    req.can = access.can;

    if (!access.can(action, resource)) {
      return res.status(403).json({
        success: false,
        message: `You do not have permission to ${action} ${resource}.`,
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};

exports.isSuperAdmin = isSuperAdmin;
exports.invalidatePermissionCache = invalidatePermissionCache;
