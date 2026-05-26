import { normalizeUserRole, resolveEffectiveAdminTier } from './access';

export const ACTION_DEFINITIONS = [
  { key: 'view', label: 'View', description: 'See and open this resource.' },
  { key: 'create', label: 'Create', description: 'Create new records for this resource.' },
  { key: 'edit', label: 'Edit', description: 'Update existing records for this resource.' },
  { key: 'delete', label: 'Delete', description: 'Delete existing records for this resource.' },
  { key: 'manage', label: 'Manage', description: 'Govern settings and privileged controls for this resource.' },
];

export const RESOURCE_DEFINITIONS = [
  { key: 'notices', label: 'Notices', group: 'Campus updates', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'events', label: 'Events', group: 'Campus updates', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'opportunities', label: 'Opportunities', group: 'Campus updates', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'faq', label: 'FAQ', group: 'Support & services', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'assignments', label: 'Assignments', group: 'Academic content', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'timetable', label: 'Timetable', group: 'Academic content', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'notes', label: 'Notes (PDFs)', group: 'Academic content', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'resources', label: 'Shared resources', group: 'Academic content', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'users', label: 'Users', group: 'Administration', actions: ['view', 'create', 'edit', 'delete', 'manage'] },
  { key: 'permissions', label: 'Permissions', group: 'Administration', actions: ['view', 'manage'] },
];

export const ROLE_SUMMARIES = {
  student: { label: 'Student', tone: 'minimal', description: 'Learner-facing access for academic updates and notes uploads.' },
  faculty: { label: 'Faculty', tone: 'academic', description: 'Assignment publishing and notes authoring without admin controls.' },
  staff: { label: 'Staff', tone: 'operations', description: 'Operational publishing access for notices and events.' },
  admin: { label: 'Admin', tone: 'highlight', description: 'Full institution-wide governance across all resources.' },
};

export const DEFAULT_RESOURCE_PERMISSIONS = {
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
