import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  FiAlertCircle,
  FiArrowUpRight,
  FiBookmark,
  FiDownload,
  FiFilter,
  FiPlus,
  FiSearch,
  FiTrash2,
} from 'react-icons/fi';
import API from '../utils/api';
import { Alert, ConfirmDialog, EmptyState, PageHeader } from '../components/ui';
import { formatRelative, getAssetUrl, getRoleLabel } from '../utils/helpers';
import { usePermissions } from '../context/PermissionContext';
import { useAuth } from '../context/AuthContext';

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'academic', label: 'Academic' },
  { value: 'event', label: 'Events' },
  { value: 'opportunity', label: 'Opportunities' },
];

const PRIORITY_STYLES = {
  high: { tone: 'border-red-200 bg-red-50 text-red-700', label: 'Urgent' },
  medium: { tone: 'border-amber-200 bg-amber-50 text-amber-700', label: 'Priority' },
  low: { tone: 'border-blue-200 bg-blue-50 text-blue-700', label: 'Update' },
};

const EmptyNoticeSkeleton = () => (
  <div className="space-y-4">
    <div className="card p-5 animate-pulse">
      <div className="h-4 w-24 rounded bg-gray-200" />
      <div className="mt-4 h-8 w-3/4 rounded bg-gray-200" />
      <div className="mt-4 space-y-2">
        <div className="h-4 w-full rounded bg-gray-100" />
        <div className="h-4 w-5/6 rounded bg-gray-100" />
        <div className="h-4 w-2/3 rounded bg-gray-100" />
      </div>
    </div>
    <div className="grid gap-4 lg:grid-cols-2">
      {[1, 2, 3, 4].map((item) => (
        <div key={item} className="card p-4 animate-pulse">
          <div className="h-4 w-20 rounded bg-gray-200" />
          <div className="mt-3 h-6 w-2/3 rounded bg-gray-200" />
          <div className="mt-4 space-y-2">
            <div className="h-3 w-full rounded bg-gray-100" />
            <div className="h-3 w-4/5 rounded bg-gray-100" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

const AudiencePills = ({ audience }) => {
  const groups = [
    { label: 'Roles', values: audience?.roles },
    { label: 'Departments', values: audience?.departments },
    { label: 'Years', values: audience?.years },
    { label: 'Sections', values: audience?.sections },
  ].filter((item) => item.values?.length);

  if (!groups.length) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {groups.map((group) => (
        <span key={group.label} className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
          <strong className="mr-1">{group.label}:</strong> {group.values.join(', ')}
        </span>
      ))}
    </div>
  );
};

function FeaturedNotice({ notice, canDelete, onDelete }) {
  const priorityStyle = PRIORITY_STYLES[notice.priority] || PRIORITY_STYLES.medium;

  return (
    <article className="card overflow-hidden border-slate-200">
      <div className="border-b border-gray-100 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold ${priorityStyle.tone}`}>
                <FiBookmark size={12} />
                {priorityStyle.label}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold uppercase text-slate-700">
                {notice.category}
              </span>
              <span className="text-xs text-gray-400">{formatRelative(notice.createdAt)}</span>
            </div>
            <h2 className="mt-3 font-display text-2xl font-black text-gray-900">{notice.title}</h2>
          </div>
          {canDelete ? (
            <button onClick={() => onDelete(notice._id)} className="rounded-xl p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500">
              <FiTrash2 size={16} />
            </button>
          ) : null}
        </div>
      </div>

      <div className="space-y-4 px-5 py-4">
        <p className="whitespace-pre-wrap text-sm leading-7 text-gray-700">{notice.description || notice.message}</p>
        <AudiencePills audience={notice.targetAudience} />

        {notice.attachments?.length ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {notice.attachments.map((file, index) => {
              const url = getAssetUrl(file.fileUrl);
              return (
                <a
                  key={`${file.fileUrl}-${index}`}
                  href={`${url}${url.includes('?') ? '&' : '?'}download=1`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 rounded-2xl border border-gray-200 px-3 py-3 transition-colors hover:border-blue-300 hover:bg-blue-50"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                    <FiDownload size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-800">{file.fileName}</p>
                    <p className="truncate text-xs text-gray-500">{file.fileType || 'Attachment'}</p>
                  </div>
                </a>
              );
            })}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3 text-xs text-gray-500">
          <span>
            Posted by <strong className="text-gray-700">{notice.postedBy?.name || 'University'}</strong> · {getRoleLabel(notice.postedBy?.role)}
          </span>
          <span>{formatRelative(notice.createdAt)}</span>
        </div>
      </div>
    </article>
  );
}

function CompactNotice({ notice, canDelete, onDelete }) {
  const priorityStyle = PRIORITY_STYLES[notice.priority] || PRIORITY_STYLES.medium;

  return (
    <article className="card p-4 transition-shadow hover:shadow-card-hover">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${priorityStyle.tone}`}>
              {priorityStyle.label}
            </span>
            <span className="text-xs uppercase text-gray-400">{notice.category}</span>
          </div>
          <h3 className="mt-2 line-clamp-2 font-display text-lg font-bold text-gray-900">{notice.title}</h3>
          <p className="mt-2 line-clamp-3 text-sm leading-6 text-gray-600">{notice.description || notice.message}</p>
        </div>
        {canDelete ? (
          <button onClick={() => onDelete(notice._id)} className="rounded-xl p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500">
            <FiTrash2 size={15} />
          </button>
        ) : null}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 text-xs text-gray-500">
        <span className="truncate">{notice.postedBy?.name || 'University'}</span>
        <span>{formatRelative(notice.createdAt)}</span>
      </div>
    </article>
  );
}

export default function AnnouncementsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteState, setDeleteState] = useState({ open: false, noticeId: '', loading: false });
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');

  const canManage = hasPermission('canPostNotice');

  useEffect(() => {
    let active = true;

    const loadNotices = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await API.get('/content?view=feed&limit=24');
        if (!active) return;
        setItems(Array.isArray(response.data?.data) ? response.data.data : []);
      } catch (requestError) {
        if (!active) return;
        setItems([]);
        setError(requestError.response?.data?.message || 'Unable to load notices right now.');
      } finally {
        if (active) setLoading(false);
      }
    };

    loadNotices();
    return () => {
      active = false;
    };
  }, []);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesCategory = category === 'all' || item.category === category;
      const haystack = [item.title, item.description, item.message, item.category, item.type]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const matchesSearch = !query || haystack.includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [category, items, search]);

  const urgentItems = useMemo(() => filteredItems.filter((item) => item.priority === 'high'), [filteredItems]);
  const featuredNotice = filteredItems[0] || null;
  const secondaryNotices = filteredItems.slice(1);

  const summary = useMemo(() => ({
    total: filteredItems.length,
    urgent: urgentItems.length,
    pinnedLabel: featuredNotice?.category ? featuredNotice.category : 'none',
  }), [featuredNotice?.category, filteredItems.length, urgentItems.length]);

  const deleteItem = async (id) => {
    setDeleteState({ open: true, noticeId: id, loading: false });
  };

  const confirmDeleteItem = async () => {
    if (!deleteState.noticeId) return;
    setDeleteState((current) => ({ ...current, loading: true }));
    try {
      await API.delete(`/content/${deleteState.noticeId}`);
      setItems((current) => current.filter((item) => item._id !== deleteState.noticeId));
      toast.success('Notice deleted');
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || 'Delete failed');
    } finally {
      setDeleteState({ open: false, noticeId: '', loading: false });
    }
  };

  return (
    <div className="space-y-5">
      <ConfirmDialog
        open={deleteState.open}
        title="Delete notice"
        description="Are you sure you want to delete this notice? This action cannot be undone."
        confirmLabel="Delete Notice"
        loading={deleteState.loading}
        onConfirm={confirmDeleteItem}
        onClose={() => setDeleteState({ open: false, noticeId: '', loading: false })}
      />

      <div className="grid gap-4 xl:grid-cols-[1.1fr,0.9fr]">
        <PageHeader
          title="Notice Board"
          subtitle="Important university updates, arranged for fast scanning."
          action={canManage ? (
            <button onClick={() => navigate('/notice-board/new')} className="btn-primary">
              <FiPlus size={15} /> Publish Notice
            </button>
          ) : null}
        />

        <div className="grid grid-cols-3 gap-3">
          <div className="notice-summary-card rounded-2xl border border-blue-100 bg-blue-50/80 px-4 py-3 text-blue-900">
            <p className="notice-summary-label text-[11px] font-semibold uppercase tracking-[0.18em] opacity-70">Visible</p>
            <p className="notice-summary-value mt-1 font-display text-2xl font-black">{summary.total}</p>
          </div>
          <div className="notice-summary-card rounded-2xl border border-red-100 bg-red-50/80 px-4 py-3 text-red-900">
            <p className="notice-summary-label text-[11px] font-semibold uppercase tracking-[0.18em] opacity-70">Urgent</p>
            <p className="notice-summary-value mt-1 font-display text-2xl font-black">{summary.urgent}</p>
          </div>
          <div className="notice-summary-card rounded-2xl border border-emerald-100 bg-emerald-50/80 px-4 py-3 text-emerald-900">
            <p className="notice-summary-label text-[11px] font-semibold uppercase tracking-[0.18em] opacity-70">Lead Type</p>
            <p className="notice-summary-value mt-1 font-display text-lg font-black capitalize">{summary.pinnedLabel}</p>
          </div>
        </div>
      </div>

      <section className="card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {CATEGORY_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setCategory(option.value)}
                className={`rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors ${
                  category === option.value ? 'bg-slate-900 text-white shadow-lg' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative min-w-[250px]">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
              <input
                className="input pl-9"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search notices in real time"
              />
            </div>
            <div className="inline-flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-500">
              <FiFilter size={14} />
              Personalized by audience
            </div>
          </div>
        </div>
      </section>

      {error ? <Alert type="error" message={error} /> : null}

      {loading ? (
        <EmptyNoticeSkeleton />
      ) : filteredItems.length === 0 ? (
        <EmptyState
          icon="📌"
          title="No notices found"
          description="Try another category or search term. The board only shows notices relevant to your audience."
        />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[1.2fr,0.8fr]">
          <div className="space-y-4">
            {featuredNotice ? (
              <FeaturedNotice
                notice={featuredNotice}
                canDelete={canManage || featuredNotice.postedBy?._id === user?._id}
                onDelete={deleteItem}
              />
            ) : null}

            {secondaryNotices.length ? (
              <div className="grid gap-4 lg:grid-cols-2">
                {secondaryNotices.map((notice) => (
                  <CompactNotice
                    key={notice._id}
                    notice={notice}
                    canDelete={canManage || notice.postedBy?._id === user?._id}
                    onDelete={deleteItem}
                  />
                ))}
              </div>
            ) : null}
          </div>

          <aside className="space-y-4 xl:sticky xl:top-6">
            <div className="card p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">How to use</p>
              <h2 className="mt-2 font-display text-lg font-bold text-gray-900">Find the right update faster</h2>
              <ul className="mt-3 space-y-3 text-sm leading-6 text-gray-600">
                <li className="flex gap-2">
                  <FiBookmark className="mt-1 text-red-500" size={14} />
                  Start with the lead notice for the most important update.
                </li>
                <li className="flex gap-2">
                  <FiSearch className="mt-1 text-blue-500" size={14} />
                  Use live search to narrow the board instantly.
                </li>
                <li className="flex gap-2">
                  <FiArrowUpRight className="mt-1 text-emerald-500" size={14} />
                  Use category chips when you only need academic, event, or opportunity updates.
                </li>
              </ul>
            </div>

            <div className="card p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">Priority signal</p>
              <div className="mt-3 space-y-3">
                <div className="flex items-center justify-between rounded-2xl bg-red-50 px-3 py-3 text-sm text-red-700">
                  <span className="inline-flex items-center gap-2"><FiAlertCircle size={15} /> Urgent</span>
                  <strong>{summary.urgent}</strong>
                </div>
                <div className="rounded-2xl border border-gray-100 bg-slate-50 px-3.5 py-3 text-sm text-gray-600">
                  This board is already filtered for your role, department, year, and section, so you can trust what appears here.
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
