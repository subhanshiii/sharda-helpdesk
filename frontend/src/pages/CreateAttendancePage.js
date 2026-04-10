import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import API from '../utils/api';
import { Alert, PageHeader } from '../components/ui';
import { useAuth } from '../context/AuthContext';

const STATUS_OPTIONS = ['present', 'absent', 'late', 'excused'];

export default function CreateAttendancePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [form, setForm] = useState({
    title: '',
    subject: '',
    department: user?.department || '',
    year: user?.year || '',
    section: user?.section || '',
    date: new Date().toISOString().slice(0, 10),
    topic: '',
    records: [],
  });
  const [students, setStudents] = useState([]);
  const [loadingPage, setLoadingPage] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadStudents = async (scope = form, existingItem = null) => {
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
        records: existingItem?.records?.length
          ? existingItem.records.map((record) => ({
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
    let active = true;

    const bootstrap = async () => {
      if (isEdit) {
        try {
          const res = await API.get('/academics/attendance');
          const sessions = res.data?.data || [];
          const item = sessions.find((entry) => entry._id === id);
          if (!active) return;
          if (!item) {
            setError('Attendance session not found.');
            setLoadingPage(false);
            return;
          }
          const nextForm = {
            title: item.title || '',
            subject: item.subject || '',
            department: item.department || user?.department || '',
            year: item.year || user?.year || '',
            section: item.section || user?.section || '',
            date: item.date ? new Date(item.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
            topic: item.topic || '',
            records: [],
          };
          setForm(nextForm);
          await loadStudents(nextForm, item);
        } catch (requestError) {
          if (active) setError(requestError.response?.data?.message || 'Failed to load attendance.');
        } finally {
          if (active) setLoadingPage(false);
        }
      } else {
        await loadStudents(form);
      }
    };

    bootstrap();

    return () => {
      active = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleScopeChange = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
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
      if (isEdit) {
        await API.put(`/academics/attendance/${id}`, form);
      } else {
        await API.post('/academics/attendance', form);
      }
      toast.success(`Attendance ${isEdit ? 'updated' : 'saved'}`);
      navigate('/attendance');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to save attendance.');
    } finally {
      setSaving(false);
    }
  };

  if (loadingPage) {
    return <div className="mx-auto max-w-2xl"><PageHeader title="Mark Attendance" subtitle="Loading attendance details..." /></div>;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={isEdit ? 'Update Attendance' : 'Mark Attendance'}
        subtitle="Capture section attendance with a simple, reliable checklist."
      />

      <div className="card p-6">
        {error ? <div className="mb-4"><Alert type="error" message={error} /></div> : null}

        <form onSubmit={handleSubmit} className="space-y-4">
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

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="label">Topic</label>
              <input className="input" value={form.topic} onChange={(event) => handleScopeChange('topic', event.target.value)} placeholder="Normalization and joins" />
            </div>
            <button type="button" onClick={refreshRoster} className="btn-secondary">Load Roster</button>
          </div>

          <div className="rounded-2xl border border-gray-100">
            <div className="border-b border-gray-100 px-4 py-3">
              <p className="font-semibold text-gray-900">Student Roster</p>
            </div>
            <div className="max-h-[420px] divide-y divide-gray-100 overflow-y-auto">
              {form.records.length === 0 ? (
                <div className="p-5 text-center text-sm text-gray-400">Load the roster for this section first.</div>
              ) : form.records.map((record) => {
                const student = students.find((entry) => entry._id === record.student);
                return (
                  <div key={record.student} className="grid gap-3 px-4 py-3 md:grid-cols-[1fr_220px] md:items-center">
                    <div>
                      <p className="font-medium text-gray-900">{student?.name || 'Student'}</p>
                      <p className="mt-1 text-xs text-gray-500">{student?.email || ''}</p>
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
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center py-2.5">
              {saving ? 'Saving...' : isEdit ? 'Update' : 'Submit'}
            </button>
            <button type="button" onClick={() => navigate('/attendance')} className="btn-secondary">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
