import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  FiArrowRight,
  FiEye,
  FiEyeOff,
  FiZap,
} from 'react-icons/fi';
import API from '../utils/api';
import { Alert, FullPageSpinner } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { getNotificationLink, useNotificationContext } from '../context/NotificationContext';
import { formatDate, formatRelative, getAdminTierDefinition, getRoleLabel } from '../utils/helpers';
import TodaysThought from '../components/dashboard/TodaysThought';

const createEmptyWorkspace = () => ({
  stats: {},
  notices: [],
  calendar: [],
  tickets: [],
  assignments: [],
  timetable: [],
  attendance: {
    totalSessions: 0,
    attendedSessions: 0,
    attendanceRate: 0,
  },
  recentSubmissions: [],
  personalTasks: [],
  widgetPreferences: { hidden: [], pinned: [] },
  dailyInsight: { message: '' },
});

const ticketTone = (ticket) => {
  if (!ticket) return 'bg-slate-100 text-slate-700';
  if (ticket.priority === 'Critical' || ticket.priority === 'High') return 'bg-red-50 text-red-700';
  if (ticket.status === 'Resolved' || ticket.status === 'Closed') return 'bg-emerald-50 text-emerald-700';
  return 'bg-blue-50 text-blue-700';
};

const SectionCard = ({ title, subtitle, action, onHide, children, className = '', bodyClassName = '' }) => (
  <section className={`dashboard-panel dashboard-section-card h-full overflow-hidden ${className}`.trim()}>
    <div className="dashboard-panel-header flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
      <div className="min-w-0 flex-1">
        <h2 className="dashboard-section-title font-display text-base font-bold text-gray-900">{title}</h2>
        {subtitle ? <p className="dashboard-subtitle mt-1 text-sm text-gray-500">{subtitle}</p> : null}
      </div>
      <div className="dashboard-panel-actions flex flex-shrink-0 flex-wrap items-center justify-end gap-2 self-start">
        {action}
        {onHide ? (
          <button
            type="button"
            onClick={onHide}
            className="dashboard-chip inline-flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-500 transition-colors hover:border-gray-300 hover:text-gray-700"
          >
            <FiEyeOff size={13} />
            Hide
          </button>
        ) : null}
      </div>
    </div>
    <div className={`dashboard-panel-body max-h-[340px] overflow-y-auto p-5 ${bodyClassName}`.trim()}>{children}</div>
  </section>
);


const dashboardToneStyles = {
  blue: 'border-blue-100 bg-blue-50 text-blue-700',
  emerald: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  amber: 'border-amber-100 bg-amber-50 text-amber-700',
  violet: 'border-violet-100 bg-violet-50 text-violet-700',
  red: 'border-rose-100 bg-rose-50 text-rose-700',
};

const DashboardMetricCard = ({ label, value, hint, tone = 'blue' }) => (
  <div className={`rounded-[24px] border p-4 shadow-sm ${dashboardToneStyles[tone] || dashboardToneStyles.blue}`}>
    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-70">{label}</p>
    <p className="mt-3 break-words text-2xl font-black leading-tight">{value}</p>
    <p className="mt-2 text-xs leading-5 opacity-80">{hint}</p>
  </div>
);

const ProgressBar = ({ value, tone = 'blue' }) => {
  const toneClasses = {
    blue: 'bg-blue-600',
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    violet: 'bg-violet-500',
    red: 'bg-red-500',
  };
  const safeValue = Math.max(0, Math.min(100, Number(value) || 0));

  return (
    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
      <div
        className={`h-full rounded-full transition-all ${toneClasses[tone] || toneClasses.blue}`}
        style={{ width: `${safeValue}%` }}
      />
    </div>
  );
};

