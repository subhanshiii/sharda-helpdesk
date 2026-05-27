import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiClock, FiEdit2, FiPlus, FiTrash2 } from 'react-icons/fi';
import API from '../utils/api';
import { Alert, ConfirmDialog, EmptyState, FullPageSpinner, Modal, PageHeader } from '../components/ui';
import { usePermissions } from '../context/PermissionContext';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const BASE_TIME_SLOTS = [
  ['09:00', '10:00'],
  ['10:00', '11:00'],
  ['11:00', '12:00'],
  ['12:00', '13:00'],
  ['14:00', '15:00'],
  ['15:00', '16:00'],
  ['16:00', '17:00'],
];

const emptyForm = {
  id: '',
  subjectId: '',
  teachingAssignmentId: '',
  startTime: '09:00',
  endTime: '10:00',
  room: '',
  notes: '',
};

const timeToMinutes = (value = '') => {
  const [hours, minutes] = String(value).split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return 0;
  return hours * 60 + minutes;
};

const formatTimeLabel = (value = '') => {
  if (!value) return '--';
  const [hourValue, minuteValue] = String(value).split(':');
  const hour = Number(hourValue);
  const minute = minuteValue || '00';
  if (Number.isNaN(hour)) return value;
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const normalizedHour = hour % 12 || 12;
  return `${normalizedHour}:${minute} ${suffix}`;
};

const formatLongDate = (date) => date.toLocaleDateString('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const formatShortDate = (date) => date.toLocaleDateString('en-IN', {
  day: 'numeric',
  month: 'short',
});

const toDateInputValue = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseLocalDate = (value) => {
  const [yearValue, monthValue, dayValue] = String(value).split('-').map(Number);
  if (!yearValue || !monthValue || !dayValue) return null;
  return new Date(yearValue, monthValue - 1, dayValue);
};

const startOfWeek = (date) => {
  const next = new Date(date);
  next.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return next;
};

const endOfWeek = (date) => {
  const next = startOfWeek(date);
  next.setDate(next.getDate() + 6);
  return next;
};

