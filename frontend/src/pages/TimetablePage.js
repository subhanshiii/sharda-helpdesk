import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiClock, FiEdit2, FiMapPin, FiTrash2, FiUsers } from 'react-icons/fi';
import API from '../utils/api';
import { Alert, ConfirmDialog, EmptyState, FullPageSpinner, PageHeader } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../context/PermissionContext';
import AcademicScopeFilters from '../components/academics/AcademicScopeFilters';
import {
  buildDepartmentCollegeMap,
  emptyAcademicScopeFilters,
  filterSectionsByScope,
} from '../utils/academicScope';
import { isStudentUser } from '../utils/access';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const SectionCard = ({ section, onClick, slotCount }) => (
  <button
    type="button"
    onClick={onClick}
    className="rounded-3xl border border-[var(--border-strong)] bg-[var(--surface-card)] p-5 text-left transition hover:-translate-y-0.5 hover:shadow-md"
  >
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Section</p>
        <h3 className="mt-2 font-display text-xl font-bold text-[var(--text-strong)]">{section.name}</h3>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          {[section.department?.name, section.program?.name, section.course?.name].filter(Boolean).join(' · ')}
        </p>
      </div>
      <div className="rounded-2xl bg-[var(--surface-soft)] px-3 py-2 text-xs font-semibold text-[var(--text-main)]">
        Year {section.studyYear || section.academicSession?.yearNumber || '—'}
      </div>
    </div>
    <div className="mt-5 flex items-center justify-between">
      <div className="rounded-2xl bg-[var(--surface-soft)] px-3 py-3 text-sm text-[var(--text-main)]">
        <p className="text-xs uppercase tracking-wide opacity-70">Existing Slots</p>
        <p className="mt-2 text-lg font-bold">{slotCount}</p>
      </div>
      <div className="rounded-full bg-[var(--accent-primary-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--accent-primary)]">
        Open Section
      </div>
    </div>
  </button>
);

