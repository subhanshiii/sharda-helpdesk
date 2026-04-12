const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');
const Enrollment = require('../models/Enrollment');
const Section = require('../models/Section');
const Subject = require('../models/Subject');
const mongoose = require('mongoose');
const { isAdminRole, normalizeRole } = require('../utils/roleHelpers');

const parseValues = (value) => {
  if (!value) return [];
  const values = Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean)
    : String(value).split(',').map((item) => item.trim()).filter(Boolean);
  return [...new Set(values)];
};

const normalizeValue = (value) => String(value ?? '').trim().toLowerCase();

const serializeFiles = (files = []) => files.map((file) => ({
  filename: file.filename,
  originalName: file.originalname,
  mimetype: file.mimetype,
  size: file.size,
  url: `/api/files/general/${file.filename}`,
}));

const parseAssignedStudents = (value) => {
  if (!value) return [];
  const values = Array.isArray(value)
    ? value
    : String(value).split(',').map((item) => item.trim()).filter(Boolean);

  return values.filter((item) => mongoose.Types.ObjectId.isValid(item));
};

const getActiveEnrollment = async (userId) => Enrollment.findOne({ student: userId, status: 'active' }).lean();

const ensureAssignmentModuleAccess = (user) => {
  if (!user) {
    const error = new Error('Not authorized');
    error.statusCode = 401;
    throw error;
  }

  const role = normalizeRole(user.role);

  if (!['student', 'faculty', 'admin'].includes(role)) {
    const error = new Error('Assignments are not available for this role');
    error.statusCode = 403;
    throw error;
  }
};

const isStudentTargeted = (assignment, user) => {
  if (!user) return false;
  const userId = user.id?.toString?.() || user._id?.toString?.();
  if (assignment.assignedStudents?.some((id) => id.toString() === userId)) return true;
  if (assignment.sectionId && user.sectionId && assignment.sectionId.toString() === user.sectionId.toString()) return true;

  const departments = assignment.targetAudience?.departments?.map(normalizeValue) || [];
  const years = assignment.targetAudience?.years?.map(normalizeValue) || [];
  const sections = assignment.targetAudience?.sections?.map(normalizeValue) || [];

  const departmentMatch = !departments.length || departments.includes(normalizeValue(user.department));
  const yearMatch = !years.length || years.includes(normalizeValue(user.year));
  const sectionMatch = !sections.length || sections.includes(normalizeValue(user.section));

  return departmentMatch && yearMatch && sectionMatch;
};

const getAssignmentAccess = async (assignmentId, user) => {
  const assignment = await Assignment.findById(assignmentId)
    .populate('createdBy', 'name email role department')
    .populate('assignedStudents', 'name email department year section')
    .populate('sectionId', 'name')
    .populate('subjectId', 'name code');

  if (!assignment) {
    const error = new Error('Assignment not found');
    error.statusCode = 404;
    throw error;
  }

  const role = normalizeRole(user.role);
  const userId = user.id?.toString?.() || user._id?.toString?.();
  const managesAssignment = isAdminRole(role) || assignment.createdBy?._id?.toString() === userId;
  const canViewAsStudent = role === 'student' && isStudentTargeted(assignment, user);

  if (!managesAssignment && !canViewAsStudent) {
    const error = new Error('Not authorized to access this assignment');
    error.statusCode = 403;
    throw error;
  }

  return { assignment, managesAssignment, canViewAsStudent };
};

