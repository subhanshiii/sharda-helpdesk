const { normalizeRole } = require('./roleHelpers');
const { FEATURE_REGISTRY } = require('./featureRegistry');
const { ADMIN_TIER_ORDER } = require('./adminTierRegistry');

const ROLE_ORDER = ['student', 'faculty', 'staff', 'admin'];

const ADMIN_TIER_PERMISSION_RULES = {
  canViewReports: 'section_moderator',
  canManageSections: 'section_moderator',
  canMarkAttendance: 'section_moderator',
  canManageTimetable: 'section_moderator',
  canManageAssignments: 'program_coordinator',
  canCreateTickets: 'department_admin',
  canManageGroups: 'department_admin',
  canManageAcademics: 'department_admin',
  canPostNotice: 'department_admin',
  canHandleTickets: 'department_admin',
  canManageUsers: 'admin',
  canViewAnalytics: 'admin',
  canManagePermissions: 'super_admin',
  canManageAdmins: 'super_admin',
};

const tierHasMinimumAccess = (adminTier, requiredTier) => {
  const tier = adminTier || 'admin';
  return ADMIN_TIER_ORDER.indexOf(tier) >= ADMIN_TIER_ORDER.indexOf(requiredTier);
};

const resolveEffectiveTier = (role, adminTier) => {
  if (adminTier) return adminTier;
  return normalizeRole(role) === 'admin' ? 'admin' : null;
};

/** Full platform admins (not college/department scoped tiers). */
const isPlatformAdmin = (user) => {
  if (!user) return false;
  const tier = resolveEffectiveTier(user.role, user.adminTier);
  return tier === 'super_admin' || tier === 'admin';
};

const buildAdminTierPermissions = (adminTier = 'admin') => {
  const base = {
    canViewChat: true,
    canSendFiles: true,
    canCreateTickets: false,
    canHandleTickets: false,
    canManageSections: false,
    canSubmitAssignments: false,
    canManageAssignments: false,
    canManageAcademics: false,
    canManageTimetable: false,
    canMarkAttendance: false,
    canManageUsers: false,
    canManageAdmins: false,
    canManageGroups: false,
    canPostNotice: false,
    canViewAnalytics: false,
    canViewReports: false,
    canManagePermissions: false,
  };

  Object.entries(ADMIN_TIER_PERMISSION_RULES).forEach(([permissionKey, requiredTier]) => {
    base[permissionKey] = tierHasMinimumAccess(adminTier, requiredTier);
  });

  return base;
};

const DEFAULT_ROLE_PERMISSIONS = {
  student: {
    canViewChat: true,
    canSendFiles: true,
    canCreateTickets: true,
    canHandleTickets: false,
    canManageSections: false,
    canSubmitAssignments: true,
    canManageAssignments: false,
    canManageAcademics: false,
    canManageTimetable: false,
    canMarkAttendance: false,
    canManageUsers: false,
    canManageAdmins: false,
    canManageGroups: false,
    canPostNotice: false,
    canViewAnalytics: false,
    canViewReports: false,
    canManagePermissions: false,
  },
  faculty: {
    canViewChat: true,
    canSendFiles: true,
    canCreateTickets: false,
    canHandleTickets: false,
    canManageSections: false,
    canSubmitAssignments: false,
    canManageAssignments: true,
    canManageAcademics: false,
    canManageTimetable: true,
    canMarkAttendance: true,
    canManageUsers: false,
    canManageAdmins: false,
    canManageGroups: false,
    canPostNotice: true,
    canViewAnalytics: false,
    canViewReports: false,
    canManagePermissions: false,
  },
  staff: {
    canViewChat: true,
    canSendFiles: true,
    canCreateTickets: true,
    canHandleTickets: true,
    canManageSections: false,
    canSubmitAssignments: false,
    canManageAssignments: false,
    canManageAcademics: false,
    canManageTimetable: false,
    canMarkAttendance: false,
    canManageUsers: false,
    canManageAdmins: false,
    canManageGroups: false,
    canPostNotice: true,
    canViewAnalytics: false,
    canViewReports: false,
    canManagePermissions: false,
  },
  admin: buildAdminTierPermissions('admin'),
};

const PERMISSION_KEYS = FEATURE_REGISTRY.map((feature) => feature.key);

const sanitizePermissions = (role, permissions = {}) => {
  const defaults = DEFAULT_ROLE_PERMISSIONS[normalizeRole(role)] || {};

  return PERMISSION_KEYS.reduce((acc, key) => {
    acc[key] = typeof permissions[key] === 'boolean' ? permissions[key] : Boolean(defaults[key]);
    return acc;
  }, {});
};

const buildResolvedPermissions = (role, rolePermissions = {}, adminTier = null) => {
  const basePermissions = sanitizePermissions(role, rolePermissions);
  const effectiveTier = resolveEffectiveTier(role, adminTier);
  if (!effectiveTier) {
    return basePermissions;
  }

  const tierPermissions = sanitizePermissions('admin', buildAdminTierPermissions(effectiveTier));
  return PERMISSION_KEYS.reduce((acc, key) => {
    acc[key] = Boolean(basePermissions[key] || tierPermissions[key]);
    return acc;
  }, {});
};

module.exports = {
  ROLE_ORDER,
  ADMIN_TIER_ORDER,
  PERMISSION_KEYS,
  DEFAULT_ROLE_PERMISSIONS,
  buildAdminTierPermissions,
  sanitizePermissions,
  tierHasMinimumAccess,
  resolveEffectiveTier,
  isPlatformAdmin,
  buildResolvedPermissions,
};
