import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { FiEdit2, FiPlus, FiX } from 'react-icons/fi';
import API from '../utils/api';
import { Alert, EmptyState, FullPageSpinner, PageHeader } from '../components/ui';
import { formatDate, formatRelative } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';

const STATUS_OPTIONS = ['present', 'absent', 'late', 'excused'];

const toneByStatus = {
  present: 'bg-emerald-50 text-emerald-700',
  absent: 'bg-red-50 text-red-700',
  late: 'bg-amber-50 text-amber-700',
  excused: 'bg-blue-50 text-blue-700',
};

function AttendanceModal({ item, user, onClose, onSaved }) {
  const [form, setForm] = useState({
    title: item?.title || '',
    subject: item?.subject || '',
    department: item?.department || user?.department || '',
    year: item?.year || user?.year || '',
    section: item?.section || user?.section || '',
    date: item?.date ? new Date(item.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
    topic: item?.topic || '',
    records: [],
  });
  const [students, setStudents] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadStudents = async (scope = form) => {
    try {
      const params = new URLSearchParams({
        department: scope.department || '',
        year: scope.year || '',
        section: scope.section || '',
      });
      const res = await API.get(`/academics/attendance/options?${params.toString()}`);
      const roster = res.data?.data || [];
      setStudents(roster);
      setForm((current) => ({
        ...current,
        records: item?.records?.length
          ? item.records.map((record) => ({
              student: record.student?._id || record.student,
              status: record.status,
            }))
          : roster.map((student) => ({ student: student._id, status: 'present' })),
      }));
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to load students.');
    }
  };

  useEffect(() => {
    loadStudents(item ? {
      department: item.department,
      year: item.year,
      section: item.section,
    } : form);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleScopeChange = (key, value) => {
    const next = { ...form, [key]: value };
    setForm(next);
  };

  const refreshRoster = async () => {
    await loadStudents(form);
  };

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
        await API.put(`/academics/attendance/${item._id}`, form);
      } else {
        await API.post('/academics/attendance', form);
      }
      toast.success(`Attendance ${item?._id ? 'updated' : 'saved'}`);
      onSaved();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to save attendance.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-3xl rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="font-display text-lg font-bold text-gray-900">{item?._id ? 'Update Attendance' : 'Mark Attendance'}</h2>
            <p className="mt-1 text-xs text-gray-500">Capture section attendance with a simple, reliable checklist.</p>
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
              <input className="input" value={form.title} onChange={(event) => handleScopeChange('title', event.target.value)} placeholder="DBMS Lecture Attendance" />
            </div>
            <div>
              <label className="label">Subject</label>
              <input className="input" value={form.subject} onChange={(event) => handleScopeChange('subject', event.target.value)} placeholder="DBMS" />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <label className="label">Department</label>
              <input className="input" value={form.department} onChange={(event) => handleScopeChange('department', event.target.value)} />
            </div>
            <div>
              <label className="label">Year</label>
              <input className="input" value={form.year} onChange={(event) => handleScopeChange('year', event.target.value)} />
            </div>
            <div>
              <label className="label">Section</label>
              <input className="input" value={form.section} onChange={(event) => handleScopeChange('section', event.target.value)} />
            </div>
            <div>
              <label className="label">Date</label>
              <input type="date" className="input" value={form.date} onChange={(event) => handleScopeChange('date', event.target.value)} />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex-1">
              <label className="label">Topic</label>
              <input className="input" value={form.topic} onChange={(event) => handleScopeChange('topic', event.target.value)} placeholder="Normalization and joins" />
            </div>
            <button type="button" onClick={refreshRoster} className="btn-secondary mt-6">Load Roster</button>
          </div>

          <div className="rounded-2xl border border-gray-100">
            <div className="border-b border-gray-100 px-4 py-3">
              <p className="font-semibold text-gray-900">Student Roster</p>
            </div>
            <div className="max-h-[320px] divide-y divide-gray-100 overflow-y-auto">
              {form.records.length === 0 ? (
                <div className="p-5 text-center text-sm text-gray-400">Load the roster for this section first.</div>
              ) : form.records.map((record) => {
                const student = students.find((entry) => entry._id === record.student);
                return (
                  <div key={record.student} className="grid gap-3 px-4 py-3 md:grid-cols-[1fr_200px] md:items-center">
                    <div>
                      <p className="font-medium text-gray-900">{student?.name || 'Student'}</p>
                      <p className="text-xs text-gray-500 mt-1">{student?.email || ''}</p>
                    </div>
                    <select
                      className="input"
                      value={record.status}
                      onChange={(event) => setForm((current) => ({
                        ...current,
                        records: current.records.map((entry) => (
                          entry.student === record.student ? { ...entry, status: event.target.value } : entry
                        )),
                      }))}
                    >
                      {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">{saving ? 'Saving...' : 'Save Attendance'}</button>
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AttendancePage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingSession, setEditingSession] = useState(null);

  const canManage = ['faculty', 'admin'].includes(user?.role);

  const loadAttendance = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await API.get('/academics/attendance');
      setSessions(res.data?.data || []);
    } catch (requestError) {
      setSessions([]);
      setError(requestError.response?.data?.message || 'Failed to load attendance.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAttendance();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const summary = useMemo(() => {
    if (user?.role === 'student') {
      const total = sessions.filter((session) => session.myRecord).length;
      const attended = sessions.filter((session) => ['present', 'late'].includes(session.myRecord?.status)).length;
      return {
        total,
        attended,
        rate: total ? Math.round((attended / total) * 100) : 0,
      };
    }

    return {
      total: sessions.length,
      attended: sessions.reduce((sum, session) => sum + (session.records?.length || 0), 0),
      rate: sessions.length ? Math.round(sessions.reduce((sum, session) => sum + (session.records?.length || 0), 0) / sessions.length) : 0,
    };
  }, [sessions, user?.role]);

  if (loading) return <FullPageSpinner />;

  return (
    <div className="space-y-5">
      {editingSession !== null ? (
        <AttendanceModal
          item={editingSession}
          user={user}
          onClose={() => setEditingSession(null)}
          onSaved={() => {
            setEditingSession(null);
            loadAttendance();
          }}
        />
      ) : null}

      <PageHeader
        title="Attendance"
        subtitle={canManage ? 'Manage attendance records and section-level presence.' : 'Track your attendance history and recent class records.'}
        action={canManage ? <button onClick={() => setEditingSession({})} className="btn-primary"><FiPlus size={15} /> Mark Attendance</button> : null}
      />

      {error ? <Alert type="error" message={error} /> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-gray-400">Sessions</p>
          <p className="font-display text-3xl font-black text-gray-900 mt-1">{summary.total}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-gray-400">{user?.role === 'student' ? 'Attended' : 'Marked Records'}</p>
          <p className="font-display text-3xl font-black text-emerald-700 mt-1">{summary.attended}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-gray-400">Attendance Rate</p>
          <p className="font-display text-3xl font-black text-blue-700 mt-1">{summary.rate}%</p>
        </div>
      </div>

      {sessions.length === 0 ? (
        <EmptyState
          icon="📝"
          title="No attendance records yet"
          description={canManage ? 'Mark attendance to start building section history.' : 'Attendance sessions will appear here once faculty records them.'}
          action={canManage ? <button onClick={() => setEditingSession({})} className="btn-primary"><FiPlus size={15} /> Mark Attendance</button> : null}
        />
      ) : (
        <div className="space-y-4">
          {sessions.map((session) => (
            <section key={session._id} className="card overflow-hidden">
              <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-4 py-3.5">
                <div>
                  <p className="font-display text-lg font-bold text-gray-900">{session.title}</p>
                  <p className="mt-1 text-sm text-gray-500">{session.subject || 'General'} · {formatDate(session.date)}</p>
                </div>
                {canManage ? (
                  <button onClick={() => setEditingSession(session)} className="btn-secondary"><FiEdit2 size={14} /> Update</button>
                ) : (
                  <span className={`badge ${toneByStatus[session.myRecord?.status] || 'bg-slate-100 text-slate-600'}`}>
                    {session.myRecord?.status || 'No record'}
                  </span>
                )}
              </div>
              <div className="p-4">
                {user?.role === 'student' ? (
                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900">{session.topic || 'Class attendance'}</p>
                      <p className="text-sm text-gray-500 mt-1">Updated {formatRelative(session.updatedAt || session.date)}</p>
                    </div>
                    <span className={`badge ${toneByStatus[session.myRecord?.status] || 'bg-slate-100 text-slate-600'}`}>{session.myRecord?.status || 'Pending'}</span>
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {(session.records || []).map((record) => (
                      <div key={`${session._id}-${record.student?._id || record.student}`} className="rounded-2xl border border-gray-100 bg-gray-50 px-3 py-3">
                        <p className="font-medium text-gray-900">{record.student?.name || 'Student'}</p>
                        <p className="text-xs text-gray-500 mt-1">{record.student?.email || ''}</p>
                        <span className={`badge mt-3 ${toneByStatus[record.status] || 'bg-slate-100 text-slate-600'}`}>{record.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
