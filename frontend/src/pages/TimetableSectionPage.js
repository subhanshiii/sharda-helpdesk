import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiClock, FiEdit2, FiMapPin, FiPlus, FiTrash2 } from 'react-icons/fi';
import API from '../utils/api';
import { Alert, ConfirmDialog, EmptyState, FullPageSpinner, Modal, PageHeader } from '../components/ui';
import { usePermissions } from '../context/PermissionContext';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const emptyForm = {
  id: '',
  subjectId: '',
  teachingAssignmentId: '',
  startTime: '09:00',
  endTime: '10:00',
  room: '',
  notes: '',
};

const getWeekdayFromDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return DAYS[date.getDay() === 0 ? 6 : date.getDay() - 1] || '';
};

export default function TimetableSectionPage() {
  const navigate = useNavigate();
  const { sectionId } = useParams();
  const [searchParams] = useSearchParams();
  const { can } = usePermissions();
  const selectedDate = searchParams.get('date') || new Date().toISOString().slice(0, 10);
  const focusedDay = getWeekdayFromDate(selectedDate) || 'Monday';
  const canCreate = can('create', 'timetable');
  const canEdit = can('edit', 'timetable');
  const canDelete = can('delete', 'timetable');

  const [section, setSection] = useState(null);
  const [entries, setEntries] = useState([]);
  const [activeSubjects, setActiveSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorDay, setEditorDay] = useState('Monday');
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

  const groupedEntries = useMemo(() => DAYS.map((day) => ({
    day,
    items: entries
      .filter((entry) => entry.dayOfWeek === day)
      .sort((a, b) => String(a.startTime).localeCompare(String(b.startTime))),
  })), [entries]);

  const openCreateModal = (day) => {
    setEditorDay(day);
    const defaultSubject = subjectOptions[0] || null;
    setForm({
      ...emptyForm,
      subjectId: defaultSubject?._id || '',
      teachingAssignmentId: defaultSubject?.teachingAssignmentId || '',
    });
    setEditorOpen(true);
  };

  const openEditModal = (entry) => {
    setEditorDay(entry.dayOfWeek);
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
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        panelClassName="max-w-xl"
        contentClassName="rounded-[28px] border border-[var(--border-strong)] bg-[var(--surface-card)] p-6 shadow-[var(--shadow-floating)]"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">{editorDay}</p>
              <h2 className="mt-2 font-display text-2xl font-bold text-[var(--text-strong)]">{form.id ? 'Edit Slot' : 'Create Slot'}</h2>
            </div>
            <div className="rounded-2xl bg-[var(--surface-soft)] px-3 py-2 text-sm font-semibold text-[var(--text-main)]">{selectedDate}</div>
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
            </div>
            <div>
              <label className="label">End Time</label>
              <input type="time" className="input" value={form.endTime} onChange={(event) => setForm((current) => ({ ...current, endTime: event.target.value }))} required />
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

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? 'Saving...' : form.id ? 'Update Slot' : 'Create Slot'}
            </button>
            <button type="button" onClick={() => setEditorOpen(false)} className="btn-secondary">Cancel</button>
          </div>
        </form>
      </Modal>

      <PageHeader
        title="Section Timetable"
        subtitle={section ? `Build the weekly timetable for Section ${section.name}.` : 'Build the weekly timetable for this section.'}
        meta={[
          selectedDate,
          focusedDay,
          section?.program?.name || section?.course?.name || '',
        ]}
        action={<button type="button" onClick={() => navigate('/timetable')} className="btn-secondary">Back to Sections</button>}
      />

      {error ? <Alert type="error" message={error} /> : null}

      {!section ? (
        <EmptyState icon="🗓️" title="Section not found" description="Go back and choose another section." />
      ) : (
        <div className="grid gap-4 xl:grid-cols-7">
          {groupedEntries.map(({ day, items }) => (
            <section
              key={day}
              className={`rounded-3xl border bg-[var(--surface-card)] p-4 ${day === focusedDay ? 'border-[var(--accent-primary)] shadow-lg' : 'border-[var(--border-strong)]'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-[var(--text-strong)]">{day}</p>
                  <p className="text-xs text-[var(--text-muted)]">{day === focusedDay ? selectedDate : 'Weekly slot'}</p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {items.length ? items.map((entry) => (
                  <div key={entry._id} className="rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-soft)] p-3">
                    <p className="text-sm font-semibold text-[var(--text-strong)]">{entry.subjectId?.name || entry.title}</p>
                    <div className="mt-2 space-y-1 text-xs text-[var(--text-muted)]">
                      <p className="inline-flex items-center gap-1"><FiClock size={12} /> {entry.startTime} - {entry.endTime}</p>
                      {entry.room ? <p className="inline-flex items-center gap-1"><FiMapPin size={12} /> {entry.room}</p> : null}
                    </div>
                    {(canEdit || canDelete) ? (
                      <div className="mt-3 flex gap-2">
                        {canEdit ? <button type="button" onClick={() => openEditModal(entry)} className="btn-secondary text-xs"><FiEdit2 size={13} /> Edit</button> : null}
                        {canDelete ? <button type="button" onClick={() => setDeleteState({ open: true, id: entry._id, loading: false })} className="btn-secondary text-xs text-red-600 hover:text-red-700"><FiTrash2 size={13} /> Delete</button> : null}
                      </div>
                    ) : null}
                  </div>
                )) : (
                  <div className="rounded-2xl border border-dashed border-[var(--border-strong)] px-3 py-6 text-center text-sm text-[var(--text-muted)]">
                    No slot yet.
                  </div>
                )}
              </div>

              {canCreate ? (
                <button type="button" onClick={() => openCreateModal(day)} className="btn-secondary mt-4 w-full justify-center">
                  <FiPlus size={14} />
                  Add Slot
                </button>
              ) : null}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