const listAssignments = async (user, { status, search, limit } = {}) => {
  ensureAssignmentModuleAccess(user);
  const role = normalizeRole(user.role);
  const query = {};

  if (role === 'student') {
    const enrollment = await getActiveEnrollment(user.id || user._id);
    query.isPublished = true;
    query.$or = [
      { assignedStudents: user.id || user._id },
      ...(enrollment?.section ? [{ sectionId: enrollment.section }] : []),
      {
        $and: [
          {
            $or: [
              { 'targetAudience.departments.0': { $exists: false } },
              ...(user.department ? [{ 'targetAudience.departments': user.department }] : []),
            ],
          },
          {
            $or: [
              { 'targetAudience.years.0': { $exists: false } },
              ...(user.year ? [{ 'targetAudience.years': user.year }] : []),
            ],
          },
          {
            $or: [
              { 'targetAudience.sections.0': { $exists: false } },
              ...(user.section ? [{ 'targetAudience.sections': user.section }] : []),
            ],
          },
        ],
      },
    ];
  } else if (!isAdminRole(role)) {
    query.createdBy = user.id || user._id;
  }

  if (status === 'published') query.isPublished = true;
  if (status === 'draft') query.isPublished = false;
  if (search) {
    query.$and = [
      ...(query.$and || []),
      {
        $or: [
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { subject: { $regex: search, $options: 'i' } },
        ],
      },
    ];
  }

  let cursor = Assignment.find(query)
    .populate('createdBy', 'name email role department')
    .populate('sectionId', 'name')
    .populate('subjectId', 'name code')
    .sort({ dueDate: 1, createdAt: -1 });

  if (limit) cursor = cursor.limit(parseInt(limit, 10));

  const assignments = await cursor;
  const assignmentIds = assignments.map((assignment) => assignment._id);

  if (!assignmentIds.length) return [];

  if (role === 'student') {
    const submissions = await Submission.find({
      assignment: { $in: assignmentIds },
      student: user.id || user._id,
    }).lean();

    const submissionMap = new Map(submissions.map((submission) => [submission.assignment.toString(), submission]));

    return assignments.map((assignment) => ({
      ...assignment.toObject(),
      mySubmission: submissionMap.get(assignment._id.toString()) || null,
    }));
  }

  const submissionStats = await Submission.aggregate([
    { $match: { assignment: { $in: assignmentIds } } },
    {
      $group: {
        _id: '$assignment',
        submissionCount: { $sum: 1 },
        gradedCount: {
          $sum: {
            $cond: [{ $eq: ['$status', 'graded'] }, 1, 0],
          },
        },
      },
    },
  ]);

  const statsMap = new Map(submissionStats.map((item) => [item._id.toString(), item]));

  return assignments.map((assignment) => ({
    ...assignment.toObject(),
    submissionCount: statsMap.get(assignment._id.toString())?.submissionCount || 0,
    gradedCount: statsMap.get(assignment._id.toString())?.gradedCount || 0,
  }));
};

const getAssignmentById = async (assignmentId, user) => {
  ensureAssignmentModuleAccess(user);
  const { assignment, managesAssignment } = await getAssignmentAccess(assignmentId, user);

  const result = assignment.toObject();

  if (managesAssignment) {
    result.submissions = await Submission.find({ assignment: assignment._id })
      .populate('student', 'name email department year section')
      .populate('gradedBy', 'name role')
      .sort({ submittedAt: -1 })
      .lean();
  } else {
    result.mySubmission = await Submission.findOne({ assignment: assignment._id, student: user.id || user._id })
      .populate('gradedBy', 'name role')
      .lean();
  }

  return result;
};

const createAssignment = async (body, user, files) => {
  ensureAssignmentModuleAccess(user);
  const role = normalizeRole(user.role);
  if (!['faculty', 'admin'].includes(role)) {
    const error = new Error('Not authorized to create assignments');
    error.statusCode = 403;
    throw error;
  }
  const assignment = await Assignment.create({
    title: body.title,
    description: body.description,
    subject: body.subject || '',
    subjectId: mongoose.Types.ObjectId.isValid(body.subjectId) ? body.subjectId : null,
    dueDate: body.dueDate,
    maxScore: body.maxScore ? Number(body.maxScore) : 100,
    allowLateSubmissions: body.allowLateSubmissions === 'true' || body.allowLateSubmissions === true,
    isPublished: body.isPublished !== 'false' && body.isPublished !== false,
    targetAudience: {
      departments: parseValues(body.audienceDepartments),
      years: parseValues(body.audienceYears),
      sections: parseValues(body.audienceSections),
    },
    sectionId: mongoose.Types.ObjectId.isValid(body.sectionId) ? body.sectionId : null,
    assignedStudents: parseAssignedStudents(body.assignedStudentIds),
    attachments: serializeFiles(files),
    createdBy: user.id || user._id,
  });

  if (assignment.sectionId) {
    const section = await Section.findById(assignment.sectionId).populate('department');
    if (section) {
      assignment.targetAudience.departments = assignment.targetAudience.departments?.length
        ? assignment.targetAudience.departments
        : [section.department?.name].filter(Boolean);
      assignment.targetAudience.sections = assignment.targetAudience.sections?.length
        ? assignment.targetAudience.sections
        : [section.name].filter(Boolean);
    }
  }

  if (assignment.subjectId) {
    const subject = await Subject.findById(assignment.subjectId);
    if (subject) assignment.subject = subject.name;
  }

  await assignment.save();

  return Assignment.findById(assignment._id)
    .populate('createdBy', 'name email role department')
    .populate('assignedStudents', 'name email department year section')
    .populate('sectionId', 'name')
    .populate('subjectId', 'name code');
};

