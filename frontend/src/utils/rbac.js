import { normalizeUserRole, resolveEffectiveAdminTier } from './access';
import config from '../shared/rbacConfig.json';

export const ACTION_DEFINITIONS = config.ACTION_DEFINITIONS;
export const RESOURCE_DEFINITIONS = config.RESOURCE_DEFINITIONS;
export const ROLE_SUMMARIES = config.ROLE_SUMMARIES;
export const DEFAULT_RESOURCE_PERMISSIONS = config.DEFAULT_RESOURCE_PERMISSIONS;

export const buildEmptyResourcePermissions = () => RESOURCE_DEFINITIONS.reduce((acc, resource) => {
  acc[resource.key] = resource.actions.reduce((actionAcc, action) => {
    actionAcc[action] = false;
    return actionAcc;
  }, {});
  return acc;
}, {});

export const normalizeResourcePermissions = (role, candidate = {}, adminTier = '') => {
  const normalizedRole = normalizeUserRole(role);
  const effectiveTier = resolveEffectiveAdminTier(normalizedRole, adminTier);

  if (normalizedRole === 'admin' || effectiveTier === 'super_admin') {
    return RESOURCE_DEFINITIONS.reduce((acc, resource) => {
      acc[resource.key] = resource.actions.reduce((actionAcc, action) => {
        actionAcc[action] = true;
        return actionAcc;
      }, {});
      return acc;
    }, {});
  }

  const base = buildEmptyResourcePermissions();
  const defaults = DEFAULT_RESOURCE_PERMISSIONS[normalizedRole] || {};

  RESOURCE_DEFINITIONS.forEach((resource) => {
    resource.actions.forEach((action) => {
      const nextValue = candidate?.[resource.key]?.[action];
      base[resource.key][action] = typeof nextValue === 'boolean'
        ? nextValue
        : Boolean(defaults?.[resource.key]?.[action]);
    });
  });

  return base;
};

export const can = (user, action, resource, resourcePermissions = null) => {
  const normalizedRole = normalizeUserRole(user?.role);
  const effectiveTier = resolveEffectiveAdminTier(normalizedRole, user?.adminTier);
  if (normalizedRole === 'admin' || effectiveTier === 'super_admin') return true;

  const normalizedPermissions = normalizeResourcePermissions(
    normalizedRole,
    resourcePermissions || DEFAULT_RESOURCE_PERMISSIONS[normalizedRole] || {},
    user?.adminTier || ''
  );

  return Boolean(normalizedPermissions?.[resource]?.[action]);
};
