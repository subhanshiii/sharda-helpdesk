import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import API from '../../utils/api';
import { Alert } from '../ui';
import AcademicScopeFilters from './AcademicScopeFilters';
import {
  buildDepartmentCollegeMap,
  emptyAcademicScopeFilters,
  filterSectionsByScope,
  subjectMatchesCourse,
} from '../../utils/academicScope';
import { isAdminUser, resolveEffectiveAdminTier } from '../../utils/access';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const defaultForm = {
  title: '',
  subjectId: '',
  sectionId: '',
  dayOfWeek: 'Monday',
  startTime: '09:00',
  endTime: '10:00',
  room: '',
  notes: '',
  isActive: true,
  faculty: '',
  teachingAssignmentId: '',
  subject: '',
  subjectCode: '',
  department: '',
  year: '',
  section: '',
};

export default function TimetableEntryForm({
  item,
  user,
  prefilledSectionId = '',
  prefilledSubjectId = '',
  sections,
  subjects,
  teachingAssignments = [],
  colleges,
  departments,
  programs,
  courses,
  onSaved,
  onCancel,
}) {
  const [form, setForm] = useState(() => ({
    ...defaultForm,
    department: user?.department || '',
    year: user?.year || '',
    section: user?.section || '',
    ...(item || {}),
    sectionId: item?.sectionId?._id || item?.sectionId || item?.sectionId || '',
    subjectId: item?.subjectId?._id || item?.subjectId || '',
    faculty: item?.faculty?._id || item?.faculty || '',
    teachingAssignmentId: item?.teachingAssignmentId?._id || item?.teachingAssignmentId || '',
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState(emptyAcademicScopeFilters);
  const departmentCollegeMap = useMemo(() => buildDepartmentCollegeMap(departments), [departments]);
  const scopedSections = useMemo(() => filterSectionsByScope(sections, filters, departmentCollegeMap), [departmentCollegeMap, filters, sections]);
  const canSelectFaculty = useMemo(
    () => Boolean(isAdminUser(user) || resolveEffectiveAdminTier(user?.role, user?.adminTier)),
    [user]
  );
  const scopedSubjects = useMemo(() => {
    const subjectsForSection = form.sectionId
      ? teachingAssignments
        .filter((assignment) => String(assignment.section?._id || assignment.section) === String(form.sectionId))
        .map((assignment) => assignment.subject)
        .filter(Boolean)
      : subjects;

    const uniqueSubjects = Array.from(new Map(subjectsForSection.map((subject) => [String(subject._id), subject])).values());
    return uniqueSubjects.filter((subject) => {
      if (filters.departmentId && String(subject.department?._id || subject.department) !== String(filters.departmentId)) return false;
      if (filters.programId && String(subject.program?._id || subject.program) !== String(filters.programId)) return false;
      if (filters.courseId && !subjectMatchesCourse(subject, filters.courseId)) return false;
      return true;
    });
  }, [filters, form.sectionId, subjects, teachingAssignments]);

  const eligibleTeachingAssignments = useMemo(() => teachingAssignments.filter((assignment) => (
    String(assignment.section?._id || assignment.section) === String(form.sectionId)
    && String(assignment.subject?._id || assignment.subject) === String(form.subjectId)
  )), [form.sectionId, form.subjectId, teachingAssignments]);

  const facultyOptions = useMemo(() => Array.from(new Map(
    eligibleTeachingAssignments
      .map((assignment) => assignment.teacher)
      .filter(Boolean)
      .map((teacher) => [String(teacher._id), teacher])
  ).values()), [eligibleTeachingAssignments]);

  useEffect(() => {
    if (!form.sectionId) return;
    const existingSection = sections.find((section) => String(section._id) === String(form.sectionId));
    if (!existingSection) return;

    setFilters((current) => ({
      ...current,
      departmentId: String(existingSection.department?._id || existingSection.department || ''),
      programId: String(existingSection.program?._id || existingSection.program || ''),
      courseId: String(existingSection.course?._id || existingSection.course || ''),
      studyYear: String(existingSection.studyYear || existingSection.academicSession?.yearNumber || ''),
      collegeId: departmentCollegeMap.get(String(existingSection.department?._id || existingSection.department || '')) || '',
      sectionId: String(existingSection._id),
    }));
  }, [departmentCollegeMap, form.sectionId, sections]);

  useEffect(() => {
    if (!eligibleTeachingAssignments.length) {
      setForm((current) => ({ ...current, faculty: '', teachingAssignmentId: '' }));
      return;
    }

    if (eligibleTeachingAssignments.length === 1) {
      const [assignment] = eligibleTeachingAssignments;
      setForm((current) => ({
        ...current,
        faculty: assignment.teacher?._id || assignment.teacher || '',
        teachingAssignmentId: assignment._id || '',
      }));
      return;
    }

    const currentFacultyStillValid = facultyOptions.some((teacher) => String(teacher._id) === String(form.faculty));
    const facultyScopedAssignments = eligibleTeachingAssignments.filter(
      (assignment) => String(assignment.teacher?._id || assignment.teacher) === String(user?.id || user?._id)
    );

    if (!canSelectFaculty && facultyScopedAssignments.length === 1) {
      const [assignment] = facultyScopedAssignments;
      setForm((current) => {
        const nextFaculty = assignment.teacher?._id || assignment.teacher || '';
        const nextAssignmentId = assignment._id || '';
        if (String(current.faculty) === String(nextFaculty)
          && String(current.teachingAssignmentId) === String(nextAssignmentId)) {
          return current;
        }
        return {
          ...current,
          faculty: nextFaculty,
          teachingAssignmentId: nextAssignmentId,
        };
      });
      return;
    }

    setForm((current) => {
      const nextFaculty = currentFacultyStillValid ? current.faculty : '';
      if (!current.teachingAssignmentId && String(nextFaculty) === String(current.faculty)) {
        return current;
      }
      return {
        ...current,
        teachingAssignmentId: '',
        faculty: nextFaculty,
      };
    });
  }, [canSelectFaculty, eligibleTeachingAssignments, facultyOptions, form.faculty, user?.id, user?._id]);

  const handleSectionChange = useCallback((sectionId) => {
    const selectedSection = sections.find((section) => String(section._id) === String(sectionId));
    setFilters((current) => ({ ...current, sectionId }));
    setForm((current) => ({
      ...current,
      sectionId,
      section: selectedSection?.name || '',
      department: selectedSection?.department?.name || current.department,
      year: String(selectedSection?.studyYear || selectedSection?.academicSession?.yearNumber || current.year || ''),
      subjectId: '',
      subject: '',
      subjectCode: '',
      faculty: '',
      teachingAssignmentId: '',
    }));
  }, [sections]);

  const handleSubjectChange = useCallback((subjectId) => {
    const selectedSubject = subjects.find((subject) => String(subject._id) === String(subjectId));
    setForm((current) => ({
      ...current,
      subjectId,
      subject: selectedSubject?.name || '',
      subjectCode: selectedSubject?.code || '',
      faculty: '',
      teachingAssignmentId: '',
    }));
  }, [subjects]);

  useEffect(() => {
    if (item?._id || !prefilledSectionId || form.sectionId || !sections.length) return;
    const selectedSection = sections.find((section) => String(section._id) === String(prefilledSectionId));
    if (!selectedSection) return;
    handleSectionChange(String(selectedSection._id));
  }, [form.sectionId, handleSectionChange, item?._id, prefilledSectionId, sections]);

  useEffect(() => {
    if (item?._id || !prefilledSubjectId || !form.sectionId || form.subjectId) return;
    const selectedSubject = subjects.find((subject) => String(subject._id) === String(prefilledSubjectId));
    if (!selectedSubject) return;
    handleSubjectChange(String(selectedSubject._id));
  }, [form.sectionId, form.subjectId, handleSubjectChange, item?._id, prefilledSubjectId, subjects]);

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
    if (!form.title.trim() || !form.sectionId) {
      setError('Title and section are required.');
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
        subjectCode: form.subjectCode,
        department: form.department,
        year: form.year,
        section: form.section,
        dayOfWeek: form.dayOfWeek,
        startTime: form.startTime,
        endTime: form.endTime,
        room: form.room,
        notes: form.notes,
        isActive: form.isActive,
        faculty: form.faculty || null,
        teachingAssignmentId: form.teachingAssignmentId || null,
      };

      if (item?._id) {
        await API.put(`/academics/timetable/${item._id}`, payload);
      } else {
        await API.post('/academics/timetable', payload);
      }

      toast.success(`Timetable entry ${item?._id ? 'updated' : 'created'}`);
      onSaved?.();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to save timetable entry.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error ? <Alert type="error" message={error} /> : null}

      <div className="card p-5">
        <AcademicScopeFilters
          filters={filters}
          onChange={handleScopeChange}
          options={{ colleges, departments, programs, courses, sections }}
          departmentCollegeMap={departmentCollegeMap}
        />
      </div>

      <div className="card p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label">Title *</label>
            <input
              className="input"
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="Database Systems Lecture"
              required
            />
          </div>
          <div>
            <label className="label">Section *</label>
            <select className="input" value={form.sectionId} onChange={(event) => handleSectionChange(event.target.value)} required>
              <option value="">Select a section</option>
              {scopedSections.map((section) => (
                <option key={section._id} value={section._id}>
                  {[
                    section.department?.name,
                    section.program?.name,
                    section.course?.name,
                    section.studyYear ? `Year ${section.studyYear}` : null,
                    section.name ? `Section ${section.name}` : null,
                  ].filter(Boolean).join(' · ')}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="label">Subject</label>
            <select className="input" value={form.subjectId} onChange={(event) => handleSubjectChange(event.target.value)}>
              <option value="">No specific subject</option>
              {scopedSubjects.map((subject) => (
                <option key={subject._id} value={subject._id}>
                  {subject.name} ({subject.code || '—'})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Room</label>
            <input className="input" value={form.room} onChange={(event) => setForm((current) => ({ ...current, room: event.target.value }))} placeholder="Lab 204" />
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
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

        <div className="mt-4">
          <label className="label">Notes</label>
          <input className="input" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Lab assignments, laptops required, etc." />
        </div>

        {(canSelectFaculty || eligibleTeachingAssignments.length > 1) ? (
          <div className="mt-4">
            <label className="label">Assigned Faculty</label>
            <select
              className="input"
              value={form.faculty || ''}
              onChange={(event) => {
                const nextFacultyId = event.target.value;
                const matchedAssignment = eligibleTeachingAssignments.find((assignment) => String(assignment.teacher?._id || assignment.teacher) === String(nextFacultyId));
                setForm((current) => ({
                  ...current,
                  faculty: nextFacultyId,
                  teachingAssignmentId: matchedAssignment?._id || '',
                }));
              }}
              disabled={Boolean(form.subjectId) && !facultyOptions.length}
            >
              <option value="">{form.subjectId ? 'Select linked teacher' : 'Select subject first'}</option>
              {facultyOptions.map((faculty) => (
                <option key={faculty._id} value={faculty._id}>
                  {faculty.name} {faculty.department ? `· ${faculty.department}` : ''}
                </option>
              ))}
            </select>
            {form.subjectId ? <p className="mt-2 text-xs text-slate-500">Only teachers linked to this section and subject are available.</p> : null}
          </div>
        ) : null}

        <div className="mt-6 flex gap-3">
          <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
            {saving ? 'Saving...' : item?._id ? 'Save Changes' : 'Create Slot'}
          </button>
          <button type="button" onClick={onCancel} className="btn-secondary">
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}
