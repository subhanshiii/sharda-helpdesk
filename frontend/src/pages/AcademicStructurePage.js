import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { FiPlus, FiRefreshCw, FiTrash2 } from 'react-icons/fi';
import API from '../utils/api';
import { Alert, EmptyState, FullPageSpinner, PageHeader } from '../components/ui';

const RESOURCES = [
  { key: 'departments', label: 'Departments', fields: ['name', 'code'] },
  { key: 'programs', label: 'Programs', fields: ['name', 'code', 'department', 'durationYears'] },
  { key: 'years', label: 'Academic Years', fields: ['program', 'yearNumber', 'label'] },
  { key: 'sections', label: 'Sections', fields: ['program', 'academicYear', 'department', 'name', 'capacity'] },
  { key: 'subjects', label: 'Subjects', fields: ['code', 'name', 'department', 'program', 'academicYear', 'credits'] },
  { key: 'section-subjects', label: 'Section Subject Assignments', fields: ['section', 'subject', 'faculty', 'semester'] },
  { key: 'enrollments', label: 'Enrollments', fields: ['student', 'section', 'academicYear', 'semester', 'status'] },
];

const DEFAULT_FORMS = {
  departments: { name: '', code: '' },
  programs: { name: '', code: '', department: '', durationYears: 4 },
  years: { program: '', yearNumber: 1, label: '' },
  sections: { program: '', academicYear: '', department: '', name: '', capacity: 60 },
  subjects: { code: '', name: '', department: '', program: '', academicYear: '', credits: 0 },
  'section-subjects': { section: '', subject: '', faculty: '', semester: '' },
  enrollments: { student: '', section: '', academicYear: '', semester: '', status: 'active' },
};

const getFieldLabel = (field) => ({
  code: 'Code',
  name: 'Name',
  department: 'Department',
  durationYears: 'Duration (years)',
  program: 'Program',
  yearNumber: 'Year number',
  label: 'Label',
  academicYear: 'Academic Year',
  capacity: 'Capacity',
  subject: 'Subject',
  faculty: 'Faculty',
  semester: 'Semester',
  student: 'Student',
  status: 'Status',
  credits: 'Credits',
}[field] || field);

const entityName = (entity) => {
  if (!entity) return '—';
  return entity.name || entity.label || entity.code || entity.email || entity._id;
};

