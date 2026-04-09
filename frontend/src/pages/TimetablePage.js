import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { FiClock, FiEdit2, FiMapPin, FiPlus, FiTrash2, FiX } from 'react-icons/fi';
import API from '../utils/api';
import { Alert, EmptyState, FullPageSpinner, PageHeader } from '../components/ui';
import { useAuth } from '../context/AuthContext';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const defaultForm = {
  title: '',
  subject: '',
  department: '',
  year: '',
  section: '',
  dayOfWeek: 'Monday',
  startTime: '09:00',
  endTime: '10:00',
  room: '',
  notes: '',
  isActive: true,
};

function TimetableModal({ item, user, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({
    ...defaultForm,
    department: user?.department || '',
    year: user?.year || '',
    section: user?.section || '',
    ...(item || {}),
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.title.trim() || !form.department.trim() || !form.year.trim() || !form.section.trim()) {
      setError('Title, department, year, and section are required.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      if (item?._id) {
        await API.put(`/academics/timetable/${item._id}`, form);
      } else {
        await API.post('/academics/timetable', form);
      }
      toast.success(`Timetable entry ${item?._id ? 'updated' : 'created'}`);
      onSaved();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to save timetable entry.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="font-display text-lg font-bold text-gray-900">{item?._id ? 'Edit Timetable Slot' : 'Add Timetable Slot'}</h2>
            <p className="mt-1 text-xs text-gray-500">Create class slots students can actually rely on.</p>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-gray-500 hover:bg-gray-100">
            <FiX size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          {error ? <Alert type="error" message={error} /> : null}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Title</label>
              <input className="input" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Database Systems Lecture" />
            </div>
            <div>
              <label className="label">Subject</label>
              <input className="input" value={form.subject} onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))} placeholder="DBMS" />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="label">Department</label>
              <input className="input" value={form.department} onChange={(event) => setForm((current) => ({ ...current, department: event.target.value }))} placeholder="CSE" />
            </div>
            <div>
              <label className="label">Year</label>
              <input className="input" value={form.year} onChange={(event) => setForm((current) => ({ ...current, year: event.target.value }))} placeholder="2" />
            </div>
            <div>
              <label className="label">Section</label>
              <input className="input" value={form.section} onChange={(event) => setForm((current) => ({ ...current, section: event.target.value }))} placeholder="A" />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="label">Day</label>
              <select className="input" value={form.dayOfWeek} onChange={(event) => setForm((current) => ({ ...current, dayOfWeek: event.target.value }))}>
                {DAYS.map((day) => <option key={day} value={day}>{day}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Start Time</label>
              <input type="time" className="input" value={form.startTime} onChange={(event) => setForm((current) => ({ ...current, startTime: event.target.value }))} />
            </div>
            <div>
              <label className="label">End Time</label>
              <input type="time" className="input" value={form.endTime} onChange={(event) => setForm((current) => ({ ...current, endTime: event.target.value }))} />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Room</label>
              <input className="input" value={form.room} onChange={(event) => setForm((current) => ({ ...current, room: event.target.value }))} placeholder="Lab 204" />
            </div>
            <div>
              <label className="label">Notes</label>
              <input className="input" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Optional context" />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">{saving ? 'Saving...' : 'Save Slot'}</button>
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function TimetablePage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingEntry, setEditingEntry] = useState(null);

  const canManage = ['faculty', 'admin'].includes(user?.role);

  const loadTimetable = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await API.get('/academics/timetable');
      setEntries(res.data?.data || []);
    } catch (requestError) {
      setEntries([]);
      setError(requestError.response?.data?.message || 'Failed to load timetable.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTimetable();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const groupedEntries = useMemo(() => DAYS.map((day) => ({
    day,
    items: entries.filter((entry) => entry.dayOfWeek === day),
  })), [entries]);

  const handleDelete = async (entryId) => {
    if (!window.confirm('Delete this timetable slot?')) return;
    try {
      await API.delete(`/academics/timetable/${entryId}`);
      toast.success('Timetable entry deleted');
      loadTimetable();
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || 'Delete failed');
    }
  };

  if (loading) return <FullPageSpinner />;

  return (
    <div className="space-y-5">
      {editingEntry !== null ? (
        <TimetableModal
          item={editingEntry}
          user={user}
          onClose={() => setEditingEntry(null)}
          onSaved={() => {
            setEditingEntry(null);
            loadTimetable();
          }}
        />
      ) : null}

      <PageHeader
        title="Timetable"
        subtitle={canManage ? 'Manage weekly class slots and keep students aligned.' : 'Your scheduled classes, organized by day.'}
        action={canManage ? <button onClick={() => setEditingEntry({})} className="btn-primary"><FiPlus size={15} /> Add Slot</button> : null}
      />

      {error ? <Alert type="error" message={error} /> : null}

      {entries.length === 0 ? (
        <EmptyState
          icon="🗓️"
          title="No timetable entries yet"
          description={canManage ? 'Add the first class slot to start building the weekly schedule.' : 'Your class schedule will appear here once it is published.'}
          action={canManage ? <button onClick={() => setEditingEntry({})} className="btn-primary"><FiPlus size={15} /> Add Slot</button> : null}
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {groupedEntries.map(({ day, items }) => (
            <section key={day} className="card overflow-hidden">
              <div className="border-b border-gray-100 px-4 py-3.5">
                <h2 className="font-display text-base font-bold text-gray-900">{day}</h2>
              </div>
              <div className="space-y-3 p-4 min-h-[140px]">
                {items.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-gray-200 p-4 text-center text-sm text-gray-400">No classes scheduled.</div>
                ) : items.map((entry) => (
                  <div key={entry._id} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-gray-900">{entry.title}</p>
                        <p className="mt-1 text-sm text-gray-500">{entry.subject || 'General'} · {entry.department} Year {entry.year} · Section {entry.section}</p>
                      </div>
                      {canManage ? (
                        <div className="flex items-center gap-2">
                          <button onClick={() => setEditingEntry(entry)} className="rounded-lg p-2 text-gray-400 hover:bg-white hover:text-blue-700"><FiEdit2 size={15} /></button>
                          <button onClick={() => handleDelete(entry._id)} className="rounded-lg p-2 text-gray-400 hover:bg-white hover:text-red-600"><FiTrash2 size={15} /></button>
                        </div>
                      ) : null}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                      <span className="inline-flex items-center gap-1"><FiClock size={12} /> {entry.startTime} - {entry.endTime}</span>
                      {entry.room ? <span className="inline-flex items-center gap-1"><FiMapPin size={12} /> {entry.room}</span> : null}
                      {entry.faculty?.name ? <span>{entry.faculty.name}</span> : null}
                    </div>
                    {entry.notes ? <p className="mt-3 text-sm text-gray-600">{entry.notes}</p> : null}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
