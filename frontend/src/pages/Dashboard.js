import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  FiArrowRight,
  FiBookOpen,
  FiCalendar,
  FiList,
  FiMessageCircle,
  FiPlus,
  FiPlusCircle,
  FiSpeaker,
  FiTrash2,
  FiZap,
} from 'react-icons/fi';
import API from '../utils/api';
import { EmptyState, FullPageSpinner } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../context/PermissionContext';
import { getNotificationLink, useNotificationContext } from '../context/NotificationContext';
import { formatRelative } from '../utils/helpers';
import TodaysThought from '../components/dashboard/TodaysThought';

const TASKS_STORAGE_PREFIX = 'sharda-dashboard-tasks';

const createEmptyState = () => ({
  stats: {},
  notices: [],
  calendar: [],
  tickets: [],
  assignments: [],
});

const readTasks = (userId) => {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(`${TASKS_STORAGE_PREFIX}:${userId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const writeTasks = (userId, tasks) => {
  if (!userId) return;
  localStorage.setItem(`${TASKS_STORAGE_PREFIX}:${userId}`, JSON.stringify(tasks));
};

const getGreeting = (name) => {
  const hour = new Date().getHours();
  if (hour < 12) return `Good morning, ${name}`;
  if (hour < 17) return `Good afternoon, ${name}`;
  return `Good evening, ${name}`;
};

const getTicketTone = (ticket) => {
  if (!ticket) return { label: 'Open', tone: 'bg-slate-100 text-slate-700' };
  const priority = String(ticket.priority || '').toLowerCase();
  const status = String(ticket.status || '').toLowerCase();
  const createdAt = ticket.createdAt ? new Date(ticket.createdAt) : null;
  const ageHours = createdAt ? (Date.now() - createdAt.getTime()) / (1000 * 60 * 60) : 0;

  if (['resolved', 'closed'].includes(status)) return { label: 'Resolved', tone: 'bg-emerald-50 text-emerald-700' };
  if (priority === 'critical' || priority === 'high') return { label: 'Priority', tone: 'bg-red-50 text-red-700' };
  if (ageHours >= 48) return { label: 'Aging', tone: 'bg-amber-50 text-amber-700' };
  return { label: 'Active', tone: 'bg-blue-50 text-blue-700' };
};

const getAssignmentTone = (assignment, canManageAssignments) => {
  if (!assignment?.dueDate) return { label: 'Open', tone: 'bg-slate-100 text-slate-700' };
  const dueDate = new Date(assignment.dueDate);
  const now = new Date();
  const done = canManageAssignments
    ? (assignment.gradedCount || 0) >= (assignment.submissionCount || 0) && (assignment.submissionCount || 0) > 0
    : Boolean(assignment.mySubmission);

  if (done) return { label: 'Complete', tone: 'bg-emerald-50 text-emerald-700' };
  if (dueDate < now) return { label: 'Overdue', tone: 'bg-red-50 text-red-700' };
  if (dueDate.toDateString() === now.toDateString()) return { label: 'Due today', tone: 'bg-amber-50 text-amber-700' };
  if (dueDate.getTime() - now.getTime() <= 72 * 60 * 60 * 1000) return { label: 'Due soon', tone: 'bg-violet-50 text-violet-700' };
  return { label: 'Upcoming', tone: 'bg-blue-50 text-blue-700' };
};

const buildInsight = ({ role, tasks, tickets, notices, assignments, unreadCount, canManageAssignments }) => {
  const pendingTasks = tasks.filter((task) => task.status !== 'done').length;
  const overdueAssignments = assignments.filter((assignment) => getAssignmentTone(assignment, canManageAssignments).label === 'Overdue').length;
  const dueTodayAssignments = assignments.filter((assignment) => getAssignmentTone(assignment, canManageAssignments).label === 'Due today').length;
  const priorityTickets = tickets.filter((ticket) => getTicketTone(ticket).label === 'Priority').length;
  const activeTickets = tickets.filter((ticket) => !['resolved', 'closed'].includes(String(ticket.status || '').toLowerCase())).length;

  if (role === 'staff') {
    if (priorityTickets > 0) {
      return `${priorityTickets} high-priority ticket${priorityTickets > 1 ? 's need' : ' needs'} attention. Clearing urgent support work first will steady the queue.`;
    }
    if (activeTickets > 0) {
      return `${activeTickets} ticket${activeTickets > 1 ? 's are' : ' is'} still active. A quick follow-up can keep response times healthy.`;
    }
  }

  if (role === 'faculty') {
    if (overdueAssignments > 0) {
      return `${overdueAssignments} assignment${overdueAssignments > 1 ? 's are' : ' is'} past due. Reviewing those first will keep your course flow smooth.`;
    }
    if (dueTodayAssignments > 0) {
      return `${dueTodayAssignments} assignment${dueTodayAssignments > 1 ? 's are' : ' is'} due today. A timely check-in will help students stay aligned.`;
    }
  }

  if (role === 'admin') {
    if (priorityTickets > 0) {
      return `${priorityTickets} urgent support case${priorityTickets > 1 ? 's are' : ' is'} open. Reviewing them first will keep campus operations moving.`;
    }
    if (freshNoticeCount(notices) > 0) {
      return `${freshNoticeCount(notices)} recent notice${freshNoticeCount(notices) > 1 ? 's are' : ' is'} live. A quick scan helps you keep communications current.`;
    }
  }

  if (overdueAssignments > 0) {
    return `${overdueAssignments} assignment${overdueAssignments > 1 ? 's are' : ' is'} overdue. Start there before the rest of the board fills up.`;
  }
  if (dueTodayAssignments > 0) {
    return `${dueTodayAssignments} assignment${dueTodayAssignments > 1 ? 's are' : ' is'} due today. Finishing them early will keep the rest of your workspace lighter.`;
  }
  if (priorityTickets > 0) {
    return `${priorityTickets} support ticket${priorityTickets > 1 ? 's need' : ' needs'} fast attention. A quick reply now can prevent delays later.`;
  }
  if (pendingTasks > 0) {
    return `You have ${pendingTasks} personal task${pendingTasks > 1 ? 's' : ''} waiting. Knock out one small item to build momentum.`;
  }
  if (unreadCount > 0) {
    return `${unreadCount} update${unreadCount > 1 ? 's are' : ' is'} unread. Review notices and notifications before starting deep work.`;
  }
  if (notices.length > 0) {
    return `Fresh notices are available. Scan the top updates first so your day stays aligned with what changed.`;
  }
  return 'Everything is under control. Use this workspace to stay ahead instead of reacting late.';
};

const freshNoticeCount = (notices) => notices.length;

const getSummaryMeta = (role) => {
  if (role === 'faculty') {
    return {
      eyebrow: 'Teaching Summary',
      description: 'A quick read on coursework, notices, and student-facing activity.',
    };
  }

  if (role === 'staff') {
    return {
      eyebrow: 'Support Summary',
      description: 'A queue-first snapshot of tickets, updates, and operational work.',
    };
  }

  if (role === 'admin') {
    return {
      eyebrow: 'Operations Summary',
      description: 'A top-level pulse on campus updates, assignments, and support load.',
    };
  }

  return {
    eyebrow: 'Student Summary',
    description: 'A quick read on your tasks, deadlines, support, and campus updates.',
  };
};

const MetricCard = ({ label, value, tone }) => (
  <div className={`rounded-2xl border px-4 py-3 ${tone}`}>
    <p className="text-[11px] uppercase tracking-[0.18em] font-semibold opacity-70">{label}</p>
    <p className="font-display text-2xl font-black mt-1">{value}</p>
  </div>
);

const QuickLink = ({ to, icon: Icon, label }) => (
  <Link to={to} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-medium text-gray-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 transition-colors">
    <Icon size={15} />
    <span>{label}</span>
  </Link>
);

const Panel = ({ title, eyebrow, action, children }) => (
  <section className="card overflow-hidden">
    <div className="px-4 py-3.5 border-b border-gray-100 flex items-center justify-between gap-3">
      <div>
        {eyebrow ? <p className="text-[11px] uppercase tracking-[0.18em] text-gray-400 font-semibold">{eyebrow}</p> : null}
        <h2 className="font-display text-base font-bold text-gray-900">{title}</h2>
      </div>
      {action}
    </div>
    <div className="p-4">{children}</div>
  </section>
);

const TaskColumn = ({ title, hint, tasks, accent, emptyText, onComplete, onReopen, onDelete, allowDelete }) => (
  <div className={`rounded-3xl border ${accent}`}>
    <div className="px-4 py-3.5 border-b border-inherit flex items-center justify-between gap-3">
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-gray-400 font-semibold">{title}</p>
        <p className="text-sm text-gray-500 mt-1">{hint}</p>
      </div>
      <span className="badge bg-white/80 text-gray-700">{tasks.length}</span>
    </div>
    <div className="p-4 space-y-3 min-h-[230px]">
      {tasks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 p-4 text-sm text-gray-400 text-center">
          {emptyText}
        </div>
      ) : (
        tasks.map((task) => (
          <div key={task.id} className="rounded-2xl border border-white/70 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-gray-900">{task.title}</p>
                {task.meta ? <p className="text-sm text-gray-500 mt-1">{task.meta}</p> : null}
              </div>
              {allowDelete && task.kind === 'personal' ? (
                <button onClick={() => onDelete(task.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                  <FiTrash2 size={15} />
                </button>
              ) : null}
            </div>
            {task.description ? <p className="text-sm text-gray-600 mt-3 leading-6">{task.description}</p> : null}
            <div className="flex items-center justify-between gap-3 mt-4">
              <span className={`badge ${task.kind === 'assigned' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-700'}`}>
                {task.kind === 'assigned' ? 'Assigned' : 'Personal'}
              </span>
              {task.status === 'done' ? (
                <button onClick={() => onReopen(task)} className="text-xs font-semibold text-amber-600 hover:text-amber-700">Move back</button>
              ) : (
                <button onClick={() => onComplete(task)} className="text-xs font-semibold text-emerald-600 hover:text-emerald-700">Mark complete</button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  </div>
);

export default function Dashboard() {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const { notifications, unreadCount } = useNotificationContext();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(createEmptyState());
  const [tasks, setTasks] = useState([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskNote, setNewTaskNote] = useState('');

  const canSeeAssignments = ['student', 'faculty', 'admin'].includes(user?.role)
    || hasPermission('canManageAssignments')
    || hasPermission('canSubmitAssignments');
  const canManageAssignments = ['faculty', 'admin'].includes(user?.role) || hasPermission('canManageAssignments');

  useEffect(() => {
    setTasks(readTasks(user?._id));
  }, [user?._id]);

  useEffect(() => {
    writeTasks(user?._id, tasks);
  }, [tasks, user?._id]);

  useEffect(() => {
    let cancelled = false;

    const loadDashboard = async () => {
      setLoading(true);
      const results = await Promise.allSettled([
        API.get('/stats'),
        API.get('/content?view=feed&limit=4'),
        API.get('/academic-calendar?limit=4'),
        API.get('/tickets?limit=4'),
        canSeeAssignments ? API.get('/assignments?limit=6') : Promise.resolve({ data: { data: [] } }),
      ]);

      if (cancelled) return;

      const pick = (result, fallback) => (result.status === 'fulfilled' ? result.value.data.data || fallback : fallback);
      const [statsRes, noticesRes, calendarRes, ticketsRes, assignmentsRes] = results;
      const coreFailures = [statsRes, noticesRes, ticketsRes].filter((result) => result.status === 'rejected').length;

      setData({
        stats: pick(statsRes, {}),
        notices: pick(noticesRes, []),
        calendar: pick(calendarRes, []),
        tickets: pick(ticketsRes, []),
        assignments: pick(assignmentsRes, []),
      });

      if (coreFailures === 3) {
        toast.error('Dashboard data is temporarily unavailable. Please refresh in a moment.');
      }
      setLoading(false);
    };

    loadDashboard();
    return () => { cancelled = true; };
  }, [canSeeAssignments]);

  const boardTasks = useMemo(() => {
    const assignedTasks = (data.assignments || []).map((assignment) => {
      const done = canManageAssignments
        ? (assignment.gradedCount || 0) >= (assignment.submissionCount || 0) && (assignment.submissionCount || 0) > 0
        : Boolean(assignment.mySubmission);

      return {
        id: `assigned-${assignment._id}`,
        kind: 'assigned',
        status: done ? 'done' : 'assigned',
        title: assignment.title,
        description: assignment.subject || '',
        meta: canManageAssignments
          ? `${assignment.submissionCount || 0} submissions · due ${formatRelative(assignment.dueDate)}`
          : `${assignment.subject || 'General'} · due ${formatRelative(assignment.dueDate)}`,
      };
    });

    const personalTasks = tasks.map((task) => ({
      ...task,
      kind: 'personal',
      meta: task.note || 'Personal task',
    }));

    return {
      assigned: assignedTasks.filter((task) => task.status === 'assigned'),
      todo: personalTasks.filter((task) => task.status === 'todo'),
      completed: [
        ...assignedTasks.filter((task) => task.status === 'done'),
        ...personalTasks.filter((task) => task.status === 'done'),
      ],
    };
  }, [canManageAssignments, data.assignments, tasks]);

  const summary = useMemo(() => ({
    pendingTasks: boardTasks.todo.length + boardTasks.assigned.length,
    activeTickets: data.stats?.openTickets || 0,
    newNotices: data.notices.length,
    unreadUpdates: unreadCount,
  }), [boardTasks, data.stats, data.notices.length, unreadCount]);

  const insight = useMemo(() => buildInsight({
    role: user?.role,
    tasks,
    tickets: data.tickets,
    notices: data.notices,
    assignments: data.assignments,
    unreadCount,
    canManageAssignments,
  }), [user?.role, tasks, data.tickets, data.notices, data.assignments, unreadCount, canManageAssignments]);

  const summaryMeta = useMemo(() => getSummaryMeta(user?.role), [user?.role]);

  const activityItems = useMemo(() => {
    const ticketItems = data.tickets.map((ticket) => ({
      id: `ticket-${ticket._id}`,
      title: ticket.title,
      meta: `${ticket.ticketId} · ${formatRelative(ticket.createdAt)}`,
      createdAt: ticket.createdAt,
      link: `/tickets/${ticket._id}`,
      badge: <span className={`badge ${getTicketTone(ticket).tone}`}>{getTicketTone(ticket).label}</span>,
      icon: <FiList size={16} />,
    }));

    const notificationItems = notifications.slice(0, 4).map((notification) => ({
      id: `notification-${notification.id}`,
      title: notification.title,
      meta: `${notification.body} · ${formatRelative(notification.timestamp)}`,
      createdAt: notification.timestamp,
      link: getNotificationLink(notification),
      badge: !notification.read ? <span className="badge bg-blue-50 text-blue-700">New</span> : <span className="badge bg-slate-100 text-slate-600">Seen</span>,
      icon: <FiZap size={16} />,
    }));

    return [...ticketItems, ...notificationItems]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 6);
  }, [data.tickets, notifications]);

  const addTask = (event) => {
    event.preventDefault();
    if (!newTaskTitle.trim()) return;

    setTasks((prev) => [
      {
        id: `local-${Date.now()}`,
        title: newTaskTitle.trim(),
        note: newTaskNote.trim(),
        status: 'todo',
      },
      ...prev,
    ]);
    setNewTaskTitle('');
    setNewTaskNote('');
  };

  const updateTaskStatus = (taskId, status) => {
    setTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, status } : task)));
  };

  const removeTask = (taskId) => {
    setTasks((prev) => prev.filter((task) => task.id !== taskId));
  };

  if (loading) return <FullPageSpinner />;

  return (
    <div className="space-y-5">
      <TodaysThought />

      <section className="rounded-3xl border border-blue-100 bg-gradient-to-r from-blue-50 via-white to-emerald-50 px-4 py-3.5 flex items-start gap-3">
        <div className="w-10 h-10 rounded-2xl bg-white text-blue-700 shadow-sm flex items-center justify-center flex-shrink-0">
          <FiZap size={18} />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.18em] text-blue-500 font-semibold">{summaryMeta.eyebrow}</p>
          <p className="text-sm sm:text-[15px] text-gray-700 leading-7 mt-1">{insight}</p>
          <p className="text-xs text-gray-500 mt-2">{summaryMeta.description}</p>
        </div>
      </section>

      <section className="card p-4 sm:p-5">
        <div className="grid xl:grid-cols-[1.2fr,0.8fr] gap-4 items-start">
          <div className="space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div>
                <p className="text-sm text-gray-500">{getGreeting(user?.name || 'there')}</p>
                <h1 className="font-display text-2xl font-bold text-gray-900">Workspace</h1>
                <p className="text-sm text-gray-500 mt-1">A fast, reliable control center for tasks, support, and campus updates.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {canSeeAssignments ? <QuickLink to="/assignments" icon={FiBookOpen} label={canManageAssignments ? 'Assignments' : 'My Work'} /> : null}
                <QuickLink to="/tickets/new" icon={FiPlusCircle} label="Create Ticket" />
                <QuickLink to="/group-chat" icon={FiMessageCircle} label="Open Chat" />
                <QuickLink to="/notice-board" icon={FiSpeaker} label="Notice Board" />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
              <MetricCard label="Pending Tasks" value={summary.pendingTasks} tone="border-blue-100 bg-blue-50/70 text-blue-900" />
              <MetricCard label="Active Tickets" value={summary.activeTickets} tone="border-amber-100 bg-amber-50/70 text-amber-900" />
              <MetricCard label="New Notices" value={summary.newNotices} tone="border-emerald-100 bg-emerald-50/70 text-emerald-900" />
              <MetricCard label="Unread Updates" value={summary.unreadUpdates} tone="border-violet-100 bg-violet-50/70 text-violet-900" />
            </div>
          </div>

          <div className="rounded-3xl border border-gray-100 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-gray-400 font-semibold">Workspace Health</p>
                <p className="text-sm text-gray-600 mt-1">Your workload at a glance.</p>
              </div>
              <span className="badge bg-white text-slate-700 border border-slate-200">
                {summary.pendingTasks === 0 && summary.activeTickets === 0 ? 'Clear' : 'In motion'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-4 text-center">
              <div className="rounded-2xl bg-white border border-gray-100 px-3 py-3">
                <p className="text-xl font-black text-gray-900">{boardTasks.completed.length}</p>
                <p className="text-xs text-gray-500 mt-1">Completed</p>
              </div>
              <div className="rounded-2xl bg-white border border-gray-100 px-3 py-3">
                <p className="text-xl font-black text-gray-900">{data.assignments.length}</p>
                <p className="text-xs text-gray-500 mt-1">Coursework</p>
              </div>
              <div className="rounded-2xl bg-white border border-gray-100 px-3 py-3">
                <p className="text-xl font-black text-gray-900">{data.calendar.length}</p>
                <p className="text-xs text-gray-500 mt-1">Upcoming</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid xl:grid-cols-[1.4fr,1fr] gap-5">
        <Panel
          title="Focus Board"
          eyebrow="Productivity"
          action={<span className="text-xs font-semibold text-gray-500">Assigned work + personal todo</span>}
        >
          <div className="grid lg:grid-cols-[1.05fr,1fr,1fr] gap-4">
            <div className="space-y-4">
              <form onSubmit={addTask} className="rounded-3xl border border-gray-100 bg-slate-50 p-4 space-y-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-gray-400 font-semibold">Add Personal Task</p>
                  <h3 className="font-semibold text-gray-900 mt-1">Keep small commitments visible</h3>
                </div>
                <input className="input" value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} placeholder="Prepare project review notes" />
                <textarea className="input resize-none" rows={3} value={newTaskNote} onChange={(e) => setNewTaskNote(e.target.value)} placeholder="Optional note or context..." />
                <button type="submit" className="btn-primary w-full justify-center">
                  <FiPlus size={14} /> Add Task
                </button>
              </form>

              <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-emerald-500 font-semibold">Momentum</p>
                <p className="font-semibold text-emerald-900 mt-2">
                  {boardTasks.completed.length > 0
                    ? `${boardTasks.completed.length} item${boardTasks.completed.length > 1 ? 's are' : ' is'} already complete. Keep the streak going.`
                    : 'Nothing completed yet today. Finishing one small task will make the rest of the board feel lighter.'}
                </p>
              </div>
            </div>

            <TaskColumn
              title="Assigned Tasks"
              hint={canManageAssignments ? 'Coursework and submissions needing attention' : 'Work assigned to you'}
              tasks={boardTasks.assigned}
              accent="border-blue-200 bg-blue-50"
              emptyText={canSeeAssignments ? 'No open assigned work right now.' : 'Assignments are not enabled for this role.'}
              onComplete={() => {}}
              onReopen={() => {}}
              onDelete={() => {}}
              allowDelete={false}
            />

            <div className="space-y-4">
              <TaskColumn
                title="Personal Todo"
                hint="Saved locally for this account"
                tasks={boardTasks.todo}
                accent="border-slate-200 bg-slate-50"
                emptyText="Add a task to build your own working list."
                onComplete={(task) => updateTaskStatus(task.id, 'done')}
                onReopen={(task) => updateTaskStatus(task.id, 'todo')}
                onDelete={removeTask}
                allowDelete
              />
              <TaskColumn
                title="Completed"
                hint="Finished personal or assigned work"
                tasks={boardTasks.completed}
                accent="border-emerald-200 bg-emerald-50"
                emptyText="Completed items will collect here."
                onComplete={() => {}}
                onReopen={(task) => {
                  if (task.kind === 'personal') updateTaskStatus(task.id, 'todo');
                }}
                onDelete={removeTask}
                allowDelete
              />
            </div>
          </div>
        </Panel>

        <div className="space-y-5">
          <Panel title="Activity Panel" eyebrow="Awareness">
            <div className="space-y-3">
              {activityItems.length > 0 ? (
                activityItems.map((item) => (
                  <Link key={item.id} to={item.link} className="flex items-start gap-3 rounded-2xl border border-gray-100 px-3.5 py-3 hover:bg-gray-50 transition-colors">
                    <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center flex-shrink-0">
                      {item.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold text-gray-900 truncate">{item.title}</p>
                        {item.badge}
                      </div>
                      <p className="text-sm text-gray-500 mt-1 truncate">{item.meta}</p>
                    </div>
                  </Link>
                ))
              ) : (
                <EmptyState icon="📬" title="No recent activity" description="Tickets and notifications will appear here once work starts moving." />
              )}
            </div>
          </Panel>

          <Panel
            title="Notice Highlights"
            eyebrow="Updates"
            action={<Link to="/notice-board" className="text-xs font-semibold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1">Open board <FiArrowRight size={12} /></Link>}
          >
            <div className="space-y-3">
              {data.notices.length > 0 ? (
                data.notices.map((notice) => (
                  <div key={notice._id} className="rounded-2xl border border-gray-100 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-gray-900 truncate">{notice.title}</p>
                      <span className={`badge ${notice.priority === 'high' ? 'bg-red-50 text-red-700' : notice.priority === 'medium' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>
                        {notice.priority}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">{notice.description}</p>
                    <p className="text-xs text-gray-400 mt-2">{formatRelative(notice.createdAt)}</p>
                  </div>
                ))
              ) : (
                <EmptyState icon="📢" title="No notices yet" description="Important campus updates will show up here." />
              )}
            </div>
          </Panel>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <Panel
          title={canManageAssignments ? 'Coursework Pulse' : 'Assigned Work'}
          eyebrow="Deadlines"
          action={canSeeAssignments ? <Link to="/assignments" className="text-xs font-semibold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1">Open assignments <FiArrowRight size={12} /></Link> : null}
        >
          {canSeeAssignments ? (
            data.assignments.length > 0 ? (
              <div className="space-y-3">
                {data.assignments.slice(0, 4).map((assignment) => (
                  <Link key={assignment._id} to={`/assignments/${assignment._id}`} className="flex items-center gap-3 rounded-2xl border border-gray-100 px-4 py-3 hover:bg-gray-50 transition-colors">
                    <div className="w-10 h-10 rounded-2xl bg-violet-50 text-violet-700 flex items-center justify-center flex-shrink-0">
                      <FiBookOpen size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{assignment.title}</p>
                      <p className="text-sm text-gray-500 truncate">{assignment.subject || 'General'} · due {formatRelative(assignment.dueDate)}</p>
                    </div>
                    <span className={`badge ${getAssignmentTone(assignment, canManageAssignments).tone}`}>
                      {getAssignmentTone(assignment, canManageAssignments).label}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState icon="📘" title="No assignment pressure right now" description="Relevant coursework will appear here as soon as it is published." />
            )
          ) : (
            <EmptyState icon="📘" title="Assignments not enabled" description="This role does not currently have assignment access." />
          )}
        </Panel>

        <Panel
          title="Upcoming Calendar"
          eyebrow="Deadlines"
          action={<Link to="/academic-calendar" className="text-xs font-semibold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1">Open calendar <FiArrowRight size={12} /></Link>}
        >
          {data.calendar.length > 0 ? (
            <div className="space-y-3">
              {data.calendar.map((item) => (
                <div key={item._id} className="flex items-center gap-3 rounded-2xl border border-gray-100 px-4 py-3">
                  <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0">
                    <FiCalendar size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{item.title}</p>
                    <p className="text-sm text-gray-500">{formatRelative(item.date)}</p>
                  </div>
                  <span className="badge bg-rose-50 text-rose-700">{item.type}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon="📅" title="No upcoming academic dates" description="Important exams, holidays, and deadlines will appear here." />
          )}
        </Panel>
      </div>
    </div>
  );
}
