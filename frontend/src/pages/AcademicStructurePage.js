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
  FiCopy,
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
import { subjectMatchesCourse } from '../utils/academicScope';

const TREE_ACTIONS = {
  college: ['department'],
  department: ['program'],
  program: ['course', 'session'],
  course: ['subject', 'section'],
  session: [],
  subject: [],
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

const emptyOrgUnitForm = {
  id: '',
  name: '',
  code: '',
  type: 'operational',
  collegeId: '',
  linkedDepartmentId: '',
  description: '',
};

const formatEntityName = (entity) => {
  if (!entity) return '—';
  if (entity.name && entity.code) return `${entity.name} (${entity.code})`;
  return entity.name || entity.label || entity.code || entity.email || entity.systemId || entity._id;
};

const getEntityId = (entity) => String(entity?._id || entity || '');

const getProgramSections = (program) => [
  ...((program?.courses || []).flatMap((course) => course.sections || [])),
  ...(program?.standaloneSections || []),
];

const getProgramSubjects = (program, subjects = []) => (
  subjects.filter((subject) => getEntityId(subject.program) === getEntityId(program))
);

const getCourseSubjects = (course, subjects = []) => (
  subjects.filter((subject) => subjectMatchesCourse(subject, getEntityId(course)))
);

const getSessionSections = (session, sections = []) => (
  sections.filter((section) => getEntityId(section.academicSession) === getEntityId(session))
);

const getSessionSubjects = (session, subjects = []) => (
  subjects.filter((subject) => getEntityId(subject.academicSession) === getEntityId(session))
);

const buildActiveStudentRecords = (enrollments = []) => {
  const active = enrollments.filter((entry) => entry?.status === 'active' && entry?.student?._id);
  const records = new Map();

  active.forEach((entry) => {
    const student = entry.student || {};
    const current = records.get(String(student._id));
    if (current) return;

    records.set(String(student._id), {
      _id: student._id,
      name: student.name || 'Student',
      systemId: student.systemId || '',
      email: student.email || '',
      status: student.status || 'pending',
      isActive: student.isActive !== false,
      emailVerified: Boolean(student.emailVerified),
      passwordNeedsSetup: Boolean(student.passwordNeedsSetup),
      expiryDate: student.expiryDate || null,
      semester: entry.semester || '',
      section: entry.section || null,
      academicSession: entry.academicSession || entry.section?.academicSession || null,
      sectionName: entry.section?.name || '',
      programName: entry.section?.program?.name || '',
      courseName: entry.section?.course?.name || '',
      departmentName: entry.section?.department?.name || '',
      student,
    });
  });

  return [...records.values()];
};

const canShowAcademicMappingOptions = (student) => {
  if (!student) return false;
  if (student.status !== 'approved') return false;
  return true;
};

const groupSubjectsByTerm = (subjects = []) => {
  const groups = new Map();
  (subjects || []).forEach((subject) => {
    const termKey = Number.isFinite(subject?.term) ? subject.term : 0;
    const list = groups.get(termKey) || [];
    list.push(subject);
    groups.set(termKey, list);
  });
  return [...groups.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([term, items]) => ({
      term: term || null,
      label: term ? `Semester ${term}` : 'Unassigned semester',
      subjects: items,
    }));
};

const getColumnMeta = (type, item) => {
  if (!item) return '—';
  if (type === 'college') return `${(item.departments || []).length} departments`;
  if (type === 'department') return `${(item.programs || []).length} programs`;
  if (type === 'program') {
    const directSections = (item.standaloneSections || []).length;
    return [`${(item.courses || []).length} courses`, directSections ? `${directSections} direct sections` : ''].filter(Boolean).join(' · ');
  }
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
  if (type === 'student') {
    return [item.systemId || item.email || 'No ID', item.sectionName ? `Section ${item.sectionName}` : '', item.programName || ''].filter(Boolean).join(' · ');
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
            : type === 'student' ? <FiUsers size={16} />
            : type === 'subject' ? <FiBookOpen size={16} />
              : <FiGitBranch size={16} />
);

const getAssignedFacultyMembers = (entry) => {
  const members = Array.isArray(entry?.facultyMembers) ? entry.facultyMembers.filter(Boolean) : [];
  if (members.length) return members;
  return entry?.faculty ? [entry.faculty] : [];
};

const DetailPill = ({ label, value }) => (
  <div className="flex h-full flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5">
    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">{label}</p>
    <p className="mt-2 break-words text-sm font-semibold leading-5 text-gray-900">{value || '—'}</p>
  </div>
);

const SummaryCard = ({ card, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={!card.level}
    className={`group flex min-h-[76px] items-center rounded-2xl border px-4 py-3.5 text-left transition ${active ? 'border-slate-900 bg-slate-900 text-white shadow-lg' : 'border-slate-200 bg-white text-slate-900'} ${card.level ? 'hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md' : 'cursor-default'}`}
    title={`${card.label}: ${card.value}. ${card.description}`}
  >
    <p className={`w-full text-center text-xs font-semibold leading-4 sm:text-sm ${active ? 'text-white' : 'text-slate-900'}`}>{card.label}</p>
  </button>
);

const FocusMetricStack = ({ items = [] }) => (
  <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="space-y-3">
      {items.map((item, index) => {
        const toneClass = item.tone === 'blue'
          ? 'bg-blue-50 border-blue-100'
          : item.tone === 'emerald'
            ? 'bg-emerald-50 border-emerald-100'
            : 'bg-slate-50 border-slate-200';

        return (
          <div
            key={item.label}
            className={`rounded-2xl border px-4 py-4 ${toneClass} ${index !== items.length - 1 ? '' : ''}`}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{item.label}</p>
            <p className="mt-2 break-words text-base font-bold leading-6 text-slate-900">{item.value || '—'}</p>
          </div>
        );
      })}
    </div>
  </div>
);

const FocusPanel = ({ eyebrow, title, description, children, bodyClassName = '' }) => (
  <div className="flex h-full min-w-0 flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
    <div className="mb-5 space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{eyebrow}</p>
      <h4 className="break-words text-base font-bold leading-6 text-slate-900">{title}</h4>
      {description ? <p className="text-sm leading-6 text-slate-500">{description}</p> : null}
    </div>
    <div className={`min-w-0 ${bodyClassName}`.trim()}>{children}</div>
  </div>
);

const LinkedRecordButton = ({ title, subtitle, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex w-full flex-col items-start gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-left transition hover:border-blue-200 hover:bg-blue-50"
  >
    <span className="min-w-0 break-words text-sm font-semibold leading-5 text-slate-900">{title}</span>
    <span className="min-w-0 break-words text-xs leading-5 text-slate-500">{subtitle}</span>
  </button>
);

const ToolbarButton = ({ children, primary = false, active = false, className = '', ...props }) => (
  <button
    type="button"
    {...props}
    className={`${primary
      ? 'btn-primary'
      : active
        ? 'border border-slate-900 bg-slate-900 text-white hover:bg-slate-800 hover:text-white'
        : 'btn-secondary'} inline-flex min-h-8 items-center justify-center gap-1.5 whitespace-nowrap px-2.5 py-1.5 text-xs font-semibold ${className}`.trim()}
  >
    {children}
  </button>
);

const TrailButton = ({ active, children, ...props }) => (
  <button
    type="button"
    {...props}
    className={`rounded-full px-3 py-1.5 text-xs font-semibold tracking-[0.12em] transition ${active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
  >
    {children}
  </button>
);

const EntityListCard = ({ title, meta, selected, onOpen, actions }) => (
  <div className={`rounded-2xl border px-4 py-4 transition ${selected ? 'border-slate-900 bg-slate-50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}`}>
    <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_auto] 2xl:items-start">
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <div className="min-w-0 space-y-1">
          <p className="text-base font-semibold leading-6 text-slate-900">{title}</p>
          <p className="break-words text-sm leading-6 text-slate-500" title={meta}>{meta}</p>
        </div>
      </button>
      <div className="flex flex-wrap items-center gap-2 2xl:w-auto 2xl:justify-end">
        {actions}
      </div>
    </div>
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
    const sectionMatches = (section) => {
      if (!normalizedQuery) return true;
      return [section?.name, section?.code, section?.academicSession?.label].some(matchesQuery);
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
              standaloneSections: (program.standaloneSections || []).filter(sectionMatches),
            })).filter((program) => {
              if (!normalizedQuery) return true;
              return matchesQuery(program.name) || matchesQuery(program.code) || program.courses.length > 0 || program.standaloneSections.length > 0;
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
                                    <p className="mt-1 text-xs text-slate-500">
                                      {(program.courses || []).length} courses
                                      {(program.standaloneSections || []).length ? ` · ${(program.standaloneSections || []).length} direct sections` : ''}
                                    </p>
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
                              {(program.standaloneSections || []).length ? (
                                <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-4">
                                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Direct Sections Without Course</p>
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {program.standaloneSections.map((section) => (
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
                                </div>
                              ) : null}
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
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                    {getEntityIcon('session')}
                  </div>
                  <div>
                    <h3 className="font-display text-lg font-bold text-slate-900">Academic Sessions</h3>
                    <p className="mt-1 text-sm text-slate-500">{filteredSessions.length} sessions in the current view</p>
                  </div>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                  <HelpTooltip
                    title="Why sessions matter"
                    items={[
                      { label: 'Academic grouping', description: 'Sessions define the year-level delivery window for sections, subjects, enrollments, timetable, and attendance.' },
                      { label: 'Safer operations', description: 'Deleting or editing a session changes the downstream structure, so keeping sessions visible here prevents hidden academic drift.' },
                    ]}
                  />
                </div>
              </div>
              <div className="mt-4 flex max-h-[260px] flex-wrap gap-2 overflow-y-auto pr-1">
                {filteredSessions.length ? filteredSessions.map((session) => (
                  <div key={session._id} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700">
                    <span>{session.label} · Year {session.yearNumber}</span>
                    <button type="button" onClick={() => session.program && onOpenProgram(session.program)} className="text-slate-500 transition hover:text-slate-800">Open</button>
                    <button type="button" onClick={() => onEdit('session', session)} className="text-slate-500 transition hover:text-slate-800">Edit</button>
                    <button type="button" onClick={() => onDelete('session', session)} className="text-red-600 transition hover:text-red-700">Delete</button>
                  </div>
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

const OrganizationUnitCard = ({ unit, onEdit, onDelete, onOpenProfile }) => {
  const roleBuckets = [
    { key: 'faculty', label: 'Faculty', items: unit.membersByRole?.faculty || [] },
    { key: 'staff', label: 'Staff', items: unit.membersByRole?.staff || [] },
    { key: 'admin', label: 'Admins', items: unit.membersByRole?.admin || [] },
  ];

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${unit.type === 'academic' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                {unit.type}
              </span>
              {unit.linkedDepartmentId?.name ? (
                <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-slate-600">
                  Linked to {unit.linkedDepartmentId.name}
                </span>
              ) : null}
            </div>
            <div>
              <h3 className="font-display text-xl font-bold text-slate-900">{unit.name}</h3>
              <p className="mt-1 text-sm text-slate-500">
                {[unit.code, unit.collegeId?.name || '', unit.description || 'Department ownership for non-student roles.'].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">{unit.memberCounts?.total || 0} members</span>
            <button type="button" onClick={() => onEdit(unit)} className="btn-secondary text-xs">Edit</button>
            <button type="button" onClick={() => onDelete(unit)} className="btn-secondary text-xs text-red-600 hover:text-red-700">Delete</button>
          </div>
        </div>
      </div>

      <div className="grid gap-5 p-5 xl:grid-cols-3">
        {roleBuckets.map((bucket) => (
          <div key={bucket.key} className="rounded-3xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{bucket.label}</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{bucket.items.length} linked</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <FiUsers size={16} />
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {bucket.items.length ? bucket.items.map((member) => (
                <button
                  key={member._id}
                  type="button"
                  onClick={() => onOpenProfile(member)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-left transition hover:border-slate-300 hover:bg-slate-100"
                >
                  <Avatar user={member} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{member.name}</p>
                    <p className="truncate text-xs text-slate-500">{[member.systemId || member.email || '', member.adminTier || member.status || ''].filter(Boolean).join(' · ')}</p>
                  </div>
                  {member.inferredOrgUnit ? (
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-700">
                      inferred
                    </span>
                  ) : null}
                </button>
              )) : (
                <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-400">
                  No {bucket.label.toLowerCase()} assigned yet.
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

function OrganizationWorkspace({
  organizationUnits,
  organizationSummary,
  organizationLoading,
  collegeOptions,
  departmentOptions,
  onRefresh,
  onCreate,
  onEdit,
  onDelete,
  onOpenProfile,
}) {
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const filteredUnits = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return organizationUnits.filter((unit) => {
      if (typeFilter && unit.type !== typeFilter) return false;
      if (!normalizedQuery) return true;
      return [unit.name, unit.code, unit.description, unit.linkedDepartmentId?.name, unit.collegeId?.name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery));
    });
  }, [organizationUnits, query, typeFilter]);

  const summaryCards = [
    { label: 'Units', value: organizationSummary.total || 0 },
    { label: 'Academic Units', value: organizationSummary.academic || 0 },
    { label: 'Operational Units', value: organizationSummary.operational || 0 },
    { label: 'Faculty', value: organizationSummary.faculty || 0 },
    { label: 'Staff', value: organizationSummary.staff || 0 },
    { label: 'Admins', value: organizationSummary.admin || 0 },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {summaryCards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{card.label}</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="card p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_200px_auto_auto]">
          <label className="relative block">
            <FiSearch size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-10"
              placeholder="Search academic or operational units"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <select className="input" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            <option value="">All Types</option>
            <option value="academic">Academic</option>
            <option value="operational">Operational</option>
          </select>
          <ToolbarButton primary onClick={onCreate}>
            <FiPlus size={15} />
            Add Department Unit
          </ToolbarButton>
          <ToolbarButton onClick={onRefresh}>
            <FiRefreshCw size={15} />
            Refresh
          </ToolbarButton>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600">
          Academic departments control teaching structure like programs, sections, subjects, timetable, and attendance. Organization units control where faculty, staff, and admins belong operationally. When an organization unit is marked academic, it can link back to one academic department such as CSE so people placement stays understandable without changing the teaching hierarchy.
        </div>
      </div>

      {organizationLoading ? (
        <div className="card p-8">
          <FullPageSpinner label="Loading organization view..." />
        </div>
      ) : filteredUnits.length ? (
        <div className="space-y-5">
          {filteredUnits.map((unit) => (
            <OrganizationUnitCard
              key={unit._id}
              unit={unit}
              onEdit={onEdit}
              onDelete={onDelete}
              onOpenProfile={onOpenProfile}
            />
          ))}
        </div>
      ) : (
        <div className="card p-8">
          <EmptyState
            icon="🏢"
            title="No organization units match yet"
            description={organizationUnits.length
              ? 'Try clearing the current search or type filter.'
              : 'Create your first academic or operational unit to start placing faculty, staff, and admins.'}
            action={!organizationUnits.length ? <button type="button" onClick={onCreate} className="btn-primary">Add First Department Unit</button> : null}
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
    enrollments: [],
  });
  const [organizationUnits, setOrganizationUnits] = useState([]);
  const [organizationSummary, setOrganizationSummary] = useState({
    total: 0,
    academic: 0,
    operational: 0,
    faculty: 0,
    staff: 0,
    admin: 0,
  });
  const [loading, setLoading] = useState(true);
  const [organizationLoading, setOrganizationLoading] = useState(true);
  const [error, setError] = useState('');
  const [quickSetupOpen, setQuickSetupOpen] = useState(false);
  const [quickSetupForm, setQuickSetupForm] = useState(emptyQuickSetup);
  const [quickSetupSaving, setQuickSetupSaving] = useState(false);
  const [inlineForm, setInlineForm] = useState(emptyInlineForm);
  const [inlineSaving, setInlineSaving] = useState(false);
  const [inlineError, setInlineError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState({ open: false, resource: '', item: null, loading: false });
  const [mappingRemovalState, setMappingRemovalState] = useState({ open: false, student: null, loading: false });
  const [selectedSection, setSelectedSection] = useState(null);
  const [sectionStudentSelection, setSectionStudentSelection] = useState('');
  const [sectionActionSaving, setSectionActionSaving] = useState({ student: false });
  const [activeScreen, setActiveScreen] = useState('structure');
  const [previousScreen, setPreviousScreen] = useState('structure');
  const [facultySubjectsTab, setFacultySubjectsTab] = useState('subjects');
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [facultySectionFilterId, setFacultySectionFilterId] = useState('');
  const [facultySubjectsQuery, setFacultySubjectsQuery] = useState('');
  const [selectedCollegeId, setSelectedCollegeId] = useState('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  const [selectedProgramId, setSelectedProgramId] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [rolloverModalOpen, setRolloverModalOpen] = useState(false);
  const [rolloverForm, setRolloverForm] = useState({ newSessionLabel: '', newYearNumber: '' });
  const [rolloverSaving, setRolloverSaving] = useState(false);
  const [rolloverError, setRolloverError] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [focusLevel, setFocusLevel] = useState('college');
  const [focusScopeMode, setFocusScopeMode] = useState('contextual');
  const [workspaceView, setWorkspaceView] = useState('hierarchy');
  const [recordsQuery, setRecordsQuery] = useState('');
  const [recordsCollegeFilter, setRecordsCollegeFilter] = useState('');
  const [recordsDepartmentFilter, setRecordsDepartmentFilter] = useState('');
  const [expandedCatalogColleges, setExpandedCatalogColleges] = useState({});
  const [structureMode, setStructureMode] = useState('academic');
  const [orgUnitFormOpen, setOrgUnitFormOpen] = useState(false);
  const [orgUnitForm, setOrgUnitForm] = useState(emptyOrgUnitForm);
  const [orgUnitFormSaving, setOrgUnitFormSaving] = useState(false);
  const [orgUnitFormError, setOrgUnitFormError] = useState('');

  const loadAcademicWorkspace = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const workspaceRes = await API.get('/academics/workspace-data');
      const workspaceData = workspaceRes.data?.data || {};

      setTreeData(workspaceData.treeData || []);
      setWorkspaceSummary(workspaceData.summary || {});
      setOptions({
        colleges: workspaceData.options?.colleges || [],
        departments: workspaceData.options?.departments || [],
        programs: workspaceData.options?.programs || [],
        courses: workspaceData.options?.courses || [],
        academicSessions: workspaceData.options?.academicSessions || [],
        sections: workspaceData.options?.sections || [],
        subjects: workspaceData.options?.subjects || [],
        faculty: workspaceData.options?.faculty || [],
        students: workspaceData.options?.students || [],
        enrollments: workspaceData.options?.enrollments || [],
      });
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to load academic structure');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadOrganizationWorkspace = useCallback(async () => {
    setOrganizationLoading(true);
    try {
      const response = await API.get('/academics/org-units');
      const payload = response.data?.data || {};
      setOrganizationUnits(payload.units || []);
      setOrganizationSummary(payload.summary || {
        total: 0,
        academic: 0,
        operational: 0,
        faculty: 0,
        staff: 0,
        admin: 0,
      });
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to load organization structure');
    } finally {
      setOrganizationLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAcademicWorkspace();
    loadOrganizationWorkspace();
  }, [loadAcademicWorkspace, loadOrganizationWorkspace]);

  useEffect(() => {
    if (!treeData.length) {
      setSelectedCollegeId('');
      setSelectedDepartmentId('');
      setSelectedProgramId('');
      setSelectedCourseId('');
      setSelectedSessionId('');
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

    const sessions = (options.academicSessions || []).filter(
      (session) => String(session.program?._id || session.program) === String(selectedProgram?._id || '')
    );
    const selectedSession = sessions.find((session) => String(session._id) === String(selectedSessionId)) || sessions[0] || null;
    if (String(selectedSessionId) !== String(selectedSession?._id || '')) {
      setSelectedSessionId(selectedSession?._id || '');
    }
  }, [options.academicSessions, treeData, selectedCollegeId, selectedDepartmentId, selectedProgramId, selectedCourseId, selectedSessionId]);

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
      { label: 'Colleges', value: workspaceSummary.colleges, icon: <FiLayers size={16} />, level: 'college', description: 'Top-level institutional containers.' },
      { label: 'Departments', value: workspaceSummary.departments, icon: <FiGitBranch size={16} />, level: 'department', description: 'Academic domains grouped inside colleges.' },
      { label: 'Programs', value: workspaceSummary.programs, icon: <FiBookOpen size={16} />, level: 'program', description: 'Program blueprints and degree tracks.' },
      { label: 'Courses', value: workspaceSummary.courses, icon: <FiBookOpen size={16} />, level: 'course', description: 'Course-level delivery containers inside programs.' },
      { label: 'Academic Sessions', value: workspaceSummary.academicSessions, icon: <FiGitBranch size={16} />, level: 'session', description: 'Year-based delivery windows for sections and subjects.' },
      { label: 'Sections', value: workspaceSummary.sections, icon: <FiUsers size={16} />, level: 'section', description: 'Operational teaching groups linked to delivery.' },
      { label: 'Subjects', value: workspaceSummary.subjects, icon: <FiBookOpen size={16} />, level: 'subject', description: 'Mapped teaching subjects across the structure.' },
      { label: 'Students', value: workspaceSummary.students, icon: <FiUsers size={16} />, level: 'student', description: 'Active enrolled learners across sections.' },
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
  const selectedSession = useMemo(
    () => (options.academicSessions || []).find((session) => String(session._id) === String(selectedSessionId)) || null,
    [options.academicSessions, selectedSessionId]
  );
  const activeStudentRecords = useMemo(() => buildActiveStudentRecords(options.enrollments || []), [options.enrollments]);
  const selectedStudentRecord = useMemo(
    () => activeStudentRecords.find((entry) => String(entry._id) === String(selectedStudentId)) || null,
    [activeStudentRecords, selectedStudentId]
  );

  useEffect(() => {
    if (!treeData.length) setFocusScopeMode('contextual');
  }, [treeData.length]);

  useEffect(() => {
    if (!activeStudentRecords.length) {
      setSelectedStudentId('');
      return;
    }

    const exists = activeStudentRecords.some((entry) => String(entry._id) === String(selectedStudentId));
    if (!exists) {
      setSelectedStudentId(activeStudentRecords[0]._id);
    }
  }, [activeStudentRecords, selectedStudentId]);

  useEffect(() => {
    if (!selectedSection?._id) return;

    const refreshedSection = (options.sections || []).find((section) => String(section._id) === String(selectedSection._id)) || null;
    if (!refreshedSection) {
      setSelectedSection(null);
      if (activeScreen === 'sectionDetail') {
        setActiveScreen('structure');
      }
      return;
    }

    if (refreshedSection !== selectedSection) {
      setSelectedSection(refreshedSection);
    }
  }, [activeScreen, options.sections, selectedSection]);

  useEffect(() => {
    if (!selectedSubject?._id) return;

    const refreshedSubject = (options.subjects || []).find((subject) => String(subject._id) === String(selectedSubject._id)) || null;
    if (!refreshedSubject) {
      setSelectedSubject(null);
      if (activeScreen === 'subjectDetail') {
        setActiveScreen('structure');
      }
      return;
    }

    if (refreshedSubject !== selectedSubject) {
      setSelectedSubject(refreshedSubject);
    }
  }, [activeScreen, options.subjects, selectedSubject]);

  const filteredFocusItems = useMemo(() => {
    const query = recordsQuery.trim().toLowerCase();
    const matches = (item) => {
      if (!query) return true;
      const values = typeof item === 'string'
        ? [item]
        : [item?.name, item?.code, item?.label, item?.description, item?.systemId, item?.email];
      return values
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    };

    if (focusLevel === 'college') return treeData.filter(matches);
    const useGlobalList = focusScopeMode === 'global';

    if (focusLevel === 'department') {
      const items = useGlobalList ? (options.departments || []) : (selectedCollege?.departments || []);
      return items.filter(matches);
    }
    if (focusLevel === 'program') {
      const items = useGlobalList ? (options.programs || []) : (selectedDepartment?.programs || []);
      return items.filter(matches);
    }
    if (focusLevel === 'course') {
      const items = useGlobalList
        ? (options.courses || [])
        : (selectedProgram?.courses || []);
      return items.filter(matches);
    }
    if (focusLevel === 'section') {
      const items = useGlobalList ? (options.sections || []) : (selectedCourse?.sections || []);
      return items.filter(matches);
    }
    if (focusLevel === 'session') {
      return (options.academicSessions || []).filter((session) => {
        const inScope = useGlobalList || !selectedProgramId || String(session.program?._id || session.program) === String(selectedProgramId);
        return inScope && matches(session);
      });
    }
    if (focusLevel === 'subject') {
      return (options.subjects || []).filter((subject) => {
        if (!useGlobalList && selectedDepartmentId && String(subject.department?._id || subject.department) !== String(selectedDepartmentId)) return false;
        if (!useGlobalList && selectedProgramId && String(subject.program?._id || subject.program) !== String(selectedProgramId)) return false;
        if (!useGlobalList && selectedCourseId && !subjectMatchesCourse(subject, selectedCourseId)) return false;
        return matches(subject);
      });
    }
    if (focusLevel === 'student') {
      return activeStudentRecords.filter((student) => {
        if (!useGlobalList && selectedDepartmentId && String(student.section?.department?._id || student.section?.department) !== String(selectedDepartmentId)) return false;
        if (!useGlobalList && selectedProgramId && String(student.section?.program?._id || student.section?.program) !== String(selectedProgramId)) return false;
        if (!useGlobalList && selectedCourseId && String(student.section?.course?._id || student.section?.course) !== String(selectedCourseId)) return false;
        return matches(student) || matches(student.student) || matches(student.sectionName) || matches(student.programName);
      });
    }
    return [];
  }, [activeStudentRecords, focusLevel, focusScopeMode, options.academicSessions, options.courses, options.departments, options.programs, options.sections, options.subjects, recordsQuery, selectedCollege, selectedCourse, selectedCourseId, selectedProgram, selectedProgramId, selectedDepartment, selectedDepartmentId, treeData]);

  const focusedEntity = useMemo(() => {
    if (focusLevel === 'college') return selectedCollege;
    if (focusLevel === 'department') return selectedDepartment;
    if (focusLevel === 'program') return selectedProgram;
    if (focusLevel === 'course') return selectedCourse;
    if (focusLevel === 'session') return selectedSession;
    if (focusLevel === 'subject') return selectedSubject;
    if (focusLevel === 'student') return selectedStudentRecord;
    if (focusLevel === 'section') return selectedSection && String(selectedSection.course?._id || selectedSection.course) === String(selectedCourseId) ? selectedSection : null;
    return null;
  }, [focusLevel, selectedCollege, selectedCourse, selectedCourseId, selectedDepartment, selectedProgram, selectedSection, selectedSession, selectedStudentRecord, selectedSubject]);

  const focusSelectionValue = useMemo(() => {
    if (focusLevel === 'college') return selectedCollegeId;
    if (focusLevel === 'department') return selectedDepartmentId;
    if (focusLevel === 'program') return selectedProgramId;
    if (focusLevel === 'course') return selectedCourseId;
    if (focusLevel === 'session') return selectedSessionId;
    if (focusLevel === 'subject') return selectedSubject?._id || '';
    if (focusLevel === 'student') return selectedStudentId;
    if (focusLevel === 'section') return selectedSection?._id || '';
    return '';
  }, [focusLevel, selectedCollegeId, selectedCourseId, selectedDepartmentId, selectedProgramId, selectedSection?._id, selectedSessionId, selectedStudentId, selectedSubject?._id]);

  const selectFocusedItem = useCallback((item) => {
    if (!item) return;

    setFocusScopeMode('contextual');

    if (focusLevel === 'college') {
      setSelectedCollegeId(item._id);
      setSelectedDepartmentId('');
      setSelectedProgramId('');
      setSelectedCourseId('');
      setSelectedSection(null);
      setFocusLevel('department');
      return;
    }

    if (focusLevel === 'department') {
      setSelectedDepartmentId(item._id);
      setSelectedProgramId('');
      setSelectedCourseId('');
      setSelectedSection(null);
      setFocusLevel('program');
      return;
    }

    if (focusLevel === 'program') {
      const parentDepartment = options.departments.find((department) => String(department._id) === String(item.department?._id || item.department || ''));
      setSelectedCollegeId(parentDepartment?.college?._id || parentDepartment?.college || '');
      setSelectedDepartmentId(parentDepartment?._id || item.department?._id || item.department || '');
      setSelectedProgramId(item._id);
      setSelectedCourseId('');
      setSelectedSection(null);
      setFocusLevel('course');
      return;
    }

    if (focusLevel === 'course') {
      const parentProgram = options.programs.find((program) => String(program._id) === String(item.program?._id || item.program || ''));
      const parentDepartment = options.departments.find((department) => String(department._id) === String(parentProgram?.department?._id || parentProgram?.department || item.department?._id || item.department || ''));
      setSelectedCollegeId(parentDepartment?.college?._id || parentDepartment?.college || '');
      setSelectedDepartmentId(parentDepartment?._id || item.department?._id || item.department || '');
      setSelectedProgramId(parentProgram?._id || item.program?._id || item.program || '');
      setSelectedCourseId(item._id);
      setSelectedSection(null);
      setFocusLevel('section');
      return;
    }

    if (focusLevel === 'section') {
      const parentProgram = options.programs.find((program) => String(program._id) === String(item.program?._id || item.program || ''));
      const parentDepartment = options.departments.find((department) => String(department._id) === String(item.department?._id || item.department || parentProgram?.department?._id || parentProgram?.department || ''));
      setSelectedCollegeId(parentDepartment?.college?._id || parentDepartment?.college || '');
      setSelectedDepartmentId(parentDepartment?._id || item.department?._id || item.department || '');
      setSelectedProgramId(parentProgram?._id || item.program?._id || item.program || '');
      setSelectedCourseId(item.course?._id || item.course || '');
      setSelectedSection(item);
      setPreviousScreen('structure');
      setActiveScreen('sectionDetail');
      return;
    }

    if (focusLevel === 'session' && item.program) {
      const parentProgram = options.programs.find((program) => String(program._id) === String(item.program?._id || item.program));
      const parentDepartment = options.departments.find((department) => String(department._id) === String(parentProgram?.department?._id || parentProgram?.department || ''));
      setSelectedCollegeId(parentDepartment?.college?._id || parentDepartment?.college || '');
      setSelectedDepartmentId(parentDepartment?._id || '');
      setSelectedProgramId(parentProgram?._id || item.program?._id || item.program || '');
      setSelectedSessionId(item._id);
      setSelectedSection(null);
      return;
    }

    if (focusLevel === 'subject') {
      if (item?._id) {
        navigate(`/academics/subjects/${item._id}`);
      }
      return;
    }

    if (focusLevel === 'student') {
      setSelectedStudentId(item._id);
    }
  }, [focusLevel, navigate, options.departments, options.programs]);

  const focusHierarchyFromItem = (type, item) => {
    if (!item) return;

    setFocusScopeMode('contextual');

    if (type === 'college') {
      setSelectedCollegeId(item._id);
      setSelectedDepartmentId('');
      setSelectedProgramId('');
      setSelectedCourseId('');
      setWorkspaceView('hierarchy');
      setFocusLevel('department');
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
      setFocusLevel('program');
      return;
    }

    if (type === 'program') {
      const parentDepartment = options.departments.find((department) => String(department._id) === String(departmentValue));
      setSelectedCollegeId(parentDepartment?.college?._id || parentDepartment?.college || '');
      setSelectedDepartmentId(departmentValue);
      setSelectedProgramId(item._id);
      setSelectedCourseId('');
      setWorkspaceView('hierarchy');
      setFocusLevel('course');
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
      setFocusLevel('section');
      return;
    }

    if (type === 'section') {
      const parentProgram = options.programs.find((program) => String(program._id) === String(programValue));
      const parentDepartment = options.departments.find((department) => String(department._id) === String(departmentValue || parentProgram?.department?._id || parentProgram?.department || ''));
      setSelectedCollegeId(parentDepartment?.college?._id || parentDepartment?.college || '');
      setSelectedDepartmentId(parentDepartment?._id || departmentValue);
      setSelectedProgramId(parentProgram?._id || programValue);
      setSelectedCourseId(courseValue);
      setFocusLevel('section');
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

  function openCreateForm(resource, parentType = '', parentItem = null) {
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
      const initialCourseIds = parentType === 'course' && parentItem?._id
        ? [String(parentItem._id)]
        : selectedCourseId
          ? [String(selectedCourseId)]
          : [];
      base.values = {
        code: '',
        name: '',
        department: parentItem?.department || selectedDepartmentId || '',
        program: parentItem?.program || selectedProgramId || '',
        courseIds: initialCourseIds,
        academicSession: selectedSession?._id || '',
        credits: 0,
        type: 'core',
        term: 1,
      };
    }

    setInlineError('');
    setInlineForm(base);
  }

  const focusMeta = focusLevel === 'college'
    ? {
        title: 'Colleges',
        subtitle: 'Browse institutions here, then drill into departments from the left list.',
        emptyLabel: 'Add the first college to start the structure.',
        addAction: () => openCreateForm('college'),
        addLabel: 'Add College',
      }
    : focusLevel === 'department'
      ? {
          title: selectedCollege ? `Departments in ${selectedCollege.name}` : 'Departments',
          subtitle: 'Choose a college first, then explore only the departments that belong to it.',
          emptyLabel: selectedCollege ? 'No departments under this college yet.' : 'Select a college first.',
          addAction: () => selectedCollege && openCreateForm('department', 'college', selectedCollege),
          addLabel: 'Add Department',
        }
      : focusLevel === 'program'
        ? {
            title: selectedDepartment ? `Programs in ${selectedDepartment.name}` : 'Programs',
            subtitle: selectedDepartment ? 'Stay inside the selected department so program management remains focused and predictable.' : 'Browse all programs in scope, then drill into the one you want to manage.',
            emptyLabel: selectedDepartment ? 'No programs under this department yet.' : 'No programs are available in the current scope.',
            addAction: () => selectedDepartment && openCreateForm('program', 'department', selectedDepartment),
            addLabel: 'Add Program',
          }
        : focusLevel === 'course'
          ? {
              title: selectedProgram ? `Courses in ${selectedProgram.name}` : 'Courses',
              subtitle: selectedProgram ? 'Courses are filtered to the selected program, so section and subject creation never drift out of scope.' : 'Browse all courses in scope, then narrow into the one you want to manage.',
              emptyLabel: selectedProgram ? 'No courses under this program yet.' : 'No courses are available in the current scope.',
              addAction: () => selectedProgram && openCreateForm('course', 'program', selectedProgram),
              addLabel: 'Add Course',
            }
          : focusLevel === 'section'
            ? {
                title: selectedCourse ? `Sections in ${selectedCourse.name}` : 'Sections',
                subtitle: selectedCourse ? 'Sections are the delivery layer for the selected course.' : 'Browse all sections in scope, then open the delivery group you want to review.',
                emptyLabel: selectedCourse ? 'No sections under this course yet.' : 'No sections are available in the current scope.',
                addAction: () => selectedCourse && openCreateForm('section', 'course', selectedCourse),
                addLabel: 'Add Section',
              }
            : {
                title: 'Academic Sessions',
                subtitle: 'Sessions stay scoped to the selected program so they support clear year-level delivery.',
                emptyLabel: selectedProgram ? 'No academic sessions under this program yet.' : 'Select a program first.',
                addAction: () => selectedProgram && openCreateForm('session', 'program', selectedProgram),
                addLabel: 'Add Session',
              };

  const extendedFocusMeta = focusLevel === 'subject'
    ? {
        title: 'Subjects',
        subtitle: 'Review mapped teaching subjects with the same academic filters used across the structure.',
        emptyLabel: 'No subjects are available in the current scope.',
        addAction: () => openCreateForm('subject', selectedCourse ? 'course' : '', selectedCourse || selectedProgram || null),
        addLabel: 'Add Subject',
      }
    : focusLevel === 'student'
      ? {
          title: 'Students',
          subtitle: 'See active enrolled students in the current academic scope with section context attached.',
          emptyLabel: 'No active students are available in the current scope.',
          addAction: null,
          addLabel: 'Add Student',
        }
      : focusMeta;

  const buildInlineValidationError = (resource, values) => {
    const normalizedName = String(values?.name || '').trim();
    const normalizedCode = String(values?.code || '').trim();

    if (resource === 'college') {
      if (!normalizedName || !normalizedCode) return 'College name and code are required.';
      return '';
    }

    if (resource === 'department') {
      if (!values?.college) return 'Select a college before saving the department.';
      if (!normalizedName || !normalizedCode) return 'Department name and code are required.';
      return '';
    }

    if (resource === 'program') {
      if (!values?.department) return 'Select a department before saving the program.';
      if (!normalizedName || !normalizedCode) return 'Program name and code are required.';
      return '';
    }

    if (resource === 'course') {
      if (!values?.department) return 'Select a department before saving the course.';
      if (!values?.program) return 'Select a program before saving the course.';
      if (!normalizedName || !normalizedCode) return 'Course name and code are required.';
      return '';
    }

    if (resource === 'session') {
      if (!values?.program) return 'Select a program before saving the academic session.';
      if (!String(values?.label || '').trim()) return 'Academic session label is required.';
      if (!Number(values?.yearNumber)) return 'Study year is required for the academic session.';
      return '';
    }

    if (resource === 'section') {
      if (!values?.department) return 'Select a department before saving the section.';
      if (!values?.program) return 'Select a program before saving the section.';
      if (!values?.course) return 'Select a course before saving the section.';
      if (!values?.academicSession) return 'Select an academic session before saving the section.';
      if (!String(values?.name || '').trim()) return 'Section name is required.';
      return '';
    }

    if (resource === 'subject') {
      if (!normalizedCode || !normalizedName) return 'Subject code and name are required.';
      if (!values?.department) return 'Select a department before saving the subject.';
      if (!values?.program) return 'Select a program before saving the subject.';
      if (!Array.isArray(values?.courseIds) || !values.courseIds.length) return 'Select at least one linked course before saving the subject.';
      if (!values?.academicSession) return 'Select an academic session before saving the subject.';
      const normalizedTerm = Number(values?.term);
      if (!Number.isFinite(normalizedTerm) || normalizedTerm < 1 || normalizedTerm > 12) return 'Subject term must be between 1 and 12.';
      return '';
    }

    return '';
  };

  const buildInlineRequestError = (requestError) => {
    const status = requestError?.response?.status;
    const message = requestError?.response?.data?.message || requestError?.message || 'Failed to save academic record';

    if (status === 403) {
      return `${message} Check that your academic scope matches the selected hierarchy before creating this record.`;
    }

    if (status === 400) {
      return `${message} Review the required hierarchy fields and linked records, then try again.`;
    }

    return message;
  };

  const buildInlineFieldErrors = (resource, values) => {
    const errors = {};

    if (resource === 'subject') {
      if (!String(values?.code || '').trim()) errors.code = 'Subject code is required.';
      if (!String(values?.name || '').trim()) errors.name = 'Subject name is required.';
      if (!values?.department) errors.department = 'Select a department.';
      if (!values?.program) errors.program = 'Select a program.';
      if (!Array.isArray(values?.courseIds) || !values.courseIds.length) errors.courseIds = 'Select at least one linked course.';
      if (!values?.academicSession) errors.academicSession = 'Select an academic session.';

      const normalizedTerm = Number(values?.term);
      if (!Number.isFinite(normalizedTerm) || normalizedTerm < 1 || normalizedTerm > 12) {
        errors.term = 'Term must be between 1 and 12.';
      }
    }

    return errors;
  };

  const inlineFieldErrors = inlineError
    ? buildInlineFieldErrors(inlineForm.resource, inlineForm.values || {})
    : {};

  const getInlineFieldClassName = (fieldName) => (
    inlineFieldErrors[fieldName]
      ? 'input border-red-300 bg-red-50 text-red-900 placeholder:text-red-400 focus:border-red-400 focus:ring-red-200'
      : 'input'
  );

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
                    courseIds: (() => {
                      const courses = Array.isArray(item.courses) ? item.courses : [];
                      const ids = courses.map((entry) => String(entry?._id || entry)).filter(Boolean);
                      const legacy = item.course?._id || item.course;
                      if (legacy && !ids.includes(String(legacy))) ids.push(String(legacy));
                      return ids;
                    })(),
                    academicSession: item.academicSession?._id || item.academicSession || '',
                    credits: item.credits ?? 0,
                    type: item.type || 'core',
                    term: Number.isFinite(item.term) ? item.term : 1,
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
    const validationError = buildInlineValidationError(inlineForm.resource, inlineForm.values || {});
    if (validationError) {
      setInlineError(validationError);
      toast.error(validationError);
      return;
    }

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
      const message = buildInlineRequestError(requestError);
      setInlineError(message);
      toast.error(message);
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
      loadAcademicWorkspace();
      setQuickSetupOpen(false);
      setQuickSetupForm(emptyQuickSetup);
      toast.success('Structure provisioned successfully');
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || 'Quick setup failed');
    } finally {
      setQuickSetupSaving(false);
    }
  };

  const handleRolloverSubmit = async (event) => {
    event.preventDefault();
    setRolloverSaving(true);
    setRolloverError('');
    try {
      const { data } = await API.post(`/academics/academic-sessions/${selectedSessionId}/rollover`, rolloverForm);
      toast.success(`Rollover complete. ${data.data.promotions.promoted} students promoted.`);
      setRolloverModalOpen(false);
      setRolloverForm({ newSessionLabel: '', newYearNumber: '' });
      loadAcademicWorkspace();
    } catch (requestError) {
      setRolloverError(requestError.response?.data?.message || 'Rollover failed');
      toast.error('Rollover failed');
    } finally {
      setRolloverSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete.item || !confirmDelete.resource) return;
    setConfirmDelete((current) => ({ ...current, loading: true }));
    try {
      await API.delete(`/academics/${confirmDelete.resource}/${confirmDelete.item._id}`);
      toast.success(confirmDelete.resource === 'org-units' ? 'Department unit deleted' : 'Academic record deleted');
      setConfirmDelete({ open: false, resource: '', item: null, loading: false });
      if (confirmDelete.resource === 'org-units') {
        await loadOrganizationWorkspace();
      } else {
        await loadAcademicWorkspace();
      }
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || 'Delete failed');
      setConfirmDelete((current) => ({ ...current, loading: false }));
    }
  };

  const openOrgUnitCreate = useCallback(() => {
    setOrgUnitForm(emptyOrgUnitForm);
    setOrgUnitFormError('');
    setOrgUnitFormOpen(true);
  }, []);

  const openOrgUnitEdit = useCallback((unit) => {
    if (!unit) return;
    setOrgUnitForm({
      id: unit._id,
      name: unit.name || '',
      code: unit.code || '',
      type: unit.type || 'operational',
      collegeId: String(unit.collegeId?._id || unit.collegeId || unit.linkedDepartmentId?.college?._id || unit.linkedDepartmentId?.college || ''),
      linkedDepartmentId: String(unit.linkedDepartmentId?._id || unit.linkedDepartmentId || ''),
      description: unit.description || '',
    });
    setOrgUnitFormError('');
    setOrgUnitFormOpen(true);
  }, []);

  const handleOrgUnitSave = useCallback(async (event) => {
    event.preventDefault();
    setOrgUnitFormSaving(true);
    setOrgUnitFormError('');

    try {
      const payload = {
        name: orgUnitForm.name,
        code: orgUnitForm.code,
        type: orgUnitForm.type,
        collegeId: orgUnitForm.collegeId || null,
        linkedDepartmentId: orgUnitForm.type === 'academic' ? (orgUnitForm.linkedDepartmentId || null) : null,
        description: orgUnitForm.description,
      };

      if (orgUnitForm.id) {
        await API.put(`/academics/org-units/${orgUnitForm.id}`, payload);
        toast.success('Department unit updated');
      } else {
        await API.post('/academics/org-units', payload);
        toast.success('Department unit created');
      }

      setOrgUnitFormOpen(false);
      setOrgUnitForm(emptyOrgUnitForm);
      await loadOrganizationWorkspace();
    } catch (requestError) {
      setOrgUnitFormError(requestError.response?.data?.message || 'Failed to save department unit');
    } finally {
      setOrgUnitFormSaving(false);
    }
  }, [loadOrganizationWorkspace, orgUnitForm]);

  const sectionAssignments = useMemo(() => {
    if (!selectedSection?._id) return [];
    return (options.subjects || [])
      .filter((subject) => {
        if (String(subject.program?._id || subject.program) !== String(selectedSection.program?._id || selectedSection.program)) return false;
        if (selectedSection.course && !subjectMatchesCourse(subject, selectedSection.course?._id || selectedSection.course)) return false;
        if (String(subject.academicSession?._id || subject.academicSession) !== String(selectedSection.academicSession?._id || selectedSection.academicSession)) return false;
        return true;
      })
      .map((subject) => {
        const sectionTeachers = (subject.sectionTeachers || [])
          .filter((mapping) => String(mapping.section?._id || mapping.section) === String(selectedSection._id))
          .map((mapping) => mapping.teacher)
          .filter(Boolean);
        const assignedTeachers = sectionTeachers.length ? sectionTeachers : (subject.teachers || []);

        return {
          _id: `${selectedSection._id}-${subject._id}`,
          section: selectedSection,
          subject,
          semester: selectedSection.studyYear ? `Year ${selectedSection.studyYear}` : '',
          faculty: assignedTeachers[0] || null,
          facultyMembers: assignedTeachers,
        };
      });
  }, [options.subjects, selectedSection]);
  const sectionStudents = useMemo(() => {
    if (!selectedSection?._id) return [];
    return (options.enrollments || []).filter(
      (entry) => String(entry.section?._id || entry.section) === String(selectedSection._id)
        && entry.status === 'active'
        && entry.student?.status === 'approved'
    );
  }, [options.enrollments, selectedSection]);
  const sectionFacultyMembers = useMemo(() => {
    const facultyMap = new Map();
    sectionAssignments.forEach((assignment) => {
      getAssignedFacultyMembers(assignment).forEach((faculty) => {
        if (faculty?._id) {
          facultyMap.set(String(faculty._id), faculty);
        }
      });
    });
    return [...facultyMap.values()];
  }, [sectionAssignments]);
  const sectionStudentIds = useMemo(
    () => new Set(sectionStudents.map((entry) => String(entry.student?._id || ''))),
    [sectionStudents]
  );
  const activelyMappedStudentIds = useMemo(
    () => new Set((options.enrollments || [])
      .filter((entry) => entry.status === 'active')
      .map((entry) => String(entry.student?._id || entry.student || ''))
      .filter(Boolean)),
    [options.enrollments]
  );
  const availableSectionSubjects = useMemo(() => {
    return sectionAssignments.map((entry) => entry.subject).filter(Boolean);
  }, [sectionAssignments]);
  const availableSectionStudents = useMemo(() => (
    (options.students || []).filter((student) => {
      if (student.status !== 'approved') return false;
      if (student.isActive === false) return false;
      const studentId = String(student._id || '');
      if (!studentId) return false;
      if (sectionStudentIds.has(studentId)) return false;
      if (activelyMappedStudentIds.has(studentId)) return false;
      return true;
    })
  ), [activelyMappedStudentIds, options.students, sectionStudentIds]);
  const sectionCapacityLeft = useMemo(() => {
    const capacity = Number(selectedSection?.capacity || 0);
    if (!capacity) return '—';
    return Math.max(capacity - sectionStudents.length, 0);
  }, [sectionStudents.length, selectedSection?.capacity]);

  useEffect(() => {
    setSectionStudentSelection('');
  }, [selectedSection?._id]);

  const handleSectionStudentCreate = async () => {
    if (!selectedSection?._id || !sectionStudentSelection) return;
    setSectionActionSaving((current) => ({ ...current, student: true }));
    try {
      await API.post('/academics/enrollments', {
        student: sectionStudentSelection,
        section: selectedSection._id,
        academicSession: selectedSection.academicSession?._id || selectedSection.academicSession,
        semester: selectedSection.studyYear ? `Year ${selectedSection.studyYear}` : '',
        status: 'active',
      });
      toast.success('Student mapped to section');
      setSectionStudentSelection('');
      await loadAcademicWorkspace();
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || 'Failed to map student to section');
    } finally {
      setSectionActionSaving((current) => ({ ...current, student: false }));
    }
  };

  const requestStudentMappingRemoval = (student) => {
    if (!student?.systemId) return;
    setMappingRemovalState({ open: true, student, loading: false });
  };

  const handleStudentMappingRemoval = async () => {
    if (!mappingRemovalState.student?.systemId) return;
    setMappingRemovalState((current) => ({ ...current, loading: true }));
    try {
      await API.put(`/users/${mappingRemovalState.student.systemId}`, { sectionId: '' });
      toast.success('Academic mapping removed');
      if (String(selectedStudentId) === String(mappingRemovalState.student._id || mappingRemovalState.student.student?._id || '')) {
        setSelectedStudentId('');
      }
      setMappingRemovalState({ open: false, student: null, loading: false });
      await loadAcademicWorkspace();
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || 'Failed to remove academic mapping');
      setMappingRemovalState((current) => ({ ...current, loading: false }));
    }
  };

  const filteredSubjects = useMemo(() => {
    const normalizedQuery = facultySubjectsQuery.trim().toLowerCase();
    return (options.subjects || []).filter((subject) => {
      if (selectedDepartmentId && String(subject.department?._id || subject.department) !== String(selectedDepartmentId)) return false;
      if (selectedProgramId && String(subject.program?._id || subject.program) !== String(selectedProgramId)) return false;
      if (selectedCourseId && !subjectMatchesCourse(subject, selectedCourseId)) return false;
      if (facultySectionFilterId) {
        const subjectSectionAssignments = (subject.sectionTeachers || []).filter(
          (entry) => String(entry.section?._id || entry.section) === String(facultySectionFilterId)
        );
        const sectionRecord = (options.sections || []).find(
          (section) => String(section._id) === String(facultySectionFilterId)
        );
        const matchesScopedCourse = sectionRecord?.course
          ? subjectMatchesCourse(subject, String(sectionRecord.course?._id || sectionRecord.course))
          : false;
        if (!subjectSectionAssignments.length && !matchesScopedCourse) {
          return false;
        }
      }
      if (normalizedQuery) {
        const haystack = [
          subject.name,
          subject.code,
          subject.program?.name,
          subject.department?.name,
          subject.academicSession?.label,
          ...(subject.teachers || []).map((teacher) => teacher.name || teacher.email),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(normalizedQuery)) return false;
      }
      return true;
    });
  }, [facultySectionFilterId, facultySubjectsQuery, options, selectedCourseId, selectedDepartmentId, selectedProgramId]);

  const sectionSubjectOptions = useMemo(() => (
    (options.subjects || []).flatMap((subject) => {
      const generalAssignments = (subject.teachers || []).map((teacher) => ({
        _id: `${subject._id}-${teacher._id}-general`,
        subject,
        section: null,
        faculty: teacher,
        facultyMembers: [teacher],
      }));
      const sectionAssignmentsForSubject = (subject.sectionTeachers || []).map((mapping) => ({
        _id: mapping._id,
        subject,
        section: mapping.section,
        faculty: mapping.teacher,
        facultyMembers: mapping.teacher ? [mapping.teacher] : [],
      }));

      return [...generalAssignments, ...sectionAssignmentsForSubject];
    })
  ), [options.subjects]);

  const facultyCards = useMemo(() => {
    return (options.faculty || []).map((faculty) => {
      const assignments = sectionSubjectOptions.filter(
        (entry) => getAssignedFacultyMembers(entry).some((assignedFaculty) => String(assignedFaculty?._id || assignedFaculty) === String(faculty._id))
          && (!facultySectionFilterId || String(entry.section?._id || entry.section) === String(facultySectionFilterId))
      );
      return { faculty, assignments };
    }).filter(({ faculty, assignments }) => {
      const normalizedQuery = facultySubjectsQuery.trim().toLowerCase();
      if (!normalizedQuery) return true;
      const facultyMatches = [faculty.name, faculty.email, faculty.systemId]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery));
      if (facultyMatches) return true;
      return assignments.some((assignment) => (
        [assignment.subject?.name, assignment.subject?.code]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedQuery))
      ));
    });
  }, [facultySectionFilterId, facultySubjectsQuery, options.faculty, sectionSubjectOptions]);

  const selectedSubjectAssignments = useMemo(() => {
    if (!selectedSubject?._id) return [];
    return (selectedSubject.sectionTeachers || []).map((entry) => ({
      _id: entry._id,
      section: entry.section,
      faculty: entry.teacher,
      facultyMembers: entry.teacher ? [entry.teacher] : [],
    }));
  }, [selectedSubject]);
  const selectedProgramSections = useMemo(() => getProgramSections(selectedProgram), [selectedProgram]);
  const selectedProgramSubjects = useMemo(() => getProgramSubjects(selectedProgram, options.subjects), [options.subjects, selectedProgram]);
  const selectedCourseSubjects = useMemo(() => getCourseSubjects(selectedCourse, options.subjects), [options.subjects, selectedCourse]);
  const selectedSessionSections = useMemo(() => getSessionSections(selectedSession, options.sections), [options.sections, selectedSession]);
  const selectedSessionSubjects = useMemo(() => getSessionSubjects(selectedSession, options.subjects), [options.subjects, selectedSession]);

  const openSectionDetail = (section) => {
    setSelectedSection(section);
    goScreen('sectionDetail');
  };

  const openSectionStudentsPage = (section) => {
    if (!section?._id) return;
    navigate(`/academics/sections/${section._id}/students`);
  };

  const openSubjectTeacherPage = (section) => {
    if (!section?._id) {
      navigate('/academics/subject-management');
      return;
    }
    navigate(`/academics/subject-management?sectionId=${section._id}`);
  };

  const openSubjectDetail = (subject) => {
    if (!subject?._id) return;
    navigate(`/academics/subjects/${subject._id}`);
  };

  const openFacultySubjects = () => {
    setFacultySubjectsTab('subjects');
    setFacultySectionFilterId('');
    setFacultySubjectsQuery('');
    goScreen('facultySubjects');
  };

  const handleFacultyOpen = (faculty) => {
    navigate(`/admin/users/${faculty.systemId}`);
  };

  const focusMetrics = focusedEntity ? (
    focusLevel === 'program'
      ? [
          { label: 'Courses', value: (focusedEntity.courses || []).length, tone: 'blue' },
          { label: 'Sections', value: selectedProgramSections.length },
          { label: 'Sessions', value: (options.academicSessions || []).filter((session) => getEntityId(session.program) === getEntityId(focusedEntity)).length },
          { label: 'Subjects', value: selectedProgramSubjects.length, tone: 'emerald' },
        ]
      : focusLevel === 'course'
        ? [
            { label: 'Sections', value: (focusedEntity.sections || []).length, tone: 'blue' },
            { label: 'Subjects', value: selectedCourseSubjects.length, tone: 'emerald' },
            { label: 'Program', value: selectedProgram?.name || '—' },
            { label: 'Department', value: selectedDepartment?.name || '—' },
          ]
        : focusLevel === 'section'
          ? [
              { label: 'Program', value: focusedEntity.program?.name || selectedProgram?.name || '—' },
              { label: 'Course', value: focusedEntity.course?.name || selectedCourse?.name || '—' },
              { label: 'Session', value: focusedEntity.academicSession?.label || '—', tone: 'blue' },
              { label: 'Capacity', value: focusedEntity.capacity || 0 },
            ]
          : focusLevel === 'session'
            ? [
                { label: 'Program', value: selectedProgram?.name || focusedEntity.program?.name || '—' },
                { label: 'Year', value: focusedEntity.yearNumber ? `Year ${focusedEntity.yearNumber}` : '—' },
                { label: 'Sections', value: selectedSessionSections.length, tone: 'blue' },
                { label: 'Subjects', value: selectedSessionSubjects.length, tone: 'emerald' },
              ]
            : focusLevel === 'subject'
              ? [
                  { label: 'Code', value: focusedEntity.code || '—' },
                  { label: 'Credits', value: focusedEntity.credits ?? 0 },
                  { label: 'Assignments', value: selectedSubjectAssignments.length, tone: 'blue' },
                  { label: 'Session', value: focusedEntity.academicSession?.label || '—', tone: 'emerald' },
                ]
              : focusLevel === 'student'
                ? [
                    { label: 'Student ID', value: focusedEntity.systemId || '—' },
                    { label: 'Section', value: focusedEntity.sectionName || '—', tone: 'blue' },
                    { label: 'Program', value: focusedEntity.programName || '—' },
                    { label: 'Session', value: focusedEntity.academicSession?.label || '—', tone: 'emerald' },
                  ]
                : []
  ) : [];
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
    <div className="space-y-6 xl:min-h-[calc(100vh-9rem)] xl:max-h-[calc(100vh-7.5rem)]">
      <ConfirmDialog
        open={confirmDelete.open}
        title="Delete academic record"
        description={`Delete ${confirmDelete.item ? formatEntityName(confirmDelete.item) : 'this record'}? This action cannot be undone.`}
        confirmLabel="Delete"
        loading={confirmDelete.loading}
        onConfirm={handleDelete}
        onClose={() => setConfirmDelete({ open: false, resource: '', item: null, loading: false })}
      />

      <ConfirmDialog
        open={mappingRemovalState.open}
        title="Remove academic mapping"
        description={`Remove ${mappingRemovalState.student?.name || 'this student'} from the current section? This will clear the active section enrollment.`}
        confirmLabel="Remove Mapping"
        loading={mappingRemovalState.loading}
        onConfirm={handleStudentMappingRemoval}
        onClose={() => setMappingRemovalState({ open: false, student: null, loading: false })}
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
                  <select className={getInlineFieldClassName('department')} value={inlineForm.values.department || ''} onChange={(e) => setInlineForm((c) => ({ ...c, values: { ...c.values, department: e.target.value, program: '', course: '', academicSession: '' } }))} required>
                    <option value="">Select Department</option>
                    {options.departments.map((department) => <option key={department._id} value={department._id}>{formatEntityName(department)}</option>)}
                  </select>
                  <select className={getInlineFieldClassName('program')} value={inlineForm.values.program || ''} onChange={(e) => setInlineForm((c) => ({ ...c, values: { ...c.values, program: e.target.value, course: '', academicSession: '' } }))} required>
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
                  <input className={getInlineFieldClassName('code')} placeholder="Subject Code" value={inlineForm.values.code || ''} onChange={(e) => setInlineForm((c) => ({ ...c, values: { ...c.values, code: e.target.value.toUpperCase() } }))} required />
                  <input className={getInlineFieldClassName('name')} placeholder="Subject Name" value={inlineForm.values.name || ''} onChange={(e) => setInlineForm((c) => ({ ...c, values: { ...c.values, name: e.target.value } }))} required />
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
                  <label className="block">
                    <span className="label">Linked courses</span>
                    <select
                      className={`${getInlineFieldClassName('courseIds')} min-h-[7rem]`}
                      multiple
                      value={Array.isArray(inlineForm.values.courseIds) ? inlineForm.values.courseIds : []}
                      onChange={(e) => setInlineForm((c) => ({
                        ...c,
                        values: {
                          ...c.values,
                          courseIds: Array.from(e.target.selectedOptions).map((option) => option.value),
                        },
                      }))}
                      required
                    >
                      {options.courses
                        .filter((course) => !inlineForm.values.program || String(course.program?._id || course.program) === String(inlineForm.values.program))
                        .map((course) => <option key={course._id} value={course._id}>{formatEntityName(course)}</option>)}
                    </select>
                  </label>
                  <select className={getInlineFieldClassName('academicSession')} value={inlineForm.values.academicSession || ''} onChange={(e) => setInlineForm((c) => ({ ...c, values: { ...c.values, academicSession: e.target.value } }))} required>
                    <option value="">Select Academic Session</option>
                    {options.academicSessions
                      .filter((session) => !inlineForm.values.program || String(session.program?._id || session.program) === String(inlineForm.values.program))
                      .map((session) => <option key={session._id} value={session._id}>{session.label} · Year {session.yearNumber}</option>)}
                  </select>
                </div>
                <p className="rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-soft)] px-4 py-3 text-sm text-[var(--text-muted)]">
                  Subjects created here and in Subject Directory use the same shared subject records.
                </p>
                {Object.keys(inlineFieldErrors).length ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    Complete the highlighted fields before saving this subject.
                  </div>
                ) : null}
                <div className="grid gap-4 sm:grid-cols-3">
                  <input
                    className={getInlineFieldClassName('term')}
                    type="number"
                    min="1"
                    max="12"
                    placeholder="Term / Semester"
                    value={inlineForm.values.term ?? 1}
                    onChange={(e) => {
                      const next = Number(e.target.value);
                      setInlineForm((c) => ({
                        ...c,
                        values: {
                          ...c.values,
                          term: Number.isFinite(next) && next >= 1 && next <= 12 ? next : 1,
                        },
                      }));
                    }}
                    required
                  />
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
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-2xl font-bold text-gray-900">Quick Setup</h3>
              <p className="mt-1 text-sm text-gray-500">Automatically generate a complete course hierarchy.</p>
            </div>
            <button type="button" onClick={() => setQuickSetupOpen(false)} className="rounded-2xl border border-gray-200 p-2 text-gray-400 transition hover:bg-gray-50 hover:text-gray-600">
              <FiX size={16} />
            </button>
          </div>

          <form onSubmit={handleQuickSetup} className="mt-6 space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <select className="input" value={quickSetupForm.collegeId} onChange={(e) => setQuickSetupForm((c) => ({ ...c, collegeId: e.target.value }))} required>
                <option value="">Select College</option>
                {options.colleges.map((college) => <option key={college._id} value={college._id}>{college.name}</option>)}
              </select>
              <div className="hidden md:block" />
              <input className="input" placeholder="Department" value={quickSetupForm.department} onChange={(e) => setQuickSetupForm((c) => ({ ...c, department: e.target.value }))} required />
              <input className="input" placeholder="Department Code" value={quickSetupForm.departmentCode} onChange={(e) => setQuickSetupForm((c) => ({ ...c, departmentCode: e.target.value.toUpperCase() }))} />
              <input className="input" placeholder="Program" value={quickSetupForm.program} onChange={(e) => setQuickSetupForm((c) => ({ ...c, program: e.target.value }))} required />
              <input className="input" placeholder="Program Code" value={quickSetupForm.programCode} onChange={(e) => setQuickSetupForm((c) => ({ ...c, programCode: e.target.value.toUpperCase() }))} />
              <input className="input" placeholder="Course" value={quickSetupForm.course} onChange={(e) => setQuickSetupForm((c) => ({ ...c, course: e.target.value }))} required />
              <input className="input" placeholder="Course Code" value={quickSetupForm.courseCode} onChange={(e) => setQuickSetupForm((c) => ({ ...c, courseCode: e.target.value.toUpperCase() }))} />
              <input className="input md:col-span-2" placeholder="Academic Session Label (e.g. 2026-27)" value={quickSetupForm.academicSession} onChange={(e) => setQuickSetupForm((c) => ({ ...c, academicSession: e.target.value }))} required />
            </div>

            <div className="rounded-2xl border border-gray-200 p-5">
              <p className="text-sm font-semibold text-gray-900">Study Years</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5].map((year) => {
                  const selected = quickSetupForm.years.includes(year);
                  return (
                    <button
                      key={year}
                      type="button"
                      onClick={() => setQuickSetupForm((current) => ({
                        ...current,
                        years: selected ? current.years.filter((entry) => entry !== year) : [...current.years, year].sort((a, b) => a - b),
                      }))}
                      className={`inline-flex items-center justify-center rounded-xl border px-4 py-2 text-sm font-medium transition ${selected ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}`}
                    >
                      Year {year}
                    </button>
                  );
                })}
              </div>

              {quickSetupForm.years.length > 0 && (
                <div className="mt-5 space-y-3 border-t border-gray-100 pt-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Section names per year (comma-separated)</p>
                  {quickSetupForm.years.map((year) => (
                    <div key={year} className="flex items-center gap-3">
                      <span className="w-16 text-sm font-medium text-gray-700">Year {year}</span>
                      <input
                        className="input"
                        placeholder="e.g. A, B, C"
                        value={quickSetupForm.sectionsPerYear[year] || ''}
                        onChange={(e) => setQuickSetupForm((current) => ({
                          ...current,
                          sectionsPerYear: { ...current.sectionsPerYear, [year]: e.target.value },
                        }))}
                        required
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Capacity per Section</label>
                <input className="input" type="number" min="1" value={quickSetupForm.capacity} onChange={(e) => setQuickSetupForm((c) => ({ ...c, capacity: Number(e.target.value) || 60 }))} />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <button type="button" onClick={() => setQuickSetupOpen(false)} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={quickSetupSaving} className="btn-primary">
                {quickSetupSaving ? 'Creating...' : 'Create Full Structure'}
              </button>
            </div>
          </form>
        </div>
      </Modal>

      <Modal open={rolloverModalOpen} onClose={() => setRolloverModalOpen(false)} panelClassName="max-w-md">
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-xl font-bold text-gray-900">Rollover Academic Session</h3>
            </div>
            <button type="button" onClick={() => setRolloverModalOpen(false)} className="rounded-xl border border-gray-200 p-2 text-gray-400 transition hover:bg-gray-50 hover:text-gray-600">
              <FiX size={16} />
            </button>
          </div>
          <form onSubmit={handleRolloverSubmit} className="mt-5 space-y-4">
            <p className="text-sm text-gray-500">This will deep clone all subjects and sections from this session to a new session, and automatically run the student promotion algorithm.</p>
            {rolloverError ? <Alert variant="error" title={rolloverError} /> : null}
            <div>
              <label className="label">New Session Label (e.g. Fall 2026)</label>
              <input
                className="input"
                placeholder="Session Label"
                value={rolloverForm.newSessionLabel}
                onChange={(e) => setRolloverForm((c) => ({ ...c, newSessionLabel: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="label">New Year Number (e.g. 2026)</label>
              <input
                className="input"
                type="number"
                placeholder="YYYY"
                value={rolloverForm.newYearNumber}
                onChange={(e) => setRolloverForm((c) => ({ ...c, newYearNumber: e.target.value }))}
                required
              />
            </div>
            <div className="flex justify-end gap-3 pt-3">
              <button type="button" onClick={() => setRolloverModalOpen(false)} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={rolloverSaving} className="btn-primary">
                {rolloverSaving ? 'Rolling over...' : 'Automate Rollover'}
              </button>
            </div>
          </form>
        </div>
      </Modal>

      <Modal open={orgUnitFormOpen} onClose={() => setOrgUnitFormOpen(false)} panelClassName="max-w-2xl">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-display text-2xl font-bold text-gray-900">
                {orgUnitForm.id ? 'Edit Department Unit' : 'Add Department Unit'}
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Keep the teaching hierarchy separate from people placement. Use academic departments for curriculum structure, and department units for faculty, staff, and admin home ownership.
              </p>
            </div>
            <button type="button" onClick={() => setOrgUnitFormOpen(false)} className="rounded-2xl border border-gray-200 p-2 text-gray-400 transition hover:bg-gray-50 hover:text-gray-600">
              <FiX size={18} />
            </button>
          </div>

          <form onSubmit={handleOrgUnitSave} className="mt-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <input
                className="input"
                placeholder="Department Unit Name"
                value={orgUnitForm.name}
                onChange={(event) => setOrgUnitForm((current) => ({ ...current, name: event.target.value }))}
                required
              />
              <input
                className="input"
                placeholder="Code"
                value={orgUnitForm.code}
                onChange={(event) => setOrgUnitForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))}
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <select
                className="input"
                value={orgUnitForm.type}
                onChange={(event) => setOrgUnitForm((current) => ({
                  ...current,
                  type: event.target.value,
                  linkedDepartmentId: event.target.value === 'academic' ? current.linkedDepartmentId : '',
                }))}
              >
                <option value="operational">Operational</option>
                <option value="academic">Academic</option>
              </select>
              <select
                className="input"
                value={orgUnitForm.collegeId}
                onChange={(event) => setOrgUnitForm((current) => ({ ...current, collegeId: event.target.value }))}
              >
                <option value="">Select College (Optional)</option>
                {options.colleges.map((college) => (
                  <option key={college._id} value={college._id}>{formatEntityName(college)}</option>
                ))}
              </select>
            </div>

            {orgUnitForm.type === 'academic' ? (
              <select
                className="input"
                value={orgUnitForm.linkedDepartmentId}
                onChange={(event) => setOrgUnitForm((current) => ({ ...current, linkedDepartmentId: event.target.value }))}
              >
                <option value="">Link Existing Academic Department (Optional)</option>
                {options.departments
                  .filter((department) => !orgUnitForm.collegeId || String(department.college?._id || department.college) === String(orgUnitForm.collegeId))
                  .map((department) => (
                    <option key={department._id} value={department._id}>{formatEntityName(department)}</option>
                  ))}
              </select>
            ) : null}

            <textarea
              className="input min-h-[110px]"
              placeholder="Description"
              value={orgUnitForm.description}
              onChange={(event) => setOrgUnitForm((current) => ({ ...current, description: event.target.value }))}
            />

            {orgUnitFormError ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{orgUnitFormError}</div> : null}

            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setOrgUnitFormOpen(false)} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={orgUnitFormSaving} className="btn-primary">
                {orgUnitFormSaving ? 'Saving...' : orgUnitForm.id ? 'Save Changes' : 'Create Unit'}
              </button>
            </div>
          </form>
        </div>
      </Modal>

      <div className="space-y-4">
        <div className="min-w-0">
          <p className="font-display text-lg font-semibold leading-8 text-gray-900 sm:text-xl">
            {structureMode === 'organization'
              ? 'Manage the ownership side of the institution separately, so faculty, staff, and admins have a department home without changing the student delivery tree.'
              : activeScreen === 'structure'
                ? 'Build and navigate the university hierarchy with a cleaner, faster workspace.'
                : activeScreen === 'facultySubjects'
                  ? 'Browse subjects and faculty relationships from the same academic workspace without losing context.'
                  : activeScreen === 'sectionDetail'
                    ? 'Review section details, student membership, and inherited subject coverage in one focused academic view.'
                    : 'Inspect subject mappings, assigned faculty, and linked sections from the same academic workspace.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="inline-flex items-center rounded-full p-1 shadow-sm"
            style={{
              backgroundColor: 'var(--theme-toggle-bg)',
              border: '1px solid var(--theme-toggle-border)',
              boxShadow: 'var(--theme-toggle-shadow)',
            }}
          >
            <button
              type="button"
              onClick={() => setStructureMode('academic')}
              className="rounded-full px-3 py-1.5 text-xs font-semibold transition"
              style={structureMode === 'academic'
                ? {
                    background: 'var(--page-accent-panel)',
                    color: 'var(--page-accent-panel-text)',
                    boxShadow: 'var(--shadow-card)',
                  }
                : {
                    color: 'var(--theme-toggle-text)',
                  }}
            >
              Academic
            </button>
            <button
              type="button"
              onClick={() => setStructureMode('organization')}
              className="rounded-full px-3 py-1.5 text-xs font-semibold transition"
              style={structureMode === 'organization'
                ? {
                    background: 'var(--page-accent-panel)',
                    color: 'var(--page-accent-panel-text)',
                    boxShadow: 'var(--shadow-card)',
                  }
                : {
                    color: 'var(--theme-toggle-text)',
                  }}
            >
              Organizational
            </button>
          </div>

          {structureMode === 'organization' ? (
            <>
              <ToolbarButton primary onClick={openOrgUnitCreate}>
                <FiPlus size={15} />
                Add Department Unit
              </ToolbarButton>
              <ToolbarButton onClick={loadOrganizationWorkspace}>
                <FiRefreshCw size={15} />
                Refresh
              </ToolbarButton>
            </>
          ) : activeScreen === 'structure' ? (
            <>
              <HelpTooltip title="Academic workspace help" items={WORKSPACE_HELP_ITEMS} />
              <ToolbarButton primary onClick={openFacultySubjects}>
                <FiBookOpen size={15} />
                View Subjects & Faculty
              </ToolbarButton>
              <ToolbarButton onClick={() => setWorkspaceView((current) => current === 'hierarchy' ? 'catalog' : 'hierarchy')}>
                <FiLayers size={15} />
                {workspaceView === 'hierarchy' ? 'Open Global Search' : 'Back to Drilldown'}
              </ToolbarButton>
              <ToolbarButton onClick={() => navigate('/academics/advanced')}>
                <FiLayers size={15} />
                Subject Directory
              </ToolbarButton>
              <ToolbarButton onClick={() => setQuickSetupOpen(true)}>
                <FiPlus size={15} />
                Quick Setup
              </ToolbarButton>
              <ToolbarButton onClick={loadAcademicWorkspace}>
                <FiRefreshCw size={15} />
                Refresh
              </ToolbarButton>
            </>
          ) : (
            <>
              <ToolbarButton onClick={goBack}>
                <FiArrowLeft size={15} />
                Back
              </ToolbarButton>
              <ToolbarButton onClick={loadAcademicWorkspace}>
                <FiRefreshCw size={15} />
                Refresh
              </ToolbarButton>
            </>
          )}
        </div>
      </div>

      {error ? <Alert type="error" message={error} /> : null}

      {structureMode === 'organization' ? (
        <OrganizationWorkspace
          organizationUnits={organizationUnits}
          organizationSummary={organizationSummary}
          organizationLoading={organizationLoading}
          collegeOptions={options.colleges}
          departmentOptions={options.departments}
          onRefresh={loadOrganizationWorkspace}
          onCreate={openOrgUnitCreate}
          onEdit={openOrgUnitEdit}
          onDelete={(unit) => setConfirmDelete({ open: true, resource: 'org-units', item: unit, loading: false })}
          onOpenProfile={(member) => member?.systemId && navigate(`/admin/users/${member.systemId}`)}
        />
      ) : (
        <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        {summaryCards.map((card) => (
          <SummaryCard
            key={card.label}
            onClick={() => {
              if (!card.level) return;
              setActiveScreen('structure');
              setWorkspaceView('hierarchy');
              setFocusScopeMode('global');
              setFocusLevel(card.level);
              if (card.level === 'subject') {
                setSelectedSubject((current) => current || options.subjects?.[0] || null);
              }
              if (card.level === 'student') {
                setSelectedStudentId((current) => current || activeStudentRecords[0]?._id || '');
              }
              if (card.level === 'session' && selectedProgram) {
                const firstSession = (options.academicSessions || []).find(
                  (session) => String(session.program?._id || session.program) === String(selectedProgram._id)
                );
                setSelectedSessionId(firstSession?._id || '');
              }
            }}
            card={card}
            active={Boolean(card.level && focusLevel === card.level && workspaceView === 'hierarchy')}
          />
        ))}
      </div>

      {activeScreen === 'structure' ? (
        <div className="space-y-6 xl:flex xl:h-full xl:min-h-0 xl:flex-col">
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
            <div className="grid gap-6 xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.94fr)] xl:items-stretch">
              <div className="card flex overflow-hidden p-0 xl:h-full xl:min-h-0 xl:flex-col">
                <div className="border-b border-slate-200 bg-slate-50 px-6 py-5">
                  <div className="space-y-4">
                    <div className="max-w-2xl space-y-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Workspace Level</p>
                      <h3 className="font-display text-2xl font-bold text-slate-900">{extendedFocusMeta.title}</h3>
                      <p className="break-words text-xs leading-5 text-slate-500" title={extendedFocusMeta.subtitle}>{extendedFocusMeta.subtitle}</p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                      <label className="relative block w-full min-w-0">
                        <FiSearch size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          className="input w-full pl-10"
                          placeholder={`Search ${extendedFocusMeta.title.toLowerCase()}`}
                          value={recordsQuery}
                          onChange={(event) => setRecordsQuery(event.target.value)}
                        />
                      </label>
                      <ToolbarButton primary className="shrink-0 sm:self-stretch" onClick={extendedFocusMeta.addAction} disabled={!extendedFocusMeta.addAction}>
                        <FiPlus size={15} />
                        {extendedFocusMeta.addLabel}
                      </ToolbarButton>
                    </div>
                  </div>
                </div>

                <div className="flex-1 space-y-5 overflow-y-auto p-6">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    <TrailButton active={focusLevel === 'college'} onClick={() => {
                      setFocusScopeMode('global');
                      setFocusLevel('college');
                    }}>Hierarchy</TrailButton>
                    {selectedCollege ? (
                      <>
                        <FiChevronRight size={12} />
                        <TrailButton active={focusLevel === 'department'} onClick={() => {
                          setFocusScopeMode('contextual');
                          setFocusLevel('department');
                        }} title={selectedCollege.name}>{selectedCollege.name}</TrailButton>
                      </>
                    ) : null}
                    {selectedDepartment ? (
                      <>
                        <FiChevronRight size={12} />
                        <TrailButton active={focusLevel === 'program'} onClick={() => {
                          setFocusScopeMode('contextual');
                          setFocusLevel('program');
                        }} title={selectedDepartment.name}>{selectedDepartment.name}</TrailButton>
                      </>
                    ) : null}
                    {selectedProgram ? (
                      <>
                        <FiChevronRight size={12} />
                        <TrailButton active={focusLevel === 'course'} onClick={() => {
                          setFocusScopeMode('contextual');
                          setFocusLevel('course');
                        }} title={selectedProgram.name}>{selectedProgram.name}</TrailButton>
                      </>
                    ) : null}
                    {selectedCourse ? (
                      <>
                        <FiChevronRight size={12} />
                        <TrailButton active={focusLevel === 'section'} onClick={() => {
                          setFocusScopeMode('contextual');
                          setFocusLevel('section');
                        }} title={selectedCourse.name}>{selectedCourse.name}</TrailButton>
                      </>
                    ) : null}
                    {selectedSubject && focusLevel === 'subject' ? (
                      <>
                        <FiChevronRight size={12} />
                        <span className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold tracking-[0.12em] text-white">{selectedSubject.code || selectedSubject.name}</span>
                      </>
                    ) : null}
                  </div>

                  {filteredFocusItems.length ? (
                    <div className="grid gap-3">
                      {filteredFocusItems.map((item) => {
                        const isSelected = String(focusSelectionValue) === String(item._id);

                        return (
                          <EntityListCard
                            key={item._id}
                            title={formatEntityName(item)}
                            meta={getColumnMeta(focusLevel, item)}
                            selected={isSelected}
                            onOpen={() => selectFocusedItem(item)}
                            actions={(
                              <>
                                <ToolbarButton className="text-xs" onClick={() => selectFocusedItem(item)}>
                                  {['section', 'subject', 'student'].includes(focusLevel) ? 'Open' : 'Explore'}
                                </ToolbarButton>
                                {focusLevel !== 'student' && focusLevel !== 'subject' ? (
                                  <>
                                    <ToolbarButton className="text-xs" onClick={() => openEditForm(focusLevel === 'session' ? 'session' : focusLevel, item)}>Edit</ToolbarButton>
                                    <ToolbarButton className="text-xs text-red-600 hover:text-red-700" onClick={() => setConfirmDelete({ open: true, resource: getDeleteResource(focusLevel === 'session' ? 'session' : focusLevel), item, loading: false })}>Delete</ToolbarButton>
                                  </>
                                ) : focusLevel === 'student' ? (
                                  <ToolbarButton className="text-xs" onClick={() => navigate(`/admin/users/${item.systemId}`)} disabled={!item.systemId}>
                                    Open Profile
                                  </ToolbarButton>
                                ) : null
                                }
                              </>
                            )}
                          />
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 px-5 py-10 text-sm leading-6 text-slate-400">
                      {extendedFocusMeta.emptyLabel}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex min-w-0 flex-col xl:h-full xl:min-h-0">
                <div className="card flex min-w-0 flex-1 overflow-hidden p-0">
                  {focusedEntity ? (
                    <div className="flex h-full flex-1 flex-col">
                      <div className="panel-accent border-b px-6 py-6">
                        <div className="flex flex-col gap-6">
                          <div className="flex items-start gap-4">
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl bg-white/10">
                              {getEntityIcon(focusLevel === 'session' ? 'session' : focusLevel)}
                            </div>
                            <div className="min-w-0">
                              <p className="panel-accent-muted text-[11px] font-semibold uppercase tracking-[0.18em]">
                                {focusLevel === 'session' ? 'Session Overview' : 'Selected Item'}
                              </p>
                              <h3 className="mt-2 break-words font-display text-2xl font-bold leading-tight">{formatEntityName(focusedEntity)}</h3>
                              <p className="panel-accent-muted mt-2 max-w-2xl break-words text-sm leading-6" title={getColumnMeta(focusLevel, focusedEntity)}>{getColumnMeta(focusLevel, focusedEntity)}</p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {(TREE_ACTIONS[focusLevel] || []).map((childResource) => (
                              <button key={childResource} type="button" onClick={() => openCreateForm(childResource, focusLevel, focusedEntity)} className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/15">
                                <span className="inline-flex items-center gap-1.5">
                                  <FiPlus size={13} />
                                  Add {childResource === 'session' ? 'Session' : childResource}
                                </span>
                              </button>
                            ))}
                            {focusLevel === 'student' ? (
                              <>
                                <button type="button" onClick={() => focusedEntity.systemId && navigate(`/admin/users/${focusedEntity.systemId}`)} disabled={!focusedEntity.systemId} className="inline-flex min-h-10 items-center rounded-full bg-white px-3 py-2 text-xs font-semibold text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60">
                                  Open Profile
                                </button>
                                {canShowAcademicMappingOptions(focusedEntity) ? (
                                  <button
                                    type="button"
                                    onClick={() => requestStudentMappingRemoval(focusedEntity)}
                                    disabled={!focusedEntity.systemId || !focusedEntity.section}
                                    className="inline-flex min-h-10 items-center rounded-full border border-white/25 bg-transparent px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    Remove Mapping
                                  </button>
                                ) : null}
                              </>
                            ) : focusLevel === 'subject' ? (
                              <button type="button" onClick={() => focusedEntity._id && navigate(`/academics/subjects/${focusedEntity._id}`)} className="inline-flex min-h-10 items-center rounded-full bg-white px-3 py-2 text-xs font-semibold text-slate-900 transition hover:bg-slate-100">
                                Open Subject Page
                              </button>
                            ) : (
                              <button type="button" onClick={() => openEditForm(focusLevel, focusedEntity)} className="inline-flex min-h-10 items-center rounded-full bg-white px-3 py-2 text-xs font-semibold text-slate-900 transition hover:bg-slate-100">
                                <span className="inline-flex items-center gap-1.5">
                                  <FiEdit2 size={13} />
                                  Edit
                                </span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex-1 space-y-5 overflow-y-auto p-6">
                        {focusMetrics.length ? (
                          <FocusMetricStack items={focusMetrics} />
                        ) : null}

                        <div className="grid min-w-0 gap-4 xl:grid-cols-2 xl:items-stretch">
                          {focusLevel === 'college' ? (
                            <>
                              <FocusPanel eyebrow="Departments" title="Departments in this College" description="Academic departments currently configured under this college." bodyClassName="max-h-64 overflow-y-auto pr-1">
                                <div className="space-y-2">
                                  {(focusedEntity.departments || []).length ? (focusedEntity.departments || []).map((department) => (
                                    <LinkedRecordButton key={department._id} title={department.name} subtitle={`${(department.programs || []).length} programs`} onClick={() => selectFocusedItem(department)} />
                                  )) : <p className="text-sm text-slate-500">No departments are attached to this college yet.</p>}
                                </div>
                              </FocusPanel>

                              <FocusPanel eyebrow="Programs" title="Programs in this College" description="Programs available across the departments in this college." bodyClassName="max-h-64 overflow-y-auto pr-1">
                                <div className="space-y-2">
                                  {(focusedEntity.departments || []).flatMap((department) => department.programs || []).length
                                    ? (focusedEntity.departments || []).flatMap((department) => department.programs || []).map((program) => (
                                      <LinkedRecordButton key={program._id} title={program.name} subtitle={`${(program.courses || []).length} courses`} onClick={() => selectFocusedItem(program)} />
                                    ))
                                    : <p className="text-sm text-slate-500">No programs are available under this college yet.</p>}
                                </div>
                              </FocusPanel>
                            </>
                          ) : null}

                          {focusLevel === 'department' ? (
                            <>
                              <FocusPanel eyebrow="Programs" title="Programs in this Department" description="Programs currently connected to the selected department." bodyClassName="max-h-64 overflow-y-auto pr-1">
                                <div className="space-y-2">
                                  {(focusedEntity.programs || []).length ? (focusedEntity.programs || []).map((program) => (
                                    <LinkedRecordButton key={program._id} title={program.name} subtitle={`${(program.courses || []).length} courses`} onClick={() => selectFocusedItem(program)} />
                                  )) : <p className="text-sm text-slate-500">No programs are attached to this department yet.</p>}
                                </div>
                              </FocusPanel>

                              <FocusPanel eyebrow="Courses" title="Courses in this Department" description="Courses available through the department's programs." bodyClassName="max-h-64 overflow-y-auto pr-1">
                                <div className="space-y-2">
                                  {(focusedEntity.programs || []).flatMap((program) => program.courses || []).length
                                    ? (focusedEntity.programs || []).flatMap((program) => program.courses || []).map((course) => (
                                      <LinkedRecordButton key={course._id} title={course.name} subtitle={`${(course.sections || []).length} sections`} onClick={() => selectFocusedItem(course)} />
                                    ))
                                    : <p className="text-sm text-slate-500">No courses are attached to this department yet.</p>}
                                </div>
                              </FocusPanel>
                            </>
                          ) : null}

                          {focusLevel === 'program' ? (
                            <>
                              <FocusPanel eyebrow="Courses" title="Courses in this Program" description="Courses currently connected to this program." bodyClassName="max-h-64 overflow-y-auto pr-1">
                                <div className="space-y-2">
                                  {(focusedEntity.courses || []).length ? (focusedEntity.courses || []).map((course) => (
                                    <LinkedRecordButton key={course._id} title={course.name} subtitle={`${(course.sections || []).length} sections`} onClick={() => selectFocusedItem(course)} />
                                  )) : <p className="text-sm text-slate-500">No courses are attached to this program yet.</p>}
                                </div>
                              </FocusPanel>

                              <FocusPanel eyebrow="Sessions" title="Academic Sessions" description="Year-level sessions connected to this program." bodyClassName="max-h-64 overflow-y-auto pr-1">
                                <div className="space-y-2">
                                  {(options.academicSessions || [])
                                    .filter((session) => String(session.program?._id || session.program) === String(focusedEntity._id))
                                    .map((session) => (
                                      <LinkedRecordButton
                                        key={session._id}
                                        title={session.label}
                                        subtitle={`Year ${session.yearNumber || '—'}`}
                                        onClick={() => {
                                          setSelectedSessionId(session._id);
                                          setFocusScopeMode('contextual');
                                          setFocusLevel('session');
                                        }}
                                      />
                                    ))}
                                  {!((options.academicSessions || []).filter((session) => String(session.program?._id || session.program) === String(focusedEntity._id)).length) ? (
                                    <p className="text-sm text-slate-500">No academic sessions are linked to this program yet.</p>
                                  ) : null}
                                </div>
                              </FocusPanel>

                              <FocusPanel eyebrow="Direct Delivery" title="Sections Without Course" description="Program sections that are not mapped to a specific course." bodyClassName="max-h-64 overflow-y-auto pr-1">
                                <div className="space-y-2">
                                  {(focusedEntity.standaloneSections || []).length ? (focusedEntity.standaloneSections || []).map((section) => (
                                    <LinkedRecordButton key={section._id} title={section.name} subtitle={section.academicSession?.label || 'Session'} onClick={() => openSectionDetail(section)} />
                                  )) : <p className="text-sm text-slate-500">All sections in this program are mapped to a course.</p>}
                                </div>
                              </FocusPanel>
                            </>
                          ) : null}

                          {focusLevel === 'course' ? (
                            <>
                              <FocusPanel eyebrow="Enrollment" title="Batches" description="Student enrollment cohorts for this course." bodyClassName="max-h-64 overflow-y-auto pr-1">
                                <div className="space-y-2">
                                  {(focusedEntity.batches || []).length ? (focusedEntity.batches || []).map((batch) => (
                                    <LinkedRecordButton key={batch._id} title={batch.name} subtitle={`Year ${batch.enrollmentYear}`} onClick={() => {}} />
                                  )) : <p className="text-sm text-slate-500">No batches created for this course.</p>}
                                </div>
                              </FocusPanel>

                              <FocusPanel eyebrow="Blueprint" title="Curriculums" description="Master academic blueprints assigned to batches." bodyClassName="max-h-64 overflow-y-auto pr-1">
                                <div className="space-y-2">
                                  {(focusedEntity.curriculums || []).length ? (focusedEntity.curriculums || []).map((curriculum) => (
                                    <LinkedRecordButton key={curriculum._id} title={curriculum.name} subtitle={`v${curriculum.version}`} onClick={() => {}} />
                                  )) : <p className="text-sm text-slate-500">No curriculums defined for this course.</p>}
                                </div>
                              </FocusPanel>
                              <FocusPanel eyebrow="Delivery" title="Sections in this Course" description="Operational teaching groups attached to this course." bodyClassName="max-h-64 overflow-y-auto pr-1">
                                <div className="space-y-2">
                                  {(focusedEntity.sections || []).length ? (focusedEntity.sections || []).map((section) => (
                                    <LinkedRecordButton key={section._id} title={section.name} subtitle={section.academicSession?.label || 'Session'} onClick={() => openSectionDetail(section)} />
                                  )) : <p className="text-sm text-slate-500">No sections are linked to this course yet.</p>}
                                </div>
                              </FocusPanel>

                              <FocusPanel eyebrow="Curriculum" title="Subjects in this Course" description="Subject catalog grouped by term." bodyClassName="max-h-72 overflow-y-auto pr-1">
                                <div className="space-y-3">
                                  {selectedCourseSubjects.length ? groupSubjectsByTerm(selectedCourseSubjects).map((group) => (
                                    <div key={group.label} className="space-y-2">
                                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{group.label}</p>
                                      <div className="space-y-2">
                                        {group.subjects.map((subject) => (
                                          <LinkedRecordButton
                                            key={subject._id}
                                            title={subject.name || 'Subject'}
                                            subtitle={[subject.code || 'No code', subject.term ? `Semester ${subject.term}` : ''].filter(Boolean).join(' · ')}
                                            onClick={() => openSubjectDetail(subject)}
                                          />
                                        ))}
                                      </div>
                                    </div>
                                  )) : <p className="text-sm text-slate-500">No subjects are linked to this course yet.</p>}
                                </div>
                              </FocusPanel>
                            </>
                          ) : null}

                          {focusLevel === 'section' ? (
                            <>
                              <FocusPanel eyebrow="Teaching Delivery" title="Delivered Subjects" description="Subjects currently assigned to this section." bodyClassName="max-h-64 overflow-y-auto pr-1">
                                <div className="space-y-2">
                                  {sectionAssignments.length
                                    ? sectionAssignments
                                      .slice(0, 8)
                                      .map((entry) => (
                                        <LinkedRecordButton
                                          key={entry._id}
                                          title={entry.subject?.name || 'Subject'}
                                          subtitle={entry.subject?.code || 'No code'}
                                          onClick={() => entry.subject && openSubjectDetail(entry.subject)}
                                        />
                                      ))
                                    : <p className="text-sm text-slate-500">No subjects are linked to this section yet.</p>}
                                </div>
                              </FocusPanel>

                              <FocusPanel eyebrow="Students" title="Active Students in this Section" description="Students currently enrolled and active in the selected section." bodyClassName="max-h-64 overflow-y-auto pr-1">
                                <div className="space-y-2">
                                  {sectionStudents.length ? sectionStudents.map((entry) => (
                                    <LinkedRecordButton
                                      key={entry._id}
                                      title={entry.student?.name || 'Student'}
                                      subtitle={entry.student?.systemId || entry.student?.email || 'No ID'}
                                      onClick={() => {
                                        const studentRecord = activeStudentRecords.find((record) => String(record._id) === String(entry.student?._id || ''));
                                        if (studentRecord) {
                                          selectFocusedItem(studentRecord);
                                        }
                                      }}
                                    />
                                  )) : <p className="text-sm text-slate-500">No active students are mapped to this section yet.</p>}
                                </div>
                              </FocusPanel>
                            </>
                          ) : null}

                          {focusLevel === 'session' ? (
                            <>
                              <div className="mb-4 rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                  <div>
                                    <h4 className="font-semibold text-blue-900">Session Rollover</h4>
                                    <p className="mt-0.5 text-sm text-blue-700">Duplicate this session structure to a new academic year</p>
                                  </div>
                                  <button type="button" onClick={() => setRolloverModalOpen(true)} className="btn-primary shrink-0">
                                    <FiCopy className="mr-2" /> Start Rollover
                                  </button>
                                </div>
                              </div>

                              <FocusPanel eyebrow="Sections" title="Sections in this Session" description="Delivery groups active in the selected academic session." bodyClassName="max-h-64 overflow-y-auto pr-1">
                                <div className="space-y-2">
                                  {selectedSessionSections.length ? selectedSessionSections.slice(0, 6).map((section) => (
                                    <LinkedRecordButton key={section._id} title={section.name} subtitle={section.course?.name || 'No course'} onClick={() => openSectionDetail(section)} />
                                  )) : <p className="text-sm text-slate-500">No sections are attached to this session yet.</p>}
                                </div>
                              </FocusPanel>

                              <FocusPanel eyebrow="Subjects" title="Subjects in this Session" description="Subjects available for delivery in the selected session." bodyClassName="max-h-64 overflow-y-auto pr-1">
                                <div className="space-y-2">
                                  {selectedSessionSubjects.length ? selectedSessionSubjects.slice(0, 8).map((subject) => (
                                    <LinkedRecordButton
                                      key={subject._id}
                                      title={subject.name || 'Subject'}
                                      subtitle={subject.code || 'No code'}
                                      onClick={() => openSubjectDetail(subject)}
                                    />
                                  )) : <p className="text-sm text-slate-500">No subjects are attached to this session yet.</p>}
                                </div>
                              </FocusPanel>
                            </>
                          ) : null}

                          {focusLevel === 'subject' ? (
                            <FocusPanel eyebrow="Assignments" title="Faculty and Section Delivery" description="Where this subject is being delivered and who is assigned to it." bodyClassName="max-h-64 overflow-y-auto pr-1">
                              <div className="space-y-2">
                                {selectedSubjectAssignments.length ? selectedSubjectAssignments.slice(0, 6).map((assignment) => (
                                  <LinkedRecordButton
                                    key={assignment._id}
                                    title={assignment.section?.name ? `Section ${assignment.section.name}` : 'Section mapping'}
                                    subtitle={getAssignedFacultyMembers(assignment).map((faculty) => faculty.name).join(', ') || 'No faculty'}
                                    onClick={() => assignment.section && openSectionDetail(assignment.section)}
                                  />
                                )) : <p className="text-sm text-slate-500">This subject is not assigned to any section yet.</p>}
                              </div>
                            </FocusPanel>
                          ) : null}

                          {focusLevel === 'student' ? (
                            <>
                              <FocusPanel eyebrow="Academic Placement" title="Current Placement" description="The student's current academic alignment inside the structure.">
                                <div className="grid gap-3 sm:grid-cols-2">
                                  <DetailPill label="Department" value={focusedEntity.departmentName || '—'} />
                                  <DetailPill label="Course" value={focusedEntity.courseName || '—'} />
                                </div>
                              </FocusPanel>

                              <FocusPanel eyebrow="Section" title="Current Section" description="Active section mapping for this student." bodyClassName="max-h-64 overflow-y-auto pr-1">
                                {focusedEntity.section ? (
                                  <div className="space-y-3">
                                    <LinkedRecordButton
                                      title={focusedEntity.sectionName ? `Section ${focusedEntity.sectionName}` : 'Section'}
                                      subtitle={focusedEntity.academicSession?.label || 'Session'}
                                      onClick={() => openSectionDetail(focusedEntity.section)}
                                    />
                                    {canShowAcademicMappingOptions(focusedEntity) ? (
                                      <button
                                        type="button"
                                        onClick={() => requestStudentMappingRemoval(focusedEntity)}
                                        className="btn-secondary text-red-600 hover:text-red-700"
                                      >
                                        Remove Mapping
                                      </button>
                                    ) : null}
                                  </div>
                                ) : <p className="text-sm text-slate-500">This student does not have an active section mapping.</p>}
                              </FocusPanel>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-6">
                      <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
                        <p className="text-sm font-semibold text-slate-900">Choose a {extendedFocusMeta.title.slice(0, -1).toLowerCase() || 'record'} from the left panel</p>
                        <p className="mt-2 text-sm leading-6 text-slate-500">Details, related records, and next actions will appear here in a structured workspace.</p>
                      </div>
                    </div>
                  )}
                </div>
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
              <DetailPill label="Course" value={selectedSection.course?.name || selectedCourse?.name || '—'} />
              <DetailPill label="Academic Session" value={selectedSection.academicSession?.label} />
              <DetailPill label="Study Year" value={selectedSection.studyYear ? `Year ${selectedSection.studyYear}` : '—'} />
              <DetailPill label="Capacity" value={selectedSection.capacity} />
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <DetailPill label="Linked Subjects" value={sectionAssignments.length} />
              <DetailPill label="Assigned Teachers" value={sectionFacultyMembers.length} />
              <DetailPill label="Enrolled Students" value={sectionStudents.length} />
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <DetailPill label="Approved Intake Open" value={availableSectionStudents.length} />
              <DetailPill label="Seats Remaining" value={sectionCapacityLeft} />
              <DetailPill label="Course Subjects" value={availableSectionSubjects.length} />
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button type="button" onClick={() => openSectionStudentsPage(selectedSection)} className="btn-secondary">
                <FiUsers size={15} />
                View Enrolled Students
              </button>
              <button type="button" onClick={() => openSubjectTeacherPage(selectedSection)} className="btn-secondary">
                <FiBookOpen size={15} />
                Open Subject Management
              </button>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="card p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-lg font-bold text-gray-900">Inherited Subjects</h3>
                  <p className="mt-1 text-sm text-gray-500">This section automatically inherits the full subject catalog from its course. Open any subject to manage teachers and section-specific overrides.</p>
                </div>
                <span className="badge border border-slate-200 bg-slate-100 text-slate-700">{availableSectionSubjects.length} subjects</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {availableSectionSubjects.length ? availableSectionSubjects.map((subject) => (
                  <button
                    key={subject._id}
                    type="button"
                    onClick={() => openSubjectDetail(subject)}
                    className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50"
                  >
                    {subject.code || 'SUBJ'} · {subject.name}
                  </button>
                )) : (
                  <p className="text-sm text-gray-500">No inherited subjects are linked to this section's course yet.</p>
                )}
              </div>
            </div>

            <div className="card p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-lg font-bold text-gray-900">Add Students</h3>
                  <p className="mt-1 text-sm text-gray-500">Only approved student accounts with no active section mapping are listed here.</p>
                </div>
                <span className="badge border border-emerald-200 bg-emerald-100 text-emerald-700">{availableSectionStudents.length} approved</span>
              </div>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <select className="input" value={sectionStudentSelection} onChange={(event) => setSectionStudentSelection(event.target.value)}>
                  <option value="">Select approved student</option>
                  {availableSectionStudents.map((student) => (
                    <option key={student._id} value={student._id}>{student.name} · {student.systemId || student.email}</option>
                  ))}
                </select>
                <button type="button" onClick={handleSectionStudentCreate} disabled={!sectionStudentSelection || sectionActionSaving.student} className="btn-primary justify-center whitespace-nowrap">
                  {sectionActionSaving.student ? 'Adding...' : 'Add Student'}
                </button>
              </div>
              {!availableSectionStudents.length ? (
                <p className="mt-3 text-sm text-gray-500">No approved unmapped student accounts are currently available.</p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_340px]">
            <div className="card p-6">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-xl font-bold text-gray-900">Section Subjects</h3>
                  <p className="mt-1 text-sm text-gray-500">These subjects come from the course automatically. Teacher ownership stays centralized on the subject detail page.</p>
                </div>
                <button type="button" onClick={() => openSubjectTeacherPage(selectedSection)} className="btn-secondary text-xs">
                  Open Subject Management
                </button>
              </div>

              {sectionAssignments.length ? (
                <div className="space-y-3">
                  {sectionAssignments.map((assignment) => (
                    <div key={assignment._id} className={`rounded-2xl border px-4 py-4 ${getAssignedFacultyMembers(assignment).length ? 'border-gray-100 bg-gray-50 dark:border-slate-800 dark:bg-slate-900/80' : 'border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-950/20'}`}>
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <button type="button" onClick={() => openSubjectDetail(assignment.subject)} className="text-left">
                            <p className="font-semibold text-gray-900 transition hover:text-blue-700">{assignment.subject?.name || 'Subject'}</p>
                          </button>
                          <p className="mt-1 text-sm text-gray-500">
                            {(assignment.subject?.code || 'No subject code')}{assignment.semester ? ` · ${assignment.semester}` : ''}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                              {getAssignedFacultyMembers(assignment).length
                                ? `${getAssignedFacultyMembers(assignment).length} teacher${getAssignedFacultyMembers(assignment).length > 1 ? 's' : ''} assigned`
                                : 'No teachers assigned'}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            onClick={() => openSubjectDetail(assignment.subject)}
                            className="btn-secondary text-xs"
                          >
                            Open Subject
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-5 text-sm text-gray-400">
                  No inherited subjects are available for this section yet.
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="card p-6">
                <h3 className="font-display text-lg font-bold text-gray-900">Section Context</h3>
                <div className="mt-4 space-y-3 text-sm text-gray-600">
                  <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
                    <p className="font-semibold text-gray-900">Student Access</p>
                    <p className="mt-1">Approved students attached to this section inherit their timetable, attendance scope, and subject list from the course-linked subject catalog.</p>
                  </div>
                  <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
                    <p className="font-semibold text-gray-900">Faculty Scope</p>
                    <p className="mt-1">Professor ownership is managed on the dedicated subject detail page, with optional section-level overrides when a section needs its own teaching context.</p>
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
                  { key: 'subjects', label: 'Subjects', count: filteredSubjects.length },
                  { key: 'faculty', label: 'Faculty', count: facultyCards.length },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setFacultySubjectsTab(tab.key)}
                    className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${facultySubjectsTab === tab.key ? 'border-blue-500 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
                  >
                    {tab.label}
                    <span className={`rounded-full px-2 py-0.5 text-xs ${facultySubjectsTab === tab.key ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>{tab.count}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="p-6">
              <div className="mb-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
                <div>
                  <label className="label">Search Subjects or Faculty</label>
                  <input
                    className="input"
                    placeholder="Search by subject, code, faculty, or ID"
                    value={facultySubjectsQuery}
                    onChange={(event) => setFacultySubjectsQuery(event.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Section Filter</label>
                  <select className="input" value={facultySectionFilterId} onChange={(event) => setFacultySectionFilterId(event.target.value)}>
                    <option value="">All Sections in Scope</option>
                    {(options.sections || [])
                      .filter((section) => {
                        if (selectedDepartmentId && String(section.department?._id || section.department) !== String(selectedDepartmentId)) return false;
                        if (selectedProgramId && String(section.program?._id || section.program) !== String(selectedProgramId)) return false;
                        if (selectedCourseId && String(section.course?._id || section.course) !== String(selectedCourseId)) return false;
                        return true;
                      })
                      .map((section) => (
                        <option key={section._id} value={section._id}>{section.name} · {section.program?.name || 'Program'}</option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="mb-5 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
                  {filteredSubjects.length} subjects
                </span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
                  {facultyCards.length} faculty
                </span>
                {selectedDepartment?.name ? (
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
                    {selectedDepartment.name}
                  </span>
                ) : null}
                {selectedProgram?.name ? (
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
                    {selectedProgram.name}
                  </span>
                ) : null}
                {selectedCourse?.name ? (
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
                    {selectedCourse.name}
                  </span>
                ) : null}
              </div>

              {facultySubjectsTab === 'subjects' ? (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm text-slate-500">Open any subject to inspect linked teachers and section-level mappings.</div>
                    <button type="button" onClick={() => navigate('/academics/advanced')} className="btn-secondary text-xs">
                      Subject Operations
                    </button>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {filteredSubjects.length ? filteredSubjects.map((subject) => {
                      const assignments = [
                        ...(subject.sectionTeachers || []).map((entry) => ({
                          _id: entry._id,
                          faculty: entry.teacher,
                          facultyMembers: entry.teacher ? [entry.teacher] : [],
                        })),
                        ...(subject.teachers || []).map((teacher) => ({
                          _id: `${subject._id}-${teacher._id}`,
                          faculty: teacher,
                          facultyMembers: [teacher],
                        })),
                      ];
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
                            {assignments.length ? assignments.slice(0, 3).flatMap((assignment) => {
                              const facultyMembers = getAssignedFacultyMembers(assignment);
                              return facultyMembers.length
                                ? facultyMembers.map((faculty) => (
                                  <span key={`${assignment._id}-${faculty._id}`} className="badge border border-slate-200 bg-slate-100 text-slate-700">
                                    {faculty.name}
                                  </span>
                                ))
                                : [<span key={`${assignment._id}-unassigned`} className="badge border border-amber-200 bg-amber-100 text-amber-800">Unassigned</span>];
                            }) : <span className="badge border border-amber-200 bg-amber-100 text-amber-800">No faculty assigned</span>}
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
                            <div className="mt-1 flex flex-wrap gap-1">
                              {getAssignedFacultyMembers(assignment).map((member) => (
                                <span key={member._id} className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600">{member.name}</span>
                              ))}
                            </div>
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
        </>
      )}

    </div>
  );
}
