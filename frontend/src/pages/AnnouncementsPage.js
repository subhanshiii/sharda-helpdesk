import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import API from '../utils/api';
import toast from 'react-hot-toast';
import {
  FiCalendar,
  FiChevronLeft,
  FiChevronRight,
  FiDownload,
  FiFilter,
  FiPlus,
  FiSearch,
  FiTrash2,
  FiUpload,
  FiX,
} from 'react-icons/fi';
import { PageHeader, FullPageSpinner, EmptyState, Alert } from '../components/ui';
import { formatRelative, getAssetUrl, getRoleLabel } from '../utils/helpers';
import { usePermissions } from '../context/PermissionContext';
import { useAuth } from '../context/AuthContext';

const VIEW_OPTIONS = [
  { value: 'feed', label: 'Feed' },
  { value: 'calendar', label: 'Academic Calendar' },
];

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'event', label: 'Events' },
  { value: 'academic', label: 'Academic' },
  { value: 'opportunity', label: 'Opportunities' },
];

const CALENDAR_TYPES = ['all', 'Exam', 'Holiday', 'Event', 'Deadline', 'Result', 'Registration', 'Other'];

const PRIORITY_OPTIONS = [
  { value: 'high', label: 'High', badge: 'bg-red-100 text-red-700 border-red-200', dot: 'bg-red-500' },
  { value: 'medium', label: 'Medium', badge: 'bg-amber-100 text-amber-700 border-amber-200', dot: 'bg-amber-400' },
  { value: 'low', label: 'Low', badge: 'bg-blue-100 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
];

const CALENDAR_TYPE_STYLES = {
  Exam:         { badge: 'bg-red-100 text-red-700 border-red-200', dot: 'bg-red-500' },
  Holiday:      { badge: 'bg-green-100 text-green-700 border-green-200', dot: 'bg-green-500' },
  Deadline:     { badge: 'bg-orange-100 text-orange-700 border-orange-200', dot: 'bg-orange-500' },
  Result:       { badge: 'bg-blue-100 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  Registration: { badge: 'bg-violet-100 text-violet-700 border-violet-200', dot: 'bg-violet-500' },
  Event:        { badge: 'bg-pink-100 text-pink-700 border-pink-200', dot: 'bg-pink-500' },
  Other:        { badge: 'bg-slate-100 text-slate-700 border-slate-200', dot: 'bg-slate-500' },
};

const typeByPriority = {
  high: 'urgent',
  medium: 'warning',
  low: 'info',
};

const emptyAudience = {
  audienceRoles: '',
  audienceDepartments: '',
  audienceYears: '',
  audienceSections: '',
};

const getMonthKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  return `${year}-${month}`;
};

const createMonthDate = (monthKey) => {
  const [year, month] = String(monthKey).split('-').map(Number);
  return new Date(year, (month || 1) - 1, 1);
};

const buildCalendarGrid = (monthKey, events) => {
  const baseDate = createMonthDate(monthKey);
  const startDay = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
  const endDay = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0);
  const leadingDays = startDay.getDay();
  const totalDays = endDay.getDate();
  const cells = [];

  for (let index = 0; index < leadingDays; index += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= totalDays; day += 1) {
    const isoDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), day).toISOString().slice(0, 10);
    const dayEvents = events.filter((item) => item.date?.slice(0, 10) === isoDate);
    cells.push({ day, isoDate, events: dayEvents });
  }

  return cells;
};

const AudiencePill = ({ label, values }) => {
  if (!values?.length) return null;
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
      <strong>{label}:</strong> {values.join(', ')}
    </span>
  );
};

