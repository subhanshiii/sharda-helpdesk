import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  FiArrowLeft,
  FiBookOpen,
  FiChevronDown,
  FiChevronRight,
  FiChevronUp,
  FiEdit2,
  FiGitBranch,
  FiLayers,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiTrash2,
  FiUsers,
  FiX,
} from 'react-icons/fi';
import API from '../utils/api';
import { Alert, Avatar, ConfirmDialog, EmptyState, FullPageSpinner, HelpTooltip, Modal } from '../components/ui';

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

const formatEntityName = (entity) => {
  if (!entity) return '—';
  if (entity.name && entity.code) return `${entity.name} (${entity.code})`;
  return entity.name || entity.label || entity.code || entity.email || entity.systemId || entity._id;
};

const getColumnMeta = (type, item) => {
  if (!item) return '—';
  if (type === 'college') return `${(item.departments || []).length} departments`;
  if (type === 'department') return `${(item.programs || []).length} programs`;
  if (type === 'program') return `${(item.courses || []).length} courses`;
  if (type === 'course') return `${(item.sections || []).length} sections`;
  if (type === 'section') {
    return [item.academicSession?.label, `Year ${item.studyYear || '—'}`, `Capacity ${item.capacity || 0}`].filter(Boolean).join(' · ');
  }
  if (type === 'session') {
    return [`Year ${item.yearNumber || '—'}`, item.program?.name || item.programName || 'Academic Session'].filter(Boolean).join(' · ');
  }
  if (type === 'subject') {
    return [item.code || 'No code', item.type || 'core', `${item.credits ?? 0} credits`].filter(Boolean).join(' · ');
  }
  return '—';
};

const WORKSPACE_HELP_ITEMS = [
  {
    label: 'Start at College',
    description: 'Each selection narrows the next column so the structure always feels connected and scoped.',
  },
  {
    label: 'Sections Drive Delivery',
    description: 'Sections are the operational unit that connect students, faculty, timetable, attendance, and assignments.',
  },
  {
    label: 'Detail Flows Stay In Context',
    description: 'Section, subject, and faculty views all open inside this workspace so the academic flow stays intuitive.',
  },
];

const getEntityIcon = (type) => (
  type === 'college' ? <FiLayers size={16} />
    : type === 'department' ? <FiGitBranch size={16} />
      : type === 'program' ? <FiBookOpen size={16} />
        : type === 'course' ? <FiBookOpen size={16} />
          : type === 'section' ? <FiUsers size={16} />
            : type === 'subject' ? <FiBookOpen size={16} />
              : <FiGitBranch size={16} />
);

