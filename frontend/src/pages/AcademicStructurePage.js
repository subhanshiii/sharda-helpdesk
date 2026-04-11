import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  FiBookOpen,
  FiChevronDown,
  FiChevronRight,
  FiEdit2,
  FiGitBranch,
  FiLayers,
  FiPlus,
  FiRefreshCw,
  FiTrash2,
  FiUsers,
  FiX,
} from 'react-icons/fi';
import API from '../utils/api';
import { Alert, ConfirmDialog, EmptyState, FullPageSpinner, Modal, PageHeader } from '../components/ui';

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

const TREE_ACTIONS = {
  college: ['department'],
  department: ['program'],
  program: ['course', 'session'],
  course: ['section'],
  session: [],
};

const emptyQuickSetup = {
  collegeId: '',
  department: '',
  departmentCode: '',
  program: '',
  programCode: '',
  course: '',
  courseCode: '',
  academicSession: '',
  years: [1, 2, 3, 4],
  sectionsPerYear: {
    1: 'A, B',
    2: 'A, B',
    3: 'A',
    4: 'A',
  },
  capacity: 60,
};

const emptyInlineForm = {
  mode: 'create',
  resource: '',
  parentType: '',
  parentLabel: '',
  id: '',
  values: {},
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

const makeExpandableKey = (type, id) => `${type}:${id}`;

function StructureNode({
  type,
  item,
  level = 0,
  selectedSectionId,
  expandedKeys,
  onToggle,
  onAdd,
  onEdit,
  onDelete,
  onSelectSection,
}) {
  const children = type === 'college'
    ? item.departments || []
    : type === 'department'
      ? item.programs || []
      : type === 'program'
        ? item.courses || []
        : type === 'course'
          ? item.sections || []
          : [];

  const hasChildren = children.length > 0;
  const expandableKey = makeExpandableKey(type, item._id);
  const isExpanded = expandedKeys.has(expandableKey);

  const renderSubtitle = () => {
    if (type === 'college') return `${(item.departments || []).length} department${(item.departments || []).length === 1 ? '' : 's'}`;
    if (type === 'department') return `${(item.programs || []).length} program${(item.programs || []).length === 1 ? '' : 's'}`;
    if (type === 'program') return `${(item.courses || []).length} course${(item.courses || []).length === 1 ? '' : 's'}`;
    if (type === 'course') return `${(item.sections || []).length} section${(item.sections || []).length === 1 ? '' : 's'}`;
    return `Capacity ${item.capacity || 0}`;
  };

  const renderMeta = () => {
    if (type === 'section') return `${item.academicSession?.label || 'Academic Session'} · Year ${item.studyYear || '—'} · Capacity ${item.capacity || 0}`;
    return null;
  };

  const isSelectedSection = type === 'section' && String(selectedSectionId || '') === String(item._id);

  return (
    <div className="space-y-3">
      <div
        className={`rounded-2xl border px-4 py-4 shadow-sm transition ${isSelectedSection ? 'border-blue-200 bg-blue-50/60' : 'border-gray-100 bg-white'}`}
        style={{ marginLeft: `${level * 20}px` }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <button
              type="button"
              onClick={() => hasChildren && onToggle(expandableKey)}
              className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl border ${hasChildren ? 'border-gray-200 bg-gray-50 text-gray-600' : 'border-transparent bg-transparent text-gray-300'}`}
            >
              {hasChildren ? (isExpanded ? <FiChevronDown size={16} /> : <FiChevronRight size={16} />) : <FiGitBranch size={14} />}
            </button>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-gray-900">{formatEntityName(item)}</p>
                <span className="badge bg-slate-100 text-slate-700 capitalize">{type}</span>
                {renderMeta() ? <span className="badge bg-blue-100 text-blue-700">{renderMeta()}</span> : null}
              </div>
              <p className="mt-1 text-sm text-gray-500">{renderSubtitle()}</p>
              {type === 'section' ? (
                <button
                  type="button"
                  onClick={() => onSelectSection(item)}
                  className="mt-3 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                >
                  {isSelectedSection ? 'Selected Section' : 'View Subjects'}
                </button>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(TREE_ACTIONS[type] || []).map((childResource) => (
              <button
                key={childResource}
                type="button"
                onClick={() => onAdd(childResource, type, item)}
                className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
              >
                <FiPlus className="mr-1 inline" size={12} />
                Add {childResource === 'session' ? 'Academic Session' : childResource.charAt(0).toUpperCase() + childResource.slice(1)}
              </button>
            ))}
            <button
              type="button"
              onClick={() => onEdit(type, item)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 transition hover:border-gray-300 hover:bg-gray-50"
            >
              <FiEdit2 className="mr-1 inline" size={12} />
              Edit
            </button>
            <button
              type="button"
              onClick={() => onDelete(type, item)}
              className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-100"
            >
              <FiTrash2 className="mr-1 inline" size={12} />
              Delete
            </button>
          </div>
        </div>
      </div>

      {hasChildren && isExpanded ? (
        <div className="space-y-3">
          {children.map((child) => (
            <StructureNode
              key={child._id}
              type={type === 'college' ? 'department' : type === 'department' ? 'program' : type === 'program' ? 'course' : 'section'}
              item={child}
              level={level + 1}
              selectedSectionId={selectedSectionId}
              expandedKeys={expandedKeys}
              onToggle={onToggle}
              onAdd={onAdd}
              onEdit={onEdit}
              onDelete={onDelete}
              onSelectSection={onSelectSection}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function AdvancedResourceSection({ resource, items, options, onCreate, onDelete }) {
  const [form, setForm] = useState(ADVANCED_DEFAULT_FORMS[resource.key]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setForm(ADVANCED_DEFAULT_FORMS[resource.key]);
    setError('');
  }, [resource.key]);

  const fieldOptions = {
    college: options.colleges || [],
    department: options.departments || [],
    program: options.programs || [],
    course: options.courses || [],
    academicSession: options.academicSessions || [],
    section: options.sections || [],
    subject: options.subjects || [],
    faculty: options.faculty || [],
    student: options.students || [],
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
                onChange={(event) => setForm((current) => ({ ...current, [field]: event.target.value }))}
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
                onChange={(event) => setForm((current) => ({ ...current, [field]: event.target.value }))}
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
              onChange={(event) => setForm((current) => ({ ...current, [field]: event.target.value }))}
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

      <div className="mt-4 space-y-2">
        {items.length ? items.slice(0, 6).map((item) => (
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

export default function AcademicStructurePage() {
  const [treeData, setTreeData] = useState([]);
  const [options, setOptions] = useState({
    colleges: [],
    departments: [],
    programs: [],
    courses: [],
    academicSessions: [],
    sections: [],
    subjects: [],
    faculty: [],
    students: [],
    'section-subjects': [],
    enrollments: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedKeys, setExpandedKeys] = useState(new Set());
  const [quickSetupOpen, setQuickSetupOpen] = useState(false);
  const [quickSetupForm, setQuickSetupForm] = useState(emptyQuickSetup);
  const [quickSetupSaving, setQuickSetupSaving] = useState(false);
  const [inlineForm, setInlineForm] = useState(emptyInlineForm);
  const [inlineSaving, setInlineSaving] = useState(false);
  const [inlineError, setInlineError] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState({ open: false, resource: '', item: null, loading: false });
  const [selectedSection, setSelectedSection] = useState(null);
  const [assignmentRowId, setAssignmentRowId] = useState('');

  const loadAcademicWorkspace = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [
        treeRes,
        collegesRes,
        departmentsRes,
        programsRes,
        coursesRes,
        sessionsRes,
        sectionsRes,
        subjectsRes,
        sectionSubjectsRes,
        enrollmentsRes,
        facultyRes,
        studentsRes,
      ] = await Promise.all([
        API.get('/academics/structure-tree'),
        API.get('/academics/colleges'),
        API.get('/academics/departments'),
        API.get('/academics/programs'),
        API.get('/academics/courses'),
        API.get('/academics/academic-sessions'),
        API.get('/academics/sections'),
        API.get('/academics/subjects'),
        API.get('/academics/section-subjects'),
        API.get('/academics/enrollments'),
        API.get('/users?role=faculty&limit=100'),
        API.get('/users?role=student&limit=100'),
      ]);

      setTreeData(treeRes.data?.data || []);
      setOptions({
        colleges: collegesRes.data?.data || [],
        departments: departmentsRes.data?.data || [],
        programs: programsRes.data?.data || [],
        courses: coursesRes.data?.data || [],
        academicSessions: sessionsRes.data?.data || [],
        sections: sectionsRes.data?.data || [],
        subjects: subjectsRes.data?.data || [],
        faculty: facultyRes.data?.data || [],
        students: studentsRes.data?.data || [],
        'section-subjects': sectionSubjectsRes.data?.data || [],
        enrollments: enrollmentsRes.data?.data || [],
      });
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to load academic structure');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAcademicWorkspace();
  }, [loadAcademicWorkspace]);

  const summaryCards = useMemo(() => {
    const sectionCount = options.sections.length;
    return [
      { label: 'Colleges', value: options.colleges.length, icon: <FiLayers size={16} /> },
      { label: 'Departments', value: options.departments.length, icon: <FiLayers size={16} /> },
      { label: 'Programs', value: options.programs.length, icon: <FiLayers size={16} /> },
      { label: 'Courses', value: options.courses.length, icon: <FiBookOpen size={16} /> },
      { label: 'Academic Sessions', value: options.academicSessions.length, icon: <FiGitBranch size={16} /> },
      { label: 'Sections', value: sectionCount, icon: <FiUsers size={16} /> },
    ];
  }, [options]);

  const toggleExpanded = (key) => {
    setExpandedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const openCreateForm = (resource, parentType = '', parentItem = null) => {
    const base = {
      mode: 'create',
      resource,
      parentType,
      parentLabel: parentItem ? formatEntityName(parentItem) : '',
      id: '',
      values: {},
    };

    if (resource === 'department') base.values = { name: '', code: '', college: parentType === 'college' ? parentItem?._id || '' : '' };
    if (resource === 'program') base.values = { name: '', code: '', durationYears: 4, department: parentItem?._id || '' };
    if (resource === 'course') base.values = {
      name: '',
      code: '',
      program: parentType === 'program' ? parentItem?._id || '' : parentItem?.program || '',
      department: parentType === 'program' ? parentItem?.department || '' : '',
    };
    if (resource === 'session') base.values = {
      program: parentItem?._id || '',
      yearNumber: 1,
      label: '',
    };
    if (resource === 'section') {
      const programId = parentItem?.program || parentItem?.program?._id || '';
      const courseId = parentType === 'course' ? parentItem?._id || '' : parentItem?.course || '';
      const departmentId = parentType === 'course' ? parentItem?.department || '' : parentItem?.department || '';
      base.values = {
        program: programId,
        course: courseId,
        academicSession: '',
        department: departmentId,
        studyYear: 1,
        name: '',
        capacity: 60,
      };
    }

    setInlineError('');
    setInlineForm(base);
  };

  const openEditForm = (resourceType, item) => {
    const resourceMap = {
      college: 'college',
      department: 'department',
      program: 'program',
      course: 'course',
      session: 'session',
      section: 'section',
    };
    const resource = resourceMap[resourceType];
    if (!resource) return;

    const values = resource === 'college'
      ? { name: item.name || '', code: item.code || '', description: item.description || '' }
      : resource === 'department'
      ? { name: item.name || '', code: item.code || '', college: item.college?._id || item.college || '' }
      : resource === 'program'
        ? { name: item.name || '', code: item.code || '', durationYears: item.durationYears || 4, department: item.department || '' }
        : resource === 'course'
          ? { name: item.name || '', code: item.code || '', program: item.program || '', department: item.department || '' }
          : resource === 'session'
            ? { program: item.program || '', yearNumber: item.yearNumber || 1, label: item.label || '' }
            : {
                program: item.program || '',
                course: item.course || '',
                academicSession: item.academicSession || '',
                department: item.department || '',
                studyYear: item.studyYear || 1,
                name: item.name || '',
                capacity: item.capacity || 60,
              };

    setInlineError('');
    setInlineForm({
      mode: 'edit',
      resource,
      parentType: '',
      parentLabel: formatEntityName(item),
      id: item._id,
      values,
    });
  };

  const handleInlineSave = async (event) => {
    event.preventDefault();
    setInlineSaving(true);
    setInlineError('');
    try {
      const resourceMap = {
        college: 'colleges',
        department: 'departments',
        program: 'programs',
        course: 'courses',
        session: 'academic-sessions',
        section: 'sections',
      };
      const endpoint = `/academics/${resourceMap[inlineForm.resource]}`;
      if (inlineForm.mode === 'edit') {
        await API.put(`${endpoint}/${inlineForm.id}`, inlineForm.values);
        toast.success('Academic record updated');
      } else {
        await API.post(endpoint, inlineForm.values);
        toast.success('Academic record created');
      }
      setInlineForm(emptyInlineForm);
      await loadAcademicWorkspace();
    } catch (requestError) {
      setInlineError(requestError.response?.data?.message || 'Failed to save academic record');
    } finally {
      setInlineSaving(false);
    }
  };

  const handleQuickSetup = async (event) => {
    event.preventDefault();
    setQuickSetupSaving(true);
    try {
      const payload = {
        ...quickSetupForm,
        years: quickSetupForm.years,
        sectionsPerYear: Object.fromEntries(
          quickSetupForm.years.map((year) => [
            year,
            String(quickSetupForm.sectionsPerYear[year] || '')
              .split(',')
              .map((entry) => entry.trim())
              .filter(Boolean),
          ])
        ),
      };

      await API.post('/academics/setup', payload);
      toast.success('Academic structure created');
      setQuickSetupOpen(false);
      setQuickSetupForm(emptyQuickSetup);
      await loadAcademicWorkspace();
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || 'Quick setup failed');
    } finally {
      setQuickSetupSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete.item || !confirmDelete.resource) return;
    setConfirmDelete((current) => ({ ...current, loading: true }));
    try {
      await API.delete(`/academics/${confirmDelete.resource}/${confirmDelete.item._id}`);
      toast.success('Academic record deleted');
      setConfirmDelete({ open: false, resource: '', item: null, loading: false });
      await loadAcademicWorkspace();
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || 'Delete failed');
      setConfirmDelete((current) => ({ ...current, loading: false }));
    }
  };

  const handleAdvancedCreate = async (resource, payload) => {
    const response = await API.post(`/academics/${resource}`, payload);
    toast.success('Saved successfully');
    await loadAcademicWorkspace();
    return response;
  };

  const sectionAssignments = useMemo(() => {
    if (!selectedSection?._id) return [];
    return (options['section-subjects'] || []).filter(
      (entry) => String(entry.section?._id || entry.section) === String(selectedSection._id)
    );
  }, [options, selectedSection]);

  const handleFacultyAssignment = async (sectionSubjectId, facultyId) => {
    try {
      await API.patch(`/academics/section-subjects/${sectionSubjectId}`, { facultyId: facultyId || null });
      toast.success('Faculty assignment updated');
      setAssignmentRowId('');
      await loadAcademicWorkspace();
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || 'Failed to update faculty assignment');
    }
  };

  if (loading) return <FullPageSpinner />;

  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={confirmDelete.open}
        title="Delete academic record"
        description={`Delete ${confirmDelete.item ? formatEntityName(confirmDelete.item) : 'this record'}? This action cannot be undone.`}
        confirmLabel="Delete"
        loading={confirmDelete.loading}
        onConfirm={handleDelete}
        onClose={() => setConfirmDelete({ open: false, resource: '', item: null, loading: false })}
      />

      <Modal open={quickSetupOpen} onClose={() => setQuickSetupOpen(false)} panelClassName="max-w-3xl">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-display text-2xl font-bold text-gray-900">Quick Setup</h3>
              <p className="mt-1 text-sm text-gray-500">Create a connected university structure in one guided flow.</p>
            </div>
            <button type="button" onClick={() => setQuickSetupOpen(false)} className="rounded-2xl border border-gray-200 p-2 text-gray-400 transition hover:bg-gray-50 hover:text-gray-600">
              <FiX size={18} />
            </button>
          </div>

          <form onSubmit={handleQuickSetup} className="mt-6 space-y-5">
            <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
              {['College', 'Department', 'Program', 'Course', 'Sections', 'Subjects'].map((step, index) => (
                <div key={step} className="rounded-2xl border border-gray-100 bg-gray-50 px-3 py-3 text-center">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">Step {index + 1}</div>
                  <div className="mt-1 text-sm font-semibold text-gray-800">{step}</div>
                </div>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <select className="input" value={quickSetupForm.collegeId} onChange={(e) => setQuickSetupForm((c) => ({ ...c, collegeId: e.target.value }))} required>
                <option value="">Select College</option>
                {options.colleges.map((college) => <option key={college._id} value={college._id}>{formatEntityName(college)}</option>)}
              </select>
              <input className="input" placeholder="Department" value={quickSetupForm.department} onChange={(e) => setQuickSetupForm((c) => ({ ...c, department: e.target.value }))} required />
              <input className="input" placeholder="Department Code" value={quickSetupForm.departmentCode} onChange={(e) => setQuickSetupForm((c) => ({ ...c, departmentCode: e.target.value.toUpperCase() }))} />
              <input className="input" placeholder="Program" value={quickSetupForm.program} onChange={(e) => setQuickSetupForm((c) => ({ ...c, program: e.target.value }))} required />
              <input className="input" placeholder="Program Code" value={quickSetupForm.programCode} onChange={(e) => setQuickSetupForm((c) => ({ ...c, programCode: e.target.value.toUpperCase() }))} />
              <input className="input" placeholder="Course" value={quickSetupForm.course} onChange={(e) => setQuickSetupForm((c) => ({ ...c, course: e.target.value }))} required />
              <input className="input" placeholder="Course Code" value={quickSetupForm.courseCode} onChange={(e) => setQuickSetupForm((c) => ({ ...c, courseCode: e.target.value.toUpperCase() }))} />
              <input className="input md:col-span-2" placeholder="Academic Session Label (e.g. 2026-27)" value={quickSetupForm.academicSession} onChange={(e) => setQuickSetupForm((c) => ({ ...c, academicSession: e.target.value }))} required />
            </div>

            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
              <p className="text-sm font-semibold text-gray-900">Study Years</p>
              <div className="mt-3 flex flex-wrap gap-3">
                {[1, 2, 3, 4].map((year) => {
                  const selected = quickSetupForm.years.includes(year);
                  return (
                    <button
                      key={year}
                      type="button"
                      onClick={() => setQuickSetupForm((current) => ({
                        ...current,
                        years: selected ? current.years.filter((entry) => entry !== year) : [...current.years, year].sort((a, b) => a - b),
                      }))}
                      className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${selected ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}
                    >
                      Year {year}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {quickSetupForm.years.map((year) => (
                <div key={year}>
                  <label className="label">{`Sections for Year ${year}`}</label>
                  <input
                    className="input"
                    placeholder="A, B, C"
                    value={quickSetupForm.sectionsPerYear[year] || ''}
                    onChange={(e) => setQuickSetupForm((current) => ({
                      ...current,
                      sectionsPerYear: {
                        ...current.sectionsPerYear,
                        [year]: e.target.value,
                      },
                    }))}
                  />
                </div>
              ))}
              <div>
                <label className="label">Capacity per Section</label>
                <input className="input" type="number" min="1" value={quickSetupForm.capacity} onChange={(e) => setQuickSetupForm((c) => ({ ...c, capacity: Number(e.target.value) || 60 }))} />
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setQuickSetupOpen(false)} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={quickSetupSaving} className="btn-primary">
                {quickSetupSaving ? 'Creating...' : 'Create Full Structure'}
              </button>
            </div>
          </form>
        </div>
      </Modal>

      <PageHeader
        title="Academic Setup & Structure"
        description="Build the university hierarchy from one connected workspace. College, department, program, course, academic session, and section now live in one guided structure."
        meta={[
          'Section-driven architecture',
          'Tree view for hierarchy',
          'Quick setup for full structure creation',
        ]}
        action={(
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => openCreateForm('college')} className="btn-secondary">
              <FiPlus size={15} />
              Add College
            </button>
            <button type="button" onClick={() => setQuickSetupOpen(true)} className="btn-primary">
              <FiLayers size={15} />
              Quick Setup
            </button>
            <button type="button" onClick={loadAcademicWorkspace} className="btn-secondary">
              <FiRefreshCw size={15} />
              Refresh
            </button>
          </div>
        )}
      />

      {error ? <Alert type="error" message={error} /> : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        {summaryCards.map((card) => (
          <div key={card.label} className="card p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">{card.label}</p>
                <p className="mt-2 font-display text-3xl font-black text-gray-900">{card.value}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">{card.icon}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.8fr)_360px]">
        <div className="space-y-5">
          <div className="card p-5">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-bold text-gray-900">Structure Tree</h2>
                <p className="mt-1 text-sm text-gray-500">College → Department → Program → Course → Sections</p>
              </div>
              <button
                type="button"
                onClick={() => setExpandedKeys(new Set(treeData.flatMap((college) => [
                  makeExpandableKey('college', college._id),
                  ...(college.departments || []).map((department) => makeExpandableKey('department', department._id)),
                  ...(college.departments || []).flatMap((department) => (department.programs || []).map((program) => makeExpandableKey('program', program._id))),
                  ...(college.departments || []).flatMap((department) => (department.programs || []).flatMap((program) => (program.courses || []).map((course) => makeExpandableKey('course', course._id)))),
                ])))}
                className="btn-secondary text-xs"
              >
                Expand Key Levels
              </button>
            </div>

            {treeData.length === 0 ? (
              <EmptyState icon="🏫" title="No academic structure yet" description="Start with Quick Setup or add the first college manually." />
            ) : (
              <div className="space-y-4">
                {treeData.map((college) => (
                  <StructureNode
                    key={college._id}
                    type="college"
                    item={college}
                    selectedSectionId={selectedSection?._id}
                    expandedKeys={expandedKeys}
                    onToggle={toggleExpanded}
                    onAdd={openCreateForm}
                    onEdit={openEditForm}
                    onSelectSection={setSelectedSection}
                    onDelete={(type, item) => {
                      const resourceMap = {
                        college: 'colleges',
                        department: 'departments',
                        program: 'programs',
                        course: 'courses',
                        session: 'academic-sessions',
                        section: 'sections',
                      };
                      setConfirmDelete({ open: true, resource: resourceMap[type], item, loading: false });
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {selectedSection ? (
            <div className="card p-5">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl font-bold text-gray-900">Section Subjects</h2>
                  <p className="mt-1 text-sm text-gray-500">
                    {[
                      selectedSection.course?.name,
                      selectedSection.academicSession?.label,
                      selectedSection.name ? `Section ${selectedSection.name}` : null,
                    ].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <button type="button" onClick={() => setSelectedSection(null)} className="btn-secondary text-xs">
                  Clear
                </button>
              </div>

              {sectionAssignments.length ? (
                <div className="space-y-3">
                  {sectionAssignments.map((assignment) => (
                    <div key={assignment._id} className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <p className="font-semibold text-gray-900">{assignment.subject?.name || 'Subject'}</p>
                          <p className="mt-1 text-sm text-gray-500">
                            {(assignment.subject?.code || 'No subject code')}{assignment.semester ? ` · ${assignment.semester}` : ''}
                          </p>
                          <p className="mt-2 text-sm text-gray-700">
                            Faculty: <span className="font-medium">{assignment.faculty?.name || 'Unassigned'}</span>
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          {assignmentRowId === assignment._id ? (
                            <select
                              className="input min-w-[240px]"
                              value={assignment.faculty?._id || ''}
                              onChange={(event) => handleFacultyAssignment(assignment._id, event.target.value)}
                            >
                              <option value="">Unassigned</option>
                              {options.faculty.map((faculty) => (
                                <option key={faculty._id} value={faculty._id}>{faculty.name}</option>
                              ))}
                            </select>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => setAssignmentRowId((current) => current === assignment._id ? '' : assignment._id)}
                            className="btn-secondary text-xs"
                          >
                            Assign
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-5 text-sm text-gray-400">
                  No subject mappings exist for this section yet.
                </div>
              )}
            </div>
          ) : null}

          <div className="card p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-bold text-gray-900">Advanced Academic Operations</h2>
                <p className="mt-1 text-sm text-gray-500">Subjects, teaching assignments, and enrollments stay available here without breaking existing workflows.</p>
              </div>
              <button type="button" onClick={() => setAdvancedOpen((current) => !current)} className="btn-secondary text-xs">
                {advancedOpen ? 'Hide' : 'Show'}
              </button>
            </div>

            {advancedOpen ? (
              <div className="space-y-5">
                {ADVANCED_RESOURCES.map((resource) => (
                  <AdvancedResourceSection
                    key={resource.key}
                    resource={resource}
                    items={options[resource.key] || []}
                    options={options}
                    onCreate={handleAdvancedCreate}
                    onDelete={(resourceKey, item) => setConfirmDelete({ open: true, resource: resourceKey, item, loading: false })}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-5 text-sm text-gray-400">
                Open this section when you need to manage subjects, teaching assignments, or enrollments.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <div className="card p-5">
            <h3 className="font-display text-lg font-bold text-gray-900">How This Works</h3>
            <div className="mt-4 space-y-3 text-sm text-gray-600">
              <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
                <p className="font-semibold text-gray-900">1. Structure First</p>
                <p className="mt-1">Create colleges, departments, programs, courses, academic sessions, and sections in one hierarchy.</p>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
                <p className="font-semibold text-gray-900">2. Section-Driven ERP</p>
                <p className="mt-1">Students inherit academics through section enrollment, and faculty scope comes from section-subject assignments.</p>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
                <p className="font-semibold text-gray-900">3. Downstream Modules</p>
                <p className="mt-1">Timetable, attendance, assignments, and user visibility all depend on this structure being correct.</p>
              </div>
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-lg font-bold text-gray-900">{inlineForm.mode === 'edit' ? 'Edit Structure Node' : 'Inline Setup'}</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {inlineForm.resource
                    ? `Manage ${inlineForm.resource} ${inlineForm.parentLabel ? `for ${inlineForm.parentLabel}` : ''}`
                    : 'Select an action from the tree to create or edit the next part of the hierarchy.'}
                </p>
              </div>
              {inlineForm.resource ? (
                <button type="button" onClick={() => setInlineForm(emptyInlineForm)} className="rounded-2xl border border-gray-200 p-2 text-gray-400 transition hover:bg-gray-50 hover:text-gray-600">
                  <FiX size={16} />
                </button>
              ) : null}
            </div>

            {!inlineForm.resource ? (
              <div className="mt-4 rounded-2xl border border-dashed border-gray-200 px-4 py-5 text-sm text-gray-400">
                Use the tree actions like Add Department, Add Program, Add Course, Add Academic Session, or Add Section to keep the hierarchy guided.
              </div>
            ) : (
              <form onSubmit={handleInlineSave} className="mt-5 space-y-4">
                {inlineForm.resource === 'college' ? (
                  <div className="grid gap-4">
                    <input className="input" placeholder="College Name" value={inlineForm.values.name || ''} onChange={(e) => setInlineForm((c) => ({ ...c, values: { ...c.values, name: e.target.value } }))} required />
                    <input className="input" placeholder="College Code" value={inlineForm.values.code || ''} onChange={(e) => setInlineForm((c) => ({ ...c, values: { ...c.values, code: e.target.value.toUpperCase() } }))} required />
                    <textarea className="input min-h-[96px]" placeholder="Description" value={inlineForm.values.description || ''} onChange={(e) => setInlineForm((c) => ({ ...c, values: { ...c.values, description: e.target.value } }))} />
                  </div>
                ) : null}

                {inlineForm.resource === 'department' ? (
                  <div className="grid gap-4">
                    <select className="input" value={inlineForm.values.college || ''} onChange={(e) => setInlineForm((c) => ({ ...c, values: { ...c.values, college: e.target.value } }))} required>
                      <option value="">Select College</option>
                      {options.colleges.map((college) => <option key={college._id} value={college._id}>{formatEntityName(college)}</option>)}
                    </select>
                    <input className="input" placeholder="Department Name" value={inlineForm.values.name || ''} onChange={(e) => setInlineForm((c) => ({ ...c, values: { ...c.values, name: e.target.value } }))} required />
                    <input className="input" placeholder="Department Code" value={inlineForm.values.code || ''} onChange={(e) => setInlineForm((c) => ({ ...c, values: { ...c.values, code: e.target.value.toUpperCase() } }))} required />
                  </div>
                ) : null}

                {inlineForm.resource === 'program' ? (
                  <div className="grid gap-4">
                    <input className="input" placeholder="Program Name" value={inlineForm.values.name || ''} onChange={(e) => setInlineForm((c) => ({ ...c, values: { ...c.values, name: e.target.value } }))} required />
                    <input className="input" placeholder="Program Code" value={inlineForm.values.code || ''} onChange={(e) => setInlineForm((c) => ({ ...c, values: { ...c.values, code: e.target.value.toUpperCase() } }))} required />
                    <input className="input" type="number" min="1" max="10" placeholder="Duration Years" value={inlineForm.values.durationYears || 4} onChange={(e) => setInlineForm((c) => ({ ...c, values: { ...c.values, durationYears: Number(e.target.value) || 4 } }))} />
                  </div>
                ) : null}

                {inlineForm.resource === 'course' ? (
                  <div className="grid gap-4">
                    <input className="input" placeholder="Course Name" value={inlineForm.values.name || ''} onChange={(e) => setInlineForm((c) => ({ ...c, values: { ...c.values, name: e.target.value } }))} required />
                    <input className="input" placeholder="Course Code" value={inlineForm.values.code || ''} onChange={(e) => setInlineForm((c) => ({ ...c, values: { ...c.values, code: e.target.value.toUpperCase() } }))} required />
                  </div>
                ) : null}

                {inlineForm.resource === 'session' ? (
                  <div className="grid gap-4">
                    <input className="input" type="number" min="1" max="10" placeholder="Study Year" value={inlineForm.values.yearNumber || 1} onChange={(e) => setInlineForm((c) => ({ ...c, values: { ...c.values, yearNumber: Number(e.target.value) || 1 } }))} required />
                    <input className="input" placeholder="Academic Session Label" value={inlineForm.values.label || ''} onChange={(e) => setInlineForm((c) => ({ ...c, values: { ...c.values, label: e.target.value } }))} required />
                  </div>
                ) : null}

                {inlineForm.resource === 'section' ? (
                  <div className="grid gap-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <select className="input" value={inlineForm.values.course || ''} onChange={(e) => setInlineForm((c) => ({ ...c, values: { ...c.values, course: e.target.value } }))} required>
                        <option value="">Select Course</option>
                        {options.courses
                          .filter((course) => !inlineForm.values.program || String(course.program?._id || course.program) === String(inlineForm.values.program))
                          .map((course) => <option key={course._id} value={course._id}>{formatEntityName(course)}</option>)}
                      </select>
                      <select className="input" value={inlineForm.values.academicSession || ''} onChange={(e) => {
                        const selectedSession = options.academicSessions.find((session) => String(session._id) === String(e.target.value));
                        setInlineForm((c) => ({ ...c, values: { ...c.values, academicSession: e.target.value, studyYear: selectedSession?.yearNumber || c.values.studyYear || 1 } }));
                      }} required>
                        <option value="">Select Academic Session</option>
                        {options.academicSessions
                          .filter((session) => !inlineForm.values.program || String(session.program?._id || session.program) === String(inlineForm.values.program))
                          .map((session) => <option key={session._id} value={session._id}>{session.label} · Year {session.yearNumber}</option>)}
                      </select>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <input className="input" placeholder="Section Name (A, B...)" value={inlineForm.values.name || ''} onChange={(e) => setInlineForm((c) => ({ ...c, values: { ...c.values, name: e.target.value.toUpperCase() } }))} required />
                      <input className="input" type="number" min="1" placeholder="Capacity" value={inlineForm.values.capacity || 60} onChange={(e) => setInlineForm((c) => ({ ...c, values: { ...c.values, capacity: Number(e.target.value) || 60 } }))} required />
                    </div>
                  </div>
                ) : null}

                {inlineError ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{inlineError}</div> : null}

                <button type="submit" disabled={inlineSaving} className="btn-primary w-full justify-center">
                  {inlineSaving ? 'Saving...' : inlineForm.mode === 'edit' ? 'Save Changes' : 'Create Record'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
