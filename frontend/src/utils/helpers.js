import { formatDistanceToNow, format } from 'date-fns';

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
  const map = {
    'admin':   'bg-purple-100 text-purple-700',
    'agent':   'bg-indigo-100 text-indigo-700',
    'student': 'bg-teal-100 text-teal-700',
  };
  return map[role] || 'bg-gray-100 text-gray-600';
};

export const getInitials = (name = '') => {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

export const CATEGORIES = [
  'IT Support', 'Administration', 'Hostel', 'Library',
  'Finance', 'Academic', 'Infrastructure', 'Other',
];

export const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];

export const STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed'];
