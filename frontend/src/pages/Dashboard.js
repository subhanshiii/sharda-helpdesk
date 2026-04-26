import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  FiArrowRight,
  FiCalendar,
  FiCheck,
  FiCircle,
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

const ReminderList = ({ tasks, emptyText, onToggle, onDelete, editingTaskId, editingTitle, onStartEdit, onEditChange, onEditSave, onEditCancel }) => (
  <div className="dashboard-reminder-list">
    {tasks.length === 0 ? (
      <div className="dashboard-empty-state rounded-2xl border border-dashed border-gray-200 p-5 text-center text-sm text-gray-400">
        {emptyText}
      </div>
    ) : (
      tasks.map((task) => (
        <div key={task.id} className={`dashboard-reminder-item flex items-start gap-3 rounded-2xl border border-gray-100 px-4 py-3 ${task.status === 'done' ? 'is-complete' : ''}`}>
          <button
            type="button"
            onClick={() => onToggle(task)}
            className={`dashboard-reminder-check inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border transition-colors ${
              task.status === 'done'
                ? 'border-emerald-200 bg-emerald-500 text-white'
                : 'border-gray-300 bg-white text-transparent hover:border-emerald-300'
            }`}
            aria-label={task.status === 'done' ? 'Mark as incomplete' : 'Mark as complete'}
          >
            {task.status === 'done' ? <FiCheck size={14} /> : <FiCircle size={12} />}
          </button>
          <div className="min-w-0 flex-1">
            {editingTaskId === task.id ? (
              <input
                className="dashboard-reminder-input input h-9 min-h-0 px-3 py-2 text-sm"
                value={editingTitle}
                onChange={(event) => onEditChange(event.target.value)}
                onBlur={() => onEditSave(task)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    onEditSave(task);
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    onEditCancel();
                  }
                }}
                autoFocus
              />
            ) : (
              <button
                type="button"
                onClick={() => onStartEdit(task)}
                className={`dashboard-reminder-title block w-full text-left text-sm font-medium text-gray-900 ${task.status === 'done' ? 'line-through opacity-60' : ''}`}
              >
                {task.title}
              </button>
            )}
            {task.note ? <p className={`dashboard-reminder-note mt-1 text-xs text-gray-500 ${task.status === 'done' ? 'opacity-60' : ''}`}>{task.note}</p> : null}
          </div>
          <button type="button" onClick={() => onDelete(task.id)} className="dashboard-icon-button dashboard-reminder-delete mt-0.5 text-gray-300 hover:text-red-500 transition-colors">
            <FiTrash2 size={15} />
          </button>
        </div>
      ))
    )}
  </div>
);

const SectionCard = ({ title, subtitle, action, onHide, children }) => (
  <section className="dashboard-panel dashboard-section-card overflow-hidden h-full">
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
    <div className="dashboard-panel-body p-5">{children}</div>
  </section>
);