function NoticeCard({ notice, canDelete, onDelete }) {
  const priority = PRIORITY_OPTIONS.find((item) => item.value === notice.priority) || PRIORITY_OPTIONS[1];

  return (
    <article className={`card overflow-hidden border ${notice.priority === 'high' ? 'ring-1 ring-red-200 shadow-card-hover' : ''}`}>
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full border text-xs font-semibold ${priority.badge}`}>
                <span className={`w-2 h-2 rounded-full ${priority.dot}`} />
                {priority.label}
              </span>
              <span className="badge text-xs bg-slate-100 text-slate-700 uppercase">{notice.category}</span>
            </div>
            <h3 className="font-display font-bold text-lg text-gray-900 mt-3">{notice.title}</h3>
          </div>
          {canDelete && (
            <button
              onClick={() => onDelete(notice._id)}
              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
            >
              <FiTrash2 size={15} />
            </button>
          )}
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        <p className="text-sm text-gray-700 leading-7 whitespace-pre-wrap">{notice.description || notice.message}</p>

        <div className="flex flex-wrap gap-2">
          <AudiencePill label="Roles" values={notice.targetAudience?.roles} />
          <AudiencePill label="Departments" values={notice.targetAudience?.departments} />
          <AudiencePill label="Years" values={notice.targetAudience?.years} />
          <AudiencePill label="Sections" values={notice.targetAudience?.sections} />
        </div>

        {notice.attachments?.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Attachments</p>
            <div className="grid sm:grid-cols-2 gap-2">
              {notice.attachments.map((file, index) => {
                const assetUrl = getAssetUrl(file.fileUrl);
                const downloadUrl = `${assetUrl}${assetUrl.includes('?') ? '&' : '?'}download=1`;

                return (
                  <a
                    key={`${file.fileUrl}-${index}`}
                    href={downloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
                      <FiDownload size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-800 truncate">{file.fileName}</p>
                      <p className="text-xs text-gray-500 truncate">{file.fileType || 'Attachment'}</p>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 pt-1 text-xs text-gray-400">
          <span>
            Posted by <strong className="text-gray-600">{notice.postedBy?.name}</strong> · {getRoleLabel(notice.postedBy?.role)}
          </span>
          <span>{formatRelative(notice.createdAt)}</span>
        </div>
      </div>
    </article>
  );
}

function CalendarEventCard({ event, canDelete, onDelete }) {
  const style = CALENDAR_TYPE_STYLES[event.type] || CALENDAR_TYPE_STYLES.Other;
  const start = new Date(event.date);
  const end = event.endDate ? new Date(event.endDate) : null;

  return (
    <article className="card p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full border text-xs font-semibold ${style.badge}`}>
              <span className={`w-2 h-2 rounded-full ${style.dot}`} />
              {event.type}
            </span>
            <span className="text-xs text-gray-400">{start.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
            {end && (
              <span className="text-xs text-gray-400">
                to {end.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            )}
          </div>
          <h3 className="font-display font-bold text-lg text-gray-900 mt-2">{event.title}</h3>
        </div>
        {canDelete && (
          <button
            onClick={() => onDelete(event._id)}
            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
          >
            <FiTrash2 size={15} />
          </button>
        )}
      </div>

      {event.description && <p className="text-sm text-gray-700 leading-7 whitespace-pre-wrap">{event.description}</p>}

      <div className="flex flex-wrap gap-2">
        <AudiencePill label="Roles" values={event.targetAudience?.roles} />
        <AudiencePill label="Departments" values={event.targetAudience?.departments} />
        <AudiencePill label="Years" values={event.targetAudience?.years} />
        <AudiencePill label="Sections" values={event.targetAudience?.sections} />
      </div>

      <div className="flex items-center justify-between gap-3 pt-1 text-xs text-gray-400">
        <span>
          Added by <strong className="text-gray-600">{event.postedBy?.name}</strong> · {getRoleLabel(event.postedBy?.role)}
        </span>
        <span>{formatRelative(event.createdAt)}</span>
      </div>
    </article>
  );
}

function AudienceFields({ form, setForm }) {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div>
        <label className="label">Audience Roles</label>
        <input
          className="input"
          value={form.audienceRoles}
          onChange={(e) => setForm((prev) => ({ ...prev, audienceRoles: e.target.value }))}
          placeholder="student, faculty"
        />
      </div>
      <div>
        <label className="label">Audience Departments</label>
        <input
          className="input"
          value={form.audienceDepartments}
          onChange={(e) => setForm((prev) => ({ ...prev, audienceDepartments: e.target.value }))}
          placeholder="CSE, IT"
        />
      </div>
      <div>
        <label className="label">Audience Years</label>
        <input
          className="input"
          value={form.audienceYears}
          onChange={(e) => setForm((prev) => ({ ...prev, audienceYears: e.target.value }))}
          placeholder="1, 2"
        />
      </div>
      <div>
        <label className="label">Audience Sections</label>
        <input
          className="input"
          value={form.audienceSections}
          onChange={(e) => setForm((prev) => ({ ...prev, audienceSections: e.target.value }))}
          placeholder="A, B"
        />
      </div>
    </div>
  );
}

function CreateNoticeModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'academic',
    priority: 'medium',
    ...emptyAudience,
  });
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim()) {
      setError('Title and description are required');
      return;
    }

    setLoading(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([key, value]) => fd.append(key, value));
      fd.append('contentType', 'notice');
      fd.append('type', typeByPriority[form.priority] || 'info');
      files.forEach((file) => fd.append('attachments', file));

      const res = await API.post('/content', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      onCreated(res.data.data);
      toast.success('Notice published');
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to publish notice');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col animate-fade-in-up">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h2 className="font-display font-bold text-gray-900 text-lg">Publish Notice</h2>
            <p className="text-xs text-gray-500 mt-1">Create a targeted update for students, faculty, or staff.</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500">
            <FiX size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4">
          {error && <Alert type="error" message={error} />}

          <div>
            <label className="label">Title</label>
            <input
              className="input"
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Semester registration deadline updated"
            />
          </div>

          <div>
            <label className="label">Description</label>
            <textarea
              className="input resize-none"
              rows={5}
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Write the full notice here..."
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="label">Category</label>
              <select
                className="input"
                value={form.category}
                onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
              >
                {CATEGORY_OPTIONS.filter((item) => item.value !== 'all').map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Priority</label>
              <select
                className="input"
                value={form.priority}
                onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value }))}
              >
                {PRIORITY_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </div>
          </div>

          <AudienceFields form={form} setForm={setForm} />

          <div>
            <label className="label">Attachments</label>
            <label className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-2xl px-4 py-5 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
              <FiUpload size={16} className="text-blue-500" />
              <span className="text-sm text-gray-600">Upload notice attachments</span>
              <input
                type="file"
                multiple
                className="hidden"
                onChange={(e) => setFiles(Array.from(e.target.files || []).slice(0, 5))}
              />
            </label>
            {files.length > 0 && (
              <div className="mt-3 space-y-2">
                {files.map((file, index) => (
                  <div key={`${file.name}-${index}`} className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-600">
                    <span className="truncate">{file.name}</span>
                    <button type="button" onClick={() => setFiles((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}>
                      <FiX size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">
              {loading ? 'Publishing...' : 'Publish Notice'}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CreateCalendarModal({ onClose, onCreated, defaultMonth }) {
  const [form, setForm] = useState({
    title: '',
    date: `${defaultMonth}-01`,
    endDate: '',
    type: 'Exam',
    description: '',
    ...emptyAudience,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.date) {
      setError('Title and date are required');
      return;
    }

    setLoading(true);
    try {
      const res = await API.post('/content', {
        ...form,
        contentType: 'calendar',
      });
      onCreated(res.data.data);
      toast.success('Calendar date published');
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save calendar event');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-fade-in-up">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h2 className="font-display font-bold text-gray-900 text-lg">Add Academic Calendar Date</h2>
            <p className="text-xs text-gray-500 mt-1">Use this for exams, holidays, registration windows, and university deadlines.</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500">
            <FiX size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4">
          {error && <Alert type="error" message={error} />}

          <div>
            <label className="label">Type</label>
            <select
              className="input"
              value={form.type}
              onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))}
            >
              {CALENDAR_TYPES.filter((item) => item !== 'all').map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Title</label>
            <input
              className="input"
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Mid-semester examinations"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="label">Start Date</label>
              <input
                type="date"
                className="input"
                value={form.date}
                onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">End Date</label>
              <input
                type="date"
                className="input"
                value={form.endDate}
                onChange={(e) => setForm((prev) => ({ ...prev, endDate: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="label">Description</label>
            <textarea
              className="input resize-none"
              rows={4}
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Optional context for this date..."
            />
          </div>

          <AudienceFields form={form} setForm={setForm} />

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">
              {loading ? 'Saving...' : 'Publish Calendar Date'}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AnnouncementsPage() {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const [searchParams, setSearchParams] = useSearchParams();
  const [notices, setNotices] = useState([]);
  const [calendarItems, setCalendarItems] = useState([]);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [loadingCalendar, setLoadingCalendar] = useState(true);
  const [showNoticeModal, setShowNoticeModal] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);

  const view = searchParams.get('view') === 'calendar' ? 'calendar' : 'feed';
  const category = searchParams.get('category') || 'all';
  const calendarType = searchParams.get('type') || 'all';
  const month = searchParams.get('month') || getMonthKey();
  const search = searchParams.get('search') || '';
  const [searchDraft, setSearchDraft] = useState(search);
  const searchParamSnapshot = searchParams.toString();

  const canManage = hasPermission('canPostNotice');

  useEffect(() => {
    setSearchDraft(search);
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const nextParams = new URLSearchParams(searchParams);
      if (searchDraft.trim()) nextParams.set('search', searchDraft.trim());
      else nextParams.delete('search');

      if (nextParams.toString() !== searchParamSnapshot) {
        setSearchParams(nextParams, { replace: true });
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchDraft, searchParams, searchParamSnapshot, setSearchParams]);

  useEffect(() => {
    const loadFeed = async () => {
      setLoadingFeed(true);
      try {
        const params = new URLSearchParams();
        if (category !== 'all') params.append('category', category);
        if (search) params.append('search', search);
        params.append('view', 'feed');
        const res = await API.get(`/content?${params.toString()}`);
        setNotices(res.data.data || []);
      } catch {
        toast.error('Failed to load notice board');
      } finally {
        setLoadingFeed(false);
      }
    };

    loadFeed();
  }, [category, search]);

  useEffect(() => {
    const loadCalendar = async () => {
      setLoadingCalendar(true);
      try {
        const params = new URLSearchParams();
        if (calendarType !== 'all') params.append('type', calendarType);
        if (month) params.append('month', month);
        if (search) params.append('search', search);
        params.append('view', 'calendar');
        const res = await API.get(`/content?${params.toString()}`);
        setCalendarItems(res.data.data || []);
      } catch {
        toast.error('Failed to load academic calendar');
      } finally {
        setLoadingCalendar(false);
      }
    };

    loadCalendar();
  }, [calendarType, month, search]);

  const updateParams = (updates) => {
    const nextParams = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '' || value === 'all') nextParams.delete(key);
      else nextParams.set(key, value);
    });

    if ((updates.view || view) !== 'calendar') {
      nextParams.delete('type');
      nextParams.delete('month');
    }

    setSearchParams(nextParams);
  };

  const noticeStats = useMemo(() => ({
    total: notices.length,
    urgent: notices.filter((notice) => notice.priority === 'high').length,
  }), [notices]);

  const calendarStats = useMemo(() => ({
    total: calendarItems.length,
    upcoming: calendarItems.filter((item) => new Date(item.date) >= new Date()).length,
  }), [calendarItems]);

  const calendarGrid = useMemo(() => buildCalendarGrid(month, calendarItems), [month, calendarItems]);

  const handleDeleteNotice = async (id) => {
    if (!window.confirm('Delete this notice?')) return;
    try {
      await API.delete(`/content/${id}`);
      setNotices((prev) => prev.filter((item) => item._id !== id));
      toast.success('Notice deleted');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    }
  };

  const handleDeleteCalendar = async (id) => {
    if (!window.confirm('Delete this calendar entry?')) return;
    try {
      await API.delete(`/content/${id}`);
      setCalendarItems((prev) => prev.filter((item) => item._id !== id));
      toast.success('Calendar entry deleted');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    }
  };

  const activeMonthDate = createMonthDate(month);
  const loading = view === 'feed' ? loadingFeed : loadingCalendar;

  return (
    <div className="space-y-5">
      {showNoticeModal && (
        <CreateNoticeModal
          onClose={() => setShowNoticeModal(false)}
          onCreated={(notice) => setNotices((prev) => [notice, ...prev])}
        />
      )}

      {showCalendarModal && (
        <CreateCalendarModal
          defaultMonth={month}
          onClose={() => setShowCalendarModal(false)}
          onCreated={(event) => setCalendarItems((prev) => [...prev, event].sort((a, b) => new Date(a.date) - new Date(b.date)))}
        />
      )}

      <PageHeader
        title="Notice Board"
        subtitle={view === 'feed'
          ? `${noticeStats.total} live notices · ${noticeStats.urgent} urgent`
          : `${calendarStats.total} calendar dates · ${calendarStats.upcoming} upcoming`}
        action={canManage ? (
          <button
            onClick={() => (view === 'feed' ? setShowNoticeModal(true) : setShowCalendarModal(true))}
            className="btn-primary"
          >
            <FiPlus size={15} /> {view === 'feed' ? 'Publish Notice' : 'Add Calendar Date'}
          </button>
        ) : null}
      />

      <div className="card p-4 space-y-4">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {VIEW_OPTIONS.map((item) => (
              <button
                key={item.value}
                onClick={() => updateParams({
                  view: item.value === 'feed' ? '' : item.value,
                  month: item.value === 'calendar' ? month : '',
                  type: item.value === 'calendar' ? calendarType : '',
                })}
                className={`px-3.5 py-2 rounded-xl text-sm font-semibold transition-colors ${
                  view === item.value
                    ? 'bg-slate-900 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative min-w-[260px]">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
              <input
                className="input pl-9"
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                placeholder={view === 'feed' ? 'Search notices...' : 'Search calendar entries...'}
              />
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 text-gray-500 text-sm">
              <FiFilter size={14} />
              Audience-aware content
            </div>
          </div>
        </div>

        {view === 'feed' ? (
          <div className="flex flex-wrap gap-2">
            {CATEGORY_OPTIONS.map((item) => (
              <button
                key={item.value}
                onClick={() => updateParams({ category: item.value })}
                className={`px-3.5 py-2 rounded-xl text-sm font-semibold transition-colors ${
                  category === item.value
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => updateParams({ month: getMonthKey(new Date(activeMonthDate.getFullYear(), activeMonthDate.getMonth() - 1, 1)) })}
                className="p-2 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200"
              >
                <FiChevronLeft size={16} />
              </button>
              <div className="px-4 py-2 rounded-xl bg-gray-50 min-w-[200px] text-center">
                <p className="text-xs uppercase tracking-wide text-gray-400">Month View</p>
                <p className="font-display font-bold text-gray-900">
                  {activeMonthDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                </p>
              </div>
              <button
                onClick={() => updateParams({ month: getMonthKey(new Date(activeMonthDate.getFullYear(), activeMonthDate.getMonth() + 1, 1)) })}
                className="p-2 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200"
              >
                <FiChevronRight size={16} />
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {CALENDAR_TYPES.map((item) => (
                <button
                  key={item}
                  onClick={() => updateParams({ type: item })}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                    calendarType === item
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-blue-200'
                  }`}
                >
                  {item === 'all' ? 'All Types' : item}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <Alert
        type="info"
        message={view === 'feed'
          ? 'Notice Board is now the single communication hub. High-priority notices stay on top, and the feed automatically respects the current user’s role, department, year, and section.'
          : 'Academic Calendar lives inside Notice Board so users can move between announcements and dates without switching products. Calendar visibility also follows audience targeting.'}
      />

      {loading ? (
        <FullPageSpinner />
      ) : view === 'feed' ? (
        notices.length === 0 ? (
          <EmptyState
            icon="📌"
            title="No notices found"
            description="Try changing the filters or publish the first notice for this audience."
          />
        ) : (
          <div className="space-y-4">
            {notices.map((notice) => (
              <NoticeCard
                key={notice._id}
                notice={notice}
                canDelete={canManage || notice.postedBy?._id === user?._id}
                onDelete={handleDeleteNotice}
              />
            ))}
          </div>
        )
      ) : (
        <div className="space-y-5">
          <div className="grid lg:grid-cols-[1.2fr,0.8fr] gap-5">
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <FiCalendar size={16} className="text-blue-600" />
                <h2 className="font-display font-bold text-gray-900">Month Overview</h2>
              </div>
              <div className="grid grid-cols-7 gap-2 text-center text-xs uppercase tracking-wide text-gray-400 mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day}>{day}</span>)}
              </div>
              <div className="grid grid-cols-7 gap-2">
                {calendarGrid.map((cell, index) => {
                  if (!cell) {
                    return <div key={`blank-${index}`} className="aspect-square rounded-2xl bg-gray-50" />;
                  }

                  const isToday = cell.isoDate === new Date().toISOString().slice(0, 10);
                  return (
                    <div
                      key={cell.isoDate}
                      className={`aspect-square rounded-2xl border p-2 flex flex-col items-start justify-between ${
                        isToday ? 'border-blue-400 bg-blue-50' : 'border-gray-100 bg-white'
                      }`}
                    >
                      <span className={`text-sm font-semibold ${isToday ? 'text-blue-700' : 'text-gray-700'}`}>{cell.day}</span>
                      <div className="space-y-1 w-full">
                        {cell.events.slice(0, 2).map((event) => {
                          const style = CALENDAR_TYPE_STYLES[event.type] || CALENDAR_TYPE_STYLES.Other;
                          return <div key={event._id} className={`w-full h-1.5 rounded-full ${style.dot}`} />;
                        })}
                        {cell.events.length > 2 && <p className="text-[10px] text-gray-400">+{cell.events.length - 2}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="card p-5 space-y-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-400">Focus</p>
                <h2 className="font-display font-bold text-gray-900">Calendar Summary</h2>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-blue-50 p-4 border border-blue-100">
                  <p className="text-xs text-blue-500 uppercase tracking-wide">Visible Dates</p>
                  <p className="font-display text-2xl font-black text-blue-900 mt-1">{calendarStats.total}</p>
                </div>
                <div className="rounded-2xl bg-emerald-50 p-4 border border-emerald-100">
                  <p className="text-xs text-emerald-500 uppercase tracking-wide">Upcoming</p>
                  <p className="font-display text-2xl font-black text-emerald-900 mt-1">{calendarStats.upcoming}</p>
                </div>
              </div>
              <p className="text-sm text-gray-600 leading-7">
                Use the month grid for orientation and the timeline below for detail. This keeps notice browsing and academic planning in one surface without forcing users to jump between separate tools.
              </p>
            </div>
          </div>

          {calendarItems.length === 0 ? (
            <EmptyState
              icon="📅"
              title="No calendar dates found"
              description="Try a different month or type filter, or publish the first academic date for this audience."
            />
          ) : (
            <div className="space-y-4">
              {calendarItems.map((event) => (
                <CalendarEventCard
                  key={event._id}
                  event={event}
                  canDelete={canManage || event.postedBy?._id === user?._id}
                  onDelete={handleDeleteCalendar}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
