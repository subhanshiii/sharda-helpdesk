const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');
const Ticket = require('../models/Ticket');
const DashboardPreference = require('../models/DashboardPreference');
const { listAssignments } = require('./assignmentService');
const { listContent } = require('./contentService');
const { getStats } = require('./statsService');
const { generateDashboardInsight } = require('./aiService');
const { isAdminRole, isSupportRole } = require('../utils/roleHelpers');

const DEFAULT_WIDGET_PREFERENCES = {
  hidden: [],
  pinned: [],
};

const getDashboardPreferenceDoc = async (userId) => DashboardPreference.findOneAndUpdate(
  { user: userId },
  { $setOnInsert: { user: userId, widgetPreferences: DEFAULT_WIDGET_PREFERENCES } },
  { new: true, upsert: true, setDefaultsOnInsert: true }
);

const getRecentTickets = async (user) => {
  const query = {};

  if (isAdminRole(user.role)) {
    // admins can see everything
  } else if (isSupportRole(user.role)) {
    query.$or = [{ assignedTo: user.id }, { assignedTo: null }];
  } else {
    query.user = user.id;
  }

  return Ticket.find(query)
    .sort({ createdAt: -1 })
    .limit(4)
    .lean();
};

const getRecentSubmissions = async (user) => {
  if (user.role === 'student') {
    const submissions = await Submission.find({ student: user.id })
      .populate('assignment', 'title subject dueDate')
      .sort({ submittedAt: -1 })
      .limit(4)
      .lean();

    return submissions.map((submission) => ({
      _id: submission._id,
      type: 'submission',
      title: submission.assignment?.title || 'Assignment submission',
      meta: `${submission.assignment?.subject || 'General'} · ${submission.status}`,
      createdAt: submission.submittedAt,
      link: submission.assignment?._id ? `/assignments/${submission.assignment._id}` : '/assignments',
    }));
  }

  if (user.role === 'faculty' || isAdminRole(user.role)) {
    let assignmentIds = [];

    if (isAdminRole(user.role)) {
      assignmentIds = await Assignment.find().distinct('_id');
    } else {
      assignmentIds = await Assignment.find({ createdBy: user.id }).distinct('_id');
    }

    if (!assignmentIds.length) return [];

    const submissions = await Submission.find({ assignment: { $in: assignmentIds } })
      .populate('student', 'name')
      .populate('assignment', 'title subject dueDate')
      .sort({ submittedAt: -1 })
      .limit(4)
      .lean();

    return submissions.map((submission) => ({
      _id: submission._id,
      type: 'submission',
      title: submission.assignment?.title || 'Assignment submission',
      meta: `${submission.student?.name || 'Student'} · ${submission.status}`,
      createdAt: submission.submittedAt,
      link: submission.assignment?._id ? `/assignments/${submission.assignment._id}` : '/assignments',
    }));
  }

  return [];
};

const buildInsightContext = ({ user, personalTasks, stats, notices, assignments }) => {
  const now = new Date();
  const pendingPersonalTasks = personalTasks.filter((task) => task.status !== 'done').length;
  const overdueAssignments = assignments.filter((assignment) => {
    if (!assignment?.dueDate) return false;
    const dueDate = new Date(assignment.dueDate);
    const completed = user.role === 'student'
      ? Boolean(assignment.mySubmission)
      : (assignment.gradedCount || 0) >= (assignment.submissionCount || 0) && (assignment.submissionCount || 0) > 0;
    return dueDate < now && !completed;
  }).length;
  const dueTodayAssignments = assignments.filter((assignment) => {
    if (!assignment?.dueDate) return false;
    const dueDate = new Date(assignment.dueDate);
    const completed = user.role === 'student'
      ? Boolean(assignment.mySubmission)
      : (assignment.gradedCount || 0) >= (assignment.submissionCount || 0) && (assignment.submissionCount || 0) > 0;
    return !completed && dueDate.toDateString() === now.toDateString();
  }).length;

  return {
    userName: user.name,
    role: user.role,
    counts: {
      pendingPersonalTasks,
      openTickets: stats.openTickets || 0,
      freshNotices: notices.length,
      overdueAssignments,
      dueTodayAssignments,
    },
  };
};