function DrilldownColumn({
  title,
  items,
  type,
  selectedId,
  onSelect,
  onAdd,
  onEdit,
  onDelete,
  emptyLabel,
}) {
  return (
    <div className="flex h-full min-h-0 min-w-[260px] flex-1 flex-col border-r border-slate-200 last:border-r-0 xl:min-w-0">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/95 px-4 py-3 backdrop-blur">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">{title}</span>
        <button
          type="button"
          onClick={onAdd}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-700"
        >
          <FiPlus size={14} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto py-2">
        {items.length ? items.map((item) => {
          const isSelected = String(selectedId || '') === String(item._id);
          return (
            <div
              key={item._id}
              className={`group border-l-2 px-4 py-3 transition ${isSelected ? 'border-slate-900 bg-slate-50' : 'border-transparent hover:bg-slate-50/80'}`}
            >
              <button
                type="button"
                onClick={() => onSelect(item)}
                className="flex w-full items-start gap-3 text-left"
              >
                <div className={`mt-1 h-2.5 w-2.5 rounded-full ${isSelected ? 'bg-slate-900 shadow-[0_0_0_4px_rgba(15,23,42,0.08)]' : 'bg-slate-300 group-hover:bg-slate-400'}`} />
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm font-semibold leading-5 ${isSelected ? 'text-slate-900' : 'text-gray-900'}`}>{formatEntityName(item)}</p>
                  <p className="mt-1 text-xs text-gray-500">{getColumnMeta(type, item)}</p>
                </div>
              </button>
              <div className="mt-3 flex flex-wrap items-center gap-2 pl-[22px]">
                {(TREE_ACTIONS[type] || []).map((childResource) => (
                  <button
                    key={childResource}
                    type="button"
                    onClick={() => onAdd(item, childResource)}
                    className="min-h-[36px] rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-800"
                  >
                    Add {childResource === 'session' ? 'Session' : childResource}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => onEdit(item)}
                  className="min-h-[36px] rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-100"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(item)}
                  className="min-h-[36px] rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                >
                  Delete
                </button>
              </div>
            </div>
          );
        }) : (
          <div className="flex h-full min-h-[120px] items-center justify-center px-4 text-center text-sm text-gray-400">
            {emptyLabel}
          </div>
        )}
      </div>
    </div>
  );
}

const DetailPill = ({ label, value }) => (
  <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">{label}</p>
    <p className="mt-2 text-sm font-semibold text-gray-900">{value || '—'}</p>
  </div>
);

function HierarchyExplorer({
  treeData,
  academicSessions,
  subjects,
  query,
  collegeFilter,
  departmentFilter,
  onQueryChange,
  onCollegeFilterChange,
  onDepartmentFilterChange,
  expandedColleges,
  onToggleCollege,
  onOpenCollege,
  onOpenDepartment,
  onOpenProgram,
  onOpenCourse,
  onOpenSection,
  onEdit,
  onDelete,
}) {
  const normalizedQuery = query.trim().toLowerCase();

  const filteredTree = useMemo(() => {
    const matchesQuery = (value) => String(value || '').toLowerCase().includes(normalizedQuery);
    const courseMatches = (course) => {
      if (!normalizedQuery) return true;
      return matchesQuery(course.name) || matchesQuery(course.code) || matchesQuery(course.sections?.map((section) => section.name).join(' '));
    };

    return treeData
      .filter((college) => !collegeFilter || String(college._id) === String(collegeFilter))
      .map((college) => {
        const departments = (college.departments || [])
          .filter((department) => !departmentFilter || String(department._id) === String(departmentFilter))
          .map((department) => ({
            ...department,
            programs: (department.programs || []).map((program) => ({
              ...program,
              courses: (program.courses || []).filter(courseMatches),
            })).filter((program) => {
              if (!normalizedQuery) return true;
              return matchesQuery(program.name) || matchesQuery(program.code) || program.courses.length > 0;
            }),
          }))
          .filter((department) => {
            if (!normalizedQuery) return true;
            return matchesQuery(department.name) || matchesQuery(department.code) || department.programs.length > 0;
          });

        return { ...college, departments };
      })
      .filter((college) => {
        if (!normalizedQuery) return college.departments.length > 0 || !collegeFilter || String(college._id) === String(collegeFilter);
        return matchesQuery(college.name) || matchesQuery(college.code) || college.departments.length > 0;
      });
  }, [collegeFilter, departmentFilter, normalizedQuery, treeData]);

  const allowedProgramIds = useMemo(() => (
    filteredTree.flatMap((college) => (college.departments || [])
      .flatMap((department) => (department.programs || []).map((program) => String(program._id))))
  ), [filteredTree]);

  const filteredSessions = useMemo(() => (
    (academicSessions || []).filter((session) => {
      const inScope = !allowedProgramIds.length || allowedProgramIds.includes(String(session.program?._id || session.program));
      if (!inScope) return false;
      if (!normalizedQuery) return true;
      return String(session.label || '').toLowerCase().includes(normalizedQuery);
    })
  ), [academicSessions, allowedProgramIds, normalizedQuery]);

  const filteredSubjects = useMemo(() => (
    (subjects || []).filter((subject) => {
      const inScope = !allowedProgramIds.length || allowedProgramIds.includes(String(subject.program?._id || subject.program));
      if (!inScope) return false;
      if (!normalizedQuery) return true;
      return [subject.name, subject.code, subject.type].some((value) => String(value || '').toLowerCase().includes(normalizedQuery));
    })
  ), [allowedProgramIds, normalizedQuery, subjects]);

  return (
    <div className="space-y-5">
      <div className="card p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(180px,0.8fr)_minmax(180px,0.8fr)]">
          <label className="relative block">
            <FiSearch size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-10"
              placeholder="Search colleges, departments, programs, courses, or sections"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
            />
          </label>
          <select className="input" value={collegeFilter} onChange={(event) => onCollegeFilterChange(event.target.value)}>
            <option value="">All Colleges</option>
            {treeData.map((college) => (
              <option key={college._id} value={college._id}>{formatEntityName(college)}</option>
            ))}
          </select>
          <select className="input" value={departmentFilter} onChange={(event) => onDepartmentFilterChange(event.target.value)}>
            <option value="">All Departments</option>
            {treeData
              .flatMap((college) => college.departments || [])
              .filter((department) => !collegeFilter || String(department.college) === String(collegeFilter))
              .map((department) => (
                <option key={department._id} value={department._id}>{formatEntityName(department)}</option>
              ))}
          </select>
        </div>
      </div>

      {filteredTree.length ? (
        <div className="space-y-4">
          {filteredTree.map((college) => {
            const isExpanded = expandedColleges[college._id] ?? true;
            const departmentCount = (college.departments || []).length;
            const programCount = (college.departments || []).reduce((sum, department) => sum + (department.programs || []).length, 0);
            const courseCount = (college.departments || []).reduce((sum, department) => sum + (department.programs || []).reduce((programSum, program) => programSum + (program.courses || []).length, 0), 0);

            return (
              <div key={college._id} className="card overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4">
                  <button type="button" onClick={() => onToggleCollege(college._id)} className="flex min-w-0 items-center gap-3 text-left">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm">
                      {getEntityIcon('college')}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-lg font-bold text-slate-900">{formatEntityName(college)}</p>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
                        <span className="rounded-full bg-white px-2.5 py-1">{departmentCount} departments</span>
                        <span className="rounded-full bg-white px-2.5 py-1">{programCount} programs</span>
                        <span className="rounded-full bg-white px-2.5 py-1">{courseCount} courses</span>
                      </div>
                    </div>
                  </button>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => onOpenCollege(college)} className="btn-secondary text-xs">Open</button>
                    <button type="button" onClick={() => onEdit('college', college)} className="btn-secondary text-xs">Edit</button>
                    <button type="button" onClick={() => onDelete('college', college)} className="btn-secondary text-xs text-red-600 hover:text-red-700">Delete</button>
                    <button type="button" onClick={() => onToggleCollege(college._id)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-100">
                      {isExpanded ? <FiChevronUp size={16} /> : <FiChevronDown size={16} />}
                    </button>
                  </div>
                </div>

                {isExpanded ? (
                  <div className="space-y-4 p-5">
                    {(college.departments || []).length ? college.departments.map((department) => (
                      <div key={department._id} className="rounded-3xl border border-slate-200 bg-white p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <button type="button" onClick={() => onOpenDepartment(department)} className="flex min-w-0 items-center gap-3 text-left">
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                              {getEntityIcon('department')}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-slate-900">{formatEntityName(department)}</p>
                              <p className="mt-1 text-xs text-slate-500">{(department.programs || []).length} programs</p>
                            </div>
                          </button>
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => onEdit('department', department)} className="btn-secondary text-xs">Edit</button>
                            <button type="button" onClick={() => onDelete('department', department)} className="btn-secondary text-xs text-red-600 hover:text-red-700">Delete</button>
                          </div>
                        </div>

                        <div className="mt-4 space-y-3">
                          {(department.programs || []).map((program) => (
                            <div key={program._id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <button type="button" onClick={() => onOpenProgram(program)} className="flex min-w-0 items-center gap-3 text-left">
                                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-slate-700">
                                    {getEntityIcon('program')}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="truncate font-semibold text-slate-900">{formatEntityName(program)}</p>
                                    <p className="mt-1 text-xs text-slate-500">{(program.courses || []).length} courses</p>
                                  </div>
                                </button>
                                <div className="flex items-center gap-2">
                                  <button type="button" onClick={() => onEdit('program', program)} className="btn-secondary text-xs">Edit</button>
                                  <button type="button" onClick={() => onDelete('program', program)} className="btn-secondary text-xs text-red-600 hover:text-red-700">Delete</button>
                                </div>
                              </div>

                              {(program.courses || []).length ? (
                                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                                  {program.courses.map((course) => (
                                    <div key={course._id} className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                                      <div className="flex items-start justify-between gap-3">
                                        <button type="button" onClick={() => onOpenCourse(course)} className="min-w-0 text-left">
                                          <div className="flex items-center gap-2">
                                            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-700">{getEntityIcon('course')}</span>
                                            <p className="truncate font-semibold text-slate-900">{formatEntityName(course)}</p>
                                          </div>
                                          <p className="mt-2 text-xs text-slate-500">{(course.sections || []).length} sections</p>
                                        </button>
                                        <div className="flex items-center gap-2">
                                          <button type="button" onClick={() => onEdit('course', course)} className="btn-secondary text-xs">Edit</button>
                                          <button type="button" onClick={() => onDelete('course', course)} className="btn-secondary text-xs text-red-600 hover:text-red-700">Delete</button>
                                        </div>
                                      </div>
                                      {(course.sections || []).length ? (
                                        <div className="mt-4 flex flex-wrap gap-2">
                                          {course.sections.map((section) => (
                                            <button
                                              key={section._id}
                                              type="button"
                                              onClick={() => onOpenSection(section)}
                                              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                                            >
                                              <span className="text-slate-400">{getEntityIcon('section')}</span>
                                              Section {section.name}
                                            </button>
                                          ))}
                                        </div>
                                      ) : (
                                        <div className="mt-4 rounded-2xl border border-dashed border-slate-200 px-3 py-3 text-xs text-slate-400">
                                          No sections mapped to this course yet.
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="mt-4 rounded-2xl border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-400">
                                  No courses under this program yet.
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )) : (
                      <div className="rounded-3xl border border-dashed border-slate-200 px-5 py-8 text-center text-sm text-slate-400">
                        No departments match the current filters.
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="card p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                  {getEntityIcon('session')}
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold text-slate-900">Academic Sessions</h3>
                  <p className="mt-1 text-sm text-slate-500">{filteredSessions.length} sessions in the current view</p>
                </div>
              </div>
              <div className="mt-4 flex max-h-[260px] flex-wrap gap-2 overflow-y-auto pr-1">
                {filteredSessions.length ? filteredSessions.map((session) => (
                  <span key={session._id} className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700">
                    {session.label} · Year {session.yearNumber}
                  </span>
                )) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-400">
                    No academic sessions match the current filters.
                  </div>
                )}
              </div>
            </div>

            <div className="card p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                  {getEntityIcon('subject')}
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold text-slate-900">Subject Overview</h3>
                  <p className="mt-1 text-sm text-slate-500">{filteredSubjects.length} subjects in the current view</p>
                </div>
              </div>
              <div className="mt-4 flex max-h-[260px] flex-wrap gap-2 overflow-y-auto pr-1">
                {filteredSubjects.length ? filteredSubjects.map((subject) => (
                  <span key={subject._id} className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
                    {subject.code} · {subject.name}
                  </span>
                )) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-400">
                    No subjects match the current filters.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="card p-8">
          <EmptyState
            icon="🔎"
            title="No records match your filters"
            description="Try a broader search or clear the current college and department filters."
          />
        </div>
      )}
    </div>
  );
}

export default function AcademicStructurePage() {
  const navigate = useNavigate();
  const [treeData, setTreeData] = useState([]);
  const [workspaceSummary, setWorkspaceSummary] = useState({
    colleges: 0,
    departments: 0,
    programs: 0,
    courses: 0,
    academicSessions: 0,
    sections: 0,
    subjects: 0,
    students: 0,
  });
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
  const [quickSetupOpen, setQuickSetupOpen] = useState(false);
  const [quickSetupForm, setQuickSetupForm] = useState(emptyQuickSetup);
  const [quickSetupSaving, setQuickSetupSaving] = useState(false);
  const [inlineForm, setInlineForm] = useState(emptyInlineForm);
  const [inlineSaving, setInlineSaving] = useState(false);
  const [inlineError, setInlineError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState({ open: false, resource: '', item: null, loading: false });
  const [selectedSection, setSelectedSection] = useState(null);
  const [assignmentRowId, setAssignmentRowId] = useState('');
  const [activeScreen, setActiveScreen] = useState('structure');
  const [previousScreen, setPreviousScreen] = useState('structure');
  const [facultySubjectsTab, setFacultySubjectsTab] = useState('subjects');
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedCollegeId, setSelectedCollegeId] = useState('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  const [selectedProgramId, setSelectedProgramId] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [workspaceView, setWorkspaceView] = useState('hierarchy');
  const [recordsQuery, setRecordsQuery] = useState('');
  const [recordsCollegeFilter, setRecordsCollegeFilter] = useState('');
  const [recordsDepartmentFilter, setRecordsDepartmentFilter] = useState('');
  const [expandedCatalogColleges, setExpandedCatalogColleges] = useState({});

  const loadAcademicWorkspace = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [
        treeRes,
        summaryRes,
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
        API.get('/academics/workspace-summary'),
        API.get('/academics/colleges?paginate=false'),
        API.get('/academics/departments?paginate=false'),
        API.get('/academics/programs?paginate=false'),
        API.get('/academics/courses?paginate=false'),
        API.get('/academics/academic-sessions?paginate=false'),
        API.get('/academics/sections?paginate=false'),
        API.get('/academics/subjects?paginate=false'),
        API.get('/academics/section-subjects?paginate=false'),
        API.get('/academics/enrollments?paginate=false'),
        API.get('/users?role=faculty&limit=500'),
        API.get('/users?role=student&limit=500'),
      ]);

      setTreeData(treeRes.data?.data || []);
      setWorkspaceSummary(summaryRes.data?.data || {});
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

  useEffect(() => {
    if (!treeData.length) {
      setSelectedCollegeId('');
      setSelectedDepartmentId('');
      setSelectedProgramId('');
      setSelectedCourseId('');
      return;
    }

    const selectedCollege = treeData.find((college) => String(college._id) === String(selectedCollegeId)) || treeData[0];
    if (String(selectedCollegeId) !== String(selectedCollege?._id || '')) {
      setSelectedCollegeId(selectedCollege?._id || '');
    }

    const departments = selectedCollege?.departments || [];
    const selectedDepartment = departments.find((department) => String(department._id) === String(selectedDepartmentId)) || departments[0] || null;
    if (String(selectedDepartmentId) !== String(selectedDepartment?._id || '')) {
      setSelectedDepartmentId(selectedDepartment?._id || '');
    }

    const programs = selectedDepartment?.programs || [];
    const selectedProgram = programs.find((program) => String(program._id) === String(selectedProgramId)) || programs[0] || null;
    if (String(selectedProgramId) !== String(selectedProgram?._id || '')) {
      setSelectedProgramId(selectedProgram?._id || '');
    }

    const courses = selectedProgram?.courses || [];
    const selectedCourse = courses.find((course) => String(course._id) === String(selectedCourseId)) || courses[0] || null;
    if (String(selectedCourseId) !== String(selectedCourse?._id || '')) {
      setSelectedCourseId(selectedCourse?._id || '');
    }
  }, [treeData, selectedCollegeId, selectedDepartmentId, selectedProgramId, selectedCourseId]);

  useEffect(() => {
    if (!recordsCollegeFilter) return;
    const departmentExists = treeData
      .find((college) => String(college._id) === String(recordsCollegeFilter))
      ?.departments?.some((department) => String(department._id) === String(recordsDepartmentFilter));

    if (!departmentExists) {
      setRecordsDepartmentFilter('');
    }
  }, [recordsCollegeFilter, recordsDepartmentFilter, treeData]);

  const summaryCards = useMemo(() => {
    return [
      { label: 'Colleges', value: workspaceSummary.colleges, icon: <FiLayers size={16} /> },
      { label: 'Departments', value: workspaceSummary.departments, icon: <FiLayers size={16} /> },
      { label: 'Programs', value: workspaceSummary.programs, icon: <FiLayers size={16} /> },
      { label: 'Sections', value: workspaceSummary.sections, icon: <FiUsers size={16} /> },
      { label: 'Students', value: workspaceSummary.students, icon: <FiUsers size={16} /> },
      { label: 'Academic Sessions', value: workspaceSummary.academicSessions, icon: <FiGitBranch size={16} /> },
    ];
  }, [workspaceSummary]);

  const selectedCollege = useMemo(
    () => treeData.find((college) => String(college._id) === String(selectedCollegeId)) || null,
    [treeData, selectedCollegeId]
  );
  const selectedDepartment = useMemo(
    () => (selectedCollege?.departments || []).find((department) => String(department._id) === String(selectedDepartmentId)) || null,
    [selectedCollege, selectedDepartmentId]
  );
  const selectedProgram = useMemo(
    () => (selectedDepartment?.programs || []).find((program) => String(program._id) === String(selectedProgramId)) || null,
    [selectedDepartment, selectedProgramId]
  );
  const selectedCourse = useMemo(
    () => (selectedProgram?.courses || []).find((course) => String(course._id) === String(selectedCourseId)) || null,
    [selectedProgram, selectedCourseId]
  );

  const focusHierarchyFromItem = (type, item) => {
    if (!item) return;

    if (type === 'college') {
      setSelectedCollegeId(item._id);
      setSelectedDepartmentId('');
      setSelectedProgramId('');
      setSelectedCourseId('');
      setWorkspaceView('hierarchy');
      return;
    }

    const departmentValue = item.department?._id || item.department || '';
    const programValue = item.program?._id || item.program || '';
    const courseValue = item.course?._id || item.course || '';
    const collegeValue = item.college?._id || item.college || '';

    if (type === 'department') {
      setSelectedCollegeId(collegeValue);
      setSelectedDepartmentId(item._id);
      setSelectedProgramId('');
      setSelectedCourseId('');
      setWorkspaceView('hierarchy');
      return;
    }

    if (type === 'program') {
      const parentDepartment = options.departments.find((department) => String(department._id) === String(departmentValue));
      setSelectedCollegeId(parentDepartment?.college?._id || parentDepartment?.college || '');
      setSelectedDepartmentId(departmentValue);
      setSelectedProgramId(item._id);
      setSelectedCourseId('');
      setWorkspaceView('hierarchy');
      return;
    }

    if (type === 'course') {
      const parentProgram = options.programs.find((program) => String(program._id) === String(programValue));
      const parentDepartment = options.departments.find((department) => String(department._id) === String(parentProgram?.department?._id || parentProgram?.department || departmentValue));
      setSelectedCollegeId(parentDepartment?.college?._id || parentDepartment?.college || '');
      setSelectedDepartmentId(parentDepartment?._id || departmentValue);
      setSelectedProgramId(parentProgram?._id || programValue);
      setSelectedCourseId(item._id);
      setWorkspaceView('hierarchy');
      return;
    }

    if (type === 'section') {
      const parentProgram = options.programs.find((program) => String(program._id) === String(programValue));
      const parentDepartment = options.departments.find((department) => String(department._id) === String(departmentValue || parentProgram?.department?._id || parentProgram?.department || ''));
      setSelectedCollegeId(parentDepartment?.college?._id || parentDepartment?.college || '');
      setSelectedDepartmentId(parentDepartment?._id || departmentValue);
      setSelectedProgramId(parentProgram?._id || programValue);
      setSelectedCourseId(courseValue);
      openSectionDetail(item);
    }
  };

  const goScreen = (screen) => {
    setPreviousScreen(activeScreen);
    setActiveScreen(screen);
  };

  const goBack = () => {
    setActiveScreen(previousScreen || 'structure');
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
    if (resource === 'subject') {
      const selectedSession = options.academicSessions.find(
        (session) => String(session.program?._id || session.program) === String(parentItem?.program || selectedProgramId || '')
      );
      base.values = {
        code: '',
        name: '',
        department: parentItem?.department || selectedDepartmentId || '',
        program: parentItem?.program || selectedProgramId || '',
        course: parentType === 'course' ? parentItem?._id || '' : selectedCourseId || '',
        academicSession: selectedSession?._id || '',
        credits: 0,
        type: 'core',
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
      subject: 'subject',
    };
    const resource = resourceMap[resourceType];
    if (!resource) return;

    const values = resource === 'college'
      ? { name: item.name || '', code: item.code || '', description: item.description || '' }
      : resource === 'department'
        ? { name: item.name || '', code: item.code || '', college: item.college?._id || item.college || '' }
        : resource === 'program'
          ? { name: item.name || '', code: item.code || '', durationYears: item.durationYears || 4, department: item.department?._id || item.department || '' }
          : resource === 'course'
            ? { name: item.name || '', code: item.code || '', program: item.program?._id || item.program || '', department: item.department?._id || item.department || '' }
            : resource === 'session'
              ? { program: item.program?._id || item.program || '', yearNumber: item.yearNumber || 1, label: item.label || '' }
              : resource === 'section'
                ? {
                    program: item.program?._id || item.program || '',
                    course: item.course?._id || item.course || '',
                    academicSession: item.academicSession?._id || item.academicSession || '',
                    department: item.department?._id || item.department || '',
                    studyYear: item.studyYear || 1,
                    name: item.name || '',
                    capacity: item.capacity || 60,
                  }
                : {
                    code: item.code || '',
                    name: item.name || '',
                    department: item.department?._id || item.department || '',
                    program: item.program?._id || item.program || '',
                    course: item.course?._id || item.course || '',
                    academicSession: item.academicSession?._id || item.academicSession || '',
                    credits: item.credits ?? 0,
                    type: item.type || 'core',
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
        subject: 'subjects',
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

  const sectionAssignments = useMemo(() => {
    if (!selectedSection?._id) return [];
    return (options['section-subjects'] || []).filter(
      (entry) => String(entry.section?._id || entry.section) === String(selectedSection._id)
    );
  }, [options, selectedSection]);
  const sectionStudents = useMemo(() => {
    if (!selectedSection?._id) return [];
    return (options.enrollments || []).filter(
      (entry) => String(entry.section?._id || entry.section) === String(selectedSection._id) && entry.status === 'active'
    );
  }, [options.enrollments, selectedSection]);
  const sectionSubjectOptions = useMemo(() => options['section-subjects'] || [], [options]);

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

  const filteredSubjects = useMemo(() => {
    return (options.subjects || []).filter((subject) => {
      if (selectedProgramId && String(subject.program?._id || subject.program) !== String(selectedProgramId)) return false;
      if (selectedCourseId && String(subject.course?._id || subject.course) !== String(selectedCourseId)) return false;
      return true;
    });
  }, [options.subjects, selectedProgramId, selectedCourseId]);

  const facultyCards = useMemo(() => {
    return (options.faculty || []).map((faculty) => {
      const assignments = sectionSubjectOptions.filter(
        (entry) => String(entry.faculty?._id || entry.faculty) === String(faculty._id)
      );
      return { faculty, assignments };
    });
  }, [options.faculty, sectionSubjectOptions]);

  const selectedSubjectAssignments = useMemo(() => {
    if (!selectedSubject?._id) return [];
    return (options['section-subjects'] || []).filter(
      (entry) => String(entry.subject?._id || entry.subject) === String(selectedSubject._id)
    );
  }, [options, selectedSubject]);

  const openSectionDetail = (section) => {
    setSelectedSection(section);
    goScreen('sectionDetail');
  };

  const openSubjectDetail = (subject) => {
    setSelectedSubject(subject);
    goScreen('subjectDetail');
  };

  const openFacultySubjects = () => {
    setFacultySubjectsTab('subjects');
    goScreen('facultySubjects');
  };

  const handleFacultyOpen = (faculty) => {
    navigate(`/admin/users/${faculty.systemId}`);
  };

  const getDeleteResource = (type) => ({
    college: 'colleges',
    department: 'departments',
    program: 'programs',
    course: 'courses',
    session: 'academic-sessions',
    section: 'sections',
    subject: 'subjects',
  }[type]);

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

      <Modal
        open={Boolean(inlineForm.resource)}
        onClose={() => setInlineForm(emptyInlineForm)}
        panelClassName="max-w-2xl"
      >
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-display text-2xl font-bold text-gray-900">
                {inlineForm.mode === 'edit'
                  ? `Edit ${inlineForm.resource === 'session' ? 'Academic Session' : inlineForm.resource}`
                  : `Add ${inlineForm.resource === 'session' ? 'Academic Session' : inlineForm.resource}`}
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {inlineForm.parentLabel
                  ? `This record will be connected under ${inlineForm.parentLabel}.`
                  : 'Use the same managed flow without leaving the structure workspace.'}
              </p>
            </div>
            <button type="button" onClick={() => setInlineForm(emptyInlineForm)} className="rounded-2xl border border-gray-200 p-2 text-gray-400 transition hover:bg-gray-50 hover:text-gray-600">
              <FiX size={18} />
            </button>
          </div>

          <form onSubmit={handleInlineSave} className="mt-6 space-y-4">
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
                <select className="input" value={inlineForm.values.department || ''} onChange={(e) => setInlineForm((c) => ({ ...c, values: { ...c.values, department: e.target.value } }))} required>
                  <option value="">Select Department</option>
                  {options.departments.map((department) => <option key={department._id} value={department._id}>{formatEntityName(department)}</option>)}
                </select>
                <input className="input" placeholder="Program Name" value={inlineForm.values.name || ''} onChange={(e) => setInlineForm((c) => ({ ...c, values: { ...c.values, name: e.target.value } }))} required />
                <input className="input" placeholder="Program Code" value={inlineForm.values.code || ''} onChange={(e) => setInlineForm((c) => ({ ...c, values: { ...c.values, code: e.target.value.toUpperCase() } }))} required />
                <input className="input" type="number" min="1" max="10" placeholder="Duration Years" value={inlineForm.values.durationYears || 4} onChange={(e) => setInlineForm((c) => ({ ...c, values: { ...c.values, durationYears: Number(e.target.value) || 4 } }))} />
              </div>
            ) : null}

            {inlineForm.resource === 'course' ? (
              <div className="grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <select className="input" value={inlineForm.values.department || ''} onChange={(e) => setInlineForm((c) => ({ ...c, values: { ...c.values, department: e.target.value, program: '' } }))} required>
                    <option value="">Select Department</option>
                    {options.departments.map((department) => <option key={department._id} value={department._id}>{formatEntityName(department)}</option>)}
                  </select>
                  <select className="input" value={inlineForm.values.program || ''} onChange={(e) => setInlineForm((c) => ({ ...c, values: { ...c.values, program: e.target.value } }))} required>
                    <option value="">Select Program</option>
                    {options.programs
                      .filter((program) => !inlineForm.values.department || String(program.department?._id || program.department) === String(inlineForm.values.department))
                      .map((program) => <option key={program._id} value={program._id}>{formatEntityName(program)}</option>)}
                  </select>
                </div>
                <input className="input" placeholder="Course Name" value={inlineForm.values.name || ''} onChange={(e) => setInlineForm((c) => ({ ...c, values: { ...c.values, name: e.target.value } }))} required />
                <input className="input" placeholder="Course Code" value={inlineForm.values.code || ''} onChange={(e) => setInlineForm((c) => ({ ...c, values: { ...c.values, code: e.target.value.toUpperCase() } }))} required />
              </div>
            ) : null}

            {inlineForm.resource === 'session' ? (
              <div className="grid gap-4">
                <select className="input" value={inlineForm.values.program || ''} onChange={(e) => setInlineForm((c) => ({ ...c, values: { ...c.values, program: e.target.value } }))} required>
                  <option value="">Select Program</option>
                  {options.programs.map((program) => <option key={program._id} value={program._id}>{formatEntityName(program)}</option>)}
                </select>
                <input className="input" type="number" min="1" max="10" placeholder="Study Year" value={inlineForm.values.yearNumber || 1} onChange={(e) => setInlineForm((c) => ({ ...c, values: { ...c.values, yearNumber: Number(e.target.value) || 1 } }))} required />
                <input className="input" placeholder="Academic Session Label" value={inlineForm.values.label || ''} onChange={(e) => setInlineForm((c) => ({ ...c, values: { ...c.values, label: e.target.value } }))} required />
              </div>
            ) : null}

            {inlineForm.resource === 'section' ? (
              <div className="grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <select className="input" value={inlineForm.values.department || ''} onChange={(e) => setInlineForm((c) => ({ ...c, values: { ...c.values, department: e.target.value, program: '', course: '', academicSession: '' } }))} required>
                    <option value="">Select Department</option>
                    {options.departments.map((department) => <option key={department._id} value={department._id}>{formatEntityName(department)}</option>)}
                  </select>
                  <select className="input" value={inlineForm.values.program || ''} onChange={(e) => setInlineForm((c) => ({ ...c, values: { ...c.values, program: e.target.value, course: '', academicSession: '' } }))} required>
                    <option value="">Select Program</option>
                    {options.programs
                      .filter((program) => !inlineForm.values.department || String(program.department?._id || program.department) === String(inlineForm.values.department))
                      .map((program) => <option key={program._id} value={program._id}>{formatEntityName(program)}</option>)}
                  </select>
                </div>
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

            {inlineForm.resource === 'subject' ? (
              <div className="grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <input className="input" placeholder="Subject Code" value={inlineForm.values.code || ''} onChange={(e) => setInlineForm((c) => ({ ...c, values: { ...c.values, code: e.target.value.toUpperCase() } }))} required />
                  <input className="input" placeholder="Subject Name" value={inlineForm.values.name || ''} onChange={(e) => setInlineForm((c) => ({ ...c, values: { ...c.values, name: e.target.value } }))} required />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <select className="input" value={inlineForm.values.department || ''} onChange={(e) => setInlineForm((c) => ({ ...c, values: { ...c.values, department: e.target.value, program: '', course: '', academicSession: '' } }))} required>
                    <option value="">Select Department</option>
                    {options.departments.map((department) => <option key={department._id} value={department._id}>{formatEntityName(department)}</option>)}
                  </select>
                  <select className="input" value={inlineForm.values.program || ''} onChange={(e) => setInlineForm((c) => ({ ...c, values: { ...c.values, program: e.target.value, course: '', academicSession: '' } }))} required>
                    <option value="">Select Program</option>
                    {options.programs
                      .filter((program) => !inlineForm.values.department || String(program.department?._id || program.department) === String(inlineForm.values.department))
                      .map((program) => <option key={program._id} value={program._id}>{formatEntityName(program)}</option>)}
                  </select>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <select className="input" value={inlineForm.values.course || ''} onChange={(e) => setInlineForm((c) => ({ ...c, values: { ...c.values, course: e.target.value } }))}>
                    <option value="">Select Course</option>
                    {options.courses
                      .filter((course) => !inlineForm.values.program || String(course.program?._id || course.program) === String(inlineForm.values.program))
                      .map((course) => <option key={course._id} value={course._id}>{formatEntityName(course)}</option>)}
                  </select>
                  <select className="input" value={inlineForm.values.academicSession || ''} onChange={(e) => setInlineForm((c) => ({ ...c, values: { ...c.values, academicSession: e.target.value } }))} required>
                    <option value="">Select Academic Session</option>
                    {options.academicSessions
                      .filter((session) => !inlineForm.values.program || String(session.program?._id || session.program) === String(inlineForm.values.program))
                      .map((session) => <option key={session._id} value={session._id}>{session.label} · Year {session.yearNumber}</option>)}
                  </select>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <input className="input" type="number" min="0" placeholder="Credits" value={inlineForm.values.credits ?? 0} onChange={(e) => setInlineForm((c) => ({ ...c, values: { ...c.values, credits: Number(e.target.value) || 0 } }))} />
                  <select className="input" value={inlineForm.values.type || 'core'} onChange={(e) => setInlineForm((c) => ({ ...c, values: { ...c.values, type: e.target.value } }))}>
                    <option value="core">Core</option>
                    <option value="elective">Elective</option>
                    <option value="common">Common</option>
                  </select>
                </div>
              </div>
            ) : null}

            {inlineError ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{inlineError}</div> : null}

            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setInlineForm(emptyInlineForm)} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={inlineSaving} className="btn-primary">
                {inlineSaving ? 'Saving...' : inlineForm.mode === 'edit' ? 'Save Changes' : 'Create Record'}
              </button>
            </div>
          </form>
        </div>
      </Modal>

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

      <div className="space-y-4">
        <div className="min-w-0">
          <p className="font-display text-lg font-semibold leading-8 text-gray-900 sm:text-xl">
            {activeScreen === 'structure'
              ? 'Build and navigate the university hierarchy with a cleaner, faster workspace.'
              : activeScreen === 'facultySubjects'
                ? 'Browse subjects and faculty relationships from the same academic workspace without losing context.'
                : activeScreen === 'sectionDetail'
                  ? 'Review section details, student membership, and faculty ownership in one focused academic view.'
                  : 'Inspect subject mappings, assigned faculty, and linked sections from the same academic workspace.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {activeScreen === 'structure' ? (
            <>
              <HelpTooltip title="Academic workspace help" items={WORKSPACE_HELP_ITEMS} />
              <button type="button" onClick={openFacultySubjects} className="btn-primary">
                <FiBookOpen size={15} />
                View Subjects & Faculty
              </button>
              <button type="button" onClick={() => setWorkspaceView((current) => current === 'hierarchy' ? 'catalog' : 'hierarchy')} className="btn-secondary">
                <FiLayers size={15} />
                {workspaceView === 'hierarchy' ? 'View All Records' : 'Back to Hierarchy'}
              </button>
              <button type="button" onClick={() => navigate('/academics/advanced')} className="btn-secondary">
                <FiLayers size={15} />
                Advanced Operations
              </button>
              <button type="button" onClick={() => setQuickSetupOpen(true)} className="btn-secondary">
                <FiPlus size={15} />
                Quick Setup
              </button>
              <button type="button" onClick={loadAcademicWorkspace} className="btn-secondary">
                <FiRefreshCw size={15} />
                Refresh
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={goBack} className="btn-secondary">
                <FiArrowLeft size={15} />
                Back
              </button>
              <button type="button" onClick={loadAcademicWorkspace} className="btn-secondary">
                <FiRefreshCw size={15} />
                Refresh
              </button>
            </>
          )}
        </div>
      </div>

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

      {activeScreen === 'structure' ? (
        <div className="space-y-6">
          {!treeData.length ? (
            <div className="card p-8">
              <EmptyState
                icon="🏫"
                title="No academic structure exists yet"
                description="Start by creating your first college, then continue through departments, programs, courses, sections, and subjects."
                action={<button type="button" onClick={() => openCreateForm('college')} className="btn-primary">Add First College</button>}
              />
            </div>
          ) : null}

          {workspaceView === 'hierarchy' ? (
            <div className="card overflow-hidden p-0">
              <div className="overflow-x-auto">
                <div className="flex h-[72vh] min-h-[540px] min-w-[1280px] max-h-[760px] flex-col xl:min-w-0 xl:flex-row">
                  <DrilldownColumn
                    title="Colleges"
                    type="college"
                    items={treeData}
                    selectedId={selectedCollegeId}
                    onSelect={(college) => {
                      setSelectedCollegeId(college._id);
                      setSelectedDepartmentId('');
                      setSelectedProgramId('');
                      setSelectedCourseId('');
                    }}
                    onAdd={(parentItem, childResource) => {
                      if (childResource) openCreateForm(childResource, 'college', parentItem);
                      else openCreateForm('college');
                    }}
                    onEdit={(item) => openEditForm('college', item)}
                    onDelete={(item) => setConfirmDelete({ open: true, resource: getDeleteResource('college'), item, loading: false })}
                    emptyLabel="Add the first college to start the structure."
                  />
                  <DrilldownColumn
                    title="Departments"
                    type="department"
                    items={selectedCollege?.departments || []}
                    selectedId={selectedDepartmentId}
                    onSelect={(department) => {
                      setSelectedDepartmentId(department._id);
                      setSelectedProgramId('');
                      setSelectedCourseId('');
                    }}
                    onAdd={(parentItem, childResource) => {
                      if (childResource) openCreateForm(childResource, 'department', parentItem);
                      else openCreateForm('department', 'college', selectedCollege);
                    }}
                    onEdit={(item) => openEditForm('department', item)}
                    onDelete={(item) => setConfirmDelete({ open: true, resource: getDeleteResource('department'), item, loading: false })}
                    emptyLabel={selectedCollege ? 'No departments under this college yet.' : 'Select a college first.'}
                  />
                  <DrilldownColumn
                    title="Programs"
                    type="program"
                    items={selectedDepartment?.programs || []}
                    selectedId={selectedProgramId}
                    onSelect={(program) => {
                      setSelectedProgramId(program._id);
                      setSelectedCourseId('');
                    }}
                    onAdd={(parentItem, childResource) => {
                      if (childResource) openCreateForm(childResource, 'program', parentItem);
                      else openCreateForm('program', 'department', selectedDepartment);
                    }}
                    onEdit={(item) => openEditForm('program', item)}
                    onDelete={(item) => setConfirmDelete({ open: true, resource: getDeleteResource('program'), item, loading: false })}
                    emptyLabel={selectedDepartment ? 'No programs under this department yet.' : 'Select a department first.'}
                  />
                  <DrilldownColumn
                    title="Courses"
                    type="course"
                    items={selectedProgram?.courses || []}
                    selectedId={selectedCourseId}
                    onSelect={(course) => setSelectedCourseId(course._id)}
                    onAdd={(parentItem, childResource) => {
                      if (childResource) openCreateForm(childResource, 'course', parentItem);
                      else openCreateForm('course', 'program', selectedProgram);
                    }}
                    onEdit={(item) => openEditForm('course', item)}
                    onDelete={(item) => setConfirmDelete({ open: true, resource: getDeleteResource('course'), item, loading: false })}
                    emptyLabel={selectedProgram ? 'No courses under this program yet.' : 'Select a program first.'}
                  />
                  <DrilldownColumn
                    title="Sections"
                    type="section"
                    items={selectedCourse?.sections || []}
                    selectedId={selectedSection?._id}
                    onSelect={openSectionDetail}
                    onAdd={() => openCreateForm('section', 'course', selectedCourse)}
                    onEdit={(item) => openEditForm('section', item)}
                    onDelete={(item) => setConfirmDelete({ open: true, resource: getDeleteResource('section'), item, loading: false })}
                    emptyLabel={selectedCourse ? 'No sections under this course yet.' : 'Select a course first.'}
                  />
                </div>
              </div>
              <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-500">
                Click through the columns to drill down. Each list now scrolls vertically inside the workspace instead of stretching the entire card.
              </div>
            </div>
          ) : (
            <HierarchyExplorer
              treeData={treeData}
              academicSessions={options.academicSessions}
              subjects={options.subjects}
              query={recordsQuery}
              collegeFilter={recordsCollegeFilter}
              departmentFilter={recordsDepartmentFilter}
              onQueryChange={setRecordsQuery}
              onCollegeFilterChange={setRecordsCollegeFilter}
              onDepartmentFilterChange={setRecordsDepartmentFilter}
              expandedColleges={expandedCatalogColleges}
              onToggleCollege={(collegeId) => setExpandedCatalogColleges((current) => ({ ...current, [collegeId]: !(current[collegeId] ?? true) }))}
              onOpenCollege={(college) => focusHierarchyFromItem('college', college)}
              onOpenDepartment={(department) => focusHierarchyFromItem('department', department)}
              onOpenProgram={(program) => focusHierarchyFromItem('program', program)}
              onOpenCourse={(course) => focusHierarchyFromItem('course', course)}
              onOpenSection={(section) => focusHierarchyFromItem('section', section)}
              onEdit={(type, item) => openEditForm(type, item)}
              onDelete={(type, item) => setConfirmDelete({
                open: true,
                resource: getDeleteResource(type),
                item,
                loading: false,
              })}
            />
          )}
        </div>
      ) : null}

      {activeScreen === 'sectionDetail' && selectedSection ? (
        <div className="space-y-6">
          <div className="card p-6">
            <button type="button" onClick={goBack} className="mb-4 flex items-center gap-2 text-sm font-medium text-gray-500 transition hover:text-gray-800">
              <FiArrowLeft size={15} />
              Back to structure
            </button>
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
              <span>{selectedCollege?.name || selectedSection.department?.college?.name || 'College'}</span>
              <FiChevronRight size={12} />
              <span>{selectedDepartment?.name || selectedSection.department?.name || 'Department'}</span>
              <FiChevronRight size={12} />
              <span>{selectedProgram?.name || selectedSection.program?.name || 'Program'}</span>
              <FiChevronRight size={12} />
              <span>{selectedCourse?.name || selectedSection.course?.name || 'Course'}</span>
              <FiChevronRight size={12} />
              <span className="text-gray-900">{selectedSection.name}</span>
            </div>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl font-bold text-gray-900">Section {selectedSection.name}</h2>
                <p className="mt-1 text-sm text-gray-500">Review section metadata first, then manage related teaching assignments below.</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={() => openEditForm('section', selectedSection)} className="btn-secondary">
                  <FiEdit2 size={15} />
                  Edit Section
                </button>
                <button type="button" onClick={() => setConfirmDelete({ open: true, resource: 'sections', item: selectedSection, loading: false })} className="btn-secondary text-red-600 hover:text-red-700">
                  <FiTrash2 size={15} />
                  Delete
                </button>
              </div>
            </div>
            <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <DetailPill label="Course" value={selectedSection.course?.name} />
              <DetailPill label="Academic Session" value={selectedSection.academicSession?.label} />
              <DetailPill label="Study Year" value={selectedSection.studyYear ? `Year ${selectedSection.studyYear}` : '—'} />
              <DetailPill label="Capacity" value={selectedSection.capacity} />
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_340px]">
            <div className="card p-6">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-xl font-bold text-gray-900">Section Subjects</h3>
                  <p className="mt-1 text-sm text-gray-500">Assign faculty inside the section context so the academic ownership is always visible.</p>
                </div>
                <button type="button" onClick={() => setAssignmentRowId('')} className="btn-secondary text-xs">
                  Reset Assigners
                </button>
              </div>

              {sectionAssignments.length ? (
                <div className="space-y-3">
                  {sectionAssignments.map((assignment) => (
                    <div key={assignment._id} className={`rounded-2xl border px-4 py-4 ${assignment.faculty?._id ? 'border-gray-100 bg-gray-50 dark:border-slate-800 dark:bg-slate-900/80' : 'border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-950/20'}`}>
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <button type="button" onClick={() => openSubjectDetail(assignment.subject)} className="text-left">
                            <p className="font-semibold text-gray-900 transition hover:text-blue-700">{assignment.subject?.name || 'Subject'}</p>
                          </button>
                          <p className="mt-1 text-sm text-gray-500">
                            {(assignment.subject?.code || 'No subject code')}{assignment.semester ? ` · ${assignment.semester}` : ''}
                          </p>
                          <p className="mt-2 text-sm text-gray-700">
                            Faculty:{' '}
                            {assignment.faculty?.systemId ? (
                              <button type="button" onClick={() => handleFacultyOpen(assignment.faculty)} className="font-medium text-blue-700 transition hover:underline">
                                {assignment.faculty.name}
                              </button>
                            ) : (
                              <span className="inline-flex rounded-full border border-amber-300 bg-amber-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200">No faculty assigned</span>
                            )}
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

            <div className="space-y-6">
              <div className="card p-6">
                <h3 className="font-display text-lg font-bold text-gray-900">Enrolled Students</h3>
                <p className="mt-1 text-sm text-gray-500">Names, IDs, and direct profile links are available here so section review stays operational.</p>
                <div className="mt-4 space-y-3">
                  {sectionStudents.length ? sectionStudents.map((enrollment) => (
                    <div key={enrollment._id} className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-900/80">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-gray-900">{enrollment.student?.name || 'Student'}</p>
                          <p className="mt-1 text-sm text-gray-500">{enrollment.student?.systemId || 'No ID'}{enrollment.semester ? ` · ${enrollment.semester}` : ''}</p>
                        </div>
                        {enrollment.student?.systemId ? (
                          <button type="button" onClick={() => navigate(`/admin/users/${enrollment.student.systemId}`)} className="btn-secondary text-xs">
                            Open Profile
                          </button>
                        ) : null}
                      </div>
                    </div>
                  )) : (
                    <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-5 text-sm text-gray-400">
                      No active students are enrolled in this section yet.
                    </div>
                  )}
                </div>
              </div>

              <div className="card p-6">
                <h3 className="font-display text-lg font-bold text-gray-900">Section Context</h3>
                <div className="mt-4 space-y-3 text-sm text-gray-600">
                  <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
                    <p className="font-semibold text-gray-900">Student Access</p>
                    <p className="mt-1">Students attached to this section inherit their timetable, attendance scope, and subject list from these mappings.</p>
                  </div>
                  <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
                    <p className="font-semibold text-gray-900">Faculty Scope</p>
                    <p className="mt-1">Faculty linked here become the teaching owners for the section’s subject delivery and attendance workflows.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {activeScreen === 'facultySubjects' ? (
        <div className="space-y-6">
          <div className="card overflow-hidden p-0">
            <div className="border-b border-gray-100 px-6 pt-4">
              <div className="flex gap-2">
                {[
                  { key: 'subjects', label: 'Subjects' },
                  { key: 'faculty', label: 'Faculty' },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setFacultySubjectsTab(tab.key)}
                    className={`border-b-2 px-4 py-3 text-sm font-semibold transition ${facultySubjectsTab === tab.key ? 'border-blue-500 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-6">
              {facultySubjectsTab === 'subjects' ? (
                <div className="space-y-5">
                  <div className="flex justify-end">
                    <button type="button" onClick={() => navigate('/academics/advanced')} className="btn-secondary text-xs">
                      Subject Operations
                    </button>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {filteredSubjects.length ? filteredSubjects.map((subject) => {
                      const assignments = (options['section-subjects'] || []).filter(
                        (entry) => String(entry.subject?._id || entry.subject) === String(subject._id)
                      );
                      return (
                        <button
                          key={subject._id}
                          type="button"
                          onClick={() => openSubjectDetail(subject)}
                          className="card group p-5 text-left transition hover:border-blue-200 hover:shadow-md"
                        >
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">{subject.code}</p>
                          <p className="mt-2 text-base font-bold text-gray-900 group-hover:text-blue-700">{subject.name}</p>
                          <p className="mt-2 text-sm text-gray-500">{subject.credits ? `${subject.credits} credits` : 'Credits not set'} · {subject.academicSession?.label || 'Session'}</p>
                          <div className="mt-4 flex flex-wrap gap-2">
                            {assignments.length ? assignments.slice(0, 3).map((assignment) => (
                              <span key={assignment._id} className="badge border border-slate-200 bg-slate-100 text-slate-700">
                                {assignment.faculty?.name || 'Unassigned'}
                              </span>
                            )) : <span className="badge border border-amber-200 bg-amber-100 text-amber-800">No faculty assigned</span>}
                          </div>
                        </button>
                      );
                    }) : (
                      <div className="md:col-span-2 xl:col-span-3">
                        <EmptyState icon="📚" title="No subjects available" description="Subjects will appear here based on the current academic structure and filters." />
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {facultyCards.length ? facultyCards.map(({ faculty, assignments }) => (
                    <button
                      key={faculty._id}
                      type="button"
                      onClick={() => handleFacultyOpen(faculty)}
                      className="card group p-5 text-left transition hover:border-blue-200 hover:shadow-md"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar user={faculty} size="md" />
                        <div className="min-w-0">
                          <p className="truncate text-base font-bold text-gray-900 group-hover:text-blue-700">{faculty.name}</p>
                          <p className="text-sm text-gray-500">{faculty.systemId}</p>
                        </div>
                      </div>
                      <div className="mt-4 space-y-2">
                        {assignments.length ? assignments.slice(0, 4).map((assignment) => (
                          <div key={assignment._id} className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                            <span className="font-semibold text-gray-800">{assignment.subject?.code || 'SUBJ'}</span>
                            {' · '}
                            {assignment.subject?.name || 'Subject'}
                          </div>
                        )) : (
                          <div className="rounded-xl border border-dashed border-gray-200 px-3 py-3 text-xs text-gray-400">
                            No assigned subjects yet.
                          </div>
                        )}
                      </div>
                    </button>
                  )) : (
                    <div className="md:col-span-2 xl:col-span-3">
                      <EmptyState icon="👩‍🏫" title="No faculty accounts available" description="Faculty users will appear here as soon as they are provisioned." />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

        </div>
      ) : null}

      {activeScreen === 'subjectDetail' && selectedSubject ? (
        <div className="space-y-6">
          <div className="card p-6">
            <button type="button" onClick={goBack} className="mb-4 flex items-center gap-2 text-sm font-medium text-gray-500 transition hover:text-gray-800">
              <FiArrowLeft size={15} />
              Back to faculty & subjects
            </button>
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
              <span>Academic Workspace</span>
              <FiChevronRight size={12} />
              <span>Subjects</span>
              <FiChevronRight size={12} />
              <span className="text-gray-900">{selectedSubject.code}</span>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                <FiBookOpen size={20} />
              </div>
              <div>
                <h2 className="font-display text-2xl font-bold text-gray-900">{selectedSubject.name}</h2>
                <p className="mt-1 text-sm text-gray-500">{selectedSubject.code} · {selectedSubject.academicSession?.label || 'Academic Session'}</p>
              </div>
            </div>
            <div className="mt-6 grid gap-3 md:grid-cols-4">
              <DetailPill label="Department" value={selectedSubject.department?.name} />
              <DetailPill label="Program" value={selectedSubject.program?.name} />
              <DetailPill label="Course" value={selectedSubject.course?.name} />
              <DetailPill label="Credits" value={selectedSubject.credits ?? 0} />
            </div>
          </div>

          <div className="card p-6">
            <h3 className="font-display text-lg font-bold text-gray-900">Assigned Faculty & Sections</h3>
            <p className="mt-1 text-sm text-gray-500">This shows where the subject is currently delivered and which faculty member is attached to each mapping.</p>
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {selectedSubjectAssignments.length ? selectedSubjectAssignments.map((assignment) => (
                <div key={assignment._id} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  <p className="text-sm font-semibold text-gray-900">Section {assignment.section?.name || '—'}</p>
                  <p className="mt-1 text-xs text-gray-500">{assignment.section?.academicSession?.label || selectedSubject.academicSession?.label || 'Academic Session'} · {assignment.semester || 'Semester not set'}</p>
                  <div className="mt-4">
                    {assignment.faculty?.systemId ? (
                      <button type="button" onClick={() => handleFacultyOpen(assignment.faculty)} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2 transition hover:border-blue-200 hover:bg-blue-50">
                        <Avatar user={assignment.faculty} size="sm" />
                        <div className="text-left">
                          <p className="text-sm font-semibold text-gray-900">{assignment.faculty.name}</p>
                          <p className="text-xs text-gray-500">Open faculty profile</p>
                        </div>
                      </button>
                    ) : (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm font-medium text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/20 dark:text-amber-200">No faculty assigned yet.</div>
                    )}
                  </div>
                </div>
              )) : (
                <div className="md:col-span-2 xl:col-span-3 rounded-2xl border border-dashed border-gray-200 px-4 py-5 text-sm text-gray-400">
                  This subject is not linked to any section mappings yet.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
