import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiHelpCircle } from 'react-icons/fi';
import { getAvatarSource, getAvatarTone, getCategoryIcon, getInitials } from '../utils/helpers';
import { getAvatarUrl, getDefaultAvatarFilename } from '../constants/avatarOptions';

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

export const PageHeader = ({ title, subtitle, description, meta, action }) => {
  const supportingCopy = description || subtitle;
  const metaItems = Array.isArray(meta) ? meta.filter(Boolean) : meta ? [meta] : [];

  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        {title ? <h1 className="sr-only">{title}</h1> : null}
        {supportingCopy ? (
          <p className="max-w-3xl font-display text-lg font-semibold leading-8 text-gray-900 sm:text-xl">
            {supportingCopy}
          </p>
        ) : null}
        {metaItems.length ? (
          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            {metaItems.map((item, index) => (
              <span
                key={`${typeof item === 'string' ? item : 'meta'}-${index}`}
                className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm"
              >
                {item}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      {action ? <div className="flex-shrink-0 self-start">{action}</div> : null}
    </div>
  );
};

export const StatCard = ({ label, value, icon, gradient, trend }) => (
  <div className={`card p-5 overflow-hidden relative group hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200`}>
    <div className={`absolute top-0 right-0 w-24 h-24 rounded-full opacity-10 -translate-y-8 translate-x-8 ${gradient || 'bg-blue-500'}`} />
    <div className="flex items-start justify-between relative">
      <div>
        <p className="theme-text-muted mb-1 text-xs font-semibold uppercase tracking-wider">{label}</p>
        <p className="theme-text-strong font-display text-3xl font-black">{value ?? 0}</p>
        {trend && <p className="theme-text-muted mt-1 text-xs">{trend}</p>}
      </div>
      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl shadow-sm ${gradient || 'bg-blue-50'}`}>
        {icon}
      </div>
    </div>
  </div>
);

export const Avatar = ({ user, name = '', src = '', avatarChoice = '', size = 'sm', className = '' }) => {
  const sizeMap = {
    sm: 'w-8 h-8 text-xs rounded-full',
    md: 'w-10 h-10 text-sm rounded-full',
    lg: 'w-14 h-14 text-base rounded-full',
    xl: 'w-20 h-20 text-xl rounded-full',
  };
  const resolvedName = name || user?.name || '';
  const resolvedSrc = src || getAvatarSource(user || { profileImage: null, avatar: null, avatarChoice });
  const tone = getAvatarTone(user?.systemId || user?.email || resolvedName);
  const [displaySrc, setDisplaySrc] = useState(resolvedSrc);
  const [fallbackFailed, setFallbackFailed] = useState(false);

  useEffect(() => {
    setDisplaySrc(resolvedSrc);
    setFallbackFailed(false);
  }, [resolvedSrc]);

  if (displaySrc && !fallbackFailed) {
    return (
      <div
        className={`${sizeMap[size] || sizeMap.sm} p-1 shadow-sm flex-shrink-0 ${className}`}
        style={{ backgroundColor: '#ffffff' }}
      >
        <img
          src={displaySrc}
          alt={resolvedName || 'Avatar'}
          loading="lazy"
          crossOrigin="use-credentials"
          className="h-full w-full rounded-full object-contain"
          onError={() => {
            const fallbackFilename = getDefaultAvatarFilename();
            const defaultSrc = fallbackFilename ? getAvatarUrl(fallbackFilename) : '';
            if (defaultSrc && displaySrc !== defaultSrc) {
              setDisplaySrc(defaultSrc);
              return;
            }
            setFallbackFailed(true);
          }}
        />
      </div>
    );
  }

  return (
    <div
      className={`${sizeMap[size] || sizeMap.sm} flex items-center justify-center font-bold flex-shrink-0 shadow-sm ${className}`}
      style={{ backgroundColor: '#ffffff', color: tone.fg }}
    >
      {getInitials(resolvedName || 'U')}
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

export const HelpTooltip = ({ title = 'How this works', items = [], className = '' }) => {
  const normalizedItems = Array.isArray(items) ? items.filter(Boolean) : [];

  if (!normalizedItems.length) return null;

  return (
    <div className={`group relative inline-flex ${className}`}>
      <button
        type="button"
        aria-label={title}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
      >
        <FiHelpCircle size={15} />
      </button>
      <div className="pointer-events-none absolute right-0 top-full z-20 mt-2 w-80 origin-top-right rounded-2xl border border-slate-200 bg-white p-4 text-left opacity-0 shadow-xl transition duration-150 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 dark:border-slate-700 dark:bg-slate-900">
        <p className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">{title}</p>
        <div className="mt-3 space-y-3">
          {normalizedItems.map((item, index) => (
            <div key={`${item.label}-${index}`} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 dark:border-slate-800 dark:bg-slate-800/80">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{item.label}</p>
              <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const Modal = ({
  open,
  onClose,
  children,
  panelClassName = '',
  contentClassName = '',
  closeOnOutside = true,
  zIndexClassName = 'z-[90]',
}) => {
  useEffect(() => {
    if (!open) return undefined;

    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className={`fixed inset-0 ${zIndexClassName} grid place-items-center p-4`}>
      <button
        type="button"
        aria-label="Close modal"
        className="modal-backdrop absolute inset-0"
        onClick={closeOnOutside ? onClose : undefined}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={`modal-panel relative w-full ${panelClassName}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={contentClassName}>
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};

export const ConfirmDialog = ({
  open,
  title = 'Confirm action',
  description = 'Are you sure you want to continue?',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  loading = false,
  onConfirm,
  onClose,
}) => {
  const toneClasses = tone === 'danger'
    ? 'bg-red-600 hover:bg-red-700 focus:ring-red-200'
    : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-200';

  return (
    <Modal open={open} onClose={onClose} panelClassName="max-w-md">
      <div className="w-full rounded-3xl border border-slate-200/80 bg-white p-6 shadow-2xl dark:border-slate-700/80 dark:bg-slate-900">
        <h3 className="font-display text-xl font-bold text-gray-900">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-gray-500">{description}</p>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={loading} className="btn-secondary justify-center">
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} disabled={loading} className={`btn-primary justify-center ${toneClasses}`}>
            {loading ? 'Please wait...' : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
};