const buildInsightKey = (context) => {
  const day = new Date().toISOString().slice(0, 10);
  return [
    day,
    context.role,
    context.counts.pendingPersonalTasks,
    context.counts.openTickets,
    context.counts.freshNotices,
    context.counts.overdueAssignments,
    context.counts.dueTodayAssignments,
  ].join(':');
};

const serializePreferenceDoc = (preference) => ({
  personalTasks: (preference.personalTasks || []).map((task) => ({
    id: task._id.toString(),
    title: task.title,
    note: task.note || '',
    status: task.status,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  })),
  widgetPreferences: {
    hidden: preference.widgetPreferences?.hidden || [],
    pinned: preference.widgetPreferences?.pinned || [],
  },
  dailyInsight: preference.dailyInsight || {},
});

const getDashboardWorkspace = async (user) => {
  const preference = await getDashboardPreferenceDoc(user.id);

  const [statsResult, notices, calendar, tickets, assignments, recentSubmissions] = await Promise.all([
    getStats(user),
    listContent({ user, view: 'feed', limit: 3 }),
    listContent({ user, view: 'calendar', limit: 4, upcomingOnly: true }),
    getRecentTickets(user),
    ['student', 'faculty', 'admin'].includes(user.role) ? listAssignments(user, { limit: 6 }) : [],
    getRecentSubmissions(user),
  ]);

  const stats = statsResult.data;
  const context = buildInsightContext({
    user,
    personalTasks: preference.personalTasks || [],
    stats,
    notices,
    assignments,
  });
  const insightKey = buildInsightKey(context);

  if (preference.dailyInsight?.key !== insightKey) {
    const insight = await generateDashboardInsight(context);
    preference.dailyInsight = {
      key: insightKey,
      message: insight.message,
      source: insight.source,
      generatedAt: new Date(),
    };
    await preference.save();
  }

  return {
    stats,
    notices,
    calendar,
    tickets,
    assignments,
    recentSubmissions,
    ...serializePreferenceDoc(preference),
  };
};

const createPersonalTask = async (userId, body) => {
  const preference = await getDashboardPreferenceDoc(userId);
  if (!body.title?.trim()) {
    const error = new Error('Task title is required');
    error.statusCode = 400;
    throw error;
  }

  preference.personalTasks.unshift({
    title: body.title.trim(),
    note: body.note?.trim() || '',
    status: 'todo',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await preference.save();

  const task = preference.personalTasks[0];
  return {
    id: task._id.toString(),
    title: task.title,
    note: task.note || '',
    status: task.status,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
};

const updatePersonalTask = async (userId, taskId, body) => {
  const preference = await getDashboardPreferenceDoc(userId);
  const task = preference.personalTasks.id(taskId);

  if (!task) {
    const error = new Error('Task not found');
    error.statusCode = 404;
    throw error;
  }

  if (body.title !== undefined) {
    if (!body.title.trim()) {
      const error = new Error('Task title is required');
      error.statusCode = 400;
      throw error;
    }
    task.title = body.title.trim();
  }
  if (body.note !== undefined) task.note = body.note.trim();
  if (body.status !== undefined) task.status = body.status;
  task.updatedAt = new Date();
  await preference.save();

  return {
    id: task._id.toString(),
    title: task.title,
    note: task.note || '',
    status: task.status,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
};

const deletePersonalTask = async (userId, taskId) => {
  const preference = await getDashboardPreferenceDoc(userId);
  const task = preference.personalTasks.id(taskId);

  if (!task) {
    const error = new Error('Task not found');
    error.statusCode = 404;
    throw error;
  }

  preference.personalTasks.pull(taskId);
  await preference.save();
};

const updateWidgetPreferences = async (userId, body) => {
  const preference = await getDashboardPreferenceDoc(userId);
  preference.widgetPreferences = {
    hidden: Array.isArray(body.hidden) ? body.hidden.filter(Boolean) : preference.widgetPreferences?.hidden || [],
    pinned: Array.isArray(body.pinned) ? body.pinned.filter(Boolean) : preference.widgetPreferences?.pinned || [],
  };
  await preference.save();
  return serializePreferenceDoc(preference).widgetPreferences;
};

module.exports = {
  getDashboardWorkspace,
  createPersonalTask,
  updatePersonalTask,
  deletePersonalTask,
  updateWidgetPreferences,
};
