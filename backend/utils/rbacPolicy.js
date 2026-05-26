const { normalizeRole } = require('./roleHelpers');
const { resolveEffectiveTier } = require('./permissionDefaults');

const ACTION_DEFINITIONS = [
  { key: 'view', label: 'View', description: 'See and open this resource.' },
  { key: 'create', label: 'Create', description: 'Create new records for this resource.' },
  { key: 'edit', label: 'Edit', description: 'Update existing records for this resource.' },
  { key: 'delete', label: 'Delete', description: 'Delete existing records for this resource.' },
  { key: 'manage', label: 'Manage', description: 'Govern settings and privileged controls for this resource.' },
];

const RESOURCE_DEFINITIONS = [
  {
    key: 'notices',
    label: 'Notices',
    group: 'Campus updates',
    description: 'Broadcast notices and notice-board updates.',
    actions: ['view', 'create', 'edit', 'delete'],
  },
  {
    key: 'events',
    label: 'Events',
    group: 'Campus updates',
    description: 'Campus events, workshops, and calendar entries.',
    actions: ['view', 'create', 'edit', 'delete'],
  },
  {
    key: 'opportunities',
    label: 'Opportunities',
    group: 'Campus updates',
    description: 'Scholarships, internships, and other opportunities.',
    actions: ['view', 'create', 'edit', 'delete'],
  },
  {
    key: 'assignments',
    label: 'Assignments',
    group: 'Academic content',
    description: 'Assignments and coursework workflows.',
    actions: ['view', 'create', 'edit', 'delete'],
  },
  {
    key: 'timetable',
    label: 'Timetable',
    group: 'Academic content',
    description: 'Class schedules and timetable entries.',
    actions: ['view', 'create', 'edit', 'delete'],
  },
  {
    key: 'notes',
    label: 'Notes (PDFs)',
    group: 'Academic content',
    description: 'Study notes and PDF-based academic uploads.',
    actions: ['view', 'create', 'edit', 'delete'],
  },
  {
    key: 'resources',
    label: 'Shared resources',
    group: 'Academic content',
    description: 'Notes, PYQs, and study materials shared across the academic community.',
    actions: ['view', 'create', 'edit', 'delete'],
  },
  {
    key: 'faq',
    label: 'FAQ',
    group: 'Support & services',
    description: 'Frequently asked questions shown across support and self-service surfaces.',
    actions: ['view', 'create', 'edit', 'delete'],
  },
  {
    key: 'users',
    label: 'Users',
    group: 'Administration',
    description: 'Identity lifecycle, role assignment, and account management.',
    actions: ['view', 'create', 'edit', 'delete', 'manage'],
  },
  {
    key: 'permissions',
    label: 'Permissions',
    group: 'Administration',
    description: 'Role policy configuration and permission governance.',
    actions: ['view', 'manage'],
  },
];

const RESOURCE_MAP = RESOURCE_DEFINITIONS.reduce((acc, resource) => {
  acc[resource.key] = resource;
  return acc;
}, {});

const ROLE_SUMMARIES = {
  student: {
    label: 'Student',
    tone: 'minimal',
    description: 'Learner-facing access for consuming academic updates and uploading notes PDFs.',
  },
  faculty: {
    label: 'Faculty',
    tone: 'academic',
    description: 'Academic delivery access with assignment authoring and notes publishing.',
  },
  staff: {
    label: 'Staff',
    tone: 'operations',
    description: 'Operational publishing access focused on notices and events.',
  },
  admin: {
    label: 'Admin',
    tone: 'highlight',
    description: 'Institution-wide governance with full access to every managed resource.',
  },
};

const DEFAULT_RESOURCE_PERMISSIONS = {
  student: {
    notices: { view: true },
    events: { view: true },
    opportunities: { view: true },
    faq: { view: true },
    assignments: { view: true },
    timetable: { view: true },
    notes: { view: true, create: true },
    resources: { view: true, create: true },
  },
  faculty: {
    notices: { view: true },
    events: { view: true },
    opportunities: { view: true },
    faq: { view: true },
    assignments: { view: true, create: true, edit: true },
    timetable: { view: true },
    notes: { view: true, create: true },
    resources: { view: true, create: true, edit: true },
  },
  staff: {
    notices: { view: true, create: true, edit: true, delete: true },
    events: { view: true, create: true, edit: true, delete: true },
    opportunities: { view: true },
    faq: { view: true },
    resources: { view: true },
  },
  admin: {},
};

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
