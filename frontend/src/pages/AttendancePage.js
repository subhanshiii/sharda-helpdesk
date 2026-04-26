import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiEdit2, FiPlus, FiTrash2 } from 'react-icons/fi';
import API from '../utils/api';
import { Alert, ConfirmDialog, EmptyState, FullPageSpinner, PageHeader } from '../components/ui';
import { formatDate, formatRelative } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../context/PermissionContext';
import AcademicScopeFilters from '../components/academics/AcademicScopeFilters';
import {
  buildDepartmentCollegeMap,
  emptyAcademicScopeFilters,
  matchesAcademicScope,
  resolveSectionForRecord,
} from '../utils/academicScope';

const toneByStatus = {
  present: 'bg-emerald-50 text-emerald-700',
  absent: 'bg-red-50 text-red-700',
  late: 'bg-amber-50 text-amber-700',
  excused: 'bg-blue-50 text-blue-700',
};

export default function AttendancePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const [sessions, setSessions] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [courses, setCourses] = useState([]);
  const [sections, setSections] = useState([]);
  const [filters, setFilters] = useState(emptyAcademicScopeFilters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteState, setDeleteState] = useState({ open: false, id: '', loading: false });

  const canManage = useMemo(() => {
    return ['faculty', 'admin'].includes(user?.role) || hasPermission('canMarkAttendance');
  }, [user?.role, hasPermission]);

  const loadAttendance = async () => {
    setLoading(true);
    setError('');
    try {
      const [attendanceRes, collegesRes, departmentsRes, programsRes, coursesRes, sectionsRes] = await Promise.all([
        API.get('/academics/attendance'),
        API.get('/academics/colleges?paginate=false'),
        API.get('/academics/departments?paginate=false'),
        API.get('/academics/programs?paginate=false'),
        API.get('/academics/courses?paginate=false'),
        API.get('/academics/sections?paginate=false'),
      ]);
      setSessions(attendanceRes.data?.data || []);
      setColleges(collegesRes.data?.data || []);
      setDepartments(departmentsRes.data?.data || []);
      setPrograms(programsRes.data?.data || []);
      setCourses(coursesRes.data?.data || []);
      setSections(sectionsRes.data?.data || []);
    } catch (requestError) {
      setSessions([]);
      setError(requestError.response?.data?.message || 'Failed to load attendance.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAttendance();
  }, []);

  const departmentCollegeMap = useMemo(() => buildDepartmentCollegeMap(departments), [departments]);
  const filteredSessions = useMemo(() => sessions.filter((session) => {
    if (!Object.values(filters).some(Boolean)) return true;
    const section = resolveSectionForRecord(session, sections);
    return matchesAcademicScope(section, filters, departmentCollegeMap);
  }), [departmentCollegeMap, filters, sections, sessions]);

  const summary = useMemo(() => {
    if (user?.role === 'student') {
      const total = filteredSessions.filter((session) => session.myRecord).length;
      const attended = filteredSessions.filter((session) => ['present', 'late'].includes(session.myRecord?.status)).length;
      return {
        total,
        attended,
        rate: total ? Math.round((attended / total) * 100) : 0,
      };
    }

    // For non-students: calculate meaningful percentage
    // Count total student records marked across all sessions
    const totalRecords = filteredSessions.reduce((sum, session) => sum + (session.records?.length || 0), 0);
    const avgStudentsPerSession = filteredSessions.length > 0
      ? Math.round(filteredSessions.reduce((sum, session) => sum + (session.records?.length || 0), 0) / filteredSessions.length)
      : 0;
    
    return {
      total: filteredSessions.length,
      attended: totalRecords,
      rate: filteredSessions.length && avgStudentsPerSession ? Math.round((totalRecords / (filteredSessions.length * avgStudentsPerSession)) * 100) : 0,
    };
  }, [filteredSessions, user?.role]);

  const handleScopeChange = (key, value) => {
    setFilters((current) => {
      const next = { ...current, [key]: value };
      if (key === 'collegeId') {
        next.departmentId = '';
        next.programId = '';
        next.courseId = '';
        next.sectionId = '';
      }
      if (key === 'departmentId') {
        next.programId = '';
        next.courseId = '';
        next.sectionId = '';
      }
      if (key === 'programId') {
        next.courseId = '';
        next.sectionId = '';
      }
      if (key === 'courseId' || key === 'studyYear') {
        next.sectionId = '';
      }
      return next;
    });
  };

  const handleDeleteSession = async () => {
    if (!deleteState.id) return;
    setDeleteState((current) => ({ ...current, loading: true }));
    try {
      await API.delete(`/academics/attendance/${deleteState.id}`);
      setSessions((current) => current.filter((session) => session._id !== deleteState.id));
      setDeleteState({ open: false, id: '', loading: false });
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to delete attendance session.');
      setDeleteState((current) => ({ ...current, loading: false }));
    }
  };

  if (loading) return <FullPageSpinner />;

  return (
    <div className="space-y-5">
      <ConfirmDialog
        open={deleteState.open}
        title="Delete attendance session"
        description="This removes the selected attendance session and all marked records inside it."
        confirmLabel="Delete Session"
        loading={deleteState.loading}
        onConfirm={handleDeleteSession}
        onClose={() => setDeleteState({ open: false, id: '', loading: false })}
      />
      <PageHeader
        title="Attendance"
        subtitle={canManage ? 'Manage attendance records and section-level presence.' : 'Track your attendance history and recent class records.'}
        action={canManage ? <button onClick={() => navigate('/attendance/new')} className="btn-primary"><FiPlus size={15} /> Mark Attendance</button> : null}
      />

      {error ? <Alert type="error" message={error} /> : null}

      <div className="card p-4">
        <AcademicScopeFilters
          filters={filters}
          onChange={handleScopeChange}
          options={{ colleges, departments, programs, courses, sections }}
          departmentCollegeMap={departmentCollegeMap}
        />
      </div>

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

      {filteredSessions.length === 0 ? (
        <EmptyState
          icon="📝"
          title="No attendance records yet"
          description={canManage ? 'Mark attendance to start building section history.' : 'Attendance sessions will appear here once faculty records them.'}
          action={canManage ? <button onClick={() => navigate('/attendance/new')} className="btn-primary"><FiPlus size={15} /> Mark Attendance</button> : null}
        />
      ) : (
        <div className="space-y-4">
          {filteredSessions.map((session) => (
            <section key={session._id} className="card overflow-hidden">
              <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-4 py-3.5">
                <div>
                  <p className="font-display text-lg font-bold text-gray-900">{session.title}</p>
                  <p className="mt-1 text-sm text-gray-500">{session.subject || 'General'} · {formatDate(session.date)}</p>
                </div>
                {canManage ? (
                  <div className="flex gap-2">
                    <button onClick={() => navigate(`/attendance/${session._id}/edit`)} className="btn-secondary" title="Edit this attendance session"><FiEdit2 size={14} /> Update</button>
                    <button type="button" onClick={() => setDeleteState({ open: true, id: session._id, loading: false })} className="btn-secondary text-red-600 hover:text-red-700"><FiTrash2 size={14} /> Delete</button>
                  </div>
                ) : (
                  <span className={`badge ${toneByStatus[session.myRecord?.status] || 'bg-slate-100 text-slate-600'}`} role="status" aria-label={`Your attendance: ${session.myRecord?.status || 'No record'}` }>
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
                    <span className={`badge ${toneByStatus[session.myRecord?.status] || 'bg-slate-100 text-slate-600'}`} role="status">{session.myRecord?.status || 'Pending'}</span>
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {(session.records || []).map((record) => (
                      <div key={`${session._id}-${record.student?._id || record.student}`} className="rounded-2xl border border-gray-100 bg-gray-50 px-3 py-3">
                        <p className="font-medium text-gray-900">{record.student?.name || 'Student'}</p>
                        <p className="mt-1 text-xs text-gray-500">{record.student?.email || ''}</p>
                        <span className={`badge mt-3 ${toneByStatus[record?.status] || 'bg-slate-100 text-slate-600'}`} role="status">{record?.status || 'pending'}</span>
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
