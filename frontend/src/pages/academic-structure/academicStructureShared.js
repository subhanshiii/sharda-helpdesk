import React from 'react';
import { FiBookOpen, FiGitBranch, FiLayers, FiUsers } from 'react-icons/fi';
import { subjectMatchesCourse } from '../../utils/academicScope';

export const TREE_ACTIONS = {
  college: ['department'],
  department: ['program'],
  program: ['course', 'session'],
  course: ['subject', 'section'],
  session: [],
  subject: [],
};

export const emptyQuickSetup = {
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

export const emptyInlineForm = {
  mode: 'create',
  resource: '',
  parentType: '',
  parentLabel: '',
  id: '',
  values: {},
};

export const emptyOrgUnitForm = {
  id: '',
  name: '',
  code: '',
  type: 'operational',
  collegeId: '',
  linkedDepartmentId: '',
  description: '',
};

export const formatEntityName = (entity) => {
  if (!entity) return '—';
  if (entity.name && entity.code) return `${entity.name} (${entity.code})`;
  return entity.name || entity.label || entity.code || entity.email || entity.systemId || entity._id;
};

export const getEntityId = (entity) => String(entity?._id || entity || '');

export const getProgramSections = (program) => [
  ...((program?.courses || []).flatMap((course) => course.sections || [])),
  ...(program?.standaloneSections || []),
];

export const getProgramSubjects = (program, subjects = []) => (
  subjects.filter((subject) => getEntityId(subject.program) === getEntityId(program))
);

export const getCourseSubjects = (course, subjects = []) => (
  subjects.filter((subject) => subjectMatchesCourse(subject, getEntityId(course)))
);

export const getSessionSections = (session, sections = []) => (
  sections.filter((section) => getEntityId(section.academicSession) === getEntityId(session))
);

export const getSessionSubjects = (session, subjects = []) => (
  subjects.filter((subject) => getEntityId(subject.academicSession) === getEntityId(session))
);

export const buildActiveStudentRecords = (enrollments = []) => {
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

export const canShowAcademicMappingOptions = (student) => {
  if (!student) return false;
  if (student.status !== 'approved') return false;
  return true;
};

export const groupSubjectsByTerm = (subjects = []) => {
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

export const getColumnMeta = (type, item) => {
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

export const WORKSPACE_HELP_ITEMS = [
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

export const getEntityIcon = (type) => (
  type === 'college' ? <FiLayers size={16} />
    : type === 'department' ? <FiGitBranch size={16} />
      : type === 'program' ? <FiBookOpen size={16} />
        : type === 'course' ? <FiBookOpen size={16} />
          : type === 'section' ? <FiUsers size={16} />
            : type === 'student' ? <FiUsers size={16} />
            : type === 'subject' ? <FiBookOpen size={16} />
              : <FiGitBranch size={16} />
);

export const getAssignedFacultyMembers = (entry) => {
  const members = Array.isArray(entry?.facultyMembers) ? entry.facultyMembers.filter(Boolean) : [];
  if (members.length) return members;
  return entry?.faculty ? [entry.faculty] : [];
};

export const DetailPill = ({ label, value }) => (
  <div className="flex h-full flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5">
    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">{label}</p>
    <p className="mt-2 break-words text-sm font-semibold leading-5 text-gray-900">{value || '—'}</p>
  </div>
);

export const SummaryCard = ({ card, active, onClick }) => (
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

export const FocusMetricStack = ({ items = [] }) => (
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

export const FocusPanel = ({ eyebrow, title, description, children, bodyClassName = '' }) => (
  <div className="flex h-full min-w-0 flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
    <div className="mb-5 space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{eyebrow}</p>
      <h4 className="break-words text-base font-bold leading-6 text-slate-900">{title}</h4>
      {description ? <p className="text-sm leading-6 text-slate-500">{description}</p> : null}
    </div>
    <div className={`min-h-0 flex-1 ${bodyClassName}`}>{children}</div>
  </div>
);
