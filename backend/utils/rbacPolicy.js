const { normalizeRole } = require('./roleHelpers');
const { resolveEffectiveTier } = require('./permissionDefaults');

const config = require('../../frontend/src/shared/rbacConfig.json');
const ACTION_DEFINITIONS = config.ACTION_DEFINITIONS;
const RESOURCE_DEFINITIONS = config.RESOURCE_DEFINITIONS;
const ROLE_SUMMARIES = config.ROLE_SUMMARIES;
const DEFAULT_RESOURCE_PERMISSIONS = config.DEFAULT_RESOURCE_PERMISSIONS;

const RESOURCE_MAP = RESOURCE_DEFINITIONS.reduce((acc, resource) => {
  acc[resource.key] = resource;
  return acc;
}, {});

const buildFullAccessResourcePermissions = () => RESOURCE_DEFINITIONS.reduce((acc, resource) => {
  acc[resource.key] = resource.actions.reduce((actionAcc, actionKey) => {
    actionAcc[actionKey] = true;
    return actionAcc;
  }, {});
  return acc;
}, {});

const buildEmptyResourcePermissions = () => RESOURCE_DEFINITIONS.reduce((acc, resource) => {
  acc[resource.key] = resource.actions.reduce((actionAcc, actionKey) => {
    actionAcc[actionKey] = false;
    return actionAcc;
  }, {});
  return acc;
}, {});

const clonePermissions = (permissions) => JSON.parse(JSON.stringify(permissions));

const normalizeResourcePermissions = (role, candidate = {}, adminTier = null) => {
  const normalizedRole = normalizeRole(role);
  const effectiveTier = resolveEffectiveTier(normalizedRole, adminTier);
  if (normalizedRole === 'admin' || effectiveTier === 'super_admin') {
    return buildFullAccessResourcePermissions();
  }

  const merged = buildEmptyResourcePermissions();
  const defaults = DEFAULT_RESOURCE_PERMISSIONS[normalizedRole] || {};

  RESOURCE_DEFINITIONS.forEach((resource) => {
    resource.actions.forEach((actionKey) => {
      const defaultValue = Boolean(defaults?.[resource.key]?.[actionKey]);
      const candidateValue = candidate?.[resource.key]?.[actionKey];
      merged[resource.key][actionKey] = typeof candidateValue === 'boolean' ? candidateValue : defaultValue;
    });
  });

  return merged;
};

const getDefaultResourcePermissions = (role, adminTier = null) => normalizeResourcePermissions(
  role,
  DEFAULT_RESOURCE_PERMISSIONS[normalizeRole(role)] || {},
  adminTier
);

const canAccessResource = ({ role, resourcePermissions, adminTier = null }, action, resource) => {
  const normalizedRole = normalizeRole(role);
  const effectiveTier = resolveEffectiveTier(normalizedRole, adminTier);
  if (normalizedRole === 'admin' || effectiveTier === 'super_admin') return true;

  const resourceDefinition = RESOURCE_MAP[resource];
  if (!resourceDefinition || !resourceDefinition.actions.includes(action)) return false;

  return Boolean(resourcePermissions?.[resource]?.[action]);
};

module.exports = {
  ACTION_DEFINITIONS,
  RESOURCE_DEFINITIONS,
  RESOURCE_MAP,
  ROLE_SUMMARIES,
  DEFAULT_RESOURCE_PERMISSIONS,
  buildEmptyResourcePermissions,
  buildFullAccessResourcePermissions,
  clonePermissions,
  normalizeResourcePermissions,
  getDefaultResourcePermissions,
  canAccessResource,
};
