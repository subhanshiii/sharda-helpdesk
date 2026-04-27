const LEGACY_ROLE_ALIASES = {
  agent: 'staff',
};

const ROLE_ORDER = ['student', 'faculty', 'staff', 'admin'];
const ROLE_QUERY_VARIANTS = {
  student: ['student'],
  faculty: ['faculty'],
  staff: ['staff', 'agent'],
  admin: ['admin'],
};

const normalizeRole = (role) => LEGACY_ROLE_ALIASES[role] || role;

const isAdminRole = (role) => normalizeRole(role) === 'admin';

const isSupportRole = (role) => ['staff', 'admin'].includes(normalizeRole(role));

const canPostNoticeRole = (role) => ['faculty', 'staff', 'admin'].includes(normalizeRole(role));

const getStoredRolesForRole = (role) => ROLE_QUERY_VARIANTS[normalizeRole(role)] || [normalizeRole(role)];

const getStoredRolesForRoles = (roles = []) => [...new Set(roles.flatMap((role) => getStoredRolesForRole(role)))];

const buildRoleInQuery = (roles = []) => ({ $in: getStoredRolesForRoles(roles) });

const getAssignableRoles = () => getStoredRolesForRoles(['staff', 'admin']);

module.exports = {
  ROLE_ORDER,
  ROLE_QUERY_VARIANTS,
  LEGACY_ROLE_ALIASES,
  normalizeRole,
  isAdminRole,
  isSupportRole,
  canPostNoticeRole,
  getStoredRolesForRole,
  getStoredRolesForRoles,
  buildRoleInQuery,
  getAssignableRoles,
};
