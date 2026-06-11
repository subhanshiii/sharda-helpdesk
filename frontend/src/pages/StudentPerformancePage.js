import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiArrowRight, FiBookOpen, FiCalendar, FiCheckCircle, FiTrendingUp, FiZap } from 'react-icons/fi';
import API from '../utils/api';
import { Alert, EmptyState, FullPageSpinner, PageHeader } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../utils/helpers';

const clampPercent = (value) => Math.max(0, Math.min(100, Number(value) || 0));

const ProgressBar = ({ value = 0, tone = 'blue' }) => {
  const tones = {
    blue: 'bg-blue-600',
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
    violet: 'bg-violet-500',
  };

  return (
    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full ${tones[tone] || tones.blue}`} style={{ width: `${clampPercent(value)}%` }} />
    </div>
  );
};

const StatCard = ({ label, value, hint, tone = 'blue' }) => {
  const tones = {
    blue: 'border-blue-100 bg-blue-50 text-blue-700',
    emerald: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-100 bg-amber-50 text-amber-700',
    red: 'border-red-100 bg-red-50 text-red-700',
    violet: 'border-violet-100 bg-violet-50 text-violet-700',
  };

  return (
    <div className={`rounded-[24px] border p-4 shadow-sm ${tones[tone] || tones.blue}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-80">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-900">{value}</p>
      {hint ? <p className="mt-2 text-xs leading-5 opacity-80">{hint}</p> : null}
    </div>
  );
};

const InsightCard = ({ title, children, accent = 'blue' }) => {
  const accents = {
    blue: 'border-blue-100 bg-white',
    emerald: 'border-emerald-100 bg-white',
    amber: 'border-amber-100 bg-white',
    red: 'border-red-100 bg-white',
    violet: 'border-violet-100 bg-white',
  };

  return (
    <section className={`rounded-[28px] border p-5 shadow-sm ${accents[accent] || accents.blue}`}>
      <h3 className="font-display text-lg font-bold text-slate-900">{title}</h3>
      <div className="mt-4">{children}</div>
    </section>
  );
};

