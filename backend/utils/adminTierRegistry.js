const ADMIN_TIER_ORDER = ['section_moderator', 'program_coordinator', 'department_admin', 'college_admin', 'admin', 'super_admin'];

const ADMIN_TIER_DEFINITIONS = [
  {
    key: 'section_moderator',
    label: 'Section Moderator',
    level: 1,
    scopeLabel: 'Section scoped',
    group: 'Scoped',
    description: 'Owns section-level delivery workflows for assigned sections only.',
  },
  {
    key: 'program_coordinator',
    label: 'Program Coordinator',
    level: 2,
    scopeLabel: 'Program scoped',
    group: 'Scoped',
    description: 'Coordinates academic workflows across a specific program and its courses.',
  },
  {
    key: 'department_admin',
    label: 'Department Admin',
    level: 3,
    scopeLabel: 'Department scoped',
    group: 'Scoped',
    description: 'Governs academic delivery and support operations for a department.',
  },
  {
    key: 'college_admin',
    label: 'College Admin',
    level: 4,
    scopeLabel: 'College scoped',
    group: 'Scoped',
    description: 'Oversees academic and support operations within one college.',
  },
  {
    key: 'admin',
    label: 'Admin',
    level: 5,
    scopeLabel: 'System-wide',
    group: 'System-level',
    description: 'Runs institution-wide operations across users, academics, notices, and tickets.',
  },
  {
    key: 'super_admin',
    label: 'Super Admin',
    level: 6,
    scopeLabel: 'System-wide governance',
    group: 'System-level',
    description: 'Full governance authority with access to permission management and privileged admin controls.',
  },
];

const ADMIN_TIER_MAP = ADMIN_TIER_DEFINITIONS.reduce((acc, definition) => {
  acc[definition.key] = definition;
  return acc;
}, {});

module.exports = {
  ADMIN_TIER_ORDER,
  ADMIN_TIER_DEFINITIONS,
  ADMIN_TIER_MAP,
};
