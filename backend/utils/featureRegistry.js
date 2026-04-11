const FEATURE_REGISTRY = [
  {
    key: 'canViewChat',
    label: 'Group Chat',
    description: 'Access the university group chat workspace.',
    group: 'Communication',
  },
  {
    key: 'canSendFiles',
    label: 'File Sharing',
    description: 'Send attachments in supported conversations and workflows.',
    group: 'Communication',
  },
  {
    key: 'canCreateTickets',
    label: 'Create Tickets',
    description: 'Submit helpdesk and support requests.',
    group: 'Helpdesk',
  },
  {
    key: 'canHandleTickets',
    label: 'Handle Tickets',
    description: 'Work the support queue and resolve submitted tickets.',
    group: 'Helpdesk',
  },
  {
    key: 'canManageSections',
    label: 'Section Management',
    description: 'Manage section-level academic delivery and section-scoped operations.',
    group: 'Academics',
  },
  {
    key: 'canSubmitAssignments',
    label: 'Submit Assignments',
    description: 'Upload and manage learner submissions.',
    group: 'Academics',
  },
  {
    key: 'canManageAssignments',
    label: 'Manage Assignments',
    description: 'Create, grade, and oversee assignment workflows.',
    group: 'Academics',
  },
  {
    key: 'canManageAcademics',
    label: 'Academic Structure',
    description: 'Manage departments, programs, courses, sections, and enrollments.',
    group: 'Academics',
  },
  {
    key: 'canManageTimetable',
    label: 'Timetable',
    description: 'Publish and maintain class schedule entries.',
    group: 'Academics',
  },
  {
    key: 'canMarkAttendance',
    label: 'Attendance',
    description: 'Create and update attendance sessions.',
    group: 'Academics',
  },
  {
    key: 'canManageUsers',
    label: 'Identity & Access',
    description: 'Provision users, manage lifecycle state, and review identity alerts.',
    group: 'Governance',
  },
  {
    key: 'canManageAdmins',
    label: 'Admin Governance',
    description: 'Create and govern administrator identities and privileged scope assignments.',
    group: 'Governance',
  },
  {
    key: 'canViewReports',
    label: 'Reports',
    description: 'View scoped academic and institutional reporting surfaces.',
    group: 'Governance',
  },
  {
    key: 'canManageGroups',
    label: 'Group Management',
    description: 'Create and administer structured chat groups.',
    group: 'Communication',
  },
  {
    key: 'canPostNotice',
    label: 'Notices & Broadcasts',
    description: 'Publish notices, events, opportunities, and academic broadcasts.',
    group: 'Communication',
  },
  {
    key: 'canViewAnalytics',
    label: 'Analytics',
    description: 'View institutional metrics and reporting dashboards.',
    group: 'Governance',
  },
  {
    key: 'canManagePermissions',
    label: 'Permissions',
    description: 'Change role-based access policy across the platform.',
    group: 'Governance',
  },
];

const FEATURE_MAP = FEATURE_REGISTRY.reduce((acc, feature) => {
  acc[feature.key] = feature;
  return acc;
}, {});

module.exports = {
  FEATURE_REGISTRY,
  FEATURE_MAP,
};
