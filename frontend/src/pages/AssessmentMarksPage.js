import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiCheckCircle, FiPlus } from 'react-icons/fi';
import API from '../utils/api';
import { Alert, ConfirmDialog, EmptyState, FullPageSpinner, PageHeader } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { isStudentUser } from '../utils/access';
import AcademicScopeFilters from '../components/academics/AcademicScopeFilters';
import { buildDepartmentCollegeMap, emptyAcademicScopeFilters, filterSectionsByScope } from '../utils/academicScope';

const assessmentTypeLabels = {
  mse: 'MSE',
  ese: 'ESE',
  assignment: 'Assignment',
  ca: 'CA',
  practical: 'Practical',
  quiz: 'Quiz',
  viva: 'Viva',
  internal: 'Internal',
  project: 'Project',
  other: 'Other',
};

const assessmentTypeOptions = Object.entries(assessmentTypeLabels).map(([value, label]) => ({ value, label }));

const getAssessmentStudentRecord = (assessment, studentId) => (assessment?.records || []).find((record) => String(record.student?._id || record.student) === String(studentId)) || null;

const getAssessmentTypeLabel = (type) => assessmentTypeLabels[type] || type || 'Other';

const getMarkBand = (record, assessment) => {
  if (!assessment) return { label: 'No sheet', tone: 'muted', cell: 'bg-[var(--surface-card)]', text: 'text-[var(--text-muted)]' };
  if (!record || record.status === 'pending' || record.marks === '' || record.marks === null || record.marks === undefined) {
    return { label: 'Pending', tone: 'pending', cell: 'bg-slate-50', text: 'text-slate-500' };
  }
  if (record.status === 'absent') {
    return { label: 'Absent', tone: 'absent', cell: 'bg-rose-50/70', text: 'text-rose-700' };
  }
  const maxMarks = Number(assessment.maxMarks || 0) || 0;
  const marks = Number(record.marks || 0);
  const percent = maxMarks ? (marks / maxMarks) * 100 : 0;
  if (percent >= 75) return { label: 'Excellent', tone: 'excellent', cell: 'bg-emerald-50/70', text: 'text-emerald-700' };
  if (percent >= 60) return { label: 'Good', tone: 'good', cell: 'bg-blue-50/70', text: 'text-blue-700' };
  if (percent >= 40) return { label: 'Need focus', tone: 'focus', cell: 'bg-amber-50/70', text: 'text-amber-700' };
  return { label: 'Low', tone: 'low', cell: 'bg-rose-50/70', text: 'text-rose-700' };
};

