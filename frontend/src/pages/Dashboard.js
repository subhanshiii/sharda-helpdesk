import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  FiArrowRight,
  FiCalendar,
  FiEye,
  FiEyeOff,
  FiMessageCircle,
  FiPlus,
  FiPlusCircle,
  FiSpeaker,
  FiTrash2,
  FiUserCheck,
  FiZap,
} from 'react-icons/fi';
import API from '../utils/api';
import { Alert, EmptyState, FullPageSpinner } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../context/PermissionContext';
import { getNotificationLink, useNotificationContext } from '../context/NotificationContext';
import { formatDate, formatRelative } from '../utils/helpers';
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
    recentSessions: [],
  },
  recentSubmissions: [],
  personalTasks: [],
  widgetPreferences: { hidden: [], pinned: [] },
  dailyInsight: { message: '' },
});

const getGreeting = (name) => {
  const hour = new Date().getHours();
  if (hour < 12) return `Good morning, ${name}`;
  if (hour < 17) return `Good afternoon, ${name}`;
  return `Good evening, ${name}`;
};

const ticketTone = (ticket) => {
  if (!ticket) return 'bg-slate-100 text-slate-700';
  if (ticket.priority === 'Critical' || ticket.priority === 'High') return 'bg-red-50 text-red-700';
  if (ticket.status === 'Resolved' || ticket.status === 'Closed') return 'bg-emerald-50 text-emerald-700';
  return 'bg-blue-50 text-blue-700';
};

const assignmentDone = (assignment, canManageAssignments) => (
  canManageAssignments
    ? (assignment.gradedCount || 0) >= (assignment.submissionCount || 0) && (assignment.submissionCount || 0) > 0
    : Boolean(assignment.mySubmission)
);

