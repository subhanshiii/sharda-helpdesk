import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiCalendar, FiCheckCircle, FiUsers } from 'react-icons/fi';
import API from '../utils/api';
import { Alert, PageHeader } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import AcademicScopeFilters from '../components/academics/AcademicScopeFilters';
import {
  buildDepartmentCollegeMap,
  emptyAcademicScopeFilters,
  filterSectionsByScope
} from '../utils/academicScope';

const STATUS_OPTIONS = ['present', 'absent'];

export default function CreateAttendancePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isEdit = Boolean(id);
  const prefilledSectionId = searchParams.get('sectionId') || '';
  const prefilledSubjectId = searchParams.get('subjectId') || '';
  const prefilledTeachingAssignmentId = searchParams.get('teachingAssignmentId') || '';
  const prefilledDate = searchParams.get('date') || new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState({
    title: '',
    subjectId: '',
    sectionId: '',
    teachingAssignmentId: '',
    date: prefilledDate,
    topic: '',
    records: [],
    // Fallback for backward compatibility
    subject: '',
    department: user?.department || '',
    year: user?.year || '',
    section: user?.section || '',
  });
  
  const [sections, setSections] = useState([]);
  const [teachingAssignments, setTeachingAssignments] = useState([]);
  const [activeSectionSubjects, setActiveSectionSubjects] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [courses, setCourses] = useState([]);
  const [filters, setFilters] = useState(emptyAcademicScopeFilters);
  const [students, setStudents] = useState([]);
  const [loadingPage, setLoadingPage] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loadingSectionData, setLoadingSectionData] = useState(false);

  // Load sections on mount for the dropdown
  useEffect(() => {
    const loadSections = async () => {
      try {
        const [collegesRes, departmentsRes, programsRes, coursesRes, sectionsRes, teachingAssignmentsRes] = await Promise.all([
          API.get('/academics/colleges?paginate=false'),
          API.get('/academics/departments?paginate=false'),
          API.get('/academics/programs?paginate=false'),
          API.get('/academics/courses?paginate=false'),
          API.get('/academics/sections?paginate=false'),
          API.get('/academics/teaching-assignments'),
        ]);
        setColleges(Array.isArray(collegesRes.data?.data) ? collegesRes.data.data : []);
        setDepartments(Array.isArray(departmentsRes.data?.data) ? departmentsRes.data.data : []);
        setPrograms(Array.isArray(programsRes.data?.data) ? programsRes.data.data : []);
        setCourses(Array.isArray(coursesRes.data?.data) ? coursesRes.data.data : []);
        setSections(Array.isArray(sectionsRes.data?.data) ? sectionsRes.data.data : []);
        setTeachingAssignments(Array.isArray(teachingAssignmentsRes.data?.data) ? teachingAssignmentsRes.data.data : []);
      } catch (requestError) {
        setColleges([]);
        setDepartments([]);
        setPrograms([]);
        setCourses([]);
        setSections([]);
        setTeachingAssignments([]);
      }
    };
    loadSections();
  }, []);

  const departmentCollegeMap = useMemo(() => buildDepartmentCollegeMap(departments), [departments]);
  const scopedSections = useMemo(
    () => filterSectionsByScope(sections, filters, departmentCollegeMap),
    [sections, filters, departmentCollegeMap]
  );
  const scopedSubjects = useMemo(() => activeSectionSubjects
    .map((entry) => entry?.subject)
    .filter(Boolean), [activeSectionSubjects]);

  const eligibleTeachingAssignments = useMemo(() => teachingAssignments.filter((assignment) => (
    String(assignment.section?._id || assignment.section) === String(form.sectionId)
    && String(assignment.subject?._id || assignment.subject) === String(form.subjectId)
  )), [form.sectionId, form.subjectId, teachingAssignments]);

  const teachingAssignmentOptions = useMemo(() => eligibleTeachingAssignments.map((assignment) => ({
    _id: assignment._id,
    label: `${assignment.subject?.name || 'Subject'} (${assignment.subject?.code || '—'}) · ${assignment.teacher?.name || 'Unassigned faculty'}`,
    teacherId: assignment.teacher?._id || assignment.teacher || '',
    subjectName: assignment.subject?.name || '',
  })), [eligibleTeachingAssignments]);

  useEffect(() => {
    if (!form.sectionId) {
      setActiveSectionSubjects([]);
      return;
    }

    let active = true;
    API.get(`/academics/sections/${form.sectionId}/active-subjects`)
      .then((response) => {
        if (!active) return;
        setActiveSectionSubjects(Array.isArray(response.data?.data) ? response.data.data : []);
      })
      .catch(() => {
        if (!active) return;
        setActiveSectionSubjects([]);
      });

    return () => {
      active = false;
    };
  }, [form.sectionId]);

  const loadStudents = useCallback(async (sectionId) => {
    if (!sectionId) {
      setStudents([]);
      setForm((current) => ({ ...current, records: [] }));
      return;
    }

    setLoadingSectionData(true);
    try {
      // Get students enrolled in this section
      const res = await API.get(`/academics/enrollments?section=${sectionId}&status=active`);
      const roster = (res.data?.data || []).map((enrollment) => enrollment.student).filter(Boolean);
      setStudents(roster);
      setForm((current) => ({
        ...current,
        records: roster.map((student) => {
          const existingRecord = current.records.find((record) => String(record.student) === String(student._id));
          return existingRecord || { student: student._id, status: 'present' };
        }),
      }));
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to load students.');
      setStudents([]);
      setForm((current) => ({ ...current, records: [] }));
    } finally {
      setLoadingSectionData(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    const bootstrap = async () => {
      if (isEdit) {
        try {
          const res = await API.get('/academics/attendance', {
            signal: controller.signal,
          });
          const sessions = res.data?.data || [];
          const item = sessions.find((entry) => entry._id === id);
          if (!active) return;
          if (!item) {
            setError('Attendance session not found.');
            setLoadingPage(false);
            return;
          }
          setForm((current) => ({
            ...current,
            title: item.title || '',
            subjectId: item.subjectId?._id || item.subjectId || '',
            sectionId: item.sectionId?._id || item.sectionId || '',
            teachingAssignmentId: item.teachingAssignmentId?._id || item.teachingAssignmentId || '',
            subject: item.subject || '',
            department: item.department || user?.department || '',
            year: item.year || user?.year || '',
            section: item.section || user?.section || '',
            date: item.date ? new Date(item.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
            topic: item.topic || '',
            records: [],
          }));
          // If editing, load students for that section
          if (item.sectionId) {
            await loadStudents(item.sectionId?._id || item.sectionId);
          } else {
            // Fallback: try loading by section string if no sectionId
            const matchedSection = sections.find((s) => s.name === item.section);
            if (matchedSection) {
              await loadStudents(matchedSection._id);
            }
          }
        } catch (requestError) {
          if (active && !controller.signal.aborted) {
            setError(requestError.response?.data?.message || 'Failed to load attendance.');
          }
        } finally {
          if (active) setLoadingPage(false);
        }
      }
    };

    bootstrap();

    return () => {
      active = false;
      controller.abort();
    };
  }, [id, isEdit, loadStudents, sections, user?.department, user?.section, user?.year]);

  useEffect(() => {
    if (isEdit || !sections.length) return;
    if (!prefilledSectionId) return;

    const selectedSection = sections.find((section) => String(section._id) === String(prefilledSectionId));
    if (!selectedSection) return;

    setFilters((current) => ({
      ...current,
      collegeId: departmentCollegeMap.get(String(selectedSection.department?._id || selectedSection.department || '')) || '',
      departmentId: String(selectedSection.department?._id || selectedSection.department || ''),
      programId: String(selectedSection.program?._id || selectedSection.program || ''),
      courseId: String(selectedSection.course?._id || selectedSection.course || ''),
      studyYear: String(selectedSection.studyYear || selectedSection.academicSession?.yearNumber || ''),
      sectionId: String(selectedSection._id),
    }));

    setForm((current) => ({
      ...current,
      sectionId: String(selectedSection._id),
      section: selectedSection.name || '',
      department: selectedSection.department?.name || current.department,
      year: String(selectedSection.studyYear || selectedSection.academicSession?.yearNumber || current.year || ''),
      date: prefilledDate,
    }));

    loadStudents(String(selectedSection._id));
  }, [departmentCollegeMap, isEdit, loadStudents, prefilledDate, prefilledSectionId, sections]);

  useEffect(() => {
    if (isEdit || !prefilledSubjectId || !form.sectionId) return;
    if (!scopedSubjects.length) return;
    const selectedSubject = scopedSubjects.find((subject) => String(subject._id) === String(prefilledSubjectId));
    if (!selectedSubject) return;

    const matchedAssignments = teachingAssignments.filter((assignment) => (
      String(assignment.section?._id || assignment.section) === String(form.sectionId)
      && String(assignment.subject?._id || assignment.subject) === String(prefilledSubjectId)
    ));

    setForm((current) => ({
      ...current,
      subjectId: String(selectedSubject._id),
      subject: selectedSubject.name || '',
      teachingAssignmentId: prefilledTeachingAssignmentId
        || (matchedAssignments.length === 1 ? matchedAssignments[0]._id : current.teachingAssignmentId),
      title: current.title || `${selectedSubject.name} Attendance`,
    }));
  }, [form.sectionId, isEdit, prefilledSubjectId, prefilledTeachingAssignmentId, scopedSubjects, teachingAssignments]);

  const handleSectionChange = (sectionId) => {
    const selectedSection = sections.find((s) => s._id === sectionId);
    setFilters((current) => ({ ...current, sectionId }));
    setForm((current) => ({
      ...current,
      sectionId,
      section: selectedSection?.name || '',
      department: selectedSection?.department?.name || current.department,
      subjectId: '',
      subject: '',
      teachingAssignmentId: '',
    }));
    setError('');
    loadStudents(sectionId);
  };

  const updateRecordStatus = (studentId, status) => {
    setError('');
    setForm((current) => ({
      ...current,
      records: current.records.map((entry) => (
        String(entry.student) === String(studentId) ? { ...entry, status } : entry
      )),
    }));
  };

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

  const handleSubmit = async (event) => {
    event.preventDefault();
    
    // Validate required fields
    if (!form.title.trim() || !form.sectionId) {
      setError('Title and section are required.');
      return;
    }
    
    // Validate form.records is not empty
    if (!Array.isArray(form.records) || form.records.length === 0) {
      setError('Must have at least one student record.');
      return;
    }
    
    // Validate date is not in the past (optional but good practice)
    const selectedDate = new Date(form.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selectedDate < today && !isEdit) {
      setError('Cannot create attendance for past dates.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const payload = {
        title: form.title,
        subjectId: form.subjectId || null,
        teachingAssignmentId: form.teachingAssignmentId || null,
        sectionId: form.sectionId,
        subject: form.subject,
        department: form.department,
        year: form.year,
        section: form.section,
        date: form.date,
        topic: form.topic,
        records: form.records,
      };

      if (isEdit) {
        await API.put(`/academics/attendance/${id}`, payload);
      } else {
        await API.post('/academics/attendance', payload);
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
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={isEdit ? 'Update Attendance' : 'Mark Attendance'}
        subtitle="Review the selected section and subject, then mark each student from the vertical roster below."
      />

      <div className="card p-6">
        {error ? <div className="mb-4"><Alert type="error" message={error} /></div> : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_240px]">
            <div className="rounded-3xl border border-[var(--border-strong)] bg-[var(--surface-soft)] p-4">
              <AcademicScopeFilters
                filters={filters}
                onChange={handleScopeChange}
                options={{ colleges, departments, programs, courses, sections }}
                departmentCollegeMap={departmentCollegeMap}
                singleLine
              />
            </div>
            <div className="grid gap-3">
              <div className="rounded-3xl border border-[var(--border-strong)] bg-[var(--surface-soft)] px-4 py-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-main)]">
                  <FiUsers size={15} />
                  Roster
                </div>
                <p className="mt-2 text-2xl font-black text-[var(--text-strong)]">{form.records.length}</p>
                <p className="text-sm text-[var(--text-muted)]">Students loaded for this section.</p>
              </div>
              <div className="rounded-3xl border border-[var(--border-strong)] bg-[var(--surface-soft)] px-4 py-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-main)]">
                  <FiCheckCircle size={15} />
                  Present by Default
                </div>
                <p className="mt-2 text-sm text-[var(--text-muted)]">Everyone starts as present. Switch only absences.</p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="title" className="label">Title</label>
              <input id="title" className="input" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="DBMS Lecture Attendance" maxLength={160} />
            </div>
            <div>
              <label htmlFor="date" className="label">Date</label>
              <input id="date" type="date" className="input" value={form.date} onChange={(event) => { setError(''); setForm((current) => ({ ...current, date: event.target.value })); }} />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="section" className="label">Section *</label>
              <select id="section" className="input" value={form.sectionId} onChange={(event) => handleSectionChange(event.target.value)} required>
                <option value="">Select a section</option>
                {scopedSections.map((section) => (
                  <option key={section._id} value={section._id}>
                    {section.name} ({section.program?.name || 'Program'}) - {section.academicSession?.label || 'Session'}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="subject" className="label">Subject (Optional)</label>
              <select id="subject" className="input" value={form.subjectId} onChange={(event) => {
                const selectedSubject = scopedSubjects.find((s) => s._id === event.target.value);
                const matchedTeachingAssignment = teachingAssignments.find((assignment) => (
                  String(assignment.section?._id || assignment.section) === String(form.sectionId)
                  && String(assignment.subject?._id || assignment.subject) === String(event.target.value)
                ));
                const matchedAssignments = teachingAssignments.filter((assignment) => (
                  String(assignment.section?._id || assignment.section) === String(form.sectionId)
                  && String(assignment.subject?._id || assignment.subject) === String(event.target.value)
                ));
                setForm((current) => ({
                  ...current,
                  subjectId: event.target.value,
                  subject: selectedSubject?.name || current.subject,
                  teachingAssignmentId: matchedAssignments.length === 1
                    ? matchedAssignments[0]._id
                    : matchedTeachingAssignment?._id || '',
                }));
                setError('');
              }}>
                <option value="">No specific subject</option>
                {scopedSubjects.map((subject) => (
                  <option key={subject._id} value={subject._id}>
                    {subject.name} ({subject.code})
                  </option>
                ))}
              </select>
            </div>
          </div>
          {form.subjectId && teachingAssignmentOptions.length > 1 ? (
            <div>
              <label htmlFor="teachingAssignment" className="label">Assigned Faculty *</label>
              <select
                id="teachingAssignment"
                className="input"
                value={form.teachingAssignmentId}
                onChange={(event) => {
                  const selectedAssignment = eligibleTeachingAssignments.find((assignment) => String(assignment._id) === String(event.target.value));
                  setForm((current) => ({
                    ...current,
                    teachingAssignmentId: event.target.value,
                    subject: selectedAssignment?.subject?.name || current.subject,
                  }));
                  setError('');
                }}
              >
                <option value="">Select linked faculty assignment</option>
                {teachingAssignmentOptions.map((option) => (
                  <option key={option._id} value={option._id}>{option.label}</option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label htmlFor="topic" className="label">Topic (Optional)</label>
              <input id="topic" className="input" value={form.topic} onChange={(event) => setForm((current) => ({ ...current, topic: event.target.value }))} placeholder="Normalization and joins" maxLength={255} />
            </div>
          </div>

          <div className="rounded-3xl border border-[var(--border-strong)]">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border-strong)] px-4 py-3">
              <div>
                <p className="font-semibold text-[var(--text-strong)]">Student Roster {loadingSectionData ? '(Loading...)' : `(${form.records.length} students)`}</p>
                <p className="mt-1 text-sm text-[var(--text-muted)]">Each student is listed vertically with a simple present or absent toggle.</p>
              </div>
              <div className="rounded-2xl bg-[var(--surface-soft)] px-3 py-2 text-sm font-semibold text-[var(--text-main)]">
                <FiCalendar className="mr-2 inline-flex" size={14} />
                {form.date}
              </div>
            </div>
            <div className="max-h-[520px] divide-y divide-[var(--border-strong)] overflow-y-auto">
              {form.records.length === 0 ? (
                <div className="p-5 text-center text-sm text-[var(--text-muted)]">
                  {loadingSectionData ? 'Loading roster...' : 'Select a section to load the student roster.'}
                </div>
              ) : form.records.map((record) => {
                const student = students.find((entry) => entry._id === record.student);
                return (
                  <div key={record.student} className="grid gap-3 px-4 py-4 md:grid-cols-[1fr_200px] md:items-center">
                    <div>
                      <p className="font-medium text-[var(--text-strong)]">{student?.name || 'Student'}</p>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">{student?.email || ''}</p>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <div className="inline-flex rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-card)] p-1">
                        {STATUS_OPTIONS.map((status) => (
                          <button
                            key={status}
                            type="button"
                            onClick={() => updateRecordStatus(record.student, status)}
                            className={`rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition ${record.status === status ? status === 'present' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white' : 'text-[var(--text-main)] hover:bg-[var(--surface-soft)]'}`}
                          >
                            {status}
                          </button>
                        ))}
                      </div>
                    </div>
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
