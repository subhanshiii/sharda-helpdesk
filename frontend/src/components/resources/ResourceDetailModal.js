import React from 'react';
import {
  FiCalendar,
  FiDownload,
  FiEye,
  FiFileText,
  FiTag,
  FiUser,
  FiX,
} from 'react-icons/fi';
import { Modal } from '../ui';

const TYPE_LABELS = {
  notes: 'Notes',
  pyq: 'PYQ',
  'study-material': 'Study Material',
  document: 'Document',
};

const formatBytes = (bytes = 0) => {
  if (!bytes) return '0 KB';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / (1024 ** index);
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
};

const formatDate = (value) => {
  if (!value) return 'Unknown';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
};

const InfoTile = ({ icon, label, value }) => (
  <div className="theme-surface-soft min-w-0 rounded-2xl px-4 py-3">
    <div className="theme-text-muted flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em]">
      {icon}
      {label}
    </div>
    <p className="theme-text-strong mt-2 break-words text-sm font-semibold leading-6">{value || 'Not available'}</p>
  </div>
);

export default function ResourceDetailModal({
  open,
  resource,
  onClose,
  onView,
  onDownload,
}) {
  if (!open || !resource) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      panelClassName="max-w-3xl"
      contentClassName="theme-surface max-h-[calc(100vh-2rem)] overflow-hidden rounded-[32px] shadow-2xl"
    >
      <div className="flex max-h-[calc(100vh-2rem)] flex-col">
        <div className="theme-surface-soft border-b px-5 py-5 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="theme-accent-badge inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em]">
                Resource details
              </p>
              <h2 className="theme-text-strong mt-3 break-words font-display text-xl font-bold sm:text-2xl">{resource.title}</h2>
              <p className="theme-text-muted mt-2 line-clamp-3 text-sm leading-6">
                {resource.description || 'No description was added for this resource.'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="theme-ghost-button inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl transition"
              aria-label="Close resource details"
            >
              <FiX size={18} />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
            <div className="min-w-0 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <InfoTile icon={<FiTag size={14} />} label="Type" value={TYPE_LABELS[resource.resourceType] || resource.resourceType} />
                <InfoTile icon={<FiFileText size={14} />} label="File name" value={resource.originalFileName} />
                <InfoTile icon={<FiCalendar size={14} />} label="Uploaded on" value={formatDate(resource.createdAt)} />
                <InfoTile icon={<FiUser size={14} />} label="Uploaded by" value={resource.uploadedBy?.name || 'Unknown'} />
              </div>

              <div className="theme-surface-soft min-w-0 rounded-[28px] p-5">
                <p className="theme-text-muted text-xs font-semibold uppercase tracking-[0.24em]">Academic tags</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {[resource.courseName, resource.department, resource.program, resource.school].filter(Boolean).map((item) => (
                    <span key={item} className="theme-chip max-w-full truncate rounded-full px-3 py-1 text-xs font-medium">
                      {item}
                    </span>
                  ))}
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <InfoTile icon={<FiFileText size={14} />} label="Size" value={formatBytes(resource.size)} />
                  <InfoTile icon={<FiDownload size={14} />} label="Downloads" value={`${resource.downloadCount || 0}`} />
                </div>
              </div>
            </div>

            <div className="theme-surface-soft min-w-0 rounded-[28px] p-5">
              <div className="theme-icon-surface flex h-14 w-14 items-center justify-center rounded-2xl shadow-sm">
                <FiFileText size={24} />
              </div>
              <h3 className="theme-text-strong mt-4 font-display text-lg font-bold sm:text-xl">Open or save this resource</h3>
              <p className="theme-text-muted mt-2 text-sm leading-6">
                Use view to open the file in a new tab, or download to save a copy on your device.
              </p>

              <div className="mt-6 grid gap-3">
                <button
                  type="button"
                  onClick={() => onView?.(resource)}
                  className="theme-ghost-button inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition"
                >
                  <FiEye size={16} />
                  View resource
                </button>
                <button
                  type="button"
                  onClick={() => onDownload?.(resource)}
                  className="btn-primary justify-center rounded-2xl px-4 py-3"
                >
                  <FiDownload size={16} />
                  Download resource
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