export default function TimetablePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { can } = usePermissions();
  const [entries, setEntries] = useState([]);
  const [sections, setSections] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [courses, setCourses] = useState([]);
  const [filters, setFilters] = useState(emptyAcademicScopeFilters);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteState, setDeleteState] = useState({ open: false, entryId: '', loading: false });

  const studentView = isStudentUser(user);
  const canManage = can('create', 'timetable') || can('edit', 'timetable') || can('delete', 'timetable');

  const loadTimetable = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [entriesRes, collegesRes, departmentsRes, programsRes, coursesRes, sectionsRes] = await Promise.all([
        API.get('/academics/timetable'),
        API.get('/academics/colleges?paginate=false'),
        API.get('/academics/departments?paginate=false'),
        API.get('/academics/programs?paginate=false'),
        API.get('/academics/courses?paginate=false'),
        API.get('/academics/sections?paginate=false'),
      ]);
      setEntries(entriesRes.data?.data || []);
      setColleges(collegesRes.data?.data || []);
      setDepartments(departmentsRes.data?.data || []);
      setPrograms(programsRes.data?.data || []);
      setCourses(coursesRes.data?.data || []);
      setSections(sectionsRes.data?.data || []);
    } catch (requestError) {
      setEntries([]);
      setError(requestError.response?.data?.message || 'Failed to load timetable.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTimetable();
  }, [loadTimetable]);

  const departmentCollegeMap = useMemo(() => buildDepartmentCollegeMap(departments), [departments]);
  const scopedSections = useMemo(
    () => filterSectionsByScope(sections, filters, departmentCollegeMap),
    [sections, filters, departmentCollegeMap]
  );

  const subjectOptions = useMemo(() => {
    const unique = new Map();
    entries.forEach((entry) => {
      const subject = entry.subjectId;
      if (subject?._id && !unique.has(String(subject._id))) {
        unique.set(String(subject._id), subject);
      }
    });
    return [...unique.values()];
  }, [entries]);

  const teacherOptions = useMemo(() => {
    const unique = new Map();
    entries.forEach((entry) => {
      const teacher = entry.faculty;
      if (teacher?._id && !unique.has(String(teacher._id))) {
        unique.set(String(teacher._id), teacher);
      }
    });
    return [...unique.values()];
  }, [entries]);

  const filteredEntries = useMemo(() => entries.filter((entry) => {
    if (filters.sectionId && String(entry.sectionId?._id || entry.sectionId) !== String(filters.sectionId)) return false;
    if (selectedSubjectId && String(entry.subjectId?._id || entry.subjectId) !== String(selectedSubjectId)) return false;
    if (selectedTeacherId && String(entry.faculty?._id || entry.faculty) !== String(selectedTeacherId)) return false;
    return true;
  }), [entries, filters.sectionId, selectedSubjectId, selectedTeacherId]);

  const groupedEntries = useMemo(() => DAYS.map((day) => ({
    day,
    items: filteredEntries.filter((entry) => entry.dayOfWeek === day),
  })), [filteredEntries]);

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

  const handleDelete = async () => {
    if (!deleteState.entryId) return;
    setDeleteState((current) => ({ ...current, loading: true }));
    try {
      await API.delete(`/academics/timetable/${deleteState.entryId}`);
      toast.success('Timetable entry deleted');
      setDeleteState({ open: false, entryId: '', loading: false });
      await loadTimetable();
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || 'Delete failed');
      setDeleteState((current) => ({ ...current, loading: false }));
    }
  };

  if (loading) return <FullPageSpinner />;

  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={deleteState.open}
        title="Delete timetable slot"
        description="Are you sure you want to delete this timetable slot?"
        confirmLabel="Delete"
        loading={deleteState.loading}
        onConfirm={handleDelete}
        onClose={() => setDeleteState({ open: false, entryId: '', loading: false })}
      />

      <PageHeader
        title="Timetable"
        subtitle={studentView
          ? 'See your weekly subject schedule with room and faculty details.'
          : 'Choose a section first, then build its weekly timetable on the dedicated section page.'}
      />

      {error ? <Alert type="error" message={error} /> : null}

      {!studentView ? (
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
            <div className="rounded-3xl border border-[var(--border-strong)] bg-[var(--surface-soft)] p-3">
              <label className="label">Date</label>
              <input type="date" className="input" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
            </div>
          </div>
        </div>
      ) : (
        <div className="card p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Subject</label>
              <select className="input" value={selectedSubjectId} onChange={(event) => setSelectedSubjectId(event.target.value)}>
                <option value="">All subjects</option>
                {subjectOptions.map((subject) => (
                  <option key={subject._id} value={subject._id}>{subject.name} ({subject.code || '—'})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Faculty</label>
              <select className="input" value={selectedTeacherId} onChange={(event) => setSelectedTeacherId(event.target.value)}>
                <option value="">All faculty</option>
                {teacherOptions.map((teacher) => (
                  <option key={teacher._id} value={teacher._id}>{teacher.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {!studentView && scopedSections.length ? (
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {scopedSections.map((section) => {
            const count = entries.filter((entry) => String(entry.sectionId?._id || entry.sectionId) === String(section._id)).length;
            return (
              <SectionCard
                key={section._id}
                section={section}
                slotCount={count}
                onClick={() => navigate(`/timetable/sections/${section._id}?date=${selectedDate}`)}
              />
            );
          })}
        </div>
      ) : null}

      {studentView && filteredEntries.length === 0 ? (
        <EmptyState
          icon="🗓️"
          title="No timetable entries match this view"
          description="Your schedule will appear here once it is published."
        />
      ) : studentView ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {groupedEntries.map(({ day, items }) => (
            <section key={day} className="card overflow-hidden">
              <div className="border-b border-gray-100 px-4 py-3.5">
                <h2 className="font-display text-base font-bold text-gray-900">{day}</h2>
              </div>
              <div className="min-h-[180px] space-y-3 p-4">
                {items.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-gray-200 p-4 text-center text-sm text-gray-400">No classes scheduled.</div>
                ) : items.map((entry) => (
                  <div key={entry._id} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-gray-900">{entry.subjectId?.name || entry.title}</p>
                        <p className="mt-1 text-sm text-gray-500">
                          {studentView
                            ? [entry.sectionId?.name ? `Section ${entry.sectionId.name}` : null, entry.faculty?.name || null].filter(Boolean).join(' · ')
                            : [entry.faculty?.name || 'Unassigned', entry.sectionId?.name ? `Section ${entry.sectionId.name}` : null].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      {canManage ? (
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => navigate(`/timetable/${entry._id}/edit`)} className="rounded-lg p-2 text-gray-400 hover:bg-white hover:text-blue-700">
                            <FiEdit2 size={15} />
                          </button>
                          <button type="button" onClick={() => setDeleteState({ open: true, entryId: entry._id, loading: false })} className="rounded-lg p-2 text-gray-400 hover:bg-white hover:text-red-600">
                            <FiTrash2 size={15} />
                          </button>
                        </div>
                      ) : null}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                      <span className="inline-flex items-center gap-1"><FiClock size={12} /> {entry.startTime} - {entry.endTime}</span>
                      {entry.room ? <span className="inline-flex items-center gap-1"><FiMapPin size={12} /> {entry.room}</span> : null}
                      {!studentView && entry.subjectId?.code ? <span>{entry.subjectId.code}</span> : null}
                      {studentView && entry.sectionId?.course?.name ? <span className="inline-flex items-center gap-1"><FiUsers size={12} /> {entry.sectionId.course.name}</span> : null}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}
