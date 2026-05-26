import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { FiArrowLeft, FiBookOpen, FiPlus, FiRefreshCw, FiSearch, FiTrash2 } from 'react-icons/fi';
import { useNavigate, useSearchParams } from 'react-router-dom';
import API from '../utils/api';
import { Alert, EmptyState, FullPageSpinner, PageHeader } from '../components/ui';
import { subjectMatchesCourse } from '../utils/academicScope';

const defaultForm = {
  code: '',
  name: '',
  department: '',
  program: '',
  academicSession: '',
  credits: 0,
  courseIds: [],
  term: 1,
};

const emptyFilters = {
  departmentId: '',
  programId: '',
  courseId: '',
  teacherId: '',
};

const matchesSubject = (subject, query) => {
  if (!query) return true;
  const haystack = [
    subject?.code,
    subject?.name,
    subject?.department?.name,
    subject?.program?.name,
    subject?.academicSession?.label,
    ...(subject?.courses || []).map((course) => course?.name),
    ...(subject?.teachers || []).map((teacher) => teacher?.name || teacher?.email),
  ].filter(Boolean).join(' ').toLowerCase();

  return haystack.includes(query);
};

export default function SubjectTeacherMappingsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const focusSectionId = searchParams.get('sectionId') || '';
  const [workspace, setWorkspace] = useState({
    subjects: [],
    courses: [],
    sections: [],
    faculty: [],
    departments: [],
    programs: [],
    academicSessions: [],
  });
  const [form, setForm] = useState(defaultForm);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState(emptyFilters);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [error, setError] = useState('');
  const [sectionActiveSubjects, setSectionActiveSubjects] = useState([]);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await API.get('/academics/subject-management');
      setWorkspace(response.data?.data || {});
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to load subject management workspace');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  const selectedSection = useMemo(
    () => (workspace.sections || []).find((section) => String(section._id) === String(focusSectionId)) || null,
    [focusSectionId, workspace.sections]
  );

  useEffect(() => {
    if (!focusSectionId) {
      setSectionActiveSubjects([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const response = await API.get(`/academics/sections/${focusSectionId}/active-subjects`);
        if (!cancelled) {
          setSectionActiveSubjects(response.data?.data || []);
        }
      } catch (requestError) {
        if (!cancelled) {
          setSectionActiveSubjects([]);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [focusSectionId]);

  const sectionUnassignedSubjectIds = useMemo(() => (
    new Set(
      sectionActiveSubjects
        .filter((entry) => entry.isUnassigned)
        .map((entry) => String(entry.subject?._id || ''))
        .filter(Boolean)
    )
  ), [sectionActiveSubjects]);

  const scopedPrograms = useMemo(() => (
    (workspace.programs || []).filter((program) => (
      !form.department || String(program.department?._id || program.department) === String(form.department)
    ))
  ), [form.department, workspace.programs]);

  const scopedSessions = useMemo(() => (
    (workspace.academicSessions || []).filter((session) => (
      !form.program || String(session.program?._id || session.program) === String(form.program)
    ))
  ), [form.program, workspace.academicSessions]);

  const scopedCourses = useMemo(() => (
    (workspace.courses || []).filter((course) => {
      if (form.department && String(course.department?._id || course.department) !== String(form.department)) return false;
      if (form.program && String(course.program?._id || course.program) !== String(form.program)) return false;
      return true;
    })
  ), [form.department, form.program, workspace.courses]);

  const filteredSubjects = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return (workspace.subjects || []).filter((subject) => {
      if (selectedSection?.course && !subjectMatchesCourse(subject, selectedSection.course?._id || selectedSection.course)) return false;
      if (selectedSection?.program && String(subject.program?._id || subject.program) !== String(selectedSection.program?._id || selectedSection.program)) return false;
      if (filters.departmentId && String(subject.department?._id || subject.department) !== String(filters.departmentId)) return false;
      if (filters.programId && String(subject.program?._id || subject.program) !== String(filters.programId)) return false;
      if (filters.courseId && !subjectMatchesCourse(subject, filters.courseId)) return false;
      if (filters.teacherId && !(subject.teachers || []).some((teacher) => String(teacher._id) === String(filters.teacherId))) return false;
      return matchesSubject(subject, normalizedQuery);
    });
  }, [filters.courseId, filters.departmentId, filters.programId, filters.teacherId, query, selectedSection, workspace.subjects]);

  const groupedSubjects = useMemo(() => {
    const groups = new Map();
    filteredSubjects.forEach((subject) => {
      const groupLabel = subject.courses?.length
        ? `${subject.program?.name || 'Program'} · ${subject.courses[0]?.name || 'Course'}`
        : `${subject.program?.name || 'Program'} · Unlinked Subjects`;
      const rows = groups.get(groupLabel) || [];
      rows.push(subject);
      groups.set(groupLabel, rows);
    });
    return [...groups.entries()];
  }, [filteredSubjects]);

  const handleCourseSelection = (event) => {
    setForm((current) => ({
      ...current,
      courseIds: [...event.target.selectedOptions].map((option) => option.value),
    }));
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    if (!form.courseIds.length) {
      setError('Select at least one course before creating a subject.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await API.post('/academics/subjects', form);
      toast.success('Subject created');
      setForm(defaultForm);
      await loadWorkspace();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to create subject');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSubject = async (subject) => {
    if (!subject?._id) return;
    const confirmed = window.confirm(`Delete ${subject.name || 'this subject'}? This removes its course links and teacher assignments.`);
    if (!confirmed) return;

    setDeletingId(subject._id);
    setError('');
    try {
      await API.delete(`/academics/subjects/${subject._id}`);
      toast.success('Subject deleted');
      await loadWorkspace();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to delete subject');
    } finally {
      setDeletingId('');
    }
  };

  if (loading) return <FullPageSpinner />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subject Directory"
        description="Create reusable subjects once, link them to one or more courses, and manage teacher ownership from a single academic workspace."
        meta={[
          `${(workspace.subjects || []).length} subjects`,
          `${(workspace.courses || []).length} courses`,
          selectedSection?.name ? `Focused on Section ${selectedSection.name}` : 'All hierarchy contexts',
        ]}
        action={(
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => navigate('/academics')} className="btn-secondary">
              <FiArrowLeft size={15} />
              Back to Planning
            </button>
            <button type="button" onClick={loadWorkspace} className="btn-secondary">
              <FiRefreshCw size={15} />
              Refresh
            </button>
          </div>
        )}
      />

      {error ? <Alert type="error" message={error} /> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1.85fr)]">
        <div className="card p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold text-gray-900">Create Reusable Subject</h2>
              <p className="mt-1 text-sm text-gray-500">Subjects are created independently, then shared across as many matching courses as needed.</p>
            </div>
            <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
              <FiPlus size={18} />
            </div>
          </div>

          <form onSubmit={handleCreate} className="mt-5 space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <input className="input" placeholder="Subject code" value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} required />
              <input className="input" placeholder="Subject name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <select className="input" value={form.department} onChange={(event) => setForm((current) => ({ ...current, department: event.target.value, program: '', academicSession: '', courseIds: [] }))} required>
                <option value="">Select department</option>
                {(workspace.departments || []).map((department) => (
                  <option key={department._id} value={department._id}>{department.name}</option>
                ))}
              </select>
              <select className="input" value={form.program} onChange={(event) => setForm((current) => ({ ...current, program: event.target.value, academicSession: '', courseIds: [] }))} required>
                <option value="">Select program</option>
                {scopedPrograms.map((program) => (
                  <option key={program._id} value={program._id}>{program.name}</option>
                ))}
              </select>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <select className="input" value={form.academicSession} onChange={(event) => setForm((current) => ({ ...current, academicSession: event.target.value }))} required>
                <option value="">Select academic session</option>
                {scopedSessions.map((session) => (
                  <option key={session._id} value={session._id}>{session.label} · Year {session.yearNumber}</option>
                ))}
              </select>
              <input
                className="input"
                type="number"
                min="1"
                max="12"
                placeholder="Term / Semester"
                value={form.term}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setForm((current) => ({
                    ...current,
                    term: Number.isFinite(next) && next >= 1 && next <= 12 ? next : 1,
                  }));
                }}
                required
              />
              <input className="input" type="number" min="0" placeholder="Credits" value={form.credits} onChange={(event) => setForm((current) => ({ ...current, credits: Number(event.target.value) || 0 }))} />
            </div>

            <label className="block">
              <span className="label">Linked courses</span>
              <select className="input min-h-[11rem]" multiple value={form.courseIds} onChange={handleCourseSelection} required>
                {scopedCourses.map((course) => (
                  <option key={course._id} value={course._id}>{course.name} ({course.code})</option>
                ))}
              </select>
            </label>

            <button type="submit" disabled={saving} className="btn-primary justify-center">
              {saving ? 'Creating...' : 'Create Subject'}
            </button>
          </form>
        </div>

        <div className="card p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display text-lg font-bold text-gray-900">Subject and Faculty Directory</h2>
              <p className="mt-1 text-sm text-gray-500">Browse the reusable subject catalog by hierarchy context, then filter by person or structure to see exactly who teaches what.</p>
            </div>
            <div className="relative w-full sm:max-w-xs">
              <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
              <input className="input pl-10" placeholder="Search subjects" value={query} onChange={(event) => setQuery(event.target.value)} />
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <select className="input" value={filters.departmentId} onChange={(event) => setFilters((current) => ({ ...current, departmentId: event.target.value, programId: '', courseId: '' }))}>
              <option value="">All departments</option>
              {(workspace.departments || []).map((department) => (
                <option key={department._id} value={department._id}>{department.name}</option>
              ))}
            </select>
            <select className="input" value={filters.programId} onChange={(event) => setFilters((current) => ({ ...current, programId: event.target.value, courseId: '' }))}>
              <option value="">All programs</option>
              {(workspace.programs || []).filter((program) => (
                !filters.departmentId || String(program.department?._id || program.department) === String(filters.departmentId)
              )).map((program) => (
                <option key={program._id} value={program._id}>{program.name}</option>
              ))}
            </select>
            <select className="input" value={filters.courseId} onChange={(event) => setFilters((current) => ({ ...current, courseId: event.target.value }))}>
              <option value="">All courses</option>
              {(workspace.courses || []).filter((course) => {
                if (filters.departmentId && String(course.department?._id || course.department) !== String(filters.departmentId)) return false;
                if (filters.programId && String(course.program?._id || course.program) !== String(filters.programId)) return false;
                return true;
              }).map((course) => (
                <option key={course._id} value={course._id}>{course.name}</option>
              ))}
            </select>
            <select className="input" value={filters.teacherId} onChange={(event) => setFilters((current) => ({ ...current, teacherId: event.target.value }))}>
              <option value="">All personnel</option>
              {(workspace.faculty || []).map((teacher) => (
                <option key={teacher._id} value={teacher._id}>{teacher.name}</option>
              ))}
            </select>
          </div>

          {selectedSection ? (
            <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
              Section focus is active for {selectedSection.name}. Only subjects inherited from {selectedSection.course?.name || 'the linked course'} are shown here.
            </div>
          ) : null}

          {groupedSubjects.length ? (
            <div className="mt-5 space-y-5">
              {groupedSubjects.map(([groupLabel, subjects]) => (
                <div key={groupLabel} className="rounded-2xl border border-slate-200">
                  <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-800">{groupLabel}</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                      <thead>
                        <tr className="text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                          <th className="px-4 py-3">Subject</th>
                          <th className="px-4 py-3">Session</th>
                          <th className="px-4 py-3">Courses</th>
                          <th className="px-4 py-3">Teachers</th>
                          <th className="px-4 py-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {subjects.map((subject) => (
                          <tr key={subject._id}>
                            <td className="px-4 py-4">
                              <div className="flex items-start gap-3">
                                <div className="rounded-2xl bg-slate-100 p-2 text-slate-700">
                                  <FiBookOpen size={16} />
                                </div>
                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="font-semibold text-gray-900">{subject.name}</p>
                                    {Number.isFinite(subject.term) ? (
                                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                                        Sem {subject.term}
                                      </span>
                                    ) : null}
                                    {selectedSection && sectionUnassignedSubjectIds.has(String(subject._id)) ? (
                                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                                        Faculty not assigned
                                      </span>
                                    ) : null}
                                  </div>
                                  <p className="mt-1 text-xs text-gray-500">{subject.code} · {subject.credits ?? 0} credits</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-sm text-gray-600">{subject.academicSession?.label || '—'}</td>
                            <td className="px-4 py-4">
                              <div className="flex flex-wrap gap-2">
                                {(subject.courses || []).length ? subject.courses.map((course) => (
                                  <span key={course._id} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
                                    {course.name}
                                  </span>
                                )) : <span className="text-sm text-gray-400">No courses linked</span>}
                              </div>
                            </td>
                            <td className="px-4 py-4 text-sm text-gray-600">
                              {(subject.teachers || []).length ? (
                                <div className="flex flex-wrap gap-2">
                                  {subject.teachers.map((teacher) => (
                                    <span key={teacher._id} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
                                      {teacher.name}
                                    </span>
                                  ))}
                                </div>
                              ) : 'No general teachers'}
                            </td>
                            <td className="px-4 py-4 text-right">
                              <div className="flex justify-end gap-2">
                                <button type="button" onClick={() => navigate(`/academics/subjects/${subject._id}`)} className="btn-secondary text-xs">
                                  Open Subject
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSubject(subject)}
                                  disabled={deletingId === subject._id}
                                  className="btn-secondary text-xs text-red-600 hover:text-red-700"
                                >
                                  <FiTrash2 size={14} />
                                  {deletingId === subject._id ? 'Deleting...' : 'Delete'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-5">
              <EmptyState
                icon="📚"
                title="No subjects found"
                description="Create the first reusable subject or adjust your search and section filters."
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
