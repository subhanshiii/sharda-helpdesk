const { normalizeRole } = require('./roleHelpers');
const { FEATURE_REGISTRY } = require('./featureRegistry');

const ROLE_ORDER = ['student', 'faculty', 'staff', 'admin'];
const ADMIN_TIER_ORDER = ['section_moderator', 'program_coordinator', 'department_admin', 'college_admin', 'admin', 'super_admin'];

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

  const tier = adminTier || 'admin';

  if (['super_admin', 'admin', 'college_admin', 'department_admin', 'program_coordinator', 'section_moderator'].includes(tier)) {
    base.canViewReports = true;
    base.canManageSections = true;
    base.canMarkAttendance = true;
    base.canManageTimetable = true;
  }
  if (['super_admin', 'admin', 'college_admin', 'department_admin'].includes(tier)) {
    base.canCreateTickets = true;
    base.canManageGroups = true;
  }
  if (['super_admin', 'admin', 'department_admin', 'program_coordinator'].includes(tier)) {
    base.canManageAssignments = true;
  }
  if (['super_admin', 'admin', 'college_admin', 'department_admin'].includes(tier)) {
    base.canManageAcademics = true;
    base.canPostNotice = true;
    base.canHandleTickets = true;
  }
  if (['super_admin', 'admin'].includes(tier)) {
    base.canManageUsers = true;
    base.canViewAnalytics = true;
  }
  if (tier === 'super_admin') {
    base.canManagePermissions = true;
    base.canManageAdmins = true;
    base.canViewAnalytics = true;
  }

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

module.exports = {
  ROLE_ORDER,
  ADMIN_TIER_ORDER,
  PERMISSION_KEYS,
  DEFAULT_ROLE_PERMISSIONS,
  buildAdminTierPermissions,
  sanitizePermissions,
};
