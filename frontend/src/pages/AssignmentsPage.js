import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiArrowLeft, FiBookOpen, FiClock, FiPlus } from 'react-icons/fi';
import API from '../utils/api';
import { EmptyState, FullPageSpinner, PageHeader, Alert } from '../components/ui';
import { formatDate, formatRelative } from '../utils/helpers';
import { usePermissions } from '../context/PermissionContext';
import { useAuth } from '../context/AuthContext';
import { isStudentUser } from '../utils/access';
import AcademicScopeFilters from '../components/academics/AcademicScopeFilters';
import useAcademicOptions from '../hooks/useAcademicOptions';
import { filterSectionsByScope } from '../utils/academicScope';

const SubmissionBadge = ({ submission }) => {
  if (!submission) return <span className="badge bg-gray-100 text-gray-600">Pending</span>;
  const styles = {
    submitted: 'bg-blue-50 text-blue-700 border border-blue-200',
    graded: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    returned: 'bg-amber-50 text-amber-700 border border-amber-200',
  };
  return <span className={`badge ${styles[submission.status] || 'bg-gray-100 text-gray-600'}`}>{submission.status}</span>;
};

const SectionCard = ({ section, active, subjectCount, assignmentCount, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full rounded-[28px] border p-5 text-left transition duration-200 ${
      active
        ? 'border-[var(--accent-primary)] bg-[var(--page-accent-panel)] text-[var(--page-accent-panel-text)] shadow-lg'
        : 'border-[var(--border-strong)] bg-[var(--surface-card)] text-[var(--text-strong)] hover:-translate-y-0.5 hover:shadow-md'
    }`}
  >
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className={`text-xs font-semibold uppercase tracking-[0.16em] ${active ? 'text-[var(--page-accent-panel-muted)]' : 'text-[var(--text-muted)]'}`}>Section</p>
        <h3 className="mt-2 break-words font-display text-xl font-bold leading-tight">{section.name}</h3>
        <p className={`mt-2 break-words text-sm leading-6 ${active ? 'text-[var(--page-accent-panel-muted)]' : 'text-[var(--text-muted)]'}`}>
          {[section.department?.name, section.program?.name, section.course?.name].filter(Boolean).join(' · ')}
        </p>
      </div>
      <div className={`shrink-0 rounded-2xl px-3 py-2 text-xs font-semibold ${active ? 'bg-white/10 text-white' : 'bg-[var(--surface-soft)] text-[var(--text-main)]'}`}>
        Year {section.studyYear || section.academicSession?.yearNumber || '—'}
      </div>
    </div>
    <div className="mt-5 flex flex-wrap gap-3 text-sm">
      {subjectCount !== null ? (
        <div className={`rounded-2xl px-3 py-3 ${active ? 'bg-white/10 text-white' : 'bg-[var(--surface-soft)] text-[var(--text-main)]'}`}>
          <p className="text-xs uppercase tracking-wide opacity-70">Subjects</p>
          <p className="mt-2 text-lg font-bold">{subjectCount}</p>
        </div>
      ) : null}
      {assignmentCount !== null ? (
        <div className={`rounded-2xl px-3 py-3 ${active ? 'bg-white/10 text-white' : 'bg-[var(--surface-soft)] text-[var(--text-main)]'}`}>
          <p className="text-xs uppercase tracking-wide opacity-70">Assignments</p>
          <p className="mt-2 text-lg font-bold">{assignmentCount}</p>
        </div>
      ) : null}
      {subjectCount === null && assignmentCount === null ? (
        <span className={`inline-flex rounded-2xl px-3 py-2 text-xs font-semibold ${active ? 'bg-white/10 text-white' : 'bg-[var(--surface-soft)] text-[var(--text-main)]'}`}>
          Open to view subjects
        </span>
      ) : null}
    </div>
  </button>
);

const SubjectCard = ({ item, active, onClick, assignmentCount = 0 }) => {
  const percentage = item.subjectAnalytics?.percentage || 0;
  const risk = item.subjectAnalytics?.riskLevel || 'normal';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-[24px] border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${
        active ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-soft)]' : 'border-[var(--border-strong)] bg-[var(--surface-card)]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">{item.subject?.code || 'SUBJ'}</p>
          <h4 className="mt-2 break-words text-base font-bold leading-6 text-[var(--text-strong)]">{item.subject?.name || 'Subject'}</h4>
          <p className="mt-2 break-words text-sm text-[var(--text-muted)]">
            {item.teacher?.name || 'Faculty not assigned'}
          </p>
        </div>
        <span className={`badge ${risk === 'high' ? 'bg-rose-50 text-rose-700' : risk === 'moderate' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
          {Math.round(percentage)}%
        </span>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 text-xs text-[var(--text-muted)]">
        <span>{assignmentCount} assignment{assignmentCount === 1 ? '' : 's'}</span>
        {item.teachingAssignmentId ? <span>Linked teaching context</span> : <span>Section subject</span>}
      </div>
    </button>
  );
};

const AssignmentCard = ({ assignment, canManageAssignments, canSubmitAssignments }) => (
  <Link key={assignment._id} to={`/assignments/${assignment._id}`} className="card p-5 transition-all hover:-translate-y-0.5 hover:shadow-card-hover">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-gray-400">
          {assignment.subjectId?.code || assignment.subject || 'General'}
        </p>
        <h3 className="mt-1 break-words font-display text-lg font-bold text-gray-900">{assignment.title}</h3>
        <p className="mt-1 break-words text-sm text-gray-500">
          {assignment.sectionId?.name ? `${assignment.sectionId.name} · ` : ''}
          {assignment.subjectId?.name || assignment.subject || 'General coursework'}
        </p>
      </div>
      {canSubmitAssignments
        ? <SubmissionBadge submission={assignment.mySubmission} />
        : <span className="badge bg-slate-100 text-slate-700">{assignment.submissionCount || 0} submissions</span>}
    </div>
    <p className="mt-3 line-clamp-3 text-sm leading-7 text-gray-600">{assignment.description}</p>
    <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-gray-500">
      <span className="inline-flex items-center gap-1"><FiClock size={12} /> Due {formatDate(assignment.dueDate)}</span>
      <span className="inline-flex items-center gap-1"><FiBookOpen size={12} /> {assignment.maxScore} points</span>
      {canManageAssignments
        ? <span>{assignment.gradedCount || 0} graded</span>
        : assignment.mySubmission?.submittedAt
          ? <span>Updated {formatRelative(assignment.mySubmission.submittedAt)}</span>
          : null}
    </div>
  </Link>
);

export default function AssignmentsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { can, hasPermission } = usePermissions();
  const { options, departmentCollegeMap } = useAcademicOptions();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    visibilityTier: '',
    visibilityRole: '',
    collegeId: '',
    departmentId: '',
    programId: '',
    courseId: '',
    studyYear: '',
    sectionId: '',
  });
  const [activeSectionId, setActiveSectionId] = useState('');
  const [activeSubjectId, setActiveSubjectId] = useState('');
  const [activeSubjectsBySection, setActiveSubjectsBySection] = useState({});

  const canManageAssignments = can('create', 'assignments') || can('edit', 'assignments') || can('delete', 'assignments');
  const canSubmitAssignments = isStudentUser(user) || hasPermission('canSubmitAssignments');

  const scopedSections = useMemo(
    () => filterSectionsByScope(options.sections || [], filters, departmentCollegeMap),
    [departmentCollegeMap, filters, options.sections]
  );

  useEffect(() => {
    if (!scopedSections.length) {
      setActiveSectionId('');
      setActiveSubjectId('');
      return;
    }

    const hasCurrentSection = activeSectionId && scopedSections.some((section) => String(section._id) === String(activeSectionId));
    if (!hasCurrentSection) {
      if (filters.sectionId && scopedSections.some((section) => String(section._id) === String(filters.sectionId))) {
        setActiveSectionId(filters.sectionId);
      } else {
        setActiveSectionId('');
      }
      setActiveSubjectId('');
    }
  }, [activeSectionId, filters.sectionId, scopedSections]);

  useEffect(() => {
    if (!activeSectionId) return;
    let active = true;

    API.get(`/academics/sections/${activeSectionId}/active-subjects`)
      .then((response) => {
        if (!active) return;
        setActiveSubjectsBySection((current) => ({
          ...current,
          [String(activeSectionId)]: Array.isArray(response.data?.data) ? response.data.data : [],
        }));
      })
      .catch(() => {
        if (!active) return;
        setActiveSubjectsBySection((current) => ({
          ...current,
          [String(activeSectionId)]: [],
        }));
      });

    return () => {
      active = false;
    };
  }, [activeSectionId]);

  const activeSubjects = useMemo(
    () => activeSubjectsBySection[String(activeSectionId)] || [],
    [activeSectionId, activeSubjectsBySection]
  );

  const activeSubjectRows = useMemo(() => activeSubjects.flatMap((entry) => {
    const subject = entry?.subject;
    const assignmentsForSubject = Array.isArray(entry?.teachingAssignments) ? entry.teachingAssignments : [];
    if (!subject?._id) return [];
    if (!assignmentsForSubject.length) {
      return [{ subject, teacher: null, teachingAssignmentId: '', isUnassigned: true }];
    }
    return assignmentsForSubject.map((assignment) => ({
      subject,
      teacher: assignment.teacher || null,
      teachingAssignmentId: assignment._id || '',
      isUnassigned: false,
    }));
  }), [activeSubjects]);

  const queryFilters = useMemo(() => ({
    ...filters,
    sectionId: activeSectionId || filters.sectionId,
    subjectId: activeSubjectId,
  }), [activeSectionId, activeSubjectId, filters]);

  useEffect(() => {
    const loadAssignments = async () => {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams();
        Object.entries(queryFilters).forEach(([key, value]) => {
          if (value) params.append(key, value);
        });
        const res = await API.get(`/assignments${params.toString() ? `?${params}` : ''}`);
        setAssignments(Array.isArray(res.data?.data) ? res.data.data : []);
      } catch (requestError) {
        const message = requestError.response?.data?.message || 'Failed to load assignments';
        setAssignments([]);
        setError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    };

    loadAssignments();
  }, [queryFilters]);

  const sectionAssignmentCount = useMemo(() => {
    if (!activeSectionId) return assignments.length;
    return assignments.filter((assignment) => String(assignment.sectionId?._id || assignment.sectionId) === String(activeSectionId)).length;
  }, [activeSectionId, assignments]);

  const assignmentCountsBySubject = useMemo(() => {
    return assignments.reduce((acc, assignment) => {
      const subjectId = String(assignment.subjectId?._id || assignment.subjectId || '');
      if (!subjectId) return acc;
      acc[subjectId] = (acc[subjectId] || 0) + 1;
      return acc;
    }, {});
  }, [assignments]);

  const selectedSection = useMemo(
    () => scopedSections.find((section) => String(section._id) === String(activeSectionId)) || null,
    [activeSectionId, scopedSections]
  );

  const selectedSubject = useMemo(
    () => activeSubjectRows.find((row) => String(row.subject._id) === String(activeSubjectId))?.subject || null,
    [activeSubjectId, activeSubjectRows]
  );

  const visibleAssignments = useMemo(() => {
    if (!activeSubjectId) return [];
    return assignments.filter((assignment) => String(assignment.subjectId?._id || assignment.subjectId) === String(activeSubjectId));
  }, [activeSubjectId, assignments]);

  const stats = useMemo(() => ({
    total: assignments.length,
    dueSoon: assignments.filter((assignment) => new Date(assignment.dueDate) > new Date() && new Date(assignment.dueDate) < new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)).length,
    submitted: assignments.filter((assignment) => assignment.mySubmission).length,
  }), [assignments]);

  const handleFilterChange = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
    if (key === 'sectionId') {
      setActiveSectionId(value);
      setActiveSubjectId('');
    }
  };

  const handleSectionSelect = (sectionId) => {
    setFilters((current) => ({ ...current, sectionId }));
    setActiveSectionId(sectionId);
    setActiveSubjectId('');
  };

  const handleSubjectSelect = (subjectId) => {
    setActiveSubjectId(subjectId);
  };

  const clearSectionSelection = () => {
    setActiveSectionId('');
    setActiveSubjectId('');
    setFilters((current) => ({ ...current, sectionId: '' }));
  };

  const clearSubjectSelection = () => {
    setActiveSubjectId('');
  };

  if (!canManageAssignments && !canSubmitAssignments) {
    return <EmptyState icon="📚" title="Assignments unavailable" description="This account does not currently have assignment access." />;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Assignments"
        description={canManageAssignments
          ? 'Section-first assignment delivery tied directly to the academic structure.'
          : 'Review the coursework assigned to your section and track submission progress.'}
        action={canManageAssignments ? (
          <button onClick={() => navigate('/assignments/new')} className="btn-primary">
            <FiPlus size={15} /> Create Assignment
          </button>
        ) : (
          <button className="btn-secondary cursor-not-allowed opacity-70" disabled title="Only faculty and admins can create assignments.">
            <FiPlus size={15} /> Create Assignment
          </button>
        )}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-gray-400">Assignments</p>
          <p className="mt-1 font-display text-3xl font-black text-gray-900">{stats.total}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-gray-400">Due Soon</p>
          <p className="mt-1 font-display text-3xl font-black text-orange-600">{stats.dueSoon}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-gray-400">{canManageAssignments ? 'Published' : 'Submitted'}</p>
          <p className="mt-1 font-display text-3xl font-black text-blue-700">{canManageAssignments ? stats.total : stats.submitted}</p>
        </div>
      </div>

      {error ? <Alert type="error" message={error} /> : null}

      <div className="card p-4">
        <AcademicScopeFilters
          filters={filters}
          onChange={handleFilterChange}
          options={options}
          departmentCollegeMap={departmentCollegeMap}
          showRoleFilter
          showTierFilter
        />

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
          <span className="badge bg-[var(--surface-soft)] text-[var(--text-main)]">Sections drive assignments</span>
          {selectedSection ? <span className="badge bg-blue-50 text-blue-700">Section: {selectedSection.name}</span> : null}
          {selectedSubject ? <span className="badge bg-emerald-50 text-emerald-700">Subject: {selectedSubject.code || selectedSubject.name}</span> : null}
          {activeSectionId && !activeSubjectId ? <span className="badge bg-amber-50 text-amber-700">Choose a subject to see assignments</span> : null}
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold text-gray-900">Sections</h2>
            <p className="mt-1 text-sm text-gray-500">Open a section to see the subjects linked through Academic Planning.</p>
          </div>
          {activeSectionId ? (
            <button type="button" onClick={clearSectionSelection} className="btn-secondary inline-flex items-center gap-2">
              <FiArrowLeft size={15} /> Back to sections
            </button>
          ) : null}
        </div>

        {scopedSections.length === 0 ? (
          <EmptyState
            icon="🏫"
            title="No sections in scope"
            description="Adjust the academic filters to reveal the section cards available to your account."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {scopedSections.map((section) => {
              const isActive = String(section._id) === String(activeSectionId);
              return (
                <SectionCard
                  key={section._id}
                  section={section}
                  active={isActive}
                  subjectCount={isActive ? activeSubjects.length : null}
                  assignmentCount={isActive ? sectionAssignmentCount : null}
                  onClick={() => handleSectionSelect(String(section._id))}
                />
              );
            })}
          </div>
        )}
      </section>

      {activeSectionId ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-bold text-gray-900">Subjects</h2>
              <p className="mt-1 text-sm text-gray-500">
                {selectedSection ? `${selectedSection.name} subjects and teaching context.` : 'Select a subject to reveal the assignments inside it.'}
              </p>
            </div>
            {activeSubjectId ? (
              <button type="button" onClick={clearSubjectSelection} className="btn-secondary inline-flex items-center gap-2">
                <FiArrowLeft size={15} /> Back to subjects
              </button>
            ) : null}
          </div>

          {activeSubjects.length === 0 ? (
            <EmptyState
              icon="📖"
              title="No subjects found"
              description="This section does not yet have active subjects linked from Academic Planning."
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {activeSubjectRows.map((item) => {
                const subjectId = String(item.subject._id);
                return (
                  <SubjectCard
                    key={`${item.subject._id}-${item.teachingAssignmentId || 'base'}`}
                    item={item}
                    active={String(activeSubjectId) === subjectId}
                    assignmentCount={assignmentCountsBySubject[subjectId] || 0}
                    onClick={() => handleSubjectSelect(subjectId)}
                  />
                );
              })}
            </div>
          )}
        </section>
      ) : null}

      {activeSubjectId ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-bold text-gray-900">Assignments</h2>
              <p className="mt-1 text-sm text-gray-500">
                {selectedSubject ? `${selectedSubject.code || selectedSubject.name} assignments for the selected section.` : 'Assignments for the selected subject.'}
              </p>
            </div>
            {canManageAssignments ? (
              <button onClick={() => navigate('/assignments/new')} className="btn-primary">
                <FiPlus size={15} /> Create Assignment
              </button>
            ) : null}
          </div>

          {loading ? (
            <FullPageSpinner />
          ) : visibleAssignments.length === 0 ? (
            <EmptyState
              icon="📝"
              title="No assignments in this subject"
              description="Create the first assignment for this section and subject combination."
              action={canManageAssignments ? <button onClick={() => navigate('/assignments/new')} className="btn-primary"><FiPlus size={15} /> Create Assignment</button> : null}
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {visibleAssignments.map((assignment) => (
                <AssignmentCard
                  key={assignment._id}
                  assignment={assignment}
                  canManageAssignments={canManageAssignments}
                  canSubmitAssignments={canSubmitAssignments}
                />
              ))}
            </div>
          )}
        </section>
      ) : null}

    </div>
  );
}