function ResourceSection({ resource, items, options, onCreate, onDelete, loading }) {
  const [form, setForm] = useState(DEFAULT_FORMS[resource.key]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setForm(DEFAULT_FORMS[resource.key]);
  }, [resource.key]);

  const fieldOptions = useMemo(() => ({
    department: options.departments || [],
    program: options.programs || [],
    academicYear: options.years || [],
    section: options.sections || [],
    subject: options.subjects || [],
    faculty: options.faculty || [],
    student: options.students || [],
  }), [options]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onCreate(resource.key, form);
      setForm(DEFAULT_FORMS[resource.key]);
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (field) => {
    const selectOptions = fieldOptions[field];
    if (selectOptions) {
      return (
        <select
          key={field}
          className="input"
          value={form[field]}
          onChange={(e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))}
          required
        >
          <option value="">Select {getFieldLabel(field)}</option>
          {selectOptions.map((item) => (
            <option key={item._id} value={item._id}>{entityName(item)}</option>
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
          onChange={(e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))}
        >
          <option value="active">Active</option>
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
        type={['durationYears', 'yearNumber', 'capacity', 'credits'].includes(field) ? 'number' : 'text'}
        value={form[field]}
        onChange={(e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))}
        required
      />
    );
  };

  return (
    <section className="card p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold text-gray-900">{resource.label}</h3>
          <p className="text-sm text-gray-500">{items.length} records</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mb-4">
        {resource.fields.map(renderField)}
        <button type="submit" disabled={submitting} className="btn-primary justify-center md:col-span-2 xl:col-span-3">
          <FiPlus size={15} />
          {submitting ? 'Saving...' : `Add ${resource.label.slice(0, -1) || resource.label}`}
        </button>
      </form>

      {loading ? (
        <div className="py-8"><FullPageSpinner /></div>
      ) : items.length === 0 ? (
        <EmptyState icon="📚" title={`No ${resource.label.toLowerCase()} yet`} description="Create the first record using the form above." />
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item._id} className="flex items-start justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
              <div className="min-w-0">
                <p className="font-medium text-gray-900 truncate">
                  {entityName(item)}
                </p>
                <p className="text-xs text-gray-500 mt-1 break-words">
                  {resource.key === 'programs' && item.department ? `Department: ${entityName(item.department)}` : null}
                  {resource.key === 'years' && item.program ? `Program: ${entityName(item.program)}` : null}
                  {resource.key === 'sections' && item.program ? `Program: ${entityName(item.program)} · Year: ${entityName(item.academicYear)} · Dept: ${entityName(item.department)}` : null}
                  {resource.key === 'subjects' && item.program ? `Program: ${entityName(item.program)} · Year: ${entityName(item.academicYear)}` : null}
                  {resource.key === 'section-subjects' ? `Section: ${entityName(item.section)} · Subject: ${entityName(item.subject)} · Faculty: ${entityName(item.faculty)}` : null}
                  {resource.key === 'enrollments' ? `Student: ${entityName(item.student)} · Section: ${entityName(item.section)} · Semester: ${item.semester}` : null}
                </p>
              </div>
              <button
                onClick={() => onDelete(resource.key, item._id)}
                className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                aria-label={`Delete ${entityName(item)}`}
              >
                <FiTrash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function AcademicStructurePage() {
  const [data, setData] = useState({
    departments: [],
    programs: [],
    years: [],
    sections: [],
    subjects: [],
    'section-subjects': [],
    enrollments: [],
  });
  const [users, setUsers] = useState({ faculty: [], students: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [
        departmentsRes,
        programsRes,
        yearsRes,
        sectionsRes,
        subjectsRes,
        sectionSubjectsRes,
        enrollmentsRes,
        facultyRes,
        studentsRes,
      ] = await Promise.all([
        API.get('/academics/departments'),
        API.get('/academics/programs'),
        API.get('/academics/years'),
        API.get('/academics/sections'),
        API.get('/academics/subjects'),
        API.get('/academics/section-subjects'),
        API.get('/academics/enrollments'),
        API.get('/users?role=faculty&limit=100'),
        API.get('/users?role=student&limit=100'),
      ]);

      setData({
        departments: departmentsRes.data?.data || [],
        programs: programsRes.data?.data || [],
        years: yearsRes.data?.data || [],
        sections: sectionsRes.data?.data || [],
        subjects: subjectsRes.data?.data || [],
        'section-subjects': sectionSubjectsRes.data?.data || [],
        enrollments: enrollmentsRes.data?.data || [],
      });
      setUsers({
        faculty: facultyRes.data?.data || [],
        students: studentsRes.data?.data || [],
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load academic structure');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleCreate = async (resource, payload) => {
    try {
      await API.post(`/academics/${resource}`, payload);
      toast.success('Saved successfully');
      await loadAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save record');
      throw err;
    }
  };

  const handleDelete = async (resource, id) => {
    if (!window.confirm('Delete this record?')) return;
    try {
      await API.delete(`/academics/${resource}/${id}`);
      toast.success('Deleted');
      await loadAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete record');
    }
  };

  const options = {
    departments: data.departments,
    programs: data.programs,
    years: data.years,
    sections: data.sections,
    subjects: data.subjects,
    faculty: users.faculty,
    students: users.students,
  };

  return (
    <div>
      <PageHeader
        title="Academic Structure"
        subtitle="Manage departments, programs, sections, subjects, teaching assignments, and enrollments"
        action={(
          <button onClick={loadAll} className="btn-secondary">
            <FiRefreshCw size={15} />
            Refresh
          </button>
        )}
      />

      {error ? <Alert type="error" message={error} className="mb-4" /> : null}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {RESOURCES.map((resource) => (
          <ResourceSection
            key={resource.key}
            resource={resource}
            items={data[resource.key] || []}
            options={options}
            loading={loading}
            onCreate={handleCreate}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </div>
  );
}
