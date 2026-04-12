import { formatDistanceToNow, format } from 'date-fns';
import { getAvatarUrl, getDefaultAvatarFilename } from '../constants/avatarOptions';

export const normalizeUserRole = (role) => {
  if (role === 'agent') return 'staff';
  return role || 'student';
};

export const getAssetUrl = (assetPath) => {
  if (!assetPath) return '';
  if (assetPath.startsWith('http')) return assetPath;

  const apiBase = process.env.REACT_APP_API_URL || '/api';
  const originBase = apiBase.replace(/\/api\/?$/, '');
  const normalizedPath = assetPath.startsWith('/') ? assetPath : `/${assetPath}`;
  const url = new URL(`${originBase}${normalizedPath}`, window.location.origin);

  // Legacy /uploads/... URLs are no longer served as static files; route through authenticated API
  if (normalizedPath.startsWith('/uploads/')) {
    const rest = normalizedPath.replace(/^\/uploads\//, '');
    const token = localStorage.getItem('token');
    if (rest.startsWith('chat/')) {
      const chatFile = rest.replace(/^chat\//, '');
      const apiUrl = new URL(`${originBase}/api/files/chat/${chatFile}`, window.location.origin);
      if (token) apiUrl.searchParams.set('token', token);
      return apiUrl.toString();
    }
    const apiUrl = new URL(`${originBase}/api/files/general/${rest}`, window.location.origin);
    if (token) apiUrl.searchParams.set('token', token);
    return apiUrl.toString();
  }

  if (normalizedPath.startsWith('/api/files/')) {
    const token = localStorage.getItem('token');
    if (token) {
      url.searchParams.set('token', token);
    }
  }

  return url.toString();
};

export const getRoleLabel = (role) => {
  const normalizedRole = normalizeUserRole(role);
  const labels = {
    admin: 'Admin',
    staff: 'Staff',
    faculty: 'Faculty',
    student: 'Student',
  };
  return labels[normalizedRole] || normalizedRole;
};

export const getAdminTierLabel = (tier) => {
  const labels = {
    super_admin: 'Super Admin',
    admin: 'Admin',
    college_admin: 'College Admin',
    department_admin: 'Department Admin',
    program_coordinator: 'Program Coordinator',
    section_moderator: 'Section Moderator',
  };
  return labels[tier] || tier;
};

export const ADMIN_TIER_DEFINITIONS = [
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

export const getAdminTierTone = (tier) => {
  const tones = {
    super_admin: 'bg-amber-100 text-amber-700',
    admin: 'bg-slate-100 text-slate-700',
    college_admin: 'bg-blue-100 text-blue-700',
    department_admin: 'bg-indigo-100 text-indigo-700',
    program_coordinator: 'bg-violet-100 text-violet-700',
    section_moderator: 'bg-emerald-100 text-emerald-700',
  };
  return tones[tier] || 'bg-slate-100 text-slate-700';
};

export const getAdminTierDefinition = (tier) => (
  ADMIN_TIER_DEFINITIONS.find((definition) => definition.key === tier) || null
);

export const formatDate = (date) => {
  if (!date) return 'N/A';
  return format(new Date(date), 'dd MMM yyyy, hh:mm a');
};

export const formatRelative = (date) => {
  if (!date) return '';
  return formatDistanceToNow(new Date(date), { addSuffix: true });
};

export const getStatusColor = (status) => {
  const map = {
    'Open':        'bg-blue-100 text-blue-700',
    'In Progress': 'bg-yellow-100 text-yellow-700',
    'Resolved':    'bg-green-100 text-green-700',
    'Closed':      'bg-gray-100 text-gray-600',
  };
  return map[status] || 'bg-gray-100 text-gray-600';
};

export const getPriorityColor = (priority) => {
  const map = {
    'Low':      'bg-green-100 text-green-700',
    'Medium':   'bg-blue-100 text-blue-700',
    'High':     'bg-orange-100 text-orange-700',
    'Critical': 'bg-red-100 text-red-700',
  };
  return map[priority] || 'bg-gray-100 text-gray-600';
};

export const getPriorityDot = (priority) => {
  const map = {
    'Low':      'bg-green-500',
    'Medium':   'bg-blue-500',
    'High':     'bg-orange-500',
    'Critical': 'bg-red-500',
  };
  return map[priority] || 'bg-gray-400';
};

export const getCategoryIcon = (category) => {
  const map = {
    'IT Support':      '💻',
    'Administration':  '🏛️',
    'Hostel':          '🏠',
    'Library':         '📚',
    'Finance':         '💰',
    'Academic':        '🎓',
    'Infrastructure':  '🏗️',
    'Other':           '📋',
  };
  return map[category] || '📋';
};

export const getRoleColor = (role) => {
  const normalizedRole = normalizeUserRole(role);
  const map = {
    admin: 'bg-purple-100 text-purple-700',
    staff: 'bg-indigo-100 text-indigo-700',
    faculty: 'bg-blue-100 text-blue-700',
    student: 'bg-teal-100 text-teal-700',
  };
  return map[normalizedRole] || 'bg-gray-100 text-gray-600';
};

export const getInitials = (name = '') => {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

export const getAvatarPresetUrl = (avatarChoice) => {
  if (!avatarChoice) return getAvatarUrl(getDefaultAvatarFilename());
  if (avatarChoice.startsWith('/avatars/')) {
    const filename = decodeURIComponent(avatarChoice.replace('/avatars/', ''));
    return getAvatarUrl(filename);
  }
  return getAvatarUrl(avatarChoice);
};

export const getAvatarSource = (user = {}) => {
  if (user?.profileImage) return getAssetUrl(user.profileImage);
  if (user?.avatarChoice) return getAvatarPresetUrl(user.avatarChoice);
  if (user?.avatar) return getAssetUrl(user.avatar);
  return '';
};

export const getAvatarTone = (seed = '') => {
  const palette = [
    { bg: '#dbeafe', fg: '#1d4ed8' },
    { bg: '#dcfce7', fg: '#15803d' },
    { bg: '#fce7f3', fg: '#be185d' },
    { bg: '#ede9fe', fg: '#6d28d9' },
    { bg: '#fef3c7', fg: '#b45309' },
    { bg: '#cffafe', fg: '#0f766e' },
  ];
  const hash = String(seed || '')
    .split('')
    .reduce((total, char) => total + char.charCodeAt(0), 0);
  return palette[hash % palette.length];
};

export const CATEGORIES = [
  'IT Support', 'Administration', 'Hostel', 'Library',
  'Finance', 'Academic', 'Infrastructure', 'Other',
];

export const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];

export const STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed'];
