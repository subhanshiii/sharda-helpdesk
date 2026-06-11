const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');
const Ticket = require('../models/Ticket');
const { getAssessmentDashboardSummary } = require('./assessmentService');
const DashboardPreference = require('../models/DashboardPreference');
const TimetableEntry = require('../models/TimetableEntry');
const AttendanceSession = require('../models/AttendanceSession');
const Enrollment = require('../models/Enrollment');
const SubjectSectionTeacher = require('../models/SubjectSectionTeacher');
const { listAssignments } = require('./assignmentService');
const { listContent } = require('./contentService');
const { getStats } = require('./statsService');
const { generateDashboardInsight } = require('./aiService');
const { isAdminRole, isSupportRole } = require('../utils/roleHelpers');
const { buildTimetableQuery } = require('../utils/timetableQuery');

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

const getTimetableEntries = async (user) => {
  const query = await buildTimetableQuery(user, {});

  return TimetableEntry.find(query)
    .populate('faculty', 'name email role')
    .populate({
      path: 'sectionId',
      select: 'name studyYear program course department academicSession',
      populate: [
        { path: 'program', select: 'name code' },
        { path: 'course', select: 'name code' },
        { path: 'department', select: 'name code college', populate: { path: 'college', select: 'name code' } },
        { path: 'academicSession', select: 'label yearNumber' },
      ],
    })
    .populate('subjectId', 'name code')
    .sort({ dayOfWeek: 1, startTime: 1 })
    .limit(10)
    .lean();
};

const getAttendanceSummary = async (user) => {
  const role = user.role;
  const query = {};

  if (role === 'student') {
    const enrollment = await Enrollment.findOne({ student: user.id, status: 'active' }).select('section').lean();
    if (enrollment?.section) {
      query.sectionId = enrollment.section;
    } else {
      query.department = user.department;
      query.year = user.year;
      query.section = user.section;
    }
  } else if (role === 'faculty') {
    const assignedSectionIds = await SubjectSectionTeacher.find({
      isActive: true,
      teacher: user.id,
    }).distinct('section');
    query.$or = [{ faculty: user.id }, ...(assignedSectionIds.length ? [{ sectionId: { $in: assignedSectionIds } }] : [])];
  }

  const sessions = await AttendanceSession.find(query)
    .populate('records.student', '_id')
    .sort({ date: -1 })
    .limit(12)
    .lean();

  if (role === 'student') {
    let attended = 0;
    let total = 0;
    sessions.forEach((session) => {
      const record = session.records.find((entry) => entry.student?._id?.toString() === user.id);
      if (record) {
        total += 1;
        if (['present', 'late'].includes(record.status)) attended += 1;
      }
    });

    return {
      totalSessions: total,
      attendedSessions: attended,
      attendanceRate: total ? Math.round((attended / total) * 100) : 0,
    };
  }

  const totalRecords = sessions.reduce((sum, session) => sum + (session.records?.length || 0), 0);
  return {
    totalSessions: sessions.length,
    attendedSessions: totalRecords,
    attendanceRate: sessions.length ? Math.round(totalRecords / sessions.length) : 0,
  };
};

const buildInsightContext = ({ user, personalTasks, stats, notices, assignments, assessments = {} }) => {
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
      pendingGrading: assessments.pendingGrading || 0,
      lowPerformanceAlerts: assessments.lowPerformanceAlerts || (assessments.weakSubjects || []).length || 0,
      assessmentRate: assessments.percentage || 0,
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

  const [statsResult, notices, calendar, tickets, assignments, recentSubmissions, timetable, attendance, assessment] = await Promise.all([
    getStats(user),
    listContent({ user, view: 'feed', limit: 3 }),
    listContent({ user, view: 'calendar', limit: 4, upcomingOnly: true }),
    getRecentTickets(user),
    ['student', 'faculty', 'admin'].includes(user.role) ? listAssignments(user, { limit: 6 }) : [],
    getRecentSubmissions(user),
    getTimetableEntries(user),
    getAttendanceSummary(user),
    getAssessmentDashboardSummary(user),
  ]);

  const stats = statsResult.data;
  const context = buildInsightContext({
    user,
    personalTasks: preference.personalTasks || [],
    stats,
    notices,
    assignments,
    assessments: assessment,
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
    timetable,
    attendance,
    assessment,
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
