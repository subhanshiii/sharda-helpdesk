import React, { useEffect, useMemo, useState } from 'react';
import { FiPlus, FiTrash2 } from 'react-icons/fi';

const ADVANCED_RESOURCES = [
  { key: 'subjects', label: 'Subjects', fields: ['code', 'name', 'department', 'program', 'course', 'academicSession', 'credits'] },
  { key: 'section-subjects', label: 'Teaching Assignments', fields: ['section', 'subject', 'faculty', 'semester'] },
  { key: 'enrollments', label: 'Enrollments', fields: ['student', 'section', 'academicSession', 'semester', 'status'] },
];

const ADVANCED_DEFAULT_FORMS = {
  subjects: { code: '', name: '', department: '', program: '', course: '', academicSession: '', credits: 0 },
  'section-subjects': { section: '', subject: '', faculty: '', semester: '' },
  enrollments: { student: '', section: '', academicSession: '', semester: '', status: 'active' },
};

const getFieldLabel = (field) => ({
  code: 'Code',
  name: 'Name',
  college: 'College',
  department: 'Department',
  durationYears: 'Duration (years)',
  program: 'Program',
  yearNumber: 'Study Year',
  label: 'Academic Session Label',
  academicSession: 'Academic Session',
  course: 'Course',
  capacity: 'Capacity',
  subject: 'Subject',
  faculty: 'Faculty',
  semester: 'Semester',
  student: 'Student',
  status: 'Status',
  credits: 'Credits',
}[field] || field);

const formatEntityName = (entity) => {
  if (!entity) return '—';
  if (entity.name && entity.code) return `${entity.name} (${entity.code})`;
  return entity.name || entity.label || entity.code || entity.email || entity.systemId || entity._id;
};

