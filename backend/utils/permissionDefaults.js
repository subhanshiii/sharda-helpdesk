const { normalizeRole } = require('./roleHelpers');

const ROLE_ORDER = ['student', 'faculty', 'staff', 'admin'];

const DEFAULT_ROLE_PERMISSIONS = {
  student: {
    canViewChat: true,
    canSendFiles: true,
    canCreateTickets: true,
    canHandleTickets: false,
    canSubmitAssignments: true,
    canManageAssignments: false,
    canManageAcademics: false,
    canManageTimetable: false,
    canMarkAttendance: false,
    canManageUsers: false,
    canManageGroups: false,
    canPostNotice: false,
    canViewAnalytics: false,
    canManagePermissions: false,
  },
  faculty: {
    canViewChat: true,
    canSendFiles: true,
    canCreateTickets: false,
    canHandleTickets: false,
    canSubmitAssignments: false,
    canManageAssignments: true,
    canManageAcademics: false,
    canManageTimetable: true,
    canMarkAttendance: true,
    canManageUsers: false,
    canManageGroups: false,
    canPostNotice: true,
    canViewAnalytics: false,
    canManagePermissions: false,
  },
  staff: {
    canViewChat: true,
    canSendFiles: true,
    canCreateTickets: true,
    canHandleTickets: true,
    canSubmitAssignments: false,
    canManageAssignments: false,
    canManageAcademics: false,
    canManageTimetable: false,
    canMarkAttendance: false,
    canManageUsers: false,
    canManageGroups: false,
    canPostNotice: true,
    canViewAnalytics: false,
    canManagePermissions: false,
  },
  admin: {
    canViewChat: true,
    canSendFiles: true,
    canCreateTickets: true,
    canHandleTickets: true,
    canSubmitAssignments: false,
    canManageAssignments: true,
    canManageAcademics: true,
    canManageTimetable: true,
    canMarkAttendance: true,
    canManageUsers: true,
    canManageGroups: true,
    canPostNotice: true,
    canViewAnalytics: true,
    canManagePermissions: true,
  },
};

const PERMISSION_KEYS = Object.keys(DEFAULT_ROLE_PERMISSIONS.admin);

const sanitizePermissions = (role, permissions = {}) => {
  const defaults = DEFAULT_ROLE_PERMISSIONS[normalizeRole(role)] || {};

  return PERMISSION_KEYS.reduce((acc, key) => {
    acc[key] = typeof permissions[key] === 'boolean' ? permissions[key] : Boolean(defaults[key]);
    return acc;
  }, {});
};

module.exports = {
  ROLE_ORDER,
  PERMISSION_KEYS,
  DEFAULT_ROLE_PERMISSIONS,
  sanitizePermissions,
};