const TaskColumn = ({ title, hint, tasks, emptyText, actionLabel, onAction, onDelete }) => (
  <section className="rounded-3xl border border-gray-100 bg-white">
    <div className="border-b border-gray-100 px-4 py-3.5">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">{title}</p>
      <p className="mt-1 text-sm text-gray-500">{hint}</p>
    </div>
    <div className="space-y-3 p-4 min-h-[220px]">
      {tasks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 p-4 text-center text-sm text-gray-400">
          {emptyText}
        </div>
      ) : tasks.map((task) => (
        <div key={task.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold text-gray-900">{task.title}</p>
              {task.meta ? <p className="mt-1 text-sm text-gray-500">{task.meta}</p> : null}
              {task.note ? <p className="mt-2 text-sm text-gray-600">{task.note}</p> : null}
            </div>
            {onDelete && task.kind === 'personal' ? (
              <button onClick={() => onDelete(task.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                <FiTrash2 size={15} />
              </button>
            ) : null}
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className={`badge ${task.kind === 'assigned' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-700'}`}>
              {task.kind === 'assigned' ? 'Assigned' : 'Personal'}
            </span>
            {onAction ? (
              <button onClick={() => onAction(task)} className="text-xs font-semibold text-emerald-600 hover:text-emerald-700">
                {actionLabel}
              </button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  </section>
);

const SectionCard = ({ title, subtitle, action, onHide, children }) => (
  <section className="card overflow-hidden">
    <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3.5">
      <div>
        <h2 className="font-display text-base font-bold text-gray-900">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-gray-500">{subtitle}</p> : null}
      </div>
      <div className="flex items-center gap-2">
        {action}
        {onHide ? (
          <button
            type="button"
            onClick={onHide}
            className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-500 transition-colors hover:border-gray-300 hover:text-gray-700"
          >
            <FiEyeOff size={13} />
            Hide
          </button>
        ) : null}
      </div>
    </div>
    <div className="p-4">{children}</div>
  </section>
);

export default function Dashboard() {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const { notifications, unreadCount } = useNotificationContext();

  const [loading, setLoading] = useState(true);
  const [workspace, setWorkspace] = useState(createEmptyWorkspace());
  const [error, setError] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskNote, setNewTaskNote] = useState('');
  const [savingTask, setSavingTask] = useState(false);
  const hiddenWidgets = workspace.widgetPreferences?.hidden || [];

  const canSeeAssignments = ['student', 'faculty', 'admin'].includes(user?.role)
    || hasPermission('canManageAssignments')
    || hasPermission('canSubmitAssignments');
  const canManageAssignments = ['faculty', 'admin'].includes(user?.role) || hasPermission('canManageAssignments');

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

  const assignedTasks = useMemo(() => (workspace.assignments || []).map((assignment) => ({
    id: `assigned-${assignment._id}`,
    kind: 'assigned',
    title: assignment.title,
    meta: `${assignment.subject || 'General'} · due ${formatRelative(assignment.dueDate)}`,
    done: assignmentDone(assignment, canManageAssignments),
    link: `/assignments/${assignment._id}`,
  })), [workspace.assignments, canManageAssignments]);

  const board = useMemo(() => {
    const personalTasks = workspace.personalTasks || [];
    return {
      personal: personalTasks.filter((task) => task.status !== 'done').map((task) => ({ ...task, kind: 'personal' })),
      assigned: assignedTasks.filter((task) => !task.done),
      completed: [
        ...personalTasks.filter((task) => task.status === 'done').map((task) => ({ ...task, kind: 'personal' })),
        ...assignedTasks.filter((task) => task.done),
      ],
    };
  }, [assignedTasks, workspace.personalTasks]);

  const stats = useMemo(() => ({
    pendingTasks: board.personal.length + board.assigned.length,
    activeTickets: workspace.stats?.openTickets || 0,
    newNotices: workspace.notices?.length || 0,
    attendanceRate: workspace.attendance?.attendanceRate || 0,
  }), [board, workspace.stats, workspace.notices, workspace.attendance]);

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

  const createTask = async (event) => {
    event.preventDefault();
    if (!newTaskTitle.trim()) return;
    setSavingTask(true);
    try {
      const res = await API.post('/dashboard/tasks', {
        title: newTaskTitle.trim(),
        note: newTaskNote.trim(),
      });
      setWorkspace((current) => ({
        ...current,
        personalTasks: [res.data?.data, ...(current.personalTasks || [])],
      }));
      setNewTaskTitle('');
      setNewTaskNote('');
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || 'Failed to create task');
    } finally {
      setSavingTask(false);
    }
  };

  const updateTask = async (task, status) => {
    try {
      const res = await API.put(`/dashboard/tasks/${task.id}`, { status });
      setWorkspace((current) => ({
        ...current,
        personalTasks: (current.personalTasks || []).map((entry) => (
          entry.id === task.id ? res.data?.data : entry
        )),
      }));
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || 'Failed to update task');
    }
  };

  const deleteTask = async (taskId) => {
    try {
      await API.delete(`/dashboard/tasks/${taskId}`);
      setWorkspace((current) => ({
        ...current,
        personalTasks: (current.personalTasks || []).filter((entry) => entry.id !== taskId),
      }));
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || 'Failed to delete task');
    }
  };

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
    academicSnapshot: 'Academic Snapshot',
    productivityBoard: 'Productivity Board',
    academicOverview: 'Academic Overview',
    noticeHighlights: 'Notice Highlights',
    recentActivity: 'Recent Activity',
    helpdeskSnapshot: 'Helpdesk Snapshot',
  }), []);

  const showAcademicSnapshot = isWidgetVisible('academicSnapshot');
  const showProductivityBoard = isWidgetVisible('productivityBoard');
  const showAcademicOverview = isWidgetVisible('academicOverview');
  const showNoticeHighlights = isWidgetVisible('noticeHighlights');
  const showRecentActivity = isWidgetVisible('recentActivity');
  const showHelpdeskSnapshot = isWidgetVisible('helpdeskSnapshot');
  const middleSectionCount = [showProductivityBoard, showAcademicOverview || showNoticeHighlights].filter(Boolean).length;
  const lowerSectionCount = [showRecentActivity, showHelpdeskSnapshot].filter(Boolean).length;

  if (loading) return <FullPageSpinner />;

  return (
    <div className="space-y-5">
      <TodaysThought />

      {hiddenWidgets.length ? (
        <section className="rounded-2xl border border-dashed border-gray-200 bg-white px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Hidden Sections</span>
            {hiddenWidgets.map((widgetKey) => (
              <button
                key={widgetKey}
                type="button"
                onClick={() => showWidget(widgetKey)}
                className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200"
              >
                <FiEye size={12} />
                {hiddenWidgetLabels[widgetKey] || widgetKey}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {isWidgetVisible('dailyFocus') && workspace.dailyInsight?.message ? (
        <section className="rounded-3xl border border-blue-100 bg-gradient-to-r from-blue-50 via-white to-emerald-50 px-4 py-3.5 flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white text-blue-700 shadow-sm flex items-center justify-center flex-shrink-0">
            <FiZap size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.18em] text-blue-500 font-semibold">Daily Focus</p>
            <p className="text-sm sm:text-[15px] text-gray-700 leading-7 mt-1">{workspace.dailyInsight.message}</p>
          </div>
          <button
            type="button"
            onClick={() => hideWidget('dailyFocus')}
            className="ml-auto inline-flex flex-shrink-0 items-center gap-1 rounded-full border border-blue-100 bg-white px-2.5 py-1 text-xs font-semibold text-blue-600 hover:border-blue-200 hover:text-blue-700"
          >
            <FiEyeOff size={12} />
            Hide
          </button>
        </section>
      ) : null}

      {error ? <Alert type="warning" message={error} /> : null}

      <section className="card p-4 sm:p-5">
        <div className={`grid gap-4 items-start ${showAcademicSnapshot ? 'xl:grid-cols-[1.25fr,0.75fr]' : 'grid-cols-1'}`}>
          <div className="space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div>
                <p className="text-sm text-gray-500">{getGreeting(user?.name || 'there')}</p>
                <h1 className="font-display text-2xl font-bold text-gray-900">Unified Dashboard</h1>
                <p className="text-sm text-gray-500 mt-1">Academic progress, support, and campus updates from one workspace.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link to="/tickets/new" className="btn-primary"><FiPlusCircle size={15} /> Create Ticket</Link>
                <Link to="/group-chat" className="btn-secondary"><FiMessageCircle size={15} /> Open Chat</Link>
                <Link to="/notice-board" className="btn-secondary"><FiSpeaker size={15} /> View Notices</Link>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
              <div className="rounded-2xl border border-blue-100 bg-blue-50/80 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.18em] font-semibold text-blue-500">Pending Tasks</p>
                <p className="font-display text-2xl font-black text-blue-900 mt-1">{stats.pendingTasks}</p>
              </div>
              <div className="rounded-2xl border border-amber-100 bg-amber-50/80 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.18em] font-semibold text-amber-500">Active Tickets</p>
                <p className="font-display text-2xl font-black text-amber-900 mt-1">{stats.activeTickets}</p>
              </div>
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.18em] font-semibold text-emerald-500">Notice Highlights</p>
                <p className="font-display text-2xl font-black text-emerald-900 mt-1">{stats.newNotices}</p>
              </div>
              <div className="rounded-2xl border border-violet-100 bg-violet-50/80 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.18em] font-semibold text-violet-500">Attendance</p>
                <p className="font-display text-2xl font-black text-violet-900 mt-1">{stats.attendanceRate}%</p>
              </div>
            </div>
          </div>

          {showAcademicSnapshot ? (
            <div className="rounded-3xl border border-gray-100 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs uppercase tracking-[0.18em] text-gray-400 font-semibold">Academic Snapshot</p>
                <button
                  type="button"
                  onClick={() => hideWidget('academicSnapshot')}
                  className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-500 hover:border-gray-300 hover:text-gray-700"
                >
                  <FiEyeOff size={12} />
                  Hide
                </button>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                <div className="rounded-2xl border border-gray-100 bg-white px-3 py-3">
                  <p className="text-xl font-black text-gray-900">{workspace.assignments?.length || 0}</p>
                  <p className="text-xs text-gray-500 mt-1">Assignments</p>
                </div>
                <div className="rounded-2xl border border-gray-100 bg-white px-3 py-3">
                  <p className="text-xl font-black text-gray-900">{workspace.timetable?.length || 0}</p>
                  <p className="text-xs text-gray-500 mt-1">Classes</p>
                </div>
                <div className="rounded-2xl border border-gray-100 bg-white px-3 py-3">
                  <p className="text-xl font-black text-gray-900">{unreadCount}</p>
                  <p className="text-xs text-gray-500 mt-1">Unread</p>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {middleSectionCount > 0 ? (
      <div className={`grid gap-5 ${middleSectionCount > 1 ? 'xl:grid-cols-[1.35fr,1fr]' : 'grid-cols-1'}`}>
        {showProductivityBoard ? (
        <SectionCard title="Productivity Board" subtitle="Personal todo meets assigned academic work" onHide={() => hideWidget('productivityBoard')}>
          <div className="grid lg:grid-cols-[0.95fr,1fr,1fr] gap-4">
            <div className="space-y-4">
              <form onSubmit={createTask} className="rounded-3xl border border-gray-100 bg-slate-50 p-4 space-y-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-gray-400 font-semibold">Add Personal Task</p>
                  <h3 className="font-semibold text-gray-900 mt-1">Stay ahead of small commitments</h3>
                </div>
                <input className="input" value={newTaskTitle} onChange={(event) => setNewTaskTitle(event.target.value)} placeholder="Prepare presentation notes" />
                <textarea className="input resize-none" rows={3} value={newTaskNote} onChange={(event) => setNewTaskNote(event.target.value)} placeholder="Optional note or next step..." />
                <button type="submit" disabled={savingTask} className="btn-primary w-full justify-center">
                  <FiPlus size={14} /> {savingTask ? 'Saving...' : 'Add Task'}
                </button>
              </form>

              <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-emerald-500 font-semibold">Momentum</p>
                <p className="mt-2 text-sm font-semibold text-emerald-900">
                  {board.completed.length
                    ? `${board.completed.length} item${board.completed.length > 1 ? 's are' : ' is'} already complete. Keep that pace going.`
                    : 'Finish one focused task early to make the whole dashboard feel lighter.'}
                </p>
              </div>
            </div>

            <TaskColumn
              title="Assigned Tasks"
              hint="Active coursework and submissions"
              tasks={board.assigned}
              emptyText={canSeeAssignments ? 'No open assigned work right now.' : 'Assignments are not enabled for this role.'}
              actionLabel="Open"
              onAction={(task) => window.location.assign(task.link)}
            />

            <div className="space-y-4">
              <TaskColumn
                title="Personal Todo"
                hint="Your own reminders and next actions"
                tasks={(workspace.personalTasks || []).filter((task) => task.status !== 'done').map((task) => ({ ...task, kind: 'personal' }))}
                emptyText="No personal tasks yet."
                actionLabel="Done"
                onAction={(task) => updateTask(task, 'done')}
                onDelete={deleteTask}
              />
              <TaskColumn
                title="Completed"
                hint="Finished items and closed loops"
                tasks={board.completed}
                emptyText="Nothing completed yet."
                actionLabel="Reopen"
                onAction={(task) => task.kind === 'personal' ? updateTask(task, 'todo') : window.location.assign(task.link)}
              />
            </div>
          </div>
        </SectionCard>
        ) : null}

        {showAcademicOverview || showNoticeHighlights ? (
        <div className="space-y-5">
          {showAcademicOverview ? (
          <SectionCard title="Academic Overview" subtitle="Timetable, attendance, and deadlines" onHide={() => hideWidget('academicOverview')}>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Link to="/timetable" className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4 hover:border-blue-200 hover:bg-blue-50 transition-colors">
                  <div className="flex items-center gap-2 text-blue-700"><FiCalendar size={16} /><span className="font-semibold">Timetable</span></div>
                  <p className="mt-2 text-sm text-gray-600">{workspace.timetable?.length || 0} upcoming class slots</p>
                </Link>
                <Link to="/attendance" className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4 hover:border-violet-200 hover:bg-violet-50 transition-colors">
                  <div className="flex items-center gap-2 text-violet-700"><FiUserCheck size={16} /><span className="font-semibold">Attendance</span></div>
                  <p className="mt-2 text-sm text-gray-600">{workspace.attendance?.attendanceRate || 0}% attendance pulse</p>
                </Link>
              </div>

              {(workspace.timetable || []).slice(0, 4).map((entry) => (
                <div key={entry._id} className="rounded-2xl border border-gray-100 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-gray-900">{entry.title}</p>
                      <p className="mt-1 text-sm text-gray-500">{entry.dayOfWeek} · {entry.startTime} - {entry.endTime}</p>
                    </div>
                    <span className="badge bg-blue-50 text-blue-700">{entry.room || 'Classroom'}</span>
                  </div>
                </div>
              ))}

              {workspace.attendance?.recentSessions?.length ? (
                <div className="rounded-2xl border border-gray-100 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-gray-400 font-semibold">Recent Attendance</p>
                  <div className="mt-3 space-y-2">
                    {workspace.attendance.recentSessions.slice(0, 3).map((session) => (
                      <div key={session._id} className="flex items-center justify-between gap-3 text-sm">
                        <div>
                          <p className="font-medium text-gray-900">{session.title}</p>
                          <p className="text-gray-500">{formatDate(session.date)}</p>
                        </div>
                        <span className={`badge ${
                          session.myRecord?.status === 'present' || session.myRecord?.status === 'late'
                            ? 'bg-emerald-50 text-emerald-700'
                            : session.myRecord?.status
                              ? 'bg-red-50 text-red-700'
                              : 'bg-slate-100 text-slate-600'
                        }`}>
                          {session.myRecord?.status || `${session.recordCount || 0} records`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </SectionCard>
          ) : null}

          {showNoticeHighlights ? (
          <SectionCard title="Notice Highlights" subtitle="Important updates from the university" onHide={() => hideWidget('noticeHighlights')}>
            {(workspace.notices || []).length === 0 ? (
              <EmptyState icon="📌" title="No notices right now" description="New announcements will appear here." />
            ) : (
              <div className="space-y-3">
                {(workspace.notices || []).slice(0, 3).map((notice) => (
                  <Link key={notice._id} to="/notice-board" className="block rounded-2xl border border-gray-100 p-4 hover:border-blue-200 hover:bg-blue-50 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900">{notice.title}</p>
                        <p className="mt-1 text-sm text-gray-500 line-clamp-2">{notice.description}</p>
                      </div>
                      <span className={`badge ${
                        notice.priority === 'high' ? 'bg-red-50 text-red-700' :
                        notice.priority === 'medium' ? 'bg-amber-50 text-amber-700' :
                        'bg-blue-50 text-blue-700'
                      }`}>
                        {notice.priority}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </SectionCard>
          ) : null}
        </div>
        ) : null}
      </div>
      ) : null}

      {lowerSectionCount > 0 ? (
      <div className={`grid gap-5 ${lowerSectionCount > 1 ? 'xl:grid-cols-[1.15fr,0.85fr]' : 'grid-cols-1'}`}>
        {showRecentActivity ? (
        <SectionCard title="Recent Activity" subtitle="Support, submissions, and live updates" onHide={() => hideWidget('recentActivity')}>
          {activityItems.length === 0 ? (
            <EmptyState icon="📬" title="No recent activity" description="Your recent support and notification history will appear here." />
          ) : (
            <div className="space-y-3">
              {activityItems.map((item) => (
                <Link key={item.id} to={item.link} className="flex items-start justify-between gap-3 rounded-2xl border border-gray-100 p-4 hover:border-blue-200 hover:bg-blue-50 transition-colors">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900">{item.title}</p>
                    <p className="mt-1 text-sm text-gray-500">{item.meta}</p>
                  </div>
                  {item.badge}
                </Link>
              ))}
            </div>
          )}
        </SectionCard>
        ) : null}

        {showHelpdeskSnapshot ? (
        <SectionCard
          title="Helpdesk Snapshot"
          subtitle="Track support flow and urgent actions"
          onHide={() => hideWidget('helpdeskSnapshot')}
          action={<Link to="/tickets" className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700 hover:text-blue-800">All Tickets <FiArrowRight size={14} /></Link>}
        >
          {(workspace.tickets || []).length === 0 ? (
            <EmptyState icon="🎫" title="No recent tickets" description="Create a support request whenever you need help." />
          ) : (
            <div className="space-y-3">
              {(workspace.tickets || []).map((ticket) => (
                <Link key={ticket._id} to={`/tickets/${ticket._id}`} className="block rounded-2xl border border-gray-100 p-4 hover:border-blue-200 hover:bg-blue-50 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900">{ticket.title}</p>
                      <p className="mt-1 text-sm text-gray-500">{ticket.ticketId} · {ticket.routingDepartment || ticket.category}</p>
                    </div>
                    <span className={`badge ${ticketTone(ticket)}`}>{ticket.status}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 text-xs text-gray-400">
                    <span>{formatRelative(ticket.createdAt)}</span>
                    <span>{ticket.assignedTo?.name || 'Awaiting assignee'}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </SectionCard>
        ) : null}
      </div>
      ) : null}
    </div>
  );
}
