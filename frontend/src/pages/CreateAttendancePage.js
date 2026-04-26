import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import API from '../utils/api';
import { Alert, PageHeader } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import AcademicScopeFilters from '../components/academics/AcademicScopeFilters';
import {
  buildDepartmentCollegeMap,
  emptyAcademicScopeFilters,
  filterSectionsByScope,
} from '../utils/academicScope';

const STATUS_OPTIONS = ['present', 'absent', 'late', 'excused'];

export default function CreateAttendancePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [form, setForm] = useState({
    title: '',
    subjectId: '',
    sectionId: '',
    date: new Date().toISOString().slice(0, 10),
    topic: '',
    records: [],
    // Fallback for backward compatibility
    subject: '',
    department: user?.department || '',
    year: user?.year || '',
    section: user?.section || '',
  });
  
  const [sections, setSections] = useState([]);
  const [subjects, setSubjects] = useState([]);
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
        const [collegesRes, departmentsRes, programsRes, coursesRes, sectionsRes] = await Promise.all([
          API.get('/academics/colleges?paginate=false'),
          API.get('/academics/departments?paginate=false'),
          API.get('/academics/programs?paginate=false'),
          API.get('/academics/courses?paginate=false'),
          API.get('/academics/sections?paginate=false'),
        ]);
        setColleges(Array.isArray(collegesRes.data?.data) ? collegesRes.data.data : []);
        setDepartments(Array.isArray(departmentsRes.data?.data) ? departmentsRes.data.data : []);
        setPrograms(Array.isArray(programsRes.data?.data) ? programsRes.data.data : []);
        setCourses(Array.isArray(coursesRes.data?.data) ? coursesRes.data.data : []);
        setSections(Array.isArray(sectionsRes.data?.data) ? sectionsRes.data.data : []);
      } catch (requestError) {
        setColleges([]);
        setDepartments([]);
        setPrograms([]);
        setCourses([]);
        setSections([]);
      }
    };
    loadSections();
  }, []);

  const departmentCollegeMap = buildDepartmentCollegeMap(departments);
  const scopedSections = filterSectionsByScope(sections, filters, departmentCollegeMap);
  const scopedSubjects = subjects.filter((subject) => {
    if (filters.departmentId && String(subject.department?._id || subject.department) !== String(filters.departmentId)) return false;
    if (filters.programId && String(subject.program?._id || subject.program) !== String(filters.programId)) return false;
    if (filters.courseId && String(subject.course?._id || subject.course) !== String(filters.courseId)) return false;
    if (filters.studyYear && String(subject.academicSession?.yearNumber || '') !== String(filters.studyYear)) return false;
    return true;
  });

  // Load subjects on mount for the dropdown
  useEffect(() => {
    const loadSubjects = async () => {
      try {
        const res = await API.get('/academics/subjects');
        setSubjects(Array.isArray(res.data?.data) ? res.data.data : []);
      } catch (requestError) {
        setSubjects([]);
      }
    };
    loadSubjects();
  }, []);

  const loadStudents = async (sectionId) => {
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
        records: roster.map((student) => ({ student: student._id, status: 'present' })),
      }));
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to load students.');
      setStudents([]);
      setForm((current) => ({ ...current, records: [] }));
    } finally {
      setLoadingSectionData(false);
    }
  };

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
            subjectId: item.subjectId || '',
            sectionId: item.sectionId || '',
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
            await loadStudents(item.sectionId);
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
  }, [id, sections])

  const handleSectionChange = (sectionId) => {
    const selectedSection = sections.find((s) => s._id === sectionId);
    setFilters((current) => ({ ...current, sectionId }));
    setForm((current) => ({
      ...current,
      sectionId,
      section: selectedSection?.name || '',
      department: selectedSection?.department?.name || current.department,
    }));
    setError('');
    loadStudents(sectionId);
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
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={isEdit ? 'Update Attendance' : 'Mark Attendance'}
        subtitle="Capture section attendance from the academic structure, linked to real student enrollments."
      />

      <div className="card p-6">
        {error ? <div className="mb-4"><Alert type="error" message={error} /></div> : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <AcademicScopeFilters
            filters={filters}
            onChange={handleScopeChange}
            options={{ colleges, departments, programs, courses, sections }}
            departmentCollegeMap={departmentCollegeMap}
          />

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
                setForm((current) => ({
                  ...current,
                  subjectId: event.target.value,
                  subject: selectedSubject?.name || current.subject,
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

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label htmlFor="topic" className="label">Topic (Optional)</label>
              <input id="topic" className="input" value={form.topic} onChange={(event) => setForm((current) => ({ ...current, topic: event.target.value }))} placeholder="Normalization and joins" maxLength={255} />
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100">
            <div className="border-b border-gray-100 px-4 py-3">
              <p className="font-semibold text-gray-900">Student Roster {loadingSectionData ? '(Loading...)' : `(${form.records.length} students)`}</p>
            </div>
            <div className="max-h-[420px] divide-y divide-gray-100 overflow-y-auto">
              {form.records.length === 0 ? (
                <div className="p-5 text-center text-sm text-gray-400">
                  {loadingSectionData ? 'Loading roster...' : 'Select a section to load the student roster.'}
                </div>
              ) : form.records.map((record) => {
                const student = students.find((entry) => entry._id === record.student);
                const statusSelectId = `status-${record.student}`;
                return (
                  <div key={record.student} className="grid gap-3 px-4 py-3 md:grid-cols-[1fr_220px] md:items-center">
                    <div>
                      <p className="font-medium text-gray-900">{student?.name || 'Student'}</p>
                      <p className="mt-1 text-xs text-gray-500">{student?.email || ''}</p>
                    </div>
                    <select
                      id={statusSelectId}
                      className="input"
                      value={record.status}
                      aria-label={`Mark ${student?.name || 'Student'} as ${record.status}`}
                      onChange={(event) => {
                        setError('');
                        setForm((current) => ({
                          ...current,
                          records: current.records.map((entry) => (
                            entry.student === record.student ? { ...entry, status: event.target.value } : entry
                          )),
                        }));
                      }}
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