export default function StudentPerformancePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [overview, setOverview] = useState(null);
  const [degreeProgress, setDegreeProgress] = useState(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [res, progressRes] = await Promise.all([
          API.get('/academics/assessments/overview'),
          API.get(`/academics/student-progress?student=${user?.id || user?._id}`).catch(() => null)
        ]);
        if (!active) return;
        setOverview(res.data?.data || null);
        const progressData = progressRes?.data?.data?.[0];
        if (progressData) {
          setDegreeProgress(progressData);
        }
      } catch (requestError) {
        if (!active) return;
        setError(requestError.response?.data?.message || 'Unable to load your performance overview right now.');
      } finally {
        if (active) setLoading(false);
      }
    };
    if (user?.id || user?._id) load();
    return () => {
      active = false;
    };
  }, [user]);

  const student = overview?.student || user || {};
  const attendance = overview?.attendance || {};
  const assessments = overview?.assessments || {};
  const weakSubjects = assessments.weakSubjects || [];
  const recommendations = assessments.recommendations || [];
  const eligibilityReasons = assessments.eligibility?.reasons || [];
  const subjectPerformance = assessments.breakdown || [];
  const recentAssessments = assessments.breakdown || [];

  if (loading) return <FullPageSpinner />;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
      <PageHeader
        title="Student Performance"
        subtitle="Track attendance, marks, eligibility, weak subjects, and improvement guidance in one place."
        meta={[
          student?.name || 'Student overview',
          overview?.enrollment?.section?.name ? `Section ${overview.enrollment.section.name}` : null,
          overview?.enrollment?.section?.course?.name || null,
        ]}
        action={(
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/assessments" className="btn-secondary text-xs">
              <FiBookOpen size={13} />
              Mark Sheet
            </Link>
            <Link to="/ai-assistant" className="btn-primary text-xs">
              <FiZap size={13} />
              Ask AI Assistant
            </Link>
          </div>
        )}
      />

      {error ? <Alert type="warning" message={error} /> : null}

      {!overview && !error ? (
        <EmptyState
          icon="📊"
          title="No performance data yet"
          description="Once attendance and marks are recorded, your analytics will appear here."
        />
      ) : null}

      {overview ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {degreeProgress ? (
              <StatCard label="Degree Progress" value={`${degreeProgress.completionPercentage || 0}%`} hint={`${degreeProgress.creditsEarned} / ${degreeProgress.totalCreditsRequired} Credits`} tone="violet" />
            ) : null}
            <StatCard label="Attendance" value={`${attendance.attendanceRate || 0}%`} hint="Used in eligibility checks" tone={(attendance.attendanceRate || 0) >= 75 ? 'emerald' : 'amber'} />
            <StatCard label="Marks" value={`${assessments.overall?.percentage || 0}%`} hint="Overall assessment performance" tone={(assessments.overall?.percentage || 0) >= 60 ? 'emerald' : (assessments.overall?.percentage || 0) >= 45 ? 'amber' : 'red'} />
            <StatCard label="Eligibility" value={assessments.eligibility?.isEligible ? 'Eligible' : 'Review'} hint={assessments.eligibility?.isEligible ? 'You are meeting the thresholds' : 'Some criteria need attention'} tone={assessments.eligibility?.isEligible ? 'emerald' : 'amber'} />
            <StatCard label="Weak subjects" value={weakSubjects.length} hint="Focus on these first" tone={weakSubjects.length ? 'red' : 'emerald'} />
          </section>

          <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
            <InsightCard title="Performance Summary" accent="blue">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-[22px] border border-slate-100 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Overall marks</p>
                  <p className="mt-2 text-3xl font-black text-slate-900">{assessments.overall?.percentage || 0}%</p>
                  <ProgressBar value={assessments.overall?.percentage || 0} tone={(assessments.overall?.percentage || 0) >= 60 ? 'emerald' : (assessments.overall?.percentage || 0) >= 45 ? 'amber' : 'red'} />
                </div>
                <div className="rounded-[22px] border border-slate-100 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Attendance rate</p>
                  <p className="mt-2 text-3xl font-black text-slate-900">{attendance.attendanceRate || 0}%</p>
                  <ProgressBar value={attendance.attendanceRate || 0} tone={(attendance.attendanceRate || 0) >= 75 ? 'emerald' : 'amber'} />
                </div>
              </div>

              <div className="mt-5 rounded-[22px] border border-slate-100 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Eligibility status</p>
                    <p className={`mt-2 text-xl font-black ${assessments.eligibility?.isEligible ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {assessments.eligibility?.isEligible ? 'Eligible for evaluation' : 'Review required'}
                    </p>
                  </div>
                  <span className={`badge ${assessments.eligibility?.isEligible ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                    {assessments.eligibility?.attendanceThreshold || 75}% / {assessments.eligibility?.marksThreshold || 40}%
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {eligibilityReasons.length ? eligibilityReasons.map((reason) => (
                    <span key={reason} className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700">{reason}</span>
                  )) : (
                    <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">No eligibility issues detected.</span>
                  )}
                </div>
              </div>
            </InsightCard>

            <InsightCard title="Quick Actions" accent="violet">
              <div className="space-y-3">
                <Link to="/assessments" className="flex items-center justify-between rounded-[22px] border border-slate-100 bg-slate-50 px-4 py-4 transition hover:-translate-y-0.5 hover:shadow-sm">
                  <div>
                    <p className="font-semibold text-slate-900">Open Mark Sheet</p>
                    <p className="mt-1 text-sm text-slate-500">View subject-wise marks and records.</p>
                  </div>
                  <FiArrowRight className="text-slate-400" />
                </Link>
                <Link to="/attendance" className="flex items-center justify-between rounded-[22px] border border-slate-100 bg-slate-50 px-4 py-4 transition hover:-translate-y-0.5 hover:shadow-sm">
                  <div>
                    <p className="font-semibold text-slate-900">Open Attendance</p>
                    <p className="mt-1 text-sm text-slate-500">Review attendance logs and trends.</p>
                  </div>
                  <FiCalendar className="text-slate-400" />
                </Link>
                <Link to="/ai-assistant" className="flex items-center justify-between rounded-[22px] border border-slate-100 bg-slate-50 px-4 py-4 transition hover:-translate-y-0.5 hover:shadow-sm">
                  <div>
                    <p className="font-semibold text-slate-900">Ask AI Assistant</p>
                    <p className="mt-1 text-sm text-slate-500">Get permission-aware help from ERP data.</p>
                  </div>
                  <FiTrendingUp className="text-slate-400" />
                </Link>
              </div>
            </InsightCard>
          </section>

          <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
            <InsightCard title="Subject-wise Performance" accent="emerald">
              {subjectPerformance.length ? (
                <div className="space-y-3">
                  {subjectPerformance.slice(0, 6).map((subject) => {
                    const percent = subject.percentage || 0;
                    const tone = percent >= 60 ? 'emerald' : percent >= 45 ? 'amber' : 'red';
                    return (
                      <div key={String(subject.subjectId || subject.code)} className="rounded-[20px] border border-slate-100 bg-slate-50 px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900">{subject.code || subject.name}</p>
                            <p className="mt-1 text-xs text-slate-500">{subject.obtainedMarks || 0}/{subject.totalMarks || 0} marks · {subject.completedAssessments || 0} completed</p>
                          </div>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone === 'emerald' ? 'bg-emerald-50 text-emerald-700' : tone === 'amber' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
                            {Math.round(percent)}%
                          </span>
                        </div>
                        <ProgressBar value={percent} tone={tone} />
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${subject.riskLevel === 'high' ? 'bg-red-50 text-red-700' : subject.riskLevel === 'moderate' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                            {subject.riskLevel === 'high' ? 'High risk' : subject.riskLevel === 'moderate' ? 'Needs attention' : 'On track'}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                            {subject.totalMarks || 0} total marks
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState icon="📘" title="No subject data yet" description="Subject-wise performance will appear after assessments are recorded." />
              )}
            </InsightCard>

            <InsightCard title="Recommendations" accent="amber">
              <div className="space-y-3">
                {(recommendations.length ? recommendations : ['Keep attending classes regularly and review weak topics every week.']).slice(0, 5).map((item) => (
                  <div key={item} className="flex items-start gap-3 rounded-[20px] border border-amber-100 bg-amber-50/80 px-4 py-3 text-sm text-amber-900">
                    <FiCheckCircle className="mt-0.5 flex-shrink-0" size={15} />
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-[22px] border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Weak subjects</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {weakSubjects.length ? weakSubjects.slice(0, 6).map((subject) => (
                    <span key={String(subject.subjectId || subject.code)} className="badge bg-red-50 text-red-700">
                      {subject.code || subject.name}
                    </span>
                  )) : (
                    <span className="badge bg-emerald-50 text-emerald-700">No weak subjects detected</span>
                  )}
                </div>
              </div>
            </InsightCard>
          </section>

          <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
            <InsightCard title="Recent Assessment Summary" accent="blue">
              <div className="space-y-3">
                {recentAssessments.slice(0, 5).map((item) => (
                  <div key={String(item.subjectId || item.code)} className="rounded-[20px] border border-slate-100 bg-slate-50 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">{item.code || item.name}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.totalAssessments || 0} assessments · {formatDate(item.lastAssessmentDate || item.date || Date.now())}
                        </p>
                      </div>
                      <span className="badge bg-blue-50 text-blue-700">{Math.round(item.percentage || 0)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </InsightCard>

            <InsightCard title="Attendance & Eligibility Notes" accent="violet">
              <div className="space-y-3">
                <div className="rounded-[20px] border border-slate-100 bg-slate-50 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Attendance summary</p>
                  <p className="mt-2 text-3xl font-black text-slate-900">{attendance.attendanceRate || 0}%</p>
                  <p className="mt-2 text-sm text-slate-600">{attendance.attendedSessions || 0} attended out of {attendance.totalSessions || 0} recorded sessions.</p>
                  <ProgressBar value={attendance.attendanceRate || 0} tone={(attendance.attendanceRate || 0) >= 75 ? 'emerald' : 'amber'} />
                </div>

                <div className="rounded-[20px] border border-slate-100 bg-slate-50 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Academic status</p>
                  <p className="mt-2 text-sm font-medium text-slate-700">
                    {assessments.eligibility?.isEligible
                      ? 'You are meeting the main academic thresholds right now.'
                      : 'Your academic profile needs attention in at least one area.'}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(eligibilityReasons.length ? eligibilityReasons : ['No active issues detected']).map((reason) => (
                      <span key={reason} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600">
                        {reason}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </InsightCard>
          </section>
        </>
      ) : null}
    </div>
  );
}