export default function Dashboard() {
  const { user } = useAuth();
  const { notifications, unreadCount } = useNotificationContext();

  const [loading, setLoading] = useState(true);
  const [workspace, setWorkspace] = useState(createEmptyWorkspace());
  const [error, setError] = useState('');
  const hiddenWidgets = workspace.widgetPreferences?.hidden || [];

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await API.get('/dashboard');
      setWorkspace({ ...createEmptyWorkspace(), ...(res.data?.data || {}) });
    } catch (requestError) {
      setWorkspace(createEmptyWorkspace());
      setError(requestError.response?.data?.message || 'We could not load your workspace right now.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  const board = useMemo(() => {
    const personalTasks = workspace.personalTasks || [];
    return {
      active: personalTasks.filter((task) => task.status !== 'done'),
      completed: personalTasks.filter((task) => task.status === 'done'),
    };
  }, [workspace.personalTasks]);

  const stats = useMemo(() => ({
    pendingTasks: board.active.length,
    activeTickets: workspace.stats?.openTickets || 0,
    newNotices: workspace.notices?.length || 0,
    attendanceRate: workspace.attendance?.attendanceRate || 0,
  }), [board, workspace.stats, workspace.notices, workspace.attendance]);

  const roleLabel = getRoleLabel(user?.role);
  const tierDefinition = useMemo(() => getAdminTierDefinition(user?.adminTier), [user?.adminTier]);
  const assessmentSummary = workspace.assessment || {};
  const attendanceSummary = workspace.attendance || {};
  const subjectPerformance = assessmentSummary.subjectPerformance || [];
  const weakSubjects = assessmentSummary.weakSubjects || [];
  const topSubject = subjectPerformance[0] || null;
  const nextAssessment = assessmentSummary.recentAssessments?.[0] || null;

  const buildActions = (items) => items.map((item) => ({ ...item }));

  const roleDashboard = (() => {
    const role = user?.role || 'student';

    if (role === 'faculty') {
      return {
        eyebrow: 'Faculty Command Center',
        title: 'Teach, grade, and monitor every section from one place.',
        subtitle: 'Follow the KPI layer, inspect subject performance, and close the grading loop faster.',
        accent: 'blue',
        kpis: [
          { label: 'Upcoming classes', value: workspace.timetable?.length || 0, hint: 'Upcoming timetable slots in scope', tone: 'blue' },
          { label: 'Attendance rate', value: `${attendanceSummary.attendanceRate || 0}%`, hint: 'Recent section attendance pulse', tone: (attendanceSummary.attendanceRate || 0) >= 75 ? 'emerald' : 'amber' },
          { label: 'Pending grading', value: assessmentSummary.pendingAssessments || assessmentSummary.pendingGrading || 0, hint: 'Marks still waiting for review', tone: (assessmentSummary.pendingAssessments || assessmentSummary.pendingGrading || 0) ? 'amber' : 'emerald' },
          { label: 'Weak subjects', value: weakSubjects.length || 0, hint: 'Sections needing attention', tone: weakSubjects.length ? 'red' : 'emerald' },
        ],
        analytics: [
          { label: 'Teaching load', value: workspace.timetable?.length || 0, hint: 'Upcoming class slots', detail: 'Use the timetable to jump straight into the next section.', tone: 'blue' },
          { label: 'Attendance health', value: `${attendanceSummary.attendanceRate || 0}%`, hint: 'Sections in your scope', detail: 'The attendance sheet is the fastest way to keep this number healthy.', tone: (attendanceSummary.attendanceRate || 0) >= 75 ? 'emerald' : 'amber' },
          { label: 'Assessment queue', value: assessmentSummary.pendingAssessments || assessmentSummary.pendingGrading || 0, hint: 'Work still to mark', detail: nextAssessment ? `${nextAssessment.title} is the next visible review.` : 'No pending assessment surfaced in the current window.', tone: 'violet' },
          { label: 'Subject risk', value: weakSubjects.length || 0, hint: 'Weak or at-risk subjects', detail: weakSubjects.length ? `${weakSubjects.slice(0, 2).map((subject) => subject.code || subject.name).join(' · ')} need a closer look.` : 'No weak-subject warning in view.', tone: weakSubjects.length ? 'red' : 'emerald' },
        ],
        insights: [
          assessmentSummary.pendingAssessments ? 'Close the grading queue first so section insights stay current.' : 'No pending grading at the moment.',
          ...(assessmentSummary.recommendations || []).slice(0, 2),
          weakSubjects.length ? `Watch ${weakSubjects[0].code || weakSubjects[0].name} because it is currently below target.` : 'No weak subjects detected in the visible data.',
        ].filter(Boolean),
        actions: buildActions([
          { to: '/assessments', label: 'Open Mark Sheet' },
          { to: '/attendance', label: 'Mark Attendance' },
          { to: '/timetable', label: 'Open Timetable' },
        ]),
      };
    }

    if (role === 'staff') {
      return {
        eyebrow: 'Staff Command Center',
        title: 'Stay on top of communication, support, and operational flow.',
        subtitle: 'Watch queue health, notices, and events without losing track of the campus pulse.',
        accent: 'emerald',
        kpis: [
          { label: 'Notices', value: workspace.notices?.length || 0, hint: 'Active campus updates', tone: 'emerald' },
          { label: 'Tickets', value: stats.activeTickets, hint: 'Open support items', tone: stats.activeTickets ? 'amber' : 'emerald' },
          { label: 'Events', value: workspace.calendar?.length || 0, hint: 'Upcoming calendar items', tone: 'blue' },
          { label: 'Assessments', value: assessmentSummary.totalAssessments || 0, hint: 'View-only analytics access', tone: 'violet' },
        ],
        analytics: [
          { label: 'Support queue', value: stats.activeTickets, hint: 'Open support items in scope', detail: `${workspace.tickets?.length || 0} recent tickets loaded into the workspace.`, tone: stats.activeTickets ? 'amber' : 'emerald' },
          { label: 'Broadcasts', value: workspace.notices?.length || 0, hint: 'Active notices ready for staff review', detail: `${workspace.calendar?.length || 0} upcoming campus calendar entries are visible.`, tone: 'emerald' },
          { label: 'Operational pulse', value: `${assessmentSummary.percentage || 0}%`, hint: 'Read-only academic health', detail: assessmentSummary.recommendations?.[0] || 'Operational teams can still scan academic risk from the dashboard.', tone: 'blue' },
          { label: 'AI assistant', value: 'Ready', hint: 'Use natural language for quick answers', detail: 'The assistant and ERP copilot now share one entry point from the dashboard.', tone: 'violet' },
        ],
        insights: [
          'Keep notices and events current so the campus feed stays relevant.',
          ...(assessmentSummary.recommendations || []).slice(0, 2),
          workspace.dailyInsight?.message ? workspace.dailyInsight.message : 'No daily insight has been generated yet.',
        ].filter(Boolean),
        actions: buildActions([
          { to: '/notice-board', label: 'Publish Notices' },
          { to: '/tickets', label: 'Open Queue' },
          { to: '/assessments', label: 'View Marks' },
        ]),
      };
    }

    if (role === 'admin') {
      return {
        eyebrow: 'Admin Command Center',
        title: 'Monitor academics, support, and campus health at a glance.',
        subtitle: 'Use the dashboard to catch risk early and keep operations moving.',
        accent: 'violet',
        kpis: [
          { label: 'Open tickets', value: stats.activeTickets, hint: 'Current support backlog', tone: stats.activeTickets ? 'amber' : 'emerald' },
          { label: 'Attendance', value: `${attendanceSummary.attendanceRate || 0}%`, hint: 'Recent class attendance pulse', tone: (attendanceSummary.attendanceRate || 0) >= 75 ? 'emerald' : 'amber' },
          { label: 'Assessments', value: assessmentSummary.totalAssessments || 0, hint: 'Visible mark sheets', tone: 'blue' },
          { label: 'Low alerts', value: assessmentSummary.lowPerformanceAlerts || 0, hint: 'Subjects needing attention', tone: assessmentSummary.lowPerformanceAlerts ? 'red' : 'emerald' },
        ],
        analytics: [
          { label: 'Risk signals', value: assessmentSummary.lowPerformanceAlerts || 0, hint: 'Subjects below target', detail: weakSubjects.length ? `${weakSubjects.length} weak subjects need review.` : 'No subject risk detected in the visible range.', tone: assessmentSummary.lowPerformanceAlerts ? 'red' : 'emerald' },
          { label: 'Attendance pulse', value: `${attendanceSummary.attendanceRate || 0}%`, hint: 'Recent academic attendance health', detail: `${workspace.timetable?.length || 0} upcoming timetable entries are available to the admin view.`, tone: (attendanceSummary.attendanceRate || 0) >= 75 ? 'emerald' : 'amber' },
          { label: 'Assessment coverage', value: assessmentSummary.totalAssessments || 0, hint: 'Visible mark sheets in the system', detail: `${assessmentSummary.pendingAssessments || assessmentSummary.pendingGrading || 0} records still need attention.`, tone: 'blue' },
          { label: 'Governance actions', value: 'Ready', hint: 'Identity, planning, and reporting', detail: 'Use the dashboard to move quickly into users, academics, and permissions.', tone: 'violet' },
        ],
        insights: [
          'Monitor low alerts and attendance together to catch academic risk early.',
          ...(assessmentSummary.recommendations || []).slice(0, 2),
          workspace.dailyInsight?.message ? workspace.dailyInsight.message : 'No daily insight has been generated yet.',
        ].filter(Boolean),
        actions: buildActions([
          { to: '/assessments', label: 'Review Marks' },
          { to: '/academics', label: 'Academic Planning' },
          { to: '/users', label: 'Identity & Access' },
        ]),
      };
    }

    return {
      eyebrow: 'Student Command Center',
      title: 'Track your attendance, marks, and eligibility in one clear view.',
      subtitle: 'This dashboard highlights what you need to keep eligibility and performance on track.',
      accent: 'emerald',
      kpis: [
        { label: 'Attendance', value: `${attendanceSummary.attendanceRate || 0}%`, hint: 'Current attendance rate', tone: (attendanceSummary.attendanceRate || 0) >= 75 ? 'emerald' : 'amber' },
        { label: 'Performance', value: `${assessmentSummary.percentage || 0}%`, hint: 'Overall mark percentage', tone: (assessmentSummary.percentage || 0) >= 60 ? 'emerald' : (assessmentSummary.percentage || 0) >= 45 ? 'amber' : 'red' },
        { label: 'Eligible', value: assessmentSummary.eligible ? 'Yes' : 'No', hint: 'Based on attendance and marks', tone: assessmentSummary.eligible ? 'emerald' : 'amber' },
        { label: 'Weak subjects', value: assessmentSummary.weakSubjects?.length || 0, hint: 'Need focused revision', tone: assessmentSummary.weakSubjects?.length ? 'red' : 'emerald' },
      ],
      analytics: [
        { label: 'Attendance health', value: `${attendanceSummary.attendanceRate || 0}%`, hint: 'Used in eligibility checks', detail: assessmentSummary.eligible ? 'You are currently meeting the attendance threshold.' : 'Improving attendance should be your next priority.', tone: (attendanceSummary.attendanceRate || 0) >= 75 ? 'emerald' : 'amber' },
        { label: 'Performance trend', value: `${assessmentSummary.percentage || 0}%`, hint: 'Overall assessment average', detail: topSubject ? `Best current subject: ${topSubject.code || topSubject.name}` : 'Subject performance will appear once marks are recorded.', tone: (assessmentSummary.percentage || 0) >= 60 ? 'emerald' : (assessmentSummary.percentage || 0) >= 45 ? 'amber' : 'red' },
        { label: 'Eligibility status', value: assessmentSummary.eligible ? 'Eligible' : 'Review', hint: 'Attendance and marks combined', detail: (assessmentSummary.eligibilityReasons || [])[0] || 'No eligibility issues detected in the current view.', tone: assessmentSummary.eligible ? 'emerald' : 'amber' },
        { label: 'Weak subjects', value: assessmentSummary.weakSubjects?.length || 0, hint: 'Needs focused revision', detail: weakSubjects.length ? weakSubjects.slice(0, 2).map((subject) => subject.code || subject.name).join(' · ') : 'No weak subject signals right now.', tone: weakSubjects.length ? 'red' : 'emerald' },
      ],
      insights: [
        ...(assessmentSummary.recommendations || []).slice(0, 3),
        assessmentSummary.eligible ? 'Keep the current pace to remain eligible.' : 'Focus first on attendance and weak subjects.',
        workspace.dailyInsight?.message ? workspace.dailyInsight.message : 'No daily insight has been generated yet.',
      ].filter(Boolean),
      actions: buildActions([
        { to: '/performance', label: 'View Performance' },
        { to: '/assessments', label: 'Open Marks' },
        { to: '/attendance', label: 'View Attendance' },
      ]),
    };
  })();

  const activityItems = useMemo(() => {
    const ticketItems = (workspace.tickets || []).map((ticket) => ({
      id: `ticket-${ticket._id}`,
      title: ticket.title,
      meta: `${ticket.ticketId} · ${formatRelative(ticket.createdAt)}`,
      link: `/tickets/${ticket._id}`,
      badge: <span className={`badge ${ticketTone(ticket)}`}>{ticket.status}</span>,
    }));

    const submissionItems = (workspace.recentSubmissions || []).map((item) => ({
      id: `submission-${item._id}`,
      title: item.title,
      meta: `${item.meta} · ${formatRelative(item.createdAt)}`,
      link: item.link,
      badge: <span className="badge bg-emerald-50 text-emerald-700">Submission</span>,
    }));

    const notificationItems = notifications.slice(0, 4).map((notification) => ({
      id: `notification-${notification.id}`,
      title: notification.title,
      meta: `${notification.body} · ${formatRelative(notification.timestamp)}`,
      link: getNotificationLink(notification),
      badge: <span className={`badge ${notification.read ? 'bg-slate-100 text-slate-600' : 'bg-blue-50 text-blue-700'}`}>{notification.read ? 'Seen' : 'New'}</span>,
    }));

    return [...ticketItems, ...submissionItems, ...notificationItems].slice(0, 8);
  }, [workspace.tickets, workspace.recentSubmissions, notifications]);

  const updateDashboardPreferences = async (nextPreferences) => {
    try {
      const res = await API.put('/dashboard/preferences', nextPreferences);
      setWorkspace((current) => ({
        ...current,
        widgetPreferences: res.data?.data || nextPreferences,
      }));
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || 'Failed to update dashboard preferences');
    }
  };

  const hideWidget = async (widgetKey) => {
    if (hiddenWidgets.includes(widgetKey)) return;
    const nextHidden = [...hiddenWidgets, widgetKey];
    setWorkspace((current) => ({
      ...current,
      widgetPreferences: {
        ...(current.widgetPreferences || { hidden: [], pinned: [] }),
        hidden: nextHidden,
      },
    }));
    await updateDashboardPreferences({
      hidden: nextHidden,
      pinned: workspace.widgetPreferences?.pinned || [],
    });
  };

  const showWidget = async (widgetKey) => {
    const nextHidden = hiddenWidgets.filter((item) => item !== widgetKey);
    setWorkspace((current) => ({
      ...current,
      widgetPreferences: {
        ...(current.widgetPreferences || { hidden: [], pinned: [] }),
        hidden: nextHidden,
      },
    }));
    await updateDashboardPreferences({
      hidden: nextHidden,
      pinned: workspace.widgetPreferences?.pinned || [],
    });
  };

  const isWidgetVisible = (widgetKey) => !hiddenWidgets.includes(widgetKey);

  const hiddenWidgetLabels = useMemo(() => ({
    dailyFocus: 'Daily Focus',
  }), []);

  const dashboardVisibleWidgets = hiddenWidgets.filter((key) => key === 'dailyFocus');
  const upcomingDeadlines = [
    nextAssessment ? {
      title: nextAssessment.title,
      meta: `${nextAssessment.subject || 'Subject'} · ${formatDate(nextAssessment.date)}`,
      tone: 'violet',
    } : null,
    ...(workspace.assignments || []).slice(0, 2).map((assignment) => {
      const dueDate = assignment.dueDate || assignment.deadline || assignment.submissionDeadline || assignment.targetDate;
      return {
        title: assignment.title || assignment.name || 'Assignment',
        meta: dueDate ? formatDate(dueDate) : 'No due date yet',
        tone: 'amber',
      };
    }),
  ].filter(Boolean).slice(0, 3);

  if (loading) return <FullPageSpinner />;

  return (
    <div className="dashboard-shell space-y-5 px-4 pb-10 sm:px-6 lg:px-8">
      <TodaysThought />

      {dashboardVisibleWidgets.length ? (
        <section className="rounded-[20px] border border-dashed border-[var(--border-strong)] bg-[var(--surface-card)] px-4 py-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Hidden sections</span>
            {dashboardVisibleWidgets.map((widgetKey) => (
              <button
                key={widgetKey}
                type="button"
                onClick={() => showWidget(widgetKey)}
                className="inline-flex items-center gap-1 rounded-full border border-[var(--border-strong)] bg-white px-3 py-1 text-xs font-semibold text-[var(--text-main)] transition hover:border-gray-300 hover:bg-slate-50"
              >
                <FiEye size={12} />
                {hiddenWidgetLabels[widgetKey] || widgetKey}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {isWidgetVisible('dailyFocus') && workspace.dailyInsight?.message ? (
        <section className="rounded-[22px] border border-blue-100 bg-gradient-to-r from-blue-50 via-white to-emerald-50 px-4 py-3 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-white text-blue-700 shadow-sm">
              <FiZap size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-500">Daily pulse</p>
              <p className="mt-1 text-sm leading-6 text-slate-700">{workspace.dailyInsight.message}</p>
            </div>
            <button
              type="button"
              onClick={() => hideWidget('dailyFocus')}
              className="inline-flex flex-shrink-0 items-center gap-1 rounded-full border border-blue-100 bg-white px-3 py-1 text-xs font-semibold text-blue-600 transition hover:border-blue-200 hover:text-blue-700"
            >
              <FiEyeOff size={12} />
              Hide
            </button>
          </div>
        </section>
      ) : null}

      {error ? <Alert type="warning" message={error} /> : null}

      <section className="rounded-[28px] border border-[var(--border-strong)] bg-[var(--surface-card)] shadow-sm">
        <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1.15fr),minmax(320px,0.85fr)] lg:p-6">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-blue-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-blue-700">{roleDashboard.eyebrow}</span>
              <span className="badge bg-slate-100 text-slate-700">{tierDefinition?.label || roleLabel}</span>
              <span className="badge bg-emerald-50 text-emerald-700">Live data</span>
            </div>
            <div className="max-w-3xl">
              <h2 className="font-display text-2xl font-black tracking-tight text-[var(--text-strong)] sm:text-3xl">{roleDashboard.title}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-muted)]">{roleDashboard.subtitle}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {roleDashboard.actions.slice(0, 3).map((action) => (
                <Link
                  key={action.to}
                  to={action.to}
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--border-strong)] bg-[var(--surface-card)] px-3.5 py-2 text-sm font-semibold text-[var(--text-main)] shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:text-blue-700"
                >
                  {action.label}
                  <FiArrowRight size={13} />
                </Link>
              ))}
              <a
                href="#dashboard-analytics"
                className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-blue-700"
              >
                View analytics
                <FiArrowRight size={13} />
              </a>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[20px] border border-slate-100 bg-slate-50 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Attendance summary</p>
              <p className="mt-2 text-2xl font-black text-slate-900">{attendanceSummary.attendanceRate || 0}%</p>
              <p className="mt-1 text-xs text-slate-500">{attendanceSummary.attendedSessions || 0}/{attendanceSummary.totalSessions || 0} sessions attended</p>
            </div>
            <div className="rounded-[20px] border border-slate-100 bg-slate-50 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Marks summary</p>
              <p className="mt-2 text-2xl font-black text-slate-900">{assessmentSummary.percentage || 0}%</p>
              <p className="mt-1 text-xs text-slate-500">{assessmentSummary.completedAssessments || 0}/{assessmentSummary.totalAssessments || 0} assessments recorded</p>
            </div>
            <div className="rounded-[20px] border border-slate-100 bg-slate-50 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Academic performance</p>
              <p className={`mt-2 text-2xl font-black ${assessmentSummary.eligible ? 'text-emerald-700' : 'text-amber-700'}`}>{assessmentSummary.eligible ? 'On track' : 'Needs attention'}</p>
              <p className="mt-1 text-xs text-slate-500">{weakSubjects.length ? `${weakSubjects.length} subjects need review` : 'No weak subjects flagged'}</p>
            </div>
            <div className="rounded-[20px] border border-slate-100 bg-slate-50 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Alerts & notifications</p>
              <p className="mt-2 text-2xl font-black text-slate-900">{unreadCount + (workspace.notices?.length || 0)}</p>
              <p className="mt-1 text-xs text-slate-500">Unread notifications and active updates</p>
            </div>
          </div>
        </div>
      </section>

      <section id="dashboard-kpis" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardMetricCard label="Attendance" value={`${attendanceSummary.attendanceRate || 0}%`} hint="Current attendance rate" tone={(attendanceSummary.attendanceRate || 0) >= 75 ? 'emerald' : 'amber'} />
        <DashboardMetricCard label="Marks" value={`${assessmentSummary.percentage || 0}%`} hint="Overall academic average" tone={(assessmentSummary.percentage || 0) >= 60 ? 'emerald' : (assessmentSummary.percentage || 0) >= 45 ? 'amber' : 'red'} />
        <DashboardMetricCard label="Pending actions" value={stats.pendingTasks} hint="Reminders and follow-ups" tone={stats.pendingTasks ? 'amber' : 'emerald'} />
        <DashboardMetricCard label="Alerts" value={unreadCount} hint="Unread notifications" tone={unreadCount ? 'violet' : 'emerald'} />
      </section>

      <section id="dashboard-analytics" className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr),minmax(320px,0.85fr)]">
        <SectionCard title="Trends and Analytics" subtitle="Attendance and subject performance in one glance" bodyClassName="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[18px] border border-slate-100 bg-slate-50 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Attendance trend</p>
              <p className="mt-2 text-xl font-black text-slate-900">{attendanceSummary.attendanceRate || 0}%</p>
              <ProgressBar value={attendanceSummary.attendanceRate || 0} tone={(attendanceSummary.attendanceRate || 0) >= 75 ? 'emerald' : 'amber'} />
              <p className="mt-2 text-xs text-slate-500">Based on {attendanceSummary.totalSessions || 0} sessions</p>
            </div>
            <div className="rounded-[18px] border border-slate-100 bg-slate-50 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Marks trend</p>
              <p className="mt-2 text-xl font-black text-slate-900">{assessmentSummary.percentage || 0}%</p>
              <ProgressBar value={assessmentSummary.percentage || 0} tone={(assessmentSummary.percentage || 0) >= 60 ? 'emerald' : (assessmentSummary.percentage || 0) >= 45 ? 'amber' : 'red'} />
              <p className="mt-2 text-xs text-slate-500">{assessmentSummary.completedAssessments || 0} assessments complete</p>
            </div>
          </div>

          <div className="rounded-[18px] border border-slate-100 bg-white px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Subject-wise performance</p>
                <p className="mt-1 text-sm text-slate-600">Quick scan of subjects needing attention</p>
              </div>
              <span className="badge bg-slate-100 text-slate-600">{subjectPerformance.length} subjects</span>
            </div>
            <div className="mt-4 space-y-3 max-h-[240px] overflow-y-auto pr-1">
              {(subjectPerformance || []).slice(0, 5).map((subject) => {
                const percent = subject.percentage || 0;
                const tone = percent >= 60 ? 'emerald' : percent >= 45 ? 'amber' : 'red';
                return (
                  <div key={String(subject.subjectId || subject.code)} className="rounded-[16px] border border-slate-100 bg-slate-50 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{subject.code || subject.name}</p>
                        <p className="mt-1 text-xs text-slate-500">{subject.obtainedMarks || 0}/{subject.totalMarks || 0} marks</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone === 'emerald' ? 'bg-emerald-50 text-emerald-700' : tone === 'amber' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
                        {percent}%
                      </span>
                    </div>
                    <ProgressBar value={percent} tone={tone} />
                  </div>
                );
              })}
            </div>
          </div>

          {(assessmentSummary.eligibilityReasons || []).length || weakSubjects.length ? (
            <div className="rounded-[18px] border border-slate-100 bg-white px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Academic performance signals</p>
                  <p className="mt-1 text-sm text-slate-600">Eligibility and low-performance alerts</p>
                </div>
                <span className={`badge ${assessmentSummary.eligible ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                  {assessmentSummary.eligible ? 'Eligible' : 'Review'}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {(assessmentSummary.eligibilityReasons || []).length ? assessmentSummary.eligibilityReasons.slice(0, 3).map((reason) => (
                  <span key={reason} className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700">{reason}</span>
                )) : null}
                {weakSubjects.slice(0, 3).map((subject) => (
                  <span key={String(subject.subjectId || subject.code)} className="badge bg-red-50 text-red-700">{subject.code || subject.name}</span>
                ))}
              </div>
            </div>
          ) : null}
        </SectionCard>

        <SectionCard title="Alerts & Notifications" subtitle="Important updates that need attention" bodyClassName="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[18px] border border-slate-100 bg-slate-50 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Unread notifications</p>
              <p className="mt-2 text-2xl font-black text-slate-900">{unreadCount}</p>
              <p className="mt-1 text-xs text-slate-500">System and activity alerts</p>
            </div>
            <div className="rounded-[18px] border border-slate-100 bg-slate-50 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Important updates</p>
              <p className="mt-2 text-2xl font-black text-slate-900">{workspace.notices?.length || 0}</p>
              <p className="mt-1 text-xs text-slate-500">Active notices and department updates</p>
            </div>
          </div>

          {upcomingDeadlines.length ? (
            <div className="rounded-[18px] border border-slate-100 bg-white px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Upcoming deadlines</p>
              <div className="mt-3 space-y-2 max-h-[180px] overflow-y-auto pr-1">
                {upcomingDeadlines.map((item) => (
                  <div key={`${item.title}-${item.meta}`} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{item.title}</p>
                      <p className="mt-1 text-xs text-slate-500">{item.meta}</p>
                    </div>
                    <span className={`badge ${item.tone === 'violet' ? 'bg-violet-50 text-violet-700' : 'bg-amber-50 text-amber-700'}`}>Due</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {workspace.notices?.length ? (
            <div className="rounded-[18px] border border-slate-100 bg-white px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Recent academic updates</p>
              <div className="mt-3 space-y-2 max-h-[180px] overflow-y-auto pr-1">
                {(workspace.notices || []).slice(0, 3).map((notice) => (
                  <Link key={notice._id} to="/notice-board" className="block rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3 transition hover:border-blue-200 hover:bg-blue-50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">{notice.title}</p>
                        <p className="mt-1 text-xs text-slate-500 line-clamp-2">{notice.description}</p>
                      </div>
                      <span className={`badge ${notice.priority === 'high' ? 'bg-red-50 text-red-700' : notice.priority === 'medium' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>
                        {notice.priority}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </SectionCard>
      </section>

      <section id="dashboard-actions" className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr),minmax(320px,0.85fr)]">
        {activityItems.length ? (
          <SectionCard title="Activity Feed" subtitle="Recent system and academic activity" bodyClassName="space-y-3">
            <div className="max-h-[320px] overflow-y-auto pr-1 space-y-3">
              {activityItems.slice(0, 6).map((item) => (
                <Link key={item.id} to={item.link} className="flex items-start justify-between gap-3 rounded-2xl border border-[var(--border-strong)] bg-white px-4 py-4 transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="min-w-0">
                    <p className="font-semibold text-[var(--text-strong)]">{item.title}</p>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">{item.meta}</p>
                  </div>
                  {item.badge}
                </Link>
              ))}
            </div>
          </SectionCard>
        ) : null}

        <div className="space-y-5">
          {workspace.tickets?.length ? (
            <SectionCard title="Ticket Status Summary" subtitle="Support backlog at a glance" bodyClassName="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-4">
                  <p className="text-lg font-black text-slate-900">{(workspace.tickets || []).filter((ticket) => ['Open', 'In Progress'].includes(ticket.status)).length}</p>
                  <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">Open</p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-4">
                  <p className="text-lg font-black text-slate-900">{(workspace.tickets || []).filter((ticket) => ticket.assignedTo?.name).length}</p>
                  <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">Assigned</p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-4">
                  <p className="text-lg font-black text-slate-900">{(workspace.tickets || []).filter((ticket) => ticket.priority === 'High' || ticket.priority === 'Critical').length}</p>
                  <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">Priority</p>
                </div>
              </div>
              <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1">
                {(workspace.tickets || []).slice(0, 3).map((ticket) => (
                  <Link key={ticket._id} to={`/tickets/${ticket._id}`} className="block rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3 transition hover:border-blue-200 hover:bg-blue-50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{ticket.title}</p>
                        <p className="mt-1 text-xs text-slate-500">{ticket.ticketId} · {ticket.routingDepartment || ticket.category}</p>
                      </div>
                      <span className={`badge ${ticketTone(ticket)}`}>{ticket.status}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </SectionCard>
          ) : null}

          {workspace.calendar?.length ? (
            <SectionCard title="Department Updates & Calendar" subtitle="Operational and academic context" bodyClassName="space-y-3">
              <div className="max-h-[220px] overflow-y-auto space-y-3 pr-1">
                {(workspace.calendar || []).slice(0, 3).map((event) => (
                  <div key={event._id || `${event.title}-${event.date}`} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-900">{event.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{formatDate(event.date || event.startDate || event.createdAt)}</p>
                  </div>
                ))}
              </div>
            </SectionCard>
          ) : null}
        </div>
      </section>
    </div>
  );
}