export default function Dashboard() {
  const { user } = useAuth();
  const { notifications, unreadCount } = useNotificationContext();

  const [loading, setLoading] = useState(true);
  const [workspace, setWorkspace] = useState(createEmptyWorkspace());
  const [error, setError] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [savingTask, setSavingTask] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState('');
  const [editingTaskTitle, setEditingTaskTitle] = useState('');
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
        note: '',
      });
      setWorkspace((current) => ({
        ...current,
        personalTasks: [res.data?.data, ...(current.personalTasks || [])],
      }));
      setNewTaskTitle('');
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

  const saveTaskTitle = async (task, nextTitle) => {
    const trimmedTitle = nextTitle.trim();
    if (!trimmedTitle || trimmedTitle === task.title) {
      setEditingTaskId('');
      setEditingTaskTitle('');
      return;
    }

    try {
      const res = await API.put(`/dashboard/tasks/${task.id}`, { title: trimmedTitle });
      setWorkspace((current) => ({
        ...current,
        personalTasks: (current.personalTasks || []).map((entry) => (
          entry.id === task.id ? res.data?.data : entry
        )),
      }));
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || 'Failed to update task');
    } finally {
      setEditingTaskId('');
      setEditingTaskTitle('');
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
    <div className="dashboard-shell space-y-6 px-4 sm:px-6 lg:px-8">
      <TodaysThought />

      {hiddenWidgets.length ? (
        <section className="dashboard-hidden-bar rounded-2xl border border-dashed border-gray-200 bg-white px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="dashboard-eyebrow">Hidden Sections</span>
            {hiddenWidgets.map((widgetKey) => (
              <button
                key={widgetKey}
                type="button"
                onClick={() => showWidget(widgetKey)}
                className="dashboard-chip inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200"
              >
                <FiEye size={12} />
                {hiddenWidgetLabels[widgetKey] || widgetKey}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {isWidgetVisible('dailyFocus') && workspace.dailyInsight?.message ? (
        <section className="dashboard-focus-card rounded-3xl border border-blue-100 bg-gradient-to-r from-blue-50 via-white to-emerald-50 px-5 py-4 flex items-start gap-4">
          <div className="dashboard-focus-icon w-11 h-11 rounded-2xl bg-white text-blue-700 shadow-sm flex items-center justify-center flex-shrink-0">
            <FiZap size={18} />
          </div>
          <div className="min-w-0">
            <p className="dashboard-focus-title dashboard-eyebrow text-blue-500">Daily Focus</p>
            <p className="dashboard-focus-body mt-1 text-sm sm:text-[15px] text-gray-700 leading-7">{workspace.dailyInsight.message}</p>
          </div>
          <div className="ml-auto flex flex-shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => hideWidget('dailyFocus')}
              className="dashboard-chip inline-flex items-center gap-1 rounded-full border border-blue-100 bg-white px-3 py-1.5 text-xs font-semibold text-blue-600 hover:border-blue-200 hover:text-blue-700"
            >
              <FiEyeOff size={12} />
              Hide
            </button>
          </div>
        </section>
      ) : null}

      {error ? <Alert type="warning" message={error} /> : null}

      <section className="dashboard-panel p-5 sm:p-6">
        <div className={`grid gap-5 items-stretch ${showAcademicSnapshot ? 'xl:grid-cols-[minmax(0,1.4fr),minmax(320px,0.82fr)]' : 'grid-cols-1'}`}>
          <div className="space-y-5">
            <div className="dashboard-hero flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
              <div>
                <p className="dashboard-subtitle text-sm text-gray-500">{getGreeting(user?.name || 'there')}</p>
                <p className="dashboard-page-title mt-1 font-display text-2xl font-bold text-gray-900">Academic progress, support, and campus updates from one workspace.</p>
                <p className="dashboard-subtitle text-sm text-gray-500 mt-2">Use this unified view to stay on top of priorities, support tasks, and campus activity.</p>
              </div>
              <div className="dashboard-action-row flex flex-wrap justify-start gap-3 max-[600px]:flex-col">
                <Link to="/tickets/new" className="dashboard-action-button btn-primary justify-center rounded-lg px-5 py-2.5 text-sm"><FiPlusCircle size={15} /> Create Ticket</Link>
                <Link to="/group-chat" className="dashboard-action-button btn-secondary justify-center rounded-lg px-5 py-2.5 text-sm"><FiMessageCircle size={15} /> Open Chat</Link>
                <Link to="/notice-board" className="dashboard-action-button btn-secondary justify-center rounded-lg px-5 py-2.5 text-sm"><FiSpeaker size={15} /> View Notices</Link>
              </div>
            </div>

            <div className="dashboard-stats-grid grid [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))] gap-5 items-start">
              <div className="dashboard-stat-card rounded-[12px] border border-gray-100 bg-gray-50 p-5 h-full">
                <div className="flex items-start justify-between gap-3">
                  <p className="dashboard-stat-title text-base font-medium text-gray-900">Pending Tasks</p>
                </div>
                <p className="dashboard-stat-value font-display text-2xl font-black text-blue-900 mt-3">{stats.pendingTasks}</p>
                <p className="dashboard-stat-copy mt-3 text-sm text-gray-500">Personal reminders waiting for action.</p>
              </div>
              <div className="dashboard-stat-card rounded-[12px] border border-gray-100 bg-gray-50 p-5 h-full">
                <div className="flex items-start justify-between gap-3">
                  <p className="dashboard-stat-title text-base font-medium text-gray-900">Active Tickets</p>
                </div>
                <p className="dashboard-stat-value font-display text-2xl font-black text-amber-900 mt-3">{stats.activeTickets}</p>
                <p className="dashboard-stat-copy mt-3 text-sm text-gray-500">Current support issues that are still open or in progress.</p>
              </div>
              <div className="dashboard-stat-card rounded-[12px] border border-gray-100 bg-gray-50 p-5 h-full">
                <div className="flex items-start justify-between gap-3">
                  <p className="dashboard-stat-title text-base font-medium text-gray-900">Notice Highlights</p>
                </div>
                <p className="dashboard-stat-value font-display text-2xl font-black text-emerald-900 mt-3">{stats.newNotices}</p>
                <p className="dashboard-stat-copy mt-3 text-sm text-gray-500">Important campus updates currently highlighted in the notice board.</p>
              </div>
              <div className="dashboard-stat-card rounded-[12px] border border-gray-100 bg-gray-50 p-5 h-full">
                <div className="flex items-start justify-between gap-3">
                  <p className="dashboard-stat-title text-base font-medium text-gray-900">Attendance</p>
                </div>
                <p className="dashboard-stat-value font-display text-2xl font-black text-violet-900 mt-3">{stats.attendanceRate}%</p>
                <p className="dashboard-stat-copy mt-3 text-sm text-gray-500">Latest attendance percentage captured from recent section sessions.</p>
              </div>
            </div>
          </div>

          {showAcademicSnapshot ? (
            <div className="dashboard-panel dashboard-academic-snapshot rounded-3xl border border-gray-100 bg-slate-50 p-5 h-full">
              <div className="flex items-center justify-between gap-2">
                <p className="dashboard-eyebrow">Academic Snapshot</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => hideWidget('academicSnapshot')}
                    className="dashboard-chip inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-500 hover:border-gray-300 hover:text-gray-700"
                  >
                    <FiEyeOff size={12} />
                    Hide
                  </button>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-3 text-center">
                <div className="dashboard-mini-stat rounded-2xl border border-gray-100 bg-white px-3 py-4">
                  <p className="text-xl font-black text-gray-900">{workspace.assignments?.length || 0}</p>
                  <p className="text-xs text-gray-500 mt-1">Assignments</p>
                </div>
                <div className="dashboard-mini-stat rounded-2xl border border-gray-100 bg-white px-3 py-4">
                  <p className="text-xl font-black text-gray-900">{workspace.timetable?.length || 0}</p>
                  <p className="text-xs text-gray-500 mt-1">Classes</p>
                </div>
                <div className="dashboard-mini-stat rounded-2xl border border-gray-100 bg-white px-3 py-4">
                  <p className="text-xl font-black text-gray-900">{unreadCount}</p>
                  <p className="text-xs text-gray-500 mt-1">Unread</p>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {middleSectionCount > 0 ? (
      <div className={`dashboard-content-grid grid gap-5 items-start ${middleSectionCount > 1 ? 'xl:grid-cols-[minmax(0,1.35fr),minmax(340px,1fr)]' : 'grid-cols-1'}`}>
        {showProductivityBoard ? (
        <SectionCard title="Productivity Board" subtitle="Simple reminders for the day" onHide={() => hideWidget('productivityBoard')}>
          <div className="dashboard-reminder-shell space-y-4">
            <form onSubmit={createTask} className="dashboard-reminder-form flex flex-col gap-3 rounded-2xl border border-gray-100 bg-slate-50 p-4 sm:flex-row sm:items-center">
              <input className="input flex-1" value={newTaskTitle} onChange={(event) => setNewTaskTitle(event.target.value)} placeholder="Add a reminder" />
              <button type="submit" disabled={savingTask} className="btn-primary min-w-[124px] justify-center">
                <FiPlus size={14} /> {savingTask ? 'Saving...' : 'Add'}
              </button>
            </form>

            <div className="dashboard-panel-secondary dashboard-reminder-panel rounded-3xl border border-gray-100 bg-slate-50 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="dashboard-eyebrow">Your List</p>
                  <p className="dashboard-subtitle mt-1">Quick reminders that stay in place as you update them.</p>
                </div>
                <span className="dashboard-chip inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-600">
                  {board.active.length} open
                </span>
              </div>
              <ReminderList
                tasks={workspace.personalTasks || []}
                emptyText="No reminders yet. Add one above to get started."
                onToggle={(task) => updateTask(task, task.status === 'done' ? 'todo' : 'done')}
                onDelete={deleteTask}
                editingTaskId={editingTaskId}
                editingTitle={editingTaskTitle}
                onStartEdit={(task) => {
                  setEditingTaskId(task.id);
                  setEditingTaskTitle(task.title);
                }}
                onEditChange={setEditingTaskTitle}
                onEditSave={(task) => saveTaskTitle(task, editingTaskTitle)}
                onEditCancel={() => {
                  setEditingTaskId('');
                  setEditingTaskTitle('');
                }}
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
                <Link to="/timetable" className="dashboard-link-card rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4 hover:border-blue-200 hover:bg-blue-50 transition-colors">
                  <div className="flex items-center gap-2 text-blue-700"><FiCalendar size={16} /><span className="font-semibold">Timetable</span></div>
                  <p className="mt-2 text-sm text-gray-600">{workspace.timetable?.length || 0} upcoming class slots</p>
                </Link>
                <Link to="/attendance" className="dashboard-link-card rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4 hover:border-violet-200 hover:bg-violet-50 transition-colors">
                  <div className="flex items-center gap-2 text-violet-700"><FiUserCheck size={16} /><span className="font-semibold">Attendance</span></div>
                  <p className="mt-2 text-sm text-gray-600">{workspace.attendance?.attendanceRate || 0}% attendance pulse</p>
                </Link>
              </div>

              {(workspace.timetable || []).slice(0, 4).map((entry) => (
                <div key={entry._id} className="dashboard-item-card rounded-2xl border border-gray-100 px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="dashboard-item-title font-semibold text-gray-900">{entry.title}</p>
                      <p className="dashboard-item-meta mt-1 text-sm text-gray-500">{entry.dayOfWeek} · {entry.startTime} - {entry.endTime}</p>
                    </div>
                    <span className="badge bg-blue-50 text-blue-700">{entry.room || 'Classroom'}</span>
                  </div>
                </div>
              ))}

            </div>
          </SectionCard>
          ) : null}

          {showNoticeHighlights ? (
          <SectionCard title="Notice Highlights" subtitle="Important updates from the university" onHide={() => hideWidget('noticeHighlights')}>
            {(workspace.notices || []).length === 0 ? (
              <EmptyState icon="📌" title="No notices right now" description="New announcements will appear here." />
            ) : (
              <div className="dashboard-notice-list">
                {(workspace.notices || []).slice(0, 3).map((notice) => (
                  <Link key={notice._id} to="/notice-board" className="dashboard-notice-item dashboard-link-card block rounded-2xl border border-gray-100 p-4 hover:border-blue-200 hover:bg-blue-50 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="dashboard-item-title font-semibold text-gray-900">{notice.title}</p>
                        </div>
                        <p className="dashboard-item-meta mt-2 text-sm text-gray-500">{notice.description}</p>
                        <p className="mt-3 text-xs font-medium uppercase tracking-[0.14em] text-gray-400">{formatDate(notice.createdAt || notice.publishDate || notice.updatedAt)}</p>
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
      <div className={`dashboard-content-grid grid gap-5 items-start ${lowerSectionCount > 1 ? 'xl:grid-cols-[minmax(0,1.15fr),minmax(320px,0.85fr)]' : 'grid-cols-1'}`}>
        {showRecentActivity ? (
        <SectionCard title="Recent Activity" subtitle="Support, submissions, and live updates" onHide={() => hideWidget('recentActivity')}>
          {activityItems.length === 0 ? (
            <EmptyState icon="📬" title="No recent activity" description="Your recent support and notification history will appear here." />
          ) : (
            <div className="space-y-3">
              {activityItems.slice(0, 4).map((item) => (
                <Link key={item.id} to={item.link} className="dashboard-link-card flex items-start justify-between gap-3 rounded-2xl border border-gray-100 p-4 hover:border-blue-200 hover:bg-blue-50 transition-colors">
                  <div className="min-w-0">
                    <p className="dashboard-item-title font-semibold text-gray-900">{item.title}</p>
                    <p className="dashboard-item-meta mt-1 text-sm text-gray-500">{item.meta}</p>
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
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="dashboard-mini-stat rounded-2xl border border-gray-100 bg-white px-3 py-3 text-center">
                  <p className="text-lg font-black text-gray-900">{(workspace.tickets || []).filter((ticket) => ['Open', 'In Progress'].includes(ticket.status)).length}</p>
                  <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.14em] text-gray-500">Open</p>
                </div>
                <div className="dashboard-mini-stat rounded-2xl border border-gray-100 bg-white px-3 py-3 text-center">
                  <p className="text-lg font-black text-gray-900">{(workspace.tickets || []).filter((ticket) => ticket.assignedTo?.name).length}</p>
                  <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.14em] text-gray-500">Assigned</p>
                </div>
                <div className="dashboard-mini-stat rounded-2xl border border-gray-100 bg-white px-3 py-3 text-center">
                  <p className="text-lg font-black text-gray-900">{(workspace.tickets || []).filter((ticket) => ticket.priority === 'High' || ticket.priority === 'Critical').length}</p>
                  <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.14em] text-gray-500">Priority</p>
                </div>
              </div>
              {(workspace.tickets || []).slice(0, 4).map((ticket) => (
                <Link key={ticket._id} to={`/tickets/${ticket._id}`} className="dashboard-helpdesk-ticket dashboard-link-card block rounded-2xl border border-gray-100 p-4 hover:border-blue-200 hover:bg-blue-50 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="dashboard-item-title font-semibold text-gray-900">{ticket.title}</p>
                        <span className={`badge ${ticketTone(ticket)}`}>{ticket.status}</span>
                      </div>
                      <p className="dashboard-item-meta text-sm text-gray-500">{ticket.ticketId} · {ticket.routingDepartment || ticket.category}</p>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
                        <span>{formatRelative(ticket.createdAt)}</span>
                        <span>{ticket.assignedTo?.name || 'Awaiting assignee'}</span>
                        {ticket.priority ? <span>{ticket.priority} priority</span> : null}
                      </div>
                    </div>
                    <FiArrowRight size={15} className="mt-1 shrink-0 text-gray-300" />
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