const MetricCard = ({ label, value, hint, accent = 'default' }) => {
  const accentClass = accent === 'primary'
    ? 'border-[var(--accent-primary)]/25 bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]'
    : accent === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : accent === 'danger'
        ? 'border-rose-200 bg-rose-50 text-rose-700'
        : 'border-[var(--border-strong)] bg-[var(--surface-card)] text-[var(--text-strong)]';

  return (
    <div className={`rounded-3xl border px-4 py-4 ${accentClass}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-70">{label}</p>
      <p className="mt-3 break-words text-2xl font-black">{value}</p>
      {hint ? <p className="mt-2 text-xs leading-5 opacity-80">{hint}</p> : null}
    </div>
  );
};

const ProgressBar = ({ value = 0, tone = 'primary' }) => {
  const safeValue = Math.max(0, Math.min(100, Math.round(value)));
  const toneClass = tone === 'success'
    ? 'bg-emerald-500'
    : tone === 'danger'
      ? 'bg-rose-500'
      : 'bg-[var(--accent-primary)]';

  return (
    <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-soft)]">
      <div className={`h-full rounded-full ${toneClass}`} style={{ width: `${safeValue}%` }} />
    </div>
  );
};

const SectionCard = ({ section, active, onClick, subjectCount, assessmentCount }) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full overflow-hidden rounded-[28px] border p-5 text-left transition duration-200 ${active ? 'border-[var(--accent-primary)] bg-[var(--page-accent-panel)] text-[var(--page-accent-panel-text)] shadow-lg' : 'border-[var(--border-strong)] bg-[var(--surface-card)] text-[var(--text-strong)] hover:-translate-y-0.5 hover:shadow-md'}`}
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
    <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
      <div className={`rounded-2xl px-3 py-3 ${active ? 'bg-white/10 text-white' : 'bg-[var(--surface-soft)] text-[var(--text-main)]'}`}>
        <p className="text-xs uppercase tracking-wide opacity-70">Subjects</p>
        <p className="mt-2 text-lg font-bold">{subjectCount}</p>
      </div>
      <div className={`rounded-2xl px-3 py-3 ${active ? 'bg-white/10 text-white' : 'bg-[var(--surface-soft)] text-[var(--text-main)]'}`}>
        <p className="text-xs uppercase tracking-wide opacity-70">Sheets</p>
        <p className="mt-2 text-lg font-bold">{assessmentCount}</p>
      </div>
    </div>
  </button>
);

const SubjectCard = ({ item, active, onClick }) => {
  const percentage = item.subjectAnalytics?.percentage || 0;
  const alerts = item.subjectAnalytics?.riskLevel || 'normal';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-[24px] border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${active ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-soft)]' : 'border-[var(--border-strong)] bg-[var(--surface-card)]'}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">{item.subject?.code || 'SUBJ'}</p>
          <h4 className="mt-2 break-words text-base font-bold leading-6 text-[var(--text-strong)]">{item.subject?.name || 'Subject'}</h4>
          <p className="mt-2 break-words text-sm text-[var(--text-muted)]">
            {item.faculty?.name || 'Faculty not assigned'}
          </p>
        </div>
        <span className={`badge ${alerts === 'high' ? 'bg-rose-50 text-rose-700' : alerts === 'moderate' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
          {Math.round(percentage)}%
        </span>
      </div>
      <div className="mt-4">
        <ProgressBar value={percentage} tone={alerts === 'high' ? 'danger' : alerts === 'moderate' ? 'primary' : 'success'} />
      </div>
    </button>
  );
};

const MarkRow = ({ student, value, onChange, maxMarks }) => (
  <div className="grid grid-cols-[minmax(0,1fr),120px,110px] gap-3 rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-card)] px-4 py-3 sm:grid-cols-[minmax(0,1fr),140px,120px]">
    <div className="min-w-0">
      <p className="font-semibold text-[var(--text-strong)]">{student.name}</p>
      <p className="mt-1 text-xs text-[var(--text-muted)]">{student.systemId || student.email || 'Enrolled student'}</p>
    </div>
    <input
      type="number"
      min="0"
      max={maxMarks}
      value={value.marks ?? ''}
      onChange={(event) => onChange(student._id, 'marks', event.target.value)}
      className="input h-11 min-h-11 rounded-2xl px-3 py-2 text-sm"
      placeholder="Marks"
    />
    <select
      className="input h-11 min-h-11 rounded-2xl px-3 py-2 text-sm"
      value={value.status || 'pending'}
      onChange={(event) => onChange(student._id, 'status', event.target.value)}
    >
      <option value="pending">Pending</option>
      <option value="graded">Graded</option>
      <option value="absent">Absent</option>
      <option value="exempt">Exempt</option>
    </select>
  </div>
);

export default function AssessmentMarksPage() {
  const { user } = useAuth();
  const { id: assessmentId } = useParams();
  const studentView = isStudentUser(user);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState({});
  const [overview, setOverview] = useState(null);
  const [assessments, setAssessments] = useState([]);
  const [assessmentToDelete, setAssessmentToDelete] = useState({ open: false, id: '', loading: false });
  const [students, setStudents] = useState([]);
  const [sections, setSections] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [courses, setCourses] = useState([]);
  const [filters, setFilters] = useState(emptyAcademicScopeFilters);
  const [activeSectionId, setActiveSectionId] = useState('');
  const [activeSubjectsBySection, setActiveSubjectsBySection] = useState({});
  const [activeSubjectId, setActiveSubjectId] = useState('');
  const [selectedAssessmentId, setSelectedAssessmentId] = useState(assessmentId || '');
  const [marksFlowStep, setMarksFlowStep] = useState('sections');
  const [sheetMode, setSheetMode] = useState('view');
  const [form, setForm] = useState({
    title: '',
    assessmentType: 'mse',
    subjectId: '',
    sectionId: '',
    teachingAssignmentId: '',
    date: new Date().toISOString().slice(0, 10),
    maxMarks: 100,
    passingMarks: 40,
    weightage: '',
    topic: '',
    status: 'published',
    records: [],
  });

  const departmentCollegeMap = useMemo(() => buildDepartmentCollegeMap(departments), [departments]);
  const scopedSections = useMemo(() => filterSectionsByScope(sections, filters, departmentCollegeMap), [sections, filters, departmentCollegeMap]);
  const activeSubjectOptions = useMemo(() => activeSubjectsBySection[String(activeSectionId)] || [], [activeSubjectsBySection, activeSectionId]);

  const activeSubjectRows = useMemo(() => activeSubjectOptions.flatMap((entry) => {
    const subject = entry?.subject;
    const assignments = Array.isArray(entry?.teachingAssignments) ? entry.teachingAssignments : [];
    if (!subject?._id) return [];
    if (!assignments.length) {
      return [{ subject, teacher: null, teachingAssignmentId: '', isUnassigned: true }];
    }
    return assignments.map((assignment) => ({
      subject,
      teacher: assignment.teacher || null,
      teachingAssignmentId: assignment._id,
      isUnassigned: false,
    }));
  }), [activeSubjectOptions]);
  const selectedSection = useMemo(() => scopedSections.find((section) => String(section._id) === String(activeSectionId)) || null, [scopedSections, activeSectionId]);
  const selectedSubject = useMemo(() => activeSubjectRows.find((item) => String(item.subject._id) === String(activeSubjectId)) || null, [activeSubjectRows, activeSubjectId]);
  const activeSubjectAssessments = useMemo(() => assessments
    .filter((assessment) => {
      if (!activeSectionId || !activeSubjectId) return false;
      return String(assessment.sectionId?._id || assessment.sectionId) === String(activeSectionId)
        && String(assessment.subjectId?._id || assessment.subjectId) === String(activeSubjectId);
    })
    .sort((a, b) => new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0)), [assessments, activeSectionId, activeSubjectId]);
  const sheetAssessmentTypes = useMemo(() => [...new Set(activeSubjectAssessments.map((item) => item.assessmentType || 'other'))], [activeSubjectAssessments]);
  const sheetRows = useMemo(() => {
    if (!students.length || !sheetAssessmentTypes.length) return [];
    const assessmentsByType = sheetAssessmentTypes.reduce((acc, type) => {
      acc[type] = activeSubjectAssessments.filter((assessment) => (assessment.assessmentType || 'other') === type);
      return acc;
    }, {});

    return students.map((student) => {
      const studentId = String(student._id);
      const cells = sheetAssessmentTypes.map((type) => {
        const assessmentList = assessmentsByType[type] || [];
        const assessment = assessmentList[0] || null;
        const record = assessment ? getAssessmentStudentRecord(assessment, studentId) : null;
        return { type, assessment, record };
      });
      return { student, cells };
    });
  }, [students, sheetAssessmentTypes, activeSubjectAssessments]);

  const loadInitialData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (studentView) {
        const [overviewRes, summaryRes] = await Promise.all([
          API.get('/academics/assessments/overview'),
          API.get('/academics/assessments/summary').catch(() => ({ data: { data: {} } })),
        ]);
        setOverview(overviewRes.data?.data || null);
        setSummary(summaryRes.data?.data || {});
      } else {
        const [summaryRes, assessmentsRes, sectionsRes, collegesRes, departmentsRes, programsRes, coursesRes] = await Promise.all([
          API.get('/academics/assessments/summary'),
          API.get('/academics/assessments'),
          API.get('/academics/sections?paginate=false'),
          API.get('/academics/colleges?paginate=false'),
          API.get('/academics/departments?paginate=false'),
          API.get('/academics/programs?paginate=false'),
          API.get('/academics/courses?paginate=false'),
        ]);
        setSummary(summaryRes.data?.data || {});
        setAssessments(Array.isArray(assessmentsRes.data?.data) ? assessmentsRes.data.data : []);
        setSections(Array.isArray(sectionsRes.data?.data) ? sectionsRes.data.data : []);
        setColleges(Array.isArray(collegesRes.data?.data) ? collegesRes.data.data : []);
        setDepartments(Array.isArray(departmentsRes.data?.data) ? departmentsRes.data.data : []);
        setPrograms(Array.isArray(programsRes.data?.data) ? programsRes.data.data : []);
        setCourses(Array.isArray(coursesRes.data?.data) ? coursesRes.data.data : []);
      }
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to load assessment marks.');
    } finally {
      setLoading(false);
    }
  }, [studentView]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    if (studentView || !scopedSections.length) return;
    if (!activeSectionId) {
      setActiveSectionId(String(scopedSections[0]._id));
      return;
    }
    if (!scopedSections.some((section) => String(section._id) === String(activeSectionId))) {
      setActiveSectionId(String(scopedSections[0]._id));
      setActiveSubjectId('');
    }
  }, [activeSectionId, scopedSections, studentView]);

  useEffect(() => {
    if (!activeSectionId || studentView) return;
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
        setActiveSubjectsBySection((current) => ({ ...current, [String(activeSectionId)]: [] }));
      });

    return () => {
      active = false;
    };
  }, [activeSectionId, studentView]);

  useEffect(() => {
    if (!studentView) {
      setForm((current) => ({
        ...current,
        sectionId: activeSectionId || current.sectionId,
      }));
    }
  }, [activeSectionId, studentView]);

  useEffect(() => {
    if (studentView || !activeSectionId) return;
    if (!activeSubjectId) return;

    const selectedSubject = activeSubjectRows.find((row) => String(row.subject._id) === String(activeSubjectId));
    if (!selectedSubject) return;

    setForm((current) => ({
      ...current,
      sectionId: activeSectionId,
      subjectId: String(selectedSubject.subject._id),
      teachingAssignmentId: selectedSubject.teachingAssignmentId || '',
    }));
  }, [activeSectionId, activeSubjectId, activeSubjectRows, studentView]);

  useEffect(() => {
    if (studentView || !form.sectionId) return;
    setLoading(true);
    API.get(`/academics/enrollments?section=${form.sectionId}&status=active`)
      .then((response) => {
        const roster = (response.data?.data || []).map((entry) => entry.student).filter(Boolean);
        setStudents(roster);
        setForm((current) => ({
          ...current,
          records: roster.map((student) => {
            const existing = current.records.find((record) => String(record.student) === String(student._id));
            return existing || { student: student._id, status: 'pending', marks: '' };
          }),
        }));
      })
      .catch((requestError) => {
        setError(requestError.response?.data?.message || 'Failed to load student roster.');
        setStudents([]);
      })
      .finally(() => setLoading(false));
  }, [form.sectionId, studentView]);

  const studentAssessmentCards = useMemo(() => {
    if (!overview?.assessments?.breakdown) return [];
    return overview.assessments.breakdown;
  }, [overview]);

  const changeFormValue = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const changeRecordValue = (studentId, key, value) => {
    setForm((current) => ({
      ...current,
      records: current.records.map((record) => (
        String(record.student) === String(studentId) ? { ...record, [key]: value } : record
      )),
    }));
  };

  const selectSection = (sectionId) => {
    setActiveSectionId(String(sectionId));
    setActiveSubjectId('');
    setSelectedAssessmentId('');
    setMarksFlowStep('subjects');
    setSheetMode('view');
    setForm((current) => ({
      ...current,
      sectionId: String(sectionId),
      subjectId: '',
      teachingAssignmentId: '',
      records: [],
    }));
  };

  const selectSubject = (subjectId) => {
    setActiveSubjectId(String(subjectId));
    setSelectedAssessmentId('');
    setMarksFlowStep('sheet');
    setSheetMode('view');
    setForm((current) => ({
      ...current,
      subjectId: String(subjectId),
    }));
  };

  const openAssessment = useCallback((assessment) => {
    setSelectedAssessmentId(String(assessment._id));
    setActiveSectionId(String(assessment.sectionId?._id || assessment.sectionId || ''));
    setActiveSubjectId(String(assessment.subjectId?._id || assessment.subjectId || ''));
    setMarksFlowStep('sheet');
    setSheetMode('view');
    setForm({
      title: assessment.title || '',
      assessmentType: assessment.assessmentType || 'mse',
      subjectId: assessment.subjectId?._id || assessment.subjectId || '',
      sectionId: assessment.sectionId?._id || assessment.sectionId || '',
      teachingAssignmentId: assessment.teachingAssignmentId?._id || assessment.teachingAssignmentId || '',
      date: assessment.date ? new Date(assessment.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      maxMarks: assessment.maxMarks || 100,
      passingMarks: assessment.passingMarks || 40,
      weightage: assessment.weightage ?? '',
      topic: assessment.topic || '',
      status: assessment.status || 'published',
      records: (assessment.records || []).map((record) => ({
        student: record.student?._id || record.student,
        marks: record.marks ?? '',
        status: record.status || 'pending',
        remarks: record.remarks || '',
      })),
    });
  }, []);

  useEffect(() => {
    if (!assessmentId || !assessments.length || studentView) return;
    const match = assessments.find((item) => String(item._id) === String(assessmentId));
    if (match) openAssessment(match);
  }, [assessmentId, assessments, openAssessment, studentView]);

  const saveAssessment = async () => {
    if (!form.sectionId || !form.subjectId || !form.title.trim()) {
      toast.error('Choose a section, subject, and title first.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        title: form.title.trim(),
        topic: form.topic.trim(),
        weightage: form.weightage === '' ? null : form.weightage,
        records: form.records.map((record) => ({
          student: record.student,
          marks: record.marks,
          status: record.status,
          remarks: record.remarks || '',
        })),
      };
      if (selectedAssessmentId) {
        await API.put(`/academics/assessments/${selectedAssessmentId}`, payload);
        toast.success('Assessment updated');
      } else {
        await API.post('/academics/assessments', payload);
        toast.success('Assessment created');
      }
      const res = await API.get('/academics/assessments');
      setAssessments(Array.isArray(res.data?.data) ? res.data.data : []);
      setSelectedAssessmentId('');
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || 'Failed to save assessment.');
    } finally {
      setSaving(false);
    }
  };

  const deleteAssessment = async (idToDelete) => {
    try {
      await API.delete(`/academics/assessments/${idToDelete}`);
      toast.success('Assessment removed');
      setAssessments((current) => current.filter((item) => String(item._id) !== String(idToDelete)));
      if (String(selectedAssessmentId) === String(idToDelete)) {
        setSelectedAssessmentId('');
      }
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || 'Failed to delete assessment.');
    }
  };

  if (loading) return <FullPageSpinner />;

  const assessmentMetrics = studentView
    ? [
        { label: 'Attendance', value: `${overview?.attendance?.attendanceRate || 0}%`, hint: 'Your current attendance rate', accent: 'primary' },
        { label: 'Performance', value: `${overview?.assessments?.overall?.percentage || 0}%`, hint: 'Overall marks across assessments', accent: 'success' },
        { label: 'Eligible', value: overview?.assessments?.eligibility?.isEligible ? 'Yes' : 'No', hint: 'Based on attendance and marks', accent: overview?.assessments?.eligibility?.isEligible ? 'success' : 'danger' },
        { label: 'Weak Subjects', value: overview?.assessments?.weakSubjects?.length || 0, hint: 'Needs focused attention', accent: 'danger' },
      ]
    : [
        { label: 'Assessments', value: summary.totalAssessments || 0, hint: 'All visible mark sheets', accent: 'primary' },
        { label: 'Pending Grading', value: summary.pendingGrading || 0, hint: 'Records waiting for marks', accent: 'danger' },
        { label: 'Low Alerts', value: summary.lowPerformanceAlerts || 0, hint: 'Subjects below target', accent: 'success' },
        { label: 'Performance', value: `${summary.percentage || 0}%`, hint: 'Across visible assessment data', accent: 'primary' },
      ];

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Assessments & Marks"
        subtitle={studentView ? 'Your marks sheet, attendance signals, eligibility, and recommendations.' : 'Build, edit, and review subject-wise marks sheets for each section.'}
        actions={(
          !studentView ? (
            <button type="button" onClick={() => {
              setSelectedAssessmentId('');
              setActiveSectionId('');
              setActiveSubjectId('');
              setMarksFlowStep('sections');
              setSheetMode('view');
              setForm((current) => ({ ...current, title: '', topic: '', records: [], weightage: '' }));
            }} className="btn-primary">
              <FiPlus size={15} /> New Mark Sheet
            </button>
          ) : null
        )}
      />

      {error ? <Alert type="warning" message={error} /> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {assessmentMetrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </div>

      {studentView ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr),minmax(320px,0.9fr)]">
          <section className="rounded-3xl border border-[var(--border-strong)] bg-[var(--surface-card)] p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border-strong)] pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Performance</p>
                <h2 className="mt-2 font-display text-xl font-bold text-[var(--text-strong)]">Subject-wise insights</h2>
              </div>
              <span className={`badge ${overview?.assessments?.eligibility?.isEligible ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                {overview?.assessments?.eligibility?.isEligible ? 'Eligible' : 'Review needed'}
              </span>
            </div>
            <div className="mt-5 space-y-3">
              {(studentAssessmentCards || []).map((subject) => (
                <div key={String(subject.subjectId || subject.code)} className="rounded-[24px] border border-[var(--border-strong)] bg-[var(--surface-soft)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">{subject.code}</p>
                      <h3 className="mt-2 text-base font-bold text-[var(--text-strong)]">{subject.name}</h3>
                    </div>
                    <span className={`badge ${subject.riskLevel === 'high' ? 'bg-rose-50 text-rose-700' : subject.riskLevel === 'moderate' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                      {Math.round(subject.percentage || 0)}%
                    </span>
                  </div>
                  <div className="mt-4">
                    <ProgressBar value={subject.percentage || 0} tone={subject.riskLevel === 'high' ? 'danger' : subject.riskLevel === 'moderate' ? 'primary' : 'success'} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--text-muted)]">
                    <span>{subject.completedAssessments || 0} completed</span>
                    <span>·</span>
                    <span>{subject.pendingAssessments || 0} pending</span>
                    <span>·</span>
                    <span>{subject.faculty?.name || 'Faculty not assigned'}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-[var(--border-strong)] bg-[var(--surface-card)] p-5 shadow-sm">
            <div className="border-b border-[var(--border-strong)] pb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Recommendations</p>
              <h2 className="mt-2 font-display text-xl font-bold text-[var(--text-strong)]">Improve your next step</h2>
            </div>
            <div className="mt-4 space-y-3">
              {(overview?.assessments?.recommendations || []).map((item) => (
                <div key={item} className="rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-soft)] px-4 py-3 text-sm text-[var(--text-main)]">
                  {item}
                </div>
              ))}
              {!overview?.assessments?.recommendations?.length ? (
                <EmptyState icon="📘" title="No recommendations yet" description="Assessment insights will appear here once marks are available." />
              ) : null}
            </div>
            <div className="mt-5 rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-soft)] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Eligibility rule</p>
              <p className="mt-2 text-sm text-[var(--text-main)]">
                Attendance threshold: {overview?.assessments?.eligibility?.attendanceThreshold || 75}% · Marks threshold: {overview?.assessments?.eligibility?.marksThreshold || 40}%
              </p>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                {(overview?.assessments?.eligibility?.reasons || []).join(' ')}
              </p>
            </div>
          </section>
        </div>

      ) : (
        <div className="space-y-6">
          <section className="rounded-3xl border border-[var(--border-strong)] bg-[var(--surface-card)] p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-strong)] pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Workflow</p>
                <h2 className="mt-2 font-display text-xl font-bold text-[var(--text-strong)]">
                  {marksFlowStep === 'sections' ? '1. Choose a section' : marksFlowStep === 'subjects' ? '2. Choose a subject' : '3. View or edit the sheet'}
                </h2>
                <p className="mt-2 text-sm text-[var(--text-muted)]">The marks tab now works like a nested flow: section first, then subject, then the student sheet.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="badge bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]">{scopedSections.length} sections</span>
                {marksFlowStep !== 'sections' ? (
                  <button type="button" className="btn-secondary" onClick={() => {
                    if (marksFlowStep === 'sheet') {
                      setMarksFlowStep('subjects');
                      setSheetMode('view');
                      return;
                    }
                    setMarksFlowStep('sections');
                    setActiveSubjectId('');
                    setSelectedAssessmentId('');
                    setSheetMode('view');
                  }}>
                    Back
                  </button>
                ) : null}
              </div>
            </div>
          </section>

          {marksFlowStep === 'sections' ? (
            <section className="space-y-5">
              <div className="rounded-3xl border border-[var(--border-strong)] bg-[var(--surface-card)] p-5 shadow-sm">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Scope</p>
                    <h2 className="mt-2 font-display text-xl font-bold text-[var(--text-strong)]">Choose a section</h2>
                  </div>
                  <span className="rounded-full bg-[var(--surface-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--text-main)]">Tap a card to drill down</span>
                </div>
                <AcademicScopeFilters
                  filters={filters}
                  onChange={(key, value) => {
                    setFilters((current) => ({ ...current, [key]: value }));
                    if (key === 'sectionId') selectSection(value);
                  }}
                  options={{ colleges, departments, programs, courses, sections: scopedSections }}
                  departmentCollegeMap={departmentCollegeMap}
                  showSection={false}
                  showLevel={false}
                  showBatch={true}
                  showSemester={true}
                  showRoleFilter={false}
                  showTierFilter={false}
                  compact
                  singleLine
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {scopedSections.map((section) => (
                  <SectionCard
                    key={section._id}
                    section={section}
                    active={String(section._id) === String(activeSectionId)}
                    subjectCount={activeSubjectRows.filter((row) => String(row.subject?.sectionId || '') === String(section._id)).length || activeSubjectRows.length}
                    assessmentCount={assessments.filter((item) => String(item.sectionId?._id || item.sectionId) === String(section._id)).length}
                    onClick={() => selectSection(section._id)}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {marksFlowStep === 'subjects' ? (
            <section className="rounded-3xl border border-[var(--border-strong)] bg-[var(--surface-card)] p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border-strong)] pb-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Section</p>
                  <h2 className="mt-2 font-display text-xl font-bold text-[var(--text-strong)]">{selectedSection?.name || 'Selected section'}</h2>
                  <p className="mt-2 text-sm text-[var(--text-muted)]">Now choose the subject to open its student marks sheet.</p>
                </div>
                <span className="badge bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]">{activeSubjectRows.length} subjects</span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {activeSubjectRows.length ? activeSubjectRows.map((item) => (
                  <SubjectCard
                    key={`${item.subject._id}-${item.teachingAssignmentId || 'unassigned'}`}
                    item={item}
                    active={String(item.subject._id) === String(activeSubjectId)}
                    onClick={() => selectSubject(item.subject._id)}
                  />
                )) : <EmptyState icon="📚" title="No subjects linked" description="Select a section with linked subjects in Academic Planning." />}
              </div>
            </section>
          ) : null}

          {marksFlowStep === 'sheet' ? (
            <section className="space-y-5">
              <div className="rounded-3xl border border-[var(--border-strong)] bg-[var(--surface-card)] p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border-strong)] pb-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Subject sheet</p>
                    <h2 className="mt-2 font-display text-xl font-bold text-[var(--text-strong)]">{selectedSubject?.subject?.name || 'Subject'} • {selectedSection?.name || 'Section'}</h2>
                    <p className="mt-2 text-sm text-[var(--text-muted)]">Open the sheet in view mode to scan marks, or switch to edit mode to update them.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex rounded-full border border-[var(--border-strong)] bg-[var(--surface-soft)] p-1">
                      <button type="button" onClick={() => setSheetMode('view')} className={`rounded-full px-3 py-2 text-xs font-semibold transition ${sheetMode === 'view' ? 'bg-white text-blue-700 shadow-sm' : 'text-[var(--text-muted)]'}`}>
                        View
                      </button>
                      <button type="button" onClick={() => setSheetMode('edit')} className={`rounded-full px-3 py-2 text-xs font-semibold transition ${sheetMode === 'edit' ? 'bg-white text-blue-700 shadow-sm' : 'text-[var(--text-muted)]'}`}>
                        Edit
                      </button>
                    </div>
                    <span className="badge bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]">{sheetAssessmentTypes.length} categories</span>
                  </div>
                </div>

                <div className="mt-4 overflow-auto rounded-[24px] border border-[var(--border-strong)] bg-[var(--surface-soft)]">
                  <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border-strong)] bg-[var(--surface-card)] px-4 py-3 text-xs font-semibold text-[var(--text-muted)]">
                    <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700">75%+ Excellent</span>
                    <span className="rounded-full bg-blue-50 px-3 py-1.5 text-blue-700">60-74% Good</span>
                    <span className="rounded-full bg-amber-50 px-3 py-1.5 text-amber-700">40-59% Need focus</span>
                    <span className="rounded-full bg-rose-50 px-3 py-1.5 text-rose-700">Below 40% Low</span>
                    <span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-600">Pending / no mark</span>
                  </div>
                  <table className="min-w-[960px] w-full border-collapse text-left">
                    <thead className="sticky top-0 z-20 bg-[var(--surface-card)] shadow-[0_1px_0_var(--border-strong)]">
                      <tr className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                        <th className="sticky left-0 z-30 bg-[var(--surface-card)] px-4 py-3 text-left">Student</th>
                        {sheetAssessmentTypes.map((type) => (
                          <th key={type} className="px-4 py-3 text-center">{getAssessmentTypeLabel(type)}</th>
                        ))}
                        <th className="px-4 py-3 text-center">Total</th>
                        <th className="px-4 py-3 text-center">Average</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sheetRows.length ? sheetRows.map(({ student, cells }) => {
                        const totals = cells.reduce((acc, cell) => {
                          const marks = Number(cell.record?.marks);
                          if (Number.isFinite(marks)) {
                            acc.marks += marks;
                            acc.count += 1;
                          }
                          return acc;
                        }, { marks: 0, count: 0 });
                        const avg = totals.count ? Math.round((totals.marks / totals.count) * 10) / 10 : 0;

                        return (
                          <tr key={student._id} className="border-b border-[var(--border-strong)] last:border-b-0 even:bg-white/40 hover:bg-white/60">
                            <td className="sticky left-0 z-10 border-r border-[var(--border-strong)] bg-[var(--surface-card)] px-4 py-4 align-top">
                              <div className="min-w-[180px]">
                                <p className="font-semibold text-[var(--text-strong)]">{student.name}</p>
                                <p className="mt-1 text-xs text-[var(--text-muted)]">{student.systemId || student.email || 'Enrolled student'}</p>
                              </div>
                            </td>
                            {cells.map((cell) => {
                              const record = cell.record;
                              const assessment = cell.assessment;
                              const mark = record?.marks;
                              const band = getMarkBand(record, assessment);
                              const maxMarks = Number(assessment?.maxMarks || 100);
                              const marks = Number(mark);
                              const percent = Number.isFinite(marks) && maxMarks ? Math.max(0, Math.min(100, (marks / maxMarks) * 100)) : 0;
                              const barTone = band.tone === 'excellent' ? 'bg-emerald-500' : band.tone === 'good' ? 'bg-blue-500' : band.tone === 'focus' ? 'bg-amber-500' : band.tone === 'low' || band.tone === 'absent' ? 'bg-rose-500' : 'bg-slate-300';
                              return (
                                <td key={cell.type} className="px-3 py-3 align-top">
                                  {assessment ? (
                                    <div className={`min-w-[130px] rounded-2xl border border-white/80 px-3 py-3 shadow-sm ${band.cell}`}>
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                          <p className={`text-sm font-black ${band.text}`}>{mark ?? '—'} / {assessment.maxMarks || 100}</p>
                                          <p className="mt-1 truncate text-[11px] font-medium text-[var(--text-muted)]" title={assessment.title}>{assessment.title}</p>
                                        </div>
                                        <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${band.tone === 'excellent' ? 'bg-emerald-100 text-emerald-700' : band.tone === 'good' ? 'bg-blue-100 text-blue-700' : band.tone === 'focus' ? 'bg-amber-100 text-amber-700' : band.tone === 'low' || band.tone === 'absent' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>
                                          {record?.status || 'pending'}
                                        </span>
                                      </div>
                                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/70">
                                        <div className={`h-full rounded-full ${barTone}`} style={{ width: `${percent}%` }} />
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="min-w-[130px] rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-card)] px-3 py-3 text-sm text-[var(--text-muted)]">
                                      No sheet
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                            <td className="px-3 py-3 align-top">
                              <span className="inline-flex min-w-[84px] justify-center rounded-2xl bg-[var(--accent-primary-soft)] px-3 py-2 text-sm font-semibold text-[var(--accent-primary)]">
                                {totals.marks.toFixed(0)}
                              </span>
                            </td>
                            <td className="px-3 py-3 align-top">
                              <span className="inline-flex min-w-[84px] justify-center rounded-2xl bg-[var(--surface-card)] px-3 py-2 text-sm font-semibold text-[var(--text-strong)]">
                                {avg}
                              </span>
                            </td>
                          </tr>
                        );
                      }) : (
                        <tr>
                          <td colSpan={Math.max(4, sheetAssessmentTypes.length + 3)} className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">
                            No student records found for this subject yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {sheetMode === 'edit' ? (
                <div className="rounded-3xl border border-[var(--border-strong)] bg-[var(--surface-card)] p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border-strong)] pb-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Edit sheet</p>
                      <h3 className="mt-2 font-display text-xl font-bold text-[var(--text-strong)]">Create or update the selected subject sheet</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedAssessmentId ? <button type="button" onClick={() => setSelectedAssessmentId('')} className="btn-secondary">New Sheet</button> : null}
                      <button type="button" onClick={saveAssessment} disabled={saving || !form.sectionId || !form.subjectId} className="btn-primary">
                        <FiCheckCircle size={15} /> {saving ? 'Saving...' : (selectedAssessmentId ? 'Update Sheet' : 'Save Sheet')}
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="label">Title</label>
                      <input className="input" value={form.title} onChange={(event) => changeFormValue('title', event.target.value)} placeholder="MSE 1, Mid Semester, Lab Assessment" />
                    </div>
                    <div>
                      <label className="label">Assessment Type</label>
                      <select className="input" value={form.assessmentType} onChange={(event) => changeFormValue('assessmentType', event.target.value)}>
                        {assessmentTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">Date</label>
                      <input type="date" className="input" value={form.date} onChange={(event) => changeFormValue('date', event.target.value)} />
                    </div>
                    <div>
                      <label className="label">Max Marks</label>
                      <input type="number" min="1" className="input" value={form.maxMarks} onChange={(event) => changeFormValue('maxMarks', event.target.value)} />
                    </div>
                    <div>
                      <label className="label">Passing Marks</label>
                      <input type="number" min="0" className="input" value={form.passingMarks} onChange={(event) => changeFormValue('passingMarks', event.target.value)} />
                    </div>
                    <div>
                      <label className="label">Weightage %</label>
                      <input type="number" min="0" className="input" value={form.weightage} onChange={(event) => changeFormValue('weightage', event.target.value)} placeholder="Optional" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="label">Topic / Unit</label>
                      <input className="input" value={form.topic} onChange={(event) => changeFormValue('topic', event.target.value)} placeholder="Chapter, unit, lab module, or exam topic" />
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-soft)] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[var(--text-strong)]">Student mark sheet</p>
                        <p className="mt-1 text-xs text-[var(--text-muted)]">Enter marks and status for each enrolled student in the selected subject.</p>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[var(--text-main)]">{students.length} students</span>
                    </div>
                    <div className="mt-4 space-y-3">
                      {students.length ? students.map((student) => {
                        const value = form.records.find((record) => String(record.student) === String(student._id)) || { marks: '', status: 'pending' };
                        return (
                          <MarkRow
                            key={student._id}
                            student={student}
                            value={value}
                            maxMarks={Number(form.maxMarks) || 100}
                            onChange={changeRecordValue}
                          />
                        );
                      }) : <EmptyState icon="🧑‍🎓" title="No roster loaded" description="Pick a section to load enrolled students and start the mark sheet." />}
                    </div>
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}
        </div>
      )}

      <ConfirmDialog
        open={assessmentToDelete.open}
        title="Delete assessment sheet"
        description="This removes the selected mark sheet and its graded records."
        confirmText={assessmentToDelete.loading ? 'Deleting...' : 'Delete'}
        tone="danger"
        onConfirm={async () => {
          setAssessmentToDelete((current) => ({ ...current, loading: true }));
          await deleteAssessment(assessmentToDelete.id);
          setAssessmentToDelete({ open: false, id: '', loading: false });
        }}
        onCancel={() => setAssessmentToDelete({ open: false, id: '', loading: false })}
      />
    </div>
  );
}
