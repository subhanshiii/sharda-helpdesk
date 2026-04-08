const LEGACY_ROLE_ALIASES = {
  agent: 'staff',
};

const normalizeRole = (role) => LEGACY_ROLE_ALIASES[role] || role;

const isAdminRole = (role) => normalizeRole(role) === 'admin';

const isSupportRole = (role) => ['staff', 'admin'].includes(normalizeRole(role));

const canPostNoticeRole = (role) => ['faculty', 'staff', 'admin'].includes(normalizeRole(role));

const getAssignableRoles = () => ['staff', 'admin', 'agent'];

module.exports = {
  LEGACY_ROLE_ALIASES,
  normalizeRole,
  isAdminRole,
  isSupportRole,
  canPostNoticeRole,
  getAssignableRoles,
};
