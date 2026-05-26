import React from 'react';
import { FiChevronRight, FiFileText, FiTrash2 } from 'react-icons/fi';

const TYPE_STYLES = {
  notes: 'theme-accent-badge',
  pyq: 'theme-accent-badge',
  'study-material': 'theme-accent-badge',
  document: 'theme-muted-badge',
};

const TYPE_LABELS = {
  notes: 'Notes',
  pyq: 'PYQ',
  'study-material': 'Study Material',
  document: 'Document',
};

export default function ResourceCard({
  resource,
  onOpen,
  onDelete,
  canDelete = false,
  deleteDisabledReason = '',
}) {
  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onOpen?.(resource)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen?.(resource);
        }
      }}
      className="theme-surface flex aspect-square h-full min-h-[240px] flex-col overflow-hidden rounded-[24px] p-4 text-left transition duration-200 hover:-translate-y-1 hover:shadow-xl"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="theme-icon-surface flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl shadow-sm">
            <FiFileText size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${TYPE_STYLES[resource.resourceType] || TYPE_STYLES.document}`}>
                {TYPE_LABELS[resource.resourceType] || resource.resourceType}
              </span>
            </div>
            <h3 className="theme-text-strong mt-3 line-clamp-3 font-display text-base font-bold leading-6">
              {resource.title}
            </h3>
          </div>
        </div>
        {canDelete ? (
          <button
            type="button"
            title={deleteDisabledReason || 'Delete resource'}
            onClick={(event) => {
              event.stopPropagation();
              onDelete?.(resource);
            }}
            className="theme-danger-button inline-flex h-9 w-9 items-center justify-center rounded-2xl transition"
          >
            <FiTrash2 size={16} />
          </button>
        ) : null}
      </div>

      <div className="mt-4 flex min-h-0 flex-1 flex-col">
        <div className="space-y-2.5">
          <div className="theme-surface-soft rounded-2xl px-3 py-2.5">
            <p className="theme-text-muted text-[11px] font-semibold uppercase tracking-[0.18em]">Course</p>
            <p className="theme-text-strong mt-1 line-clamp-2 text-sm font-semibold leading-5">
              {resource.courseName || 'Not tagged'}
            </p>
          </div>

          <div className="theme-surface-soft rounded-2xl px-3 py-2.5">
            <p className="theme-text-muted text-[11px] font-semibold uppercase tracking-[0.18em]">Department</p>
            <p className="theme-text-strong mt-1 line-clamp-2 text-sm font-semibold leading-5">
              {resource.department || 'Not available'}
            </p>
          </div>

          <div className="theme-surface-soft rounded-2xl px-3 py-2.5">
            <p className="theme-text-muted text-[11px] font-semibold uppercase tracking-[0.18em]">Program</p>
            <p className="theme-text-strong mt-1 line-clamp-2 text-sm font-semibold leading-5">
              {resource.program || 'Not available'}
            </p>
          </div>
        </div>

        <span className="theme-text-main mt-auto inline-flex items-center justify-between pt-3 text-sm font-semibold">
          <span>View details</span>
          <FiChevronRight size={15} />
        </span>
      </div>
    </article>
  );
}