const updateAssignment = async (assignmentId, body, user, files) => {
  ensureAssignmentModuleAccess(user);
  const { assignment, managesAssignment } = await getAssignmentAccess(assignmentId, user);
  if (!managesAssignment) {
    const error = new Error('Not authorized to update this assignment');
    error.statusCode = 403;
    throw error;
  }

  if (body.title !== undefined) assignment.title = body.title;
  if (body.description !== undefined) assignment.description = body.description;
  if (body.subject !== undefined) assignment.subject = body.subject;
  if (body.subjectId !== undefined) assignment.subjectId = mongoose.Types.ObjectId.isValid(body.subjectId) ? body.subjectId : null;
  if (body.dueDate !== undefined) assignment.dueDate = body.dueDate;
  if (body.maxScore !== undefined) assignment.maxScore = Number(body.maxScore);
  if (body.allowLateSubmissions !== undefined) assignment.allowLateSubmissions = body.allowLateSubmissions === 'true' || body.allowLateSubmissions === true;
  if (body.isPublished !== undefined) assignment.isPublished = body.isPublished === 'true' || body.isPublished === true;
  assignment.targetAudience = {
    departments: parseValues(body.audienceDepartments),
    years: parseValues(body.audienceYears),
    sections: parseValues(body.audienceSections),
  };
  if (body.sectionId !== undefined) assignment.sectionId = mongoose.Types.ObjectId.isValid(body.sectionId) ? body.sectionId : null;
  assignment.assignedStudents = parseAssignedStudents(body.assignedStudentIds);
  if (files?.length) assignment.attachments = serializeFiles(files);

  if (assignment.sectionId) {
    const section = await Section.findById(assignment.sectionId).populate('department');
    if (section) {
      assignment.targetAudience.departments = assignment.targetAudience.departments?.length
        ? assignment.targetAudience.departments
        : [section.department?.name].filter(Boolean);
      assignment.targetAudience.sections = assignment.targetAudience.sections?.length
        ? assignment.targetAudience.sections
        : [section.name].filter(Boolean);
    }
  }

  if (assignment.subjectId) {
    const subject = await Subject.findById(assignment.subjectId);
    if (subject) assignment.subject = subject.name;
  }

  await assignment.save();
  return Assignment.findById(assignment._id)
    .populate('createdBy', 'name email role department')
    .populate('assignedStudents', 'name email department year section')
    .populate('sectionId', 'name')
    .populate('subjectId', 'name code');
};

const deleteAssignment = async (assignmentId, user) => {
  ensureAssignmentModuleAccess(user);
  const { assignment, managesAssignment } = await getAssignmentAccess(assignmentId, user);
  if (!managesAssignment) {
    const error = new Error('Not authorized to delete this assignment');
    error.statusCode = 403;
    throw error;
  }

  await Promise.all([
    Submission.deleteMany({ assignment: assignment._id }),
    assignment.deleteOne(),
  ]);
};

const submitAssignment = async (assignmentId, body, user, files) => {
  ensureAssignmentModuleAccess(user);
  const { assignment } = await getAssignmentAccess(assignmentId, user);

  if (normalizeRole(user.role) !== 'student') {
    const error = new Error('Only students can submit assignments');
    error.statusCode = 403;
    throw error;
  }

  const now = new Date();
  if (!assignment.allowLateSubmissions && new Date(assignment.dueDate) < now) {
    const error = new Error('Submission deadline has passed');
    error.statusCode = 400;
    throw error;
  }

  if (!body.comment?.trim() && !files?.length) {
    const error = new Error('Submission comment or file is required');
    error.statusCode = 400;
    throw error;
  }

  const submission = await Submission.findOneAndUpdate(
    { assignment: assignment._id, student: user.id || user._id },
    {
      $set: {
        assignment: assignment._id,
        student: user.id || user._id,
        comment: body.comment || '',
        attachments: serializeFiles(files),
        submittedAt: now,
        status: 'submitted',
        score: null,
        feedback: '',
        gradedAt: null,
        gradedBy: null,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  )
    .populate('student', 'name email department year section')
    .populate('gradedBy', 'name role');

  return submission;
};

const gradeSubmission = async (assignmentId, submissionId, body, user) => {
  ensureAssignmentModuleAccess(user);
  const { assignment, managesAssignment } = await getAssignmentAccess(assignmentId, user);
  if (!managesAssignment) {
    const error = new Error('Not authorized to grade this submission');
    error.statusCode = 403;
    throw error;
  }

  const submission = await Submission.findOne({ _id: submissionId, assignment: assignment._id });
  if (!submission) {
    const error = new Error('Submission not found');
    error.statusCode = 404;
    throw error;
  }

  submission.score = body.score !== undefined && body.score !== '' ? Number(body.score) : null;
  submission.feedback = body.feedback || '';
  submission.status = body.status || 'graded';
  submission.gradedAt = new Date();
  submission.gradedBy = user.id || user._id;
  await submission.save();

  return Submission.findById(submission._id)
    .populate('student', 'name email department year section')
    .populate('gradedBy', 'name role');
};

module.exports = {
  listAssignments,
  getAssignmentById,
  getAssignmentAccess,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  submitAssignment,
  gradeSubmission,
};