function AdvancedResourceSection({ resource, items, options, onCreate, onDelete }) {
  const [form, setForm] = useState(ADVANCED_DEFAULT_FORMS[resource.key]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setForm(ADVANCED_DEFAULT_FORMS[resource.key]);
    setError('');
  }, [resource.key]);

  const scopedDepartments = useMemo(() => (
    (options.departments || []).filter((department) => {
      if (!form.college) return true;
      return String(department.college?._id || department.college) === String(form.college);
    })
  ), [form.college, options.departments]);

  const scopedPrograms = useMemo(() => (
    (options.programs || []).filter((program) => {
      if (!form.department) return true;
      return String(program.department?._id || program.department) === String(form.department);
    })
  ), [form.department, options.programs]);

  const scopedCourses = useMemo(() => (
    (options.courses || []).filter((course) => {
      if (form.program && String(course.program?._id || course.program) !== String(form.program)) return false;
      if (form.department && String(course.department?._id || course.department) !== String(form.department)) return false;
      return true;
    })
  ), [form.department, form.program, options.courses]);

  const scopedSessions = useMemo(() => (
    (options.academicSessions || []).filter((session) => {
      if (!form.program) return true;
      return String(session.program?._id || session.program) === String(form.program);
    })
  ), [form.program, options.academicSessions]);

  const scopedSections = useMemo(() => (
    (options.sections || []).filter((section) => {
      if (form.department && String(section.department?._id || section.department) !== String(form.department)) return false;
      if (form.program && String(section.program?._id || section.program) !== String(form.program)) return false;
      if (form.course && String(section.course?._id || section.course) !== String(form.course)) return false;
      if (form.academicSession && String(section.academicSession?._id || section.academicSession) !== String(form.academicSession)) return false;
      return true;
    })
  ), [form.academicSession, form.course, form.department, form.program, options.sections]);

  const scopedSubjects = useMemo(() => (
    (options.subjects || []).filter((subject) => {
      if (form.department && String(subject.department?._id || subject.department) !== String(form.department)) return false;
      if (form.program && String(subject.program?._id || subject.program) !== String(form.program)) return false;
      if (form.course && String(subject.course?._id || subject.course) !== String(form.course)) return false;
      if (form.academicSession && String(subject.academicSession?._id || subject.academicSession) !== String(form.academicSession)) return false;
      return true;
    })
  ), [form.academicSession, form.course, form.department, form.program, options.subjects]);

  const scopedStudents = useMemo(() => (options.students || []), [options.students]);

  const fieldOptions = {
    college: options.colleges || [],
    department: scopedDepartments,
    program: scopedPrograms,
    course: scopedCourses,
    academicSession: scopedSessions,
    section: scopedSections,
    subject: scopedSubjects,
    faculty: options.faculty || [],
    student: scopedStudents,
  };

  const handleFieldChange = (field, value) => {
    setForm((current) => {
      const next = { ...current, [field]: value };

      if (field === 'department') {
        next.program = '';
        next.course = '';
        next.academicSession = '';
        if (resource.key === 'section-subjects') next.subject = '';
      }
      if (field === 'program') {
        next.course = '';
        next.academicSession = '';
        if (resource.key === 'section-subjects') {
          next.section = '';
          next.subject = '';
        }
      }
      if (field === 'course') {
        if (resource.key === 'section-subjects') {
          next.section = '';
          next.subject = '';
        }
      }
      if (field === 'academicSession' && resource.key === 'section-subjects') {
        next.section = '';
        next.subject = '';
      }
      if (field === 'section' && resource.key === 'section-subjects') {
        const selectedSection = (options.sections || []).find((section) => String(section._id) === String(value));
        next.department = selectedSection?.department?._id || selectedSection?.department || current.department;
        next.program = selectedSection?.program?._id || selectedSection?.program || current.program;
        next.course = selectedSection?.course?._id || selectedSection?.course || current.course;
        next.academicSession = selectedSection?.academicSession?._id || selectedSection?.academicSession || current.academicSession;
      }
      if (field === 'subject' && resource.key === 'section-subjects') {
        const selectedSubject = (options.subjects || []).find((subject) => String(subject._id) === String(value));
        next.department = selectedSubject?.department?._id || selectedSubject?.department || current.department;
        next.program = selectedSubject?.program?._id || selectedSubject?.program || current.program;
        next.course = selectedSubject?.course?._id || selectedSubject?.course || current.course;
        next.academicSession = selectedSubject?.academicSession?._id || selectedSubject?.academicSession || current.academicSession;
      }
      if (field === 'section' && resource.key === 'enrollments') {
        const selectedSection = (options.sections || []).find((section) => String(section._id) === String(value));
        next.academicSession = selectedSection?.academicSession?._id || selectedSection?.academicSession || current.academicSession;
      }

      return next;
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await onCreate(resource.key, form);
      setForm(ADVANCED_DEFAULT_FORMS[resource.key]);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to save record');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="card p-5">
      <div className="mb-4">
        <h3 className="font-display text-lg font-bold text-gray-900">{resource.label}</h3>
        <p className="mt-1 text-sm text-gray-500">Advanced academic relationships that build on the structure tree.</p>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {resource.fields.map((field) => {
          const selectOptions = fieldOptions[field];
          if (selectOptions) {
            return (
              <select
                key={field}
                className="input"
                value={form[field]}
                onChange={(event) => handleFieldChange(field, event.target.value)}
                required
              >
                <option value="">Select {getFieldLabel(field)}</option>
                {selectOptions.map((item) => (
                  <option key={item._id || item.systemId} value={item._id || item.systemId}>{formatEntityName(item)}</option>
                ))}
              </select>
            );
          }

          if (field === 'status') {
            return (
              <select
                key={field}
                className="input"
                value={form[field]}
                onChange={(event) => handleFieldChange(field, event.target.value)}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="completed">Completed</option>
                <option value="withdrawn">Withdrawn</option>
              </select>
            );
          }

          return (
            <input
              key={field}
              className="input"
              placeholder={getFieldLabel(field)}
              value={form[field]}
              onChange={(event) => handleFieldChange(field, event.target.value)}
              required
            />
          );
        })}
        <button type="submit" disabled={submitting} className="btn-primary justify-center xl:col-span-3">
          <FiPlus size={15} />
          {submitting ? 'Saving...' : `Add ${resource.label.slice(0, -1)}`}
        </button>
      </form>

      {error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      {(resource.key === 'subjects' || resource.key === 'section-subjects' || resource.key === 'enrollments') ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          {resource.key === 'subjects' ? 'Subjects sit under a course and academic session, then get delivered through section-teaching assignments.' : null}
          {resource.key === 'section-subjects' ? 'Teaching assignments connect a subject to a delivery section. Selecting a section or subject will automatically align the related hierarchy fields.' : null}
          {resource.key === 'enrollments' ? 'Enrollments attach students to sections. The academic session is inferred from the selected section when available.' : null}
        </div>
      ) : null}

      <div className="mt-4 space-y-2">
        {items.length ? items.slice(0, 8).map((item) => (
          <div key={item._id} className="flex items-start justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
            <div>
              <p className="font-medium text-gray-900">{formatEntityName(item)}</p>
              <p className="mt-1 text-xs text-gray-500">{item.semester || item.label || item.email || item.status || 'Mapped record'}</p>
            </div>
            <button
              type="button"
              onClick={() => onDelete(resource.key, item)}
              className="rounded-lg p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-600"
            >
              <FiTrash2 size={14} />
            </button>
          </div>
        )) : (
          <div className="rounded-xl border border-dashed border-gray-200 px-4 py-4 text-sm text-gray-400">No {resource.label.toLowerCase()} yet.</div>
        )}
      </div>
    </section>
  );
}

export default function AdvancedAcademicOperationsPanel({ options, onCreate, onDelete }) {
  return (
    <div className="space-y-5">
      {ADVANCED_RESOURCES.map((resource) => (
        <AdvancedResourceSection
          key={resource.key}
          resource={resource}
          items={options[resource.key] || []}
          options={options}
          onCreate={onCreate}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
