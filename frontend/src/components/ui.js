import React from 'react';
import { getStatusColor, getPriorityColor, getCategoryIcon } from '../utils/helpers';

export const StatusBadge = ({ status }) => {
  const map = {
    'Open':        'bg-blue-50 text-blue-700 border border-blue-200',
    'In Progress': 'bg-amber-50 text-amber-700 border border-amber-200',
    'Resolved':    'bg-emerald-50 text-emerald-700 border border-emerald-200',
    'Closed':      'bg-gray-100 text-gray-500 border border-gray-200',
  };
  return <span className={`badge ${map[status] || 'bg-gray-100 text-gray-600'}`}>{status}</span>;
};

export const PriorityBadge = ({ priority }) => {
  const map = {
    'Low':      'bg-green-50 text-green-700 border border-green-200',
    'Medium':   'bg-blue-50 text-blue-700 border border-blue-200',
    'High':     'bg-orange-50 text-orange-700 border border-orange-200',
    'Critical': 'bg-red-50 text-red-700 border border-red-200',
  };
  return <span className={`badge ${map[priority] || 'bg-gray-100 text-gray-600'}`}>{priority}</span>;
};

export const CategoryBadge = ({ category }) => (
  <span className="badge bg-indigo-50 text-indigo-700 border border-indigo-100 gap-1">
    <span>{getCategoryIcon(category)}</span>{category}
  </span>
);

export const Spinner = ({ size = 'md', className = '' }) => {
  const s = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-10 h-10' }[size];
  return <div className={`${s} border-2 border-blue-100 border-t-blue-600 rounded-full animate-spin ${className}`} />;
};

export const FullPageSpinner = () => (
  <div className="flex flex-col items-center justify-center h-64 gap-3">
    <Spinner size="lg" />
    <p className="text-sm text-gray-400 font-medium">Loading...</p>
  </div>
);

export const EmptyState = ({ icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center py-20 text-center">
    <div className="text-5xl mb-4 animate-bounce">{icon || '📭'}</div>
    <h3 className="font-display text-lg font-bold text-gray-800 mb-1">{title}</h3>
    {description && <p className="text-sm text-gray-500 mb-5 max-w-sm leading-relaxed">{description}</p>}
    {action}
  </div>
);

export const PageHeader = ({ title, subtitle, action }) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
    <div>
      <h1 className="font-display text-2xl font-bold text-gray-900">{title}</h1>
      {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
    </div>
    {action && <div className="flex-shrink-0">{action}</div>}
  </div>
);

export const StatCard = ({ label, value, icon, gradient, trend }) => (
  <div className={`card p-5 overflow-hidden relative group hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200`}>
    <div className={`absolute top-0 right-0 w-24 h-24 rounded-full opacity-10 -translate-y-8 translate-x-8 ${gradient || 'bg-blue-500'}`} />
    <div className="flex items-start justify-between relative">
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{label}</p>
        <p className="font-display text-3xl font-black text-gray-900">{value ?? 0}</p>
        {trend && <p className="text-xs text-gray-400 mt-1">{trend}</p>}
      </div>
      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl shadow-sm ${gradient || 'bg-blue-50'}`}>
        {icon}
      </div>
    </div>
  </div>
);

export const Avatar = ({ name = '', size = 'sm' }) => {
  const sizeMap = { sm: 'w-7 h-7 text-xs', md: 'w-9 h-9 text-sm', lg: 'w-12 h-12 text-base' };
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  return (
    <div className={`rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 text-white flex items-center justify-center font-bold flex-shrink-0 shadow-sm ${sizeMap[size]}`}>
      {initials}
    </div>
  );
};

export const Alert = ({ type = 'error', message }) => {
  if (!message) return null;
  const map = {
    error:   'bg-red-50 border-red-200 text-red-700',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    warning: 'bg-amber-50 border-amber-200 text-amber-700',
    info:    'bg-blue-50 border-blue-200 text-blue-700',
  };
  const icons = { error: '⚠️', success: '✅', warning: '⚡', info: 'ℹ️' };
  return (
    <div className={`border rounded-xl px-4 py-3 text-sm flex items-start gap-2 ${map[type]}`}>
      <span>{icons[type]}</span>
      <span>{message}</span>
    </div>
  );
};
