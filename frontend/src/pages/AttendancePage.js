import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiEdit2, FiPlus } from 'react-icons/fi';
import API from '../utils/api';
import { Alert, EmptyState, FullPageSpinner, PageHeader } from '../components/ui';
import { formatDate, formatRelative } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';

const toneByStatus = {
  present: 'bg-emerald-50 text-emerald-700',
  absent: 'bg-red-50 text-red-700',
  late: 'bg-amber-50 text-amber-700',
  excused: 'bg-blue-50 text-blue-700',
};

export default function AttendancePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
      <PageHeader
        title="Attendance"
        subtitle={canManage ? 'Manage attendance records and section-level presence.' : 'Track your attendance history and recent class records.'}
        action={canManage ? <button onClick={() => navigate('/attendance/new')} className="btn-primary"><FiPlus size={15} /> Mark Attendance</button> : null}
      />

      {error ? <Alert type="error" message={error} /> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-gray-400">Sessions</p>
          <p className="mt-1 font-display text-3xl font-black text-gray-900">{summary.total}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-gray-400">{user?.role === 'student' ? 'Attended' : 'Marked Records'}</p>
          <p className="mt-1 font-display text-3xl font-black text-emerald-700">{summary.attended}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-gray-400">Attendance Rate</p>
          <p className="mt-1 font-display text-3xl font-black text-blue-700">{summary.rate}%</p>
        </div>
      </div>

      {sessions.length === 0 ? (
        <EmptyState
          icon="📝"
          title="No attendance records yet"
          description={canManage ? 'Mark attendance to start building section history.' : 'Attendance sessions will appear here once faculty records them.'}
          action={canManage ? <button onClick={() => navigate('/attendance/new')} className="btn-primary"><FiPlus size={15} /> Mark Attendance</button> : null}
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
                  <button onClick={() => navigate(`/attendance/${session._id}/edit`)} className="btn-secondary"><FiEdit2 size={14} /> Update</button>
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
                      <p className="mt-1 text-sm text-gray-500">Updated {formatRelative(session.updatedAt || session.date)}</p>
                    </div>
                    <span className={`badge ${toneByStatus[session.myRecord?.status] || 'bg-slate-100 text-slate-600'}`}>{session.myRecord?.status || 'Pending'}</span>
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {(session.records || []).map((record) => (
                      <div key={`${session._id}-${record.student?._id || record.student}`} className="rounded-2xl border border-gray-100 bg-gray-50 px-3 py-3">
                        <p className="font-medium text-gray-900">{record.student?.name || 'Student'}</p>
                        <p className="mt-1 text-xs text-gray-500">{record.student?.email || ''}</p>
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
