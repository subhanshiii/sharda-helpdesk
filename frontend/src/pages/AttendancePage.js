import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiCalendar, FiCheckCircle, FiEdit2, FiTrash2, FiUsers } from 'react-icons/fi';
import API from '../utils/api';
import { Alert, ConfirmDialog, EmptyState, FullPageSpinner, Modal, PageHeader } from '../components/ui';
import { formatDate } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';
import { isStudentUser } from '../utils/access';
import AcademicScopeFilters from '../components/academics/AcademicScopeFilters';
import {
  buildDepartmentCollegeMap,
  emptyAcademicScopeFilters,
  filterSectionsByScope
} from '../utils/academicScope';

const toneByStatus = {
  present: 'bg-emerald-50 text-emerald-700',
  absent: 'bg-red-50 text-red-700',
  late: 'bg-amber-50 text-amber-700',
  excused: 'bg-blue-50 text-blue-700',
};

const todayKey = new Date().toISOString().slice(0, 10);

const SectionCard = ({ section, active, onClick, sessionCount, subjectCount, actionLabel = 'Open' }) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-3xl border p-5 text-left transition ${active ? 'border-[var(--accent-primary)] bg-[var(--page-accent-panel)] text-[var(--page-accent-panel-text)] shadow-lg' : 'border-[var(--border-strong)] bg-[var(--surface-card)] text-[var(--text-strong)] hover:-translate-y-0.5 hover:shadow-md'}`}
  >
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className={`text-xs font-semibold uppercase tracking-[0.16em] ${active ? 'text-[var(--page-accent-panel-muted)]' : 'text-[var(--text-muted)]'}`}>Section</p>
        <h3 className="mt-2 font-display text-xl font-bold">{section.name}</h3>
        <p className={`mt-2 text-sm ${active ? 'text-[var(--page-accent-panel-muted)]' : 'text-[var(--text-muted)]'}`}>
          {[section.department?.name, section.program?.name, section.course?.name].filter(Boolean).join(' · ')}
        </p>
      </div>
      <div className={`rounded-2xl px-3 py-2 text-xs font-semibold ${active ? 'bg-white/10 text-white' : 'bg-[var(--surface-soft)] text-[var(--text-main)]'}`}>
        Year {section.studyYear || section.academicSession?.yearNumber || '—'}
      </div>
    </div>
    <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
      <div className={`rounded-2xl px-3 py-3 ${active ? 'bg-white/10 text-white' : 'bg-[var(--surface-soft)] text-[var(--text-main)]'}`}>
        <p className="text-xs uppercase tracking-wide opacity-70">Subjects</p>
        <p className="mt-2 text-lg font-bold">{subjectCount}</p>
      </div>
      <div className={`rounded-2xl px-3 py-3 ${active ? 'bg-white/10 text-white' : 'bg-[var(--surface-soft)] text-[var(--text-main)]'}`}>
        <p className="text-xs uppercase tracking-wide opacity-70">Marked</p>
        <p className="mt-2 text-lg font-bold">{sessionCount}</p>
      </div>
    </div>
    <div className={`mt-4 inline-flex rounded-full px-3 py-1.5 text-xs font-semibold ${active ? 'bg-white/10 text-white' : 'bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]'}`}>
      {actionLabel}
    </div>
  </button>
);

const SubjectOptionCard = ({ option, onClick, onManageMapping }) => (
  <div className="rounded-3xl border border-[var(--border-strong)] bg-[var(--surface-card)] p-4">
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left transition hover:-translate-y-0.5"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">{option.subject?.code || 'SUBJ'}</p>
      <p className="mt-2 text-base font-bold text-[var(--text-strong)]">{option.subject?.name || 'Subject'}</p>
      <p className="mt-2 text-sm text-[var(--text-muted)]">
        {[option.teacher?.name || 'Faculty not assigned', option.subject?.academicSession?.label || 'Current session'].filter(Boolean).join(' · ')}
      </p>
    </button>
    {option.isUnassigned ? (
      <button type="button" className="btn-secondary mt-3 text-xs" onClick={onManageMapping}>
        Assign Faculty
      </button>
    ) : null}
  </div>
);

export default function AttendancePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const studentView = isStudentUser(user);

  const [sessions, setSessions] = useState([]);
  const [activeSubjectsBySection, setActiveSubjectsBySection] = useState({});
  const [colleges, setColleges] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [courses, setCourses] = useState([]);
  const [sections, setSections] = useState([]);
  const [filters, setFilters] = useState(emptyAcademicScopeFilters);
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [subjectPickerOpen, setSubjectPickerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteState, setDeleteState] = useState({ open: false, id: '', loading: false });

  useEffect(() => {
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
        setError(requestError.response?.data?.message || 'Failed to load attendance.');
      } finally {
        setLoading(false);
      }
    };

    loadAttendance();
  }, []);

  const departmentCollegeMap = useMemo(() => buildDepartmentCollegeMap(departments), [departments]);
  const scopedSections = useMemo(
    () => filterSectionsByScope(sections, filters, departmentCollegeMap),
    [sections, filters, departmentCollegeMap]
  );

  useEffect(() => {
    if (studentView || !scopedSections.length) return;

    const sectionIdsToLoad = scopedSections
      .map((section) => String(section._id))
      .filter((sectionId) => !activeSubjectsBySection[sectionId]);

    if (!sectionIdsToLoad.length) return;

    let active = true;
    Promise.all(
      sectionIdsToLoad.map(async (sectionId) => {
        const response = await API.get(`/academics/sections/${sectionId}/active-subjects`);
        return [sectionId, response.data?.data || []];
      })
    )
      .then((entries) => {
        if (!active) return;
        setActiveSubjectsBySection((current) => {
          const next = { ...current };
          entries.forEach(([sectionId, data]) => {
            next[sectionId] = data;
          });
          return next;
        });
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [activeSubjectsBySection, scopedSections, studentView]);

  useEffect(() => {
    if (!selectedSectionId && scopedSections.length && !studentView) {
      setSelectedSectionId(String(scopedSections[0]._id));
    }
    if (selectedSectionId && !scopedSections.some((section) => String(section._id) === String(selectedSectionId))) {
      setSelectedSectionId(scopedSections[0]?._id || '');
      setSelectedSubjectId('');
    }
  }, [scopedSections, selectedSectionId, studentView]);

  const sectionSubjectAssignments = useMemo(() => {
    const activeSubjects = activeSubjectsBySection[String(selectedSectionId)] || [];
    const options = [];

    activeSubjects.forEach((entry) => {
      const subject = entry?.subject;
      const assignments = Array.isArray(entry?.teachingAssignments) ? entry.teachingAssignments : [];

      if (!subject?._id) return;

      if (!assignments.length) {
        options.push({
          subject,
          teacher: null,
          teachingAssignmentId: '',
          isUnassigned: true,
        });
        return;
      }

      assignments.forEach((assignment) => {
        options.push({
          subject,
          teacher: assignment.teacher || null,
          teachingAssignmentId: assignment._id,
          isUnassigned: false,
        });
      });
    });

    return options;
  }, [activeSubjectsBySection, selectedSectionId]);

  const filteredSessions = useMemo(() => sessions.filter((session) => {
    if (selectedSectionId && String(session.sectionId?._id || session.sectionId) !== String(selectedSectionId)) return false;
    if (selectedSubjectId && String(session.subjectId?._id || session.subjectId) !== String(selectedSubjectId)) return false;
    if (selectedDate && new Date(session.date).toISOString().slice(0, 10) !== selectedDate) return false;
    return true;
  }), [selectedDate, selectedSectionId, selectedSubjectId, sessions]);

  const studentSubjectOptions = useMemo(() => {
    const unique = new Map();
    sessions.forEach((session) => {
      const subject = session.subjectId;
      if (subject?._id && !unique.has(String(subject._id))) unique.set(String(subject._id), subject);
    });
    return [...unique.values()];
  }, [sessions]);

  const studentSessions = useMemo(() => sessions.filter((session) => {
    if (selectedSubjectId && String(session.subjectId?._id || session.subjectId) !== String(selectedSubjectId)) return false;
    if (selectedDate && new Date(session.date).toISOString().slice(0, 10) !== selectedDate) return false;
    return true;
  }), [selectedDate, selectedSubjectId, sessions]);

  const handleScopeChange = (key, value) => {
    if (key === 'sectionId') {
      const selectedSection = sections.find((section) => String(section._id) === String(value));
      setFilters((current) => ({
        ...current,
        sectionId: value,
        collegeId: selectedSection
          ? (departmentCollegeMap.get(String(selectedSection.department?._id || selectedSection.department || '')) || '')
          : current.collegeId,
        departmentId: selectedSection ? String(selectedSection.department?._id || selectedSection.department || '') : current.departmentId,
        programId: selectedSection ? String(selectedSection.program?._id || selectedSection.program || '') : current.programId,
        courseId: selectedSection ? String(selectedSection.course?._id || selectedSection.course || '') : current.courseId,
        studyYear: selectedSection
          ? String(selectedSection.studyYear || selectedSection.academicSession?.yearNumber || '')
          : current.studyYear,
      }));
      if (selectedSection) {
        setSelectedSectionId(String(selectedSection._id));
      }
      return;
    }

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
    <div className="space-y-6">
      <ConfirmDialog
        open={deleteState.open}
        title="Delete attendance session"
        description="This removes the selected attendance session and all marked records inside it."
        confirmLabel="Delete Session"
        loading={deleteState.loading}
        onConfirm={handleDeleteSession}
        onClose={() => setDeleteState({ open: false, id: '', loading: false })}
      />

      <Modal
        open={subjectPickerOpen}
        onClose={() => setSubjectPickerOpen(false)}
        panelClassName="max-w-3xl"
        contentClassName="rounded-[28px] border border-[var(--border-strong)] bg-[var(--surface-card)] p-6 shadow-[var(--shadow-floating)]"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Attendance Flow</p>
            <h2 className="mt-2 font-display text-2xl font-bold text-[var(--text-strong)]">Choose a Subject</h2>
            <p className="mt-2 text-sm text-[var(--text-muted)]">Select a subject from this section to open the roster page.</p>
          </div>
          <div className="rounded-2xl bg-[var(--surface-soft)] px-3 py-2 text-sm font-semibold text-[var(--text-main)]">{selectedDate}</div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {sectionSubjectAssignments.length ? sectionSubjectAssignments.map((option) => (
            <SubjectOptionCard
              key={`${option.subject?._id}:${option.teachingAssignmentId || 'fallback'}`}
              option={option}
              onClick={() => {
                setSubjectPickerOpen(false);
                const query = new URLSearchParams({
                  sectionId: selectedSectionId,
                  subjectId: String(option.subject?._id || ''),
                  date: selectedDate,
                });
                if (option.teachingAssignmentId) {
                  query.set('teachingAssignmentId', String(option.teachingAssignmentId));
                }
                navigate(`/attendance/new?${query.toString()}`);
              }}
              onManageMapping={() => {
                setSubjectPickerOpen(false);
                const query = new URLSearchParams({
                  sectionId: selectedSectionId,
                  subjectId: String(option.subject?._id || ''),
                });
                navigate(`/academics/subject-management?${query.toString()}`);
              }}
            />
          )) : (
            <div className="md:col-span-2">
              <EmptyState icon="📚" title="No subjects assigned yet" description="Assign subjects to this section before marking attendance." />
            </div>
          )}
        </div>
      </Modal>

      <PageHeader
        title="Attendance"
        subtitle={studentView
          ? 'Review your attendance by subject and date without the marking interface.'
          : 'Choose a section card, then select a subject to open the dedicated roster page.'}
      />

      {error ? <Alert type="error" message={error} /> : null}

      {studentView ? (
        <>
          <div className="card p-5">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
              <div>
                <label className="label">Subject</label>
                <select className="input" value={selectedSubjectId} onChange={(event) => setSelectedSubjectId(event.target.value)}>
                  <option value="">All subjects</option>
                  {studentSubjectOptions.map((subject) => (
                    <option key={subject._id} value={subject._id}>{subject.name} ({subject.code || '—'})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Date</label>
                <input type="date" className="input" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
              </div>
            </div>
          </div>

          {!studentSessions.length ? (
            <EmptyState icon="🗂️" title="No attendance records match these filters" description="Try another subject or date to review your attendance history." />
          ) : (
            <div className="card overflow-hidden">
              <div className="grid grid-cols-[minmax(0,1.2fr)_180px_140px] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                <span>Subject and Group</span>
                <span>Date</span>
                <span>Status</span>
              </div>
              <div className="divide-y divide-slate-100">
                {studentSessions.map((session) => (
                  <div key={session._id} className="grid grid-cols-[minmax(0,1.2fr)_180px_140px] gap-4 px-5 py-4 text-sm">
                    <div>
                      <p className="font-semibold text-slate-900">{session.subjectId?.name || session.subject || session.title}</p>
                      <p className="mt-1 text-slate-500">Section {session.sectionId?.name || session.section || '—'}</p>
                    </div>
                    <div className="text-slate-600">{formatDate(session.date)}</div>
                    <div><span className={`badge ${toneByStatus[session.myRecord?.status] || 'bg-slate-100 text-slate-600'}`}>{session.myRecord?.status || 'No record'}</span></div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="card p-5">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px] xl:items-end">
              <div className="min-w-0">
                <AcademicScopeFilters
                  filters={filters}
                  onChange={handleScopeChange}
                  options={{ colleges, departments, programs, courses, sections }}
                  departmentCollegeMap={departmentCollegeMap}
                  singleLine
                />
              </div>
              <div className="rounded-3xl border border-[var(--border-strong)] bg-[var(--surface-soft)] px-4 py-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-main)]">
                  <FiCalendar size={15} />
                  Attendance Date
                </div>
                <input type="date" className="input mt-3" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
              </div>
            </div>
          </div>

          {!scopedSections.length ? (
            <EmptyState icon="🏫" title="No sections available in this scope" description="Adjust the academic filters to reveal the sections you can manage." />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
              {scopedSections.map((section) => {
                const subjectCount = (activeSubjectsBySection[String(section._id)] || []).length;
                const sessionCount = sessions.filter((session) => String(session.sectionId?._id || session.sectionId) === String(section._id)).length;
                return (
                  <SectionCard
                    key={section._id}
                    section={section}
                    active={String(section._id) === String(selectedSectionId)}
                    onClick={() => {
                      setSelectedSectionId(String(section._id));
                      setFilters((current) => ({
                        ...current,
                        sectionId: String(section._id),
                        collegeId: departmentCollegeMap.get(String(section.department?._id || section.department || '')) || '',
                        departmentId: String(section.department?._id || section.department || ''),
                        programId: String(section.program?._id || section.program || ''),
                        courseId: String(section.course?._id || section.course || ''),
                        studyYear: String(section.studyYear || section.academicSession?.yearNumber || ''),
                      }));
                      setSubjectPickerOpen(true);
                    }}
                    subjectCount={subjectCount}
                    sessionCount={sessionCount}
                    actionLabel="Choose Subject"
                  />
                );
              })}
            </div>
          )}

          {selectedSectionId ? (
            <div className="card p-5">
                <h2 className="font-display text-xl font-bold text-slate-900">Today’s Sessions</h2>
                <p className="mt-1 text-sm text-slate-500">Review what has already been marked for this section and date.</p>
                <div className="mt-4 space-y-3">
                  {!filteredSessions.length ? (
                    <div className="rounded-3xl border border-dashed border-slate-200 px-5 py-10 text-center text-sm text-slate-500">
                      No attendance has been marked for this combination yet.
                    </div>
                  ) : filteredSessions.map((session) => (
                    <div key={session._id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">{session.title}</p>
                          <p className="mt-1 text-sm text-slate-500">{session.subjectId?.name || session.subject || 'General'} · {formatDate(session.date)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => navigate(`/attendance/${session._id}/edit`)} className="rounded-xl p-2 text-slate-500 transition hover:bg-white hover:text-blue-700">
                            <FiEdit2 size={15} />
                          </button>
                          <button type="button" onClick={() => setDeleteState({ open: true, id: session._id, loading: false })} className="rounded-xl p-2 text-slate-500 transition hover:bg-white hover:text-red-600">
                            <FiTrash2 size={15} />
                          </button>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-600">
                        <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5"><FiUsers size={14} /> {(session.records || []).length} students</span>
                        <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5"><FiCheckCircle size={14} /> {(session.records || []).filter((record) => record.status === 'present').length} present</span>
                      </div>
                    </div>
                  ))}
                </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