const enumerateDates = (startDate, endDate) => {
  if (!startDate || !endDate || startDate > endDate) return [];
  const dates = [];
  const cursor = new Date(startDate);
  while (cursor <= endDate) {
    const value = new Date(cursor);
    const weekdayIndex = value.getDay() === 0 ? 6 : value.getDay() - 1;
    dates.push({
      key: toDateInputValue(value),
      label: formatShortDate(value),
      longLabel: formatLongDate(value),
      weekday: DAYS[weekdayIndex],
      date: value,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
};

const OverviewPill = ({ label, value, accent = 'default' }) => {
  const accentClass = accent === 'primary'
    ? 'border-[var(--accent-primary)]/25 bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]'
    : accent === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : 'border-[var(--border-strong)] bg-[var(--surface-card)] text-[var(--text-strong)]';

  return (
    <div className={`rounded-3xl border px-4 py-4 ${accentClass}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-70">{label}</p>
      <p className="mt-3 break-words text-xl font-black">{value}</p>
    </div>
  );
};

export default function TimetableSectionPage() {
  const navigate = useNavigate();
  const { sectionId } = useParams();
  const [searchParams] = useSearchParams();
  const { can } = usePermissions();
  const initialStartDate = startOfWeek(new Date());
  const initialEndDate = endOfWeek(new Date());
  const rangeStart = searchParams.get('startDate') || toDateInputValue(initialStartDate);
  const rangeEnd = searchParams.get('endDate') || toDateInputValue(initialEndDate);
  const rangeStartDate = parseLocalDate(rangeStart);
  const rangeEndDate = parseLocalDate(rangeEnd);
  const effectiveStartDate = rangeStartDate && rangeEndDate && rangeStartDate <= rangeEndDate ? rangeStartDate : null;
  const effectiveEndDate = rangeStartDate && rangeEndDate && rangeStartDate <= rangeEndDate ? rangeEndDate : null;
  const rangeDates = useMemo(() => enumerateDates(effectiveStartDate, effectiveEndDate), [effectiveEndDate, effectiveStartDate]);
  const rangeLabel = effectiveStartDate && effectiveEndDate
    ? `${formatLongDate(effectiveStartDate)} - ${formatLongDate(effectiveEndDate)}`
    : 'Choose a valid date range';
  const canCreate = can('create', 'timetable');
  const canEdit = can('edit', 'timetable');
  const canDelete = can('delete', 'timetable');

  const [section, setSection] = useState(null);
  const [entries, setEntries] = useState([]);
  const [activeSubjects, setActiveSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [detailState, setDetailState] = useState(null);
  const [editorDay, setEditorDay] = useState('Monday');
  const [editorDateLabel, setEditorDateLabel] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteState, setDeleteState] = useState({ open: false, id: '', loading: false });

  const loadPage = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [sectionsRes, entriesRes, activeSubjectsRes] = await Promise.all([
        API.get('/academics/sections?paginate=false'),
        API.get(`/academics/timetable?sectionId=${sectionId}`),
        API.get(`/academics/sections/${sectionId}/active-subjects`),
      ]);
      const sections = sectionsRes.data?.data || [];
      const currentSection = sections.find((item) => String(item._id) === String(sectionId)) || null;
      setSection(currentSection);
      setEntries(entriesRes.data?.data || []);
      setActiveSubjects(activeSubjectsRes.data?.data || []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to load section timetable.');
    } finally {
      setLoading(false);
    }
  }, [sectionId]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  const subjectOptions = useMemo(() => {
    const options = [];

    activeSubjects.forEach((entry) => {
      const subject = entry?.subject;
      const assignments = Array.isArray(entry?.teachingAssignments) ? entry.teachingAssignments : [];

      if (!subject?._id) return;

      if (!assignments.length) {
        options.push({
          ...subject,
          optionKey: `${String(subject._id)}:fallback`,
          teachingAssignmentId: '',
          teacherName: 'Faculty not assigned',
          isUnassigned: true,
        });
        return;
      }

      assignments.forEach((assignment) => {
        options.push({
          ...subject,
          optionKey: `${String(subject._id)}:${String(assignment._id)}`,
          teachingAssignmentId: assignment._id,
          teacherName: assignment.teacher?.name || 'Faculty not assigned',
          isUnassigned: false,
        });
      });
    });

    return options;
  }, [activeSubjects]);

  const boardSummary = useMemo(() => ({
    templateSlots: entries.length,
    linkedSubjects: new Set(activeSubjects.map((entry) => String(entry?.subject?._id || '')).filter(Boolean)).size,
  }), [activeSubjects, entries.length]);

  const timeRows = useMemo(() => {
    const rowMap = new Map();

    BASE_TIME_SLOTS.forEach(([startTime, endTime]) => {
      rowMap.set(`${startTime}-${endTime}`, { key: `${startTime}-${endTime}`, startTime, endTime });
    });

    entries.forEach((entry) => {
      const startTime = entry.startTime || '09:00';
      const endTime = entry.endTime || '10:00';
      rowMap.set(`${startTime}-${endTime}`, { key: `${startTime}-${endTime}`, startTime, endTime });
    });

    return [...rowMap.values()].sort((left, right) => {
      const startDiff = timeToMinutes(left.startTime) - timeToMinutes(right.startTime);
      if (startDiff !== 0) return startDiff;
      return timeToMinutes(left.endTime) - timeToMinutes(right.endTime);
    });
  }, [entries]);

  const openCreateModal = (day, slot = null, dateLabel = '') => {
    setEditorDay(day);
    setEditorDateLabel(dateLabel);
    const defaultSubject = subjectOptions[0] || null;
    setForm({
      ...emptyForm,
      subjectId: defaultSubject?._id || '',
      teachingAssignmentId: defaultSubject?.teachingAssignmentId || '',
      startTime: slot?.startTime || emptyForm.startTime,
      endTime: slot?.endTime || emptyForm.endTime,
    });
    setEditorOpen(true);
  };

  const openEditModal = (entry, dateLabel = '') => {
    setEditorDay(entry.dayOfWeek);
    setEditorDateLabel(dateLabel);
    setForm({
      id: entry._id,
      subjectId: entry.subjectId?._id || entry.subjectId || '',
      teachingAssignmentId: entry.teachingAssignmentId?._id || entry.teachingAssignmentId || '',
      startTime: entry.startTime || '09:00',
      endTime: entry.endTime || '10:00',
      room: entry.room || '',
      notes: entry.notes || '',
    });
    setEditorOpen(true);
  };

  const handleSave = async (event) => {
    event.preventDefault();
    const selectedSubject = subjectOptions.find(
      (subject) => String(subject._id) === String(form.subjectId)
        && String(subject.teachingAssignmentId || '') === String(form.teachingAssignmentId || '')
    );
    if (!selectedSubject) {
      setError('Select a subject first.');
      return;
    }
    if (selectedSubject.isUnassigned || !selectedSubject.teachingAssignmentId) {
      setError('This subject is linked to the section, but no faculty assignment exists yet. Assign a faculty in Academic Planning first.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const payload = {
        title: `${selectedSubject.name} ${editorDay} Slot`,
        sectionId,
        subjectId: selectedSubject._id,
        teachingAssignmentId: selectedSubject?.teachingAssignmentId || null,
        dayOfWeek: editorDay,
        startTime: form.startTime,
        endTime: form.endTime,
        room: form.room,
        notes: form.notes,
      };

      if (form.id) {
        await API.put(`/academics/timetable/${form.id}`, payload);
        toast.success('Timetable slot updated');
      } else {
        await API.post('/academics/timetable', payload);
        toast.success('Timetable slot created');
      }
      setEditorOpen(false);
      setForm(emptyForm);
      setEditorDateLabel('');
      await loadPage();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to save timetable slot.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteState.id) return;
    setDeleteState((current) => ({ ...current, loading: true }));
    try {
      await API.delete(`/academics/timetable/${deleteState.id}`);
      toast.success('Timetable slot deleted');
      setDeleteState({ open: false, id: '', loading: false });
      await loadPage();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to delete timetable slot.');
      setDeleteState((current) => ({ ...current, loading: false }));
    }
  };

  if (loading) return <FullPageSpinner />;

  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={deleteState.open}
        title="Delete timetable slot"
        description="This removes the selected timetable slot."
        confirmLabel="Delete Slot"
        loading={deleteState.loading}
        onConfirm={handleDelete}
        onClose={() => setDeleteState({ open: false, id: '', loading: false })}
      />

      <Modal
        open={Boolean(detailState)}
        onClose={() => setDetailState(null)}
        panelClassName="max-w-lg"
        contentClassName="rounded-[30px] border border-[var(--border-strong)] bg-[var(--surface-card)] p-6 shadow-[var(--shadow-floating)]"
      >
        {detailState ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Timetable Slot</p>
                <h2 className="mt-2 break-words font-display text-2xl font-bold text-[var(--text-strong)]">{detailState.entry.subjectId?.name || detailState.entry.title}</h2>
                <p className="mt-2 text-sm text-[var(--text-muted)]">{detailState.entry.dayOfWeek} · {detailState.dateLabel}</p>
              </div>
              <span className="inline-flex shrink-0 rounded-full bg-[var(--accent-primary-soft)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent-primary)]">
                {detailState.entry.subjectId?.code || 'SUBJ'}
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl border border-[var(--border-strong)] bg-[var(--surface-soft)] px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Subject Code</p>
                <p className="mt-2 break-words text-sm font-semibold text-[var(--text-strong)]">{detailState.entry.subjectId?.code || '—'}</p>
              </div>
              <div className="rounded-3xl border border-[var(--border-strong)] bg-[var(--surface-soft)] px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Teacher</p>
                <p className="mt-2 break-words text-sm font-semibold text-[var(--text-strong)]">{detailState.entry.faculty?.name || 'Faculty not assigned'}</p>
              </div>
              <div className="rounded-3xl border border-[var(--border-strong)] bg-[var(--surface-soft)] px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Timing</p>
                <p className="mt-2 text-sm font-semibold text-[var(--text-strong)]">{detailState.entry.startTime} - {detailState.entry.endTime}</p>
              </div>
              <div className="rounded-3xl border border-[var(--border-strong)] bg-[var(--surface-soft)] px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Room</p>
                <p className="mt-2 break-words text-sm font-semibold text-[var(--text-strong)]">{detailState.entry.room || 'Not provided'}</p>
              </div>
            </div>

            {(canEdit || canDelete) ? (
              <div className="flex flex-wrap gap-3 pt-1">
                {canEdit ? (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      const current = detailState;
                      setDetailState(null);
                      openEditModal(current.entry, current.dateLabel);
                    }}
                  >
                    <FiEdit2 size={14} />
                    Edit Slot
                  </button>
                ) : null}
                {canDelete ? (
                  <button
                    type="button"
                    className="btn-secondary text-rose-600 hover:text-rose-700"
                    onClick={() => {
                      setDeleteState({ open: true, id: detailState.entry._id, loading: false });
                      setDetailState(null);
                    }}
                  >
                    <FiTrash2 size={14} />
                    Delete Slot
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        panelClassName="max-w-xl"
        contentClassName="rounded-[28px] border border-[var(--border-strong)] bg-[var(--surface-card)] p-6 shadow-[var(--shadow-floating)]"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">{editorDay}</p>
              <h2 className="mt-2 font-display text-2xl font-bold text-[var(--text-strong)]">{form.id ? 'Edit Slot' : 'Create Slot'}</h2>
              {editorDateLabel ? <p className="mt-2 text-sm text-[var(--text-muted)]">Applies to recurring classes that appear on {editorDateLabel}</p> : null}
            </div>
            <div className="rounded-2xl bg-[var(--surface-soft)] px-3 py-2 text-sm font-semibold text-[var(--text-main)]">{rangeLabel}</div>
          </div>

          <div>
            <label className="label">Subject</label>
            <select
              className="input"
              value={`${String(form.subjectId || '')}:${String(form.teachingAssignmentId || 'fallback')}`}
              onChange={(event) => {
                const selectedAssignment = subjectOptions.find((subject) => String(subject.optionKey) === String(event.target.value));
                setForm((current) => ({
                  ...current,
                  subjectId: selectedAssignment?._id || '',
                  teachingAssignmentId: selectedAssignment?.teachingAssignmentId || '',
                }));
              }}
              required
            >
              <option value="">Select subject</option>
              {subjectOptions.map((subject) => (
                <option key={subject.optionKey} value={subject.optionKey}>
                  {subject.name} ({subject.code || '—'}) · {subject.teacherName}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              Subjects without faculty mapping are visible, but cannot be scheduled until faculty is assigned.
            </p>
            {form.subjectId && !form.teachingAssignmentId ? (
              <button
                type="button"
                className="btn-secondary mt-3 text-xs"
                onClick={() => {
                  const query = new URLSearchParams({
                    sectionId: String(sectionId),
                    subjectId: String(form.subjectId),
                  });
                  navigate(`/academics/subject-management?${query.toString()}`);
                }}
              >
                Assign Faculty
              </button>
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Start Time</label>
              <input type="time" className="input" value={form.startTime} onChange={(event) => setForm((current) => ({ ...current, startTime: event.target.value }))} required />
              <p className="mt-2 text-xs text-[var(--text-muted)]">Editable for each recurring timetable slot.</p>
            </div>
            <div>
              <label className="label">End Time</label>
              <input type="time" className="input" value={form.endTime} onChange={(event) => setForm((current) => ({ ...current, endTime: event.target.value }))} required />
              <p className="mt-2 text-xs text-[var(--text-muted)]">Use custom timings whenever the class differs from the default row.</p>
            </div>
          </div>

          <div>
            <label className="label">Location</label>
            <input className="input" value={form.room} onChange={(event) => setForm((current) => ({ ...current, room: event.target.value }))} placeholder="Room / Lab / Hall" />
          </div>

          <div>
            <label className="label">Notes</label>
            <input className="input" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Optional note" />
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? 'Saving...' : form.id ? 'Update Slot' : 'Create Slot'}
            </button>
            <button type="button" onClick={() => setEditorOpen(false)} className="btn-secondary">Cancel</button>
          </div>
        </form>
      </Modal>

      <PageHeader
        title="Section Timetable"
        subtitle={section ? `Build the recurring timetable for Section ${section.name} across the selected date range.` : 'Build the recurring timetable for this section.'}
        meta={[rangeLabel, `${rangeDates.length} visible date${rangeDates.length === 1 ? '' : 's'}`, section?.program?.name || section?.course?.name || '']}
        action={<button type="button" onClick={() => navigate('/timetable')} className="btn-secondary">Back to Sections</button>}
      />

      {error ? <Alert type="error" message={error} /> : null}

      {!section ? (
        <EmptyState icon="🗓️" title="Section not found" description="Go back and choose another section." />
      ) : !rangeDates.length ? (
        <EmptyState icon="🗓️" title="Choose a valid date range" description="Open this section from the timetable page with a valid start and end date." />
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <OverviewPill label="Date Range" value={rangeLabel} accent="primary" />
            <OverviewPill label="Visible Dates" value={rangeDates.length} />
            <OverviewPill label="Template Slots" value={boardSummary.templateSlots} />
            <OverviewPill label="Linked Subjects" value={boardSummary.linkedSubjects} accent="success" />
          </div>

          <div className="overflow-hidden rounded-[32px] border border-[var(--border-strong)] bg-[var(--surface-card)] shadow-[var(--shadow-soft)]">
            <div className="flex flex-col gap-4 border-b border-[var(--border-strong)] px-5 py-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Range Planner</p>
                <h2 className="mt-2 font-display text-2xl font-bold text-[var(--text-strong)]">Recurring Calendar Grid</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
                  Recurring weekday slots are mapped onto each actual date inside the selected range, so you can review the timetable as a real calendar window.
                </p>
                <p className="mt-3 text-sm font-semibold text-[var(--text-main)]">Date Range: {rangeLabel}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-3xl border border-[var(--border-strong)] bg-[var(--surface-soft)] px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Section</p>
                  <p className="mt-2 break-words text-base font-bold text-[var(--text-strong)]">{section.name}</p>
                </div>
                <div className="rounded-3xl border border-[var(--border-strong)] bg-[var(--surface-soft)] px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Visible Dates</p>
                  <p className="mt-2 text-base font-bold text-[var(--text-strong)]">{rangeDates.length} day view</p>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto px-4 py-4 sm:px-5 sm:py-5">
              <div
                className="grid gap-3"
                style={{ gridTemplateColumns: `180px repeat(${rangeDates.length}, minmax(150px, 1fr))`, minWidth: `${180 + (rangeDates.length * 150)}px` }}
              >
                <div className="rounded-3xl border border-[var(--border-strong)] bg-[var(--surface-soft)] px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Time Slots</p>
                  <p className="mt-2 text-sm font-semibold text-[var(--text-main)]">{rangeLabel}</p>
                </div>

                {rangeDates.map((dateInfo) => (
                  <div
                    key={dateInfo.key}
                    className="rounded-3xl border border-[var(--border-strong)] bg-[var(--surface-soft)] px-4 py-4 text-[var(--text-strong)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-base font-bold">{dateInfo.weekday}</p>
                        <p className="mt-1 text-xs font-medium text-[var(--text-muted)]">{dateInfo.label}</p>
                      </div>
                      {canCreate ? (
                        <button
                          type="button"
                          onClick={() => openCreateModal(dateInfo.weekday, null, dateInfo.longLabel)}
                          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-card)] text-[var(--text-main)] transition hover:-translate-y-0.5 hover:shadow-md"
                          aria-label={`Add slot for ${dateInfo.weekday}`}
                        >
                          <FiPlus size={15} />
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}

                {timeRows.map((row) => (
                  <React.Fragment key={row.key}>
                    <div className="rounded-3xl border border-[var(--border-strong)] bg-[var(--surface-soft)] px-4 py-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">{formatTimeLabel(row.startTime)}</p>
                      <p className="mt-2 text-sm font-semibold text-[var(--text-strong)]">{formatTimeLabel(row.startTime)} - {formatTimeLabel(row.endTime)}</p>
                    </div>

                    {rangeDates.map((dateInfo) => {
                      const cellEntries = entries
                        .filter((entry) => entry.dayOfWeek === dateInfo.weekday && String(entry.startTime) === String(row.startTime) && String(entry.endTime) === String(row.endTime))
                        .sort((left, right) => String(left.startTime).localeCompare(String(right.startTime)));

                      return (
                        <div
                          key={`${dateInfo.key}-${row.key}`}
                          className="flex h-[168px] min-h-[168px] max-h-[168px] flex-col rounded-[28px] border border-[var(--border-strong)] bg-[var(--surface-card)] p-3 transition duration-200 hover:-translate-y-0.5 hover:shadow-md"
                        >
                          {cellEntries.length ? (
                            <div className="flex h-full flex-col gap-2 overflow-hidden">
                              {cellEntries.map((entry) => (
                                <button
                                  key={`${dateInfo.key}-${entry._id}`}
                                  type="button"
                                  onClick={() => setDetailState({ entry, dateLabel: dateInfo.longLabel })}
                                  className="flex min-h-0 flex-1 flex-col justify-between overflow-hidden rounded-3xl border border-[var(--border-strong)] bg-[var(--surface-soft)] px-3 py-3 text-left shadow-sm transition hover:border-[var(--accent-primary)]/30 hover:shadow-md"
                                >
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-bold uppercase tracking-[0.08em] text-[var(--text-strong)]">{entry.subjectId?.code || 'SUBJ'}</p>
                                    <p className="mt-2 truncate text-xs font-medium text-[var(--text-muted)]">{entry.room ? `Room ${entry.room}` : 'No room assigned'}</p>
                                  </div>
                                  <div className="mt-3 flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                                    <FiClock size={11} />
                                    <span className="truncate">{entry.startTime} - {entry.endTime}</span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div className="flex h-full flex-1 flex-col overflow-hidden rounded-3xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-soft)]/55 px-3 py-4 text-left">
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-[var(--text-main)]">Open slot</p>
                                <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--text-muted)]">No subject scheduled for this date and time yet.</p>
                              </div>
                              {canCreate ? (
                                <button
                                  type="button"
                                  onClick={() => openCreateModal(dateInfo.weekday, row, dateInfo.longLabel)}
                                  className="mt-3 inline-flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-card)] px-3 py-2 text-xs font-semibold text-[var(--text-main)] transition hover:-translate-y-0.5 hover:border-[var(--accent-primary)]/30 hover:text-[var(--accent-primary)]"
                                >
                                  <FiPlus size={13} />
                                  Create Slot
                                </button>
                              ) : null}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
