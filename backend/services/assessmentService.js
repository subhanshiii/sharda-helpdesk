const mongoose = require('mongoose');
const AssessmentSession = require('../models/AssessmentSession');
const AttendanceSession = require('../models/AttendanceSession');
const Enrollment = require('../models/Enrollment');
const Section = require('../models/Section');
const Subject = require('../models/Subject');
const TeachingAssignment = require('../models/TeachingAssignment');
const User = require('../models/User');
const { getScopeFilter } = require('../utils/scopeGuard');
const { normalizeRole } = require('../utils/roleHelpers');
const { buildSubjectCatalog, getSubjectIdsForSection } = require('../utils/subjectManagement');
const { logAuditEvent } = require('./auditService');

const ASSESSMENT_TYPE_LABELS = {
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

const ASSESSMENT_TYPE_ALIASES = {
  'mse-1': 'mse',
  'mse-2': 'mse',
  'end-sem': 'ese',
  endsem: 'ese',
  'end-semester': 'ese',
  'assignment-1': 'assignment',
  'assignment-2': 'assignment',
  'class-assessment': 'ca',
  classwork: 'ca',
  practicals: 'practical',
};

const normalizeString = (value) => String(value || '').trim();
const normalizeNumber = (value, fallback = null) => {
  if (value === '' || value === null || value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const normalizeDate = (value, fallback = null) => {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
};
const toObjectId = (value) => {
  if (!value) return null;
  if (value instanceof mongoose.Types.ObjectId) return value;
  if (!mongoose.Types.ObjectId.isValid(value)) return null;
  return new mongoose.Types.ObjectId(value);
};
const normalizeAssessmentType = (value) => {
  const raw = normalizeString(value).toLowerCase();
  const mapped = ASSESSMENT_TYPE_ALIASES[raw] || raw;
  return Object.prototype.hasOwnProperty.call(ASSESSMENT_TYPE_LABELS, mapped) ? mapped : 'other';
};
const normalizeAssessmentStatus = (value) => {
  const raw = normalizeString(value).toLowerCase();
  return ['draft', 'published', 'archived'].includes(raw) ? raw : 'published';
};

const getAssessmentTypeLabel = (value) => ASSESSMENT_TYPE_LABELS[normalizeAssessmentType(value)] || 'Other';

const buildAssessmentPopulate = () => ([
  { path: 'subjectId', select: 'name code credits type department program academicSession' },
  {
    path: 'sectionId',
    select: 'name code studyYear program course department academicSession',
    populate: [
      { path: 'program', select: 'name code department' },
      { path: 'course', select: 'name code' },
      { path: 'department', select: 'name code college' },
      { path: 'academicSession', select: 'label yearNumber' },
    ],
  },
  { path: 'academicSessionId', select: 'label yearNumber' },
  { path: 'faculty', select: 'name email systemId role' },
  { path: 'createdBy', select: 'name email systemId role' },
  { path: 'updatedBy', select: 'name email systemId role' },
  { path: 'records.student', select: 'name email systemId role section sectionId' },
]);

const getActiveStudentSectionId = async (studentId) => {
  const enrollment = await Enrollment.findOne({ student: studentId, status: 'active' }).select('section academicSession').lean();
  return enrollment?.section || null;
};

const getScopedSectionIds = async (user) => {
  const requesterRole = normalizeRole(user?.role);
  if (requesterRole === 'student') {
    const sectionId = await getActiveStudentSectionId(user.id);
    return sectionId ? [sectionId] : [];
  }

  if (requesterRole === 'faculty') {
    const [teachingSections, assignedByTeacher] = await Promise.all([
      TeachingAssignment.find({ teacher: user.id, isActive: true }).distinct('section'),
      Section.find({ advisorFaculty: user.id, isActive: true }).distinct('_id'),
    ]);
    return [...new Set([...teachingSections, ...assignedByTeacher].map((id) => String(id)).filter(Boolean))].map((id) => toObjectId(id));
  }

  const scope = await getScopeFilter(user, 'sections');
  if (!scope || !Object.keys(scope).length) return [];
  const sectionIds = await Section.find({ isActive: true, ...scope }).distinct('_id');
  return sectionIds.map((id) => toObjectId(id)).filter(Boolean);
};

const ensureSection = async (sectionId) => {
  const section = await Section.findById(sectionId)
    .populate('program', 'name code department')
    .populate('course', 'name code')
    .populate('department', 'name code college')
    .populate('academicSession', 'label yearNumber program')
    .lean();

  if (!section) {
    const error = new Error('Section not found');
    error.statusCode = 404;
    throw error;
  }

  return section;
};

const ensureSubject = async (subjectId) => {
  const subject = await Subject.findById(subjectId)
    .populate('department', 'name code college')
    .populate('program', 'name code department')
    .populate('academicSession', 'label yearNumber')
    .lean();

  if (!subject) {
    const error = new Error('Subject not found');
    error.statusCode = 404;
    throw error;
  }

  return subject;
};

const ensureAssessmentAccess = async (user, assessmentDoc) => {
  if (!assessmentDoc) return;
  const requesterRole = normalizeRole(user?.role);
  if (requesterRole === 'student') {
    const sectionId = await getActiveStudentSectionId(user.id);
    if (!sectionId || String(sectionId) !== String(assessmentDoc.sectionId?._id || assessmentDoc.sectionId)) {
      const error = new Error('You are not allowed to view this assessment');
      error.statusCode = 403;
      throw error;
    }
    if (assessmentDoc.status === 'draft') {
      const error = new Error('This assessment is still in draft mode');
      error.statusCode = 403;
      throw error;
    }
    return;
  }

  if (requesterRole === 'faculty') {
    const sectionIds = await getScopedSectionIds(user);
    if (sectionIds.length && !sectionIds.some((id) => String(id) === String(assessmentDoc.sectionId?._id || assessmentDoc.sectionId))) {
      const error = new Error('This assessment is outside your assigned section scope');
      error.statusCode = 403;
      throw error;
    }
  }

  const scope = await getScopeFilter(user, 'sections');
  if (scope && Object.keys(scope).length) {
    const sectionId = assessmentDoc.sectionId?._id || assessmentDoc.sectionId;
    const allowed = await Section.exists({ _id: sectionId, ...scope, isActive: true });
    if (!allowed) {
      const error = new Error('This assessment is outside your assigned academic scope');
      error.statusCode = 403;
      throw error;
    }
  }
};

const normalizeRecords = async (records = [], sectionId, maxMarks, actorId = null) => {
  if (!Array.isArray(records)) return [];

  const activeStudentIds = await Enrollment.find({ section: sectionId, status: 'active' }).distinct('student');
  const activeStudentSet = new Set(activeStudentIds.map((id) => String(id)));

  return records
    .map((entry) => {
      const studentId = toObjectId(entry.student || entry.studentId);
      if (!studentId || !activeStudentSet.has(String(studentId))) {
        return null;
      }

      const status = normalizeString(entry.status).toLowerCase();
      const marksValue = entry.marks ?? entry.obtainedMarks ?? entry.score;
      const marks = marksValue === '' || marksValue === null || marksValue === undefined
        ? null
        : normalizeNumber(marksValue, null);

      return {
        student: studentId,
        marks: status === 'absent' || status === 'pending' || status === 'exempt' ? marks : marks,
        status: ['pending', 'graded', 'absent', 'exempt'].includes(status) ? status : (marks === null ? 'pending' : 'graded'),
        remarks: normalizeString(entry.remarks),
        gradedAt: status === 'graded' || marks !== null ? new Date() : null,
        gradedBy: actorId,
      };
    })
    .filter(Boolean)
    .map((record) => {
      if (record.status === 'graded' && record.marks !== null && Number(record.marks) > maxMarks) {
        record.marks = maxMarks;
      }
      if (record.status === 'absent' && record.marks === null) {
        record.marks = 0;
      }
      return record;
    });
};

const buildAssessmentQuery = async (user, filters = {}) => {
  const requesterRole = normalizeRole(user?.role);
  const query = { isDeleted: false };

  if (filters.sectionId || filters.section) {
    query.sectionId = toObjectId(filters.sectionId || filters.section);
  }
  if (filters.subjectId || filters.subject) {
    query.subjectId = toObjectId(filters.subjectId || filters.subject);
  }
  if (filters.academicSessionId || filters.academicSession || filters.sessionId) {
    query.academicSessionId = toObjectId(filters.academicSessionId || filters.academicSession || filters.sessionId);
  }
  if (filters.facultyId || filters.faculty) {
    query.faculty = toObjectId(filters.facultyId || filters.faculty);
  }
  if (filters.assessmentType) {
    query.assessmentType = normalizeAssessmentType(filters.assessmentType);
  }
  if (filters.status) {
    query.status = normalizeAssessmentStatus(filters.status);
  }
  if (filters.startDate || filters.from) {
    query.date = { ...(query.date || {}), $gte: new Date(filters.startDate || filters.from) };
  }
  if (filters.endDate || filters.to) {
    query.date = { ...(query.date || {}), $lte: new Date(filters.endDate || filters.to) };
  }

  if (requesterRole === 'student') {
    const sectionId = await getActiveStudentSectionId(user.id);
    if (!sectionId) {
      query._id = { $in: [] };
      return query;
    }
    query.sectionId = sectionId;
    query.status = { $ne: 'draft' };
    return query;
  }

  if (requesterRole === 'faculty') {
    const sectionIds = await getScopedSectionIds(user);
    const orClauses = [
      { faculty: user.id },
      { createdBy: user.id },
    ];
    if (sectionIds.length) {
      orClauses.push({ sectionId: { $in: sectionIds } });
      if (!query.sectionId) {
        query.sectionId = { $in: sectionIds };
      }
    }
    query.$or = orClauses;
  } else {
    const scope = await getScopeFilter(user, 'sections');
    if (scope && Object.keys(scope).length) {
      const sectionIds = await Section.find({ isActive: true, ...scope }).distinct('_id');
      if (sectionIds.length) {
        query.sectionId = query.sectionId ? { $in: sectionIds.filter((id) => String(id) === String(query.sectionId)) } : { $in: sectionIds };
      }
    }
  }

  return query;
};

const populateAssessmentDoc = async (assessmentDoc) => {
  if (!assessmentDoc) return null;
  return AssessmentSession.populate(assessmentDoc, buildAssessmentPopulate());
};

const listAssessments = async (user, filters = {}) => {
  const query = await buildAssessmentQuery(user, filters);
  const page = Math.max(Number(filters.page) || 1, 1);
  const limit = Math.min(Math.max(Number(filters.limit) || 100, 1), 250);

  const [rows, total] = await Promise.all([
    AssessmentSession.find(query)
      .sort({ date: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate(buildAssessmentPopulate())
      .lean(),
    AssessmentSession.countDocuments(query),
  ]);

  return { rows, total, page, limit };
};

const getAssessmentById = async (user, assessmentId) => {
  const assessment = await AssessmentSession.findById(assessmentId).populate(buildAssessmentPopulate()).lean();
  if (!assessment || assessment.isDeleted) {
    const error = new Error('Assessment not found');
    error.statusCode = 404;
    throw error;
  }

  await ensureAssessmentAccess(user, assessment);
  return assessment;
};

const resolveAssessmentContext = async (user, body = {}, existingAssessment = null) => {
  const sectionId = toObjectId(body.sectionId || body.section || existingAssessment?.sectionId);
  if (!sectionId) {
    const error = new Error('Section is required');
    error.statusCode = 400;
    throw error;
  }

  const section = await ensureSection(sectionId);
  const subjectId = toObjectId(body.subjectId || body.subject || existingAssessment?.subjectId);
  if (!subjectId) {
    const error = new Error('Subject is required');
    error.statusCode = 400;
    throw error;
  }

  const subject = await ensureSubject(subjectId);
  const allowedSubjectIds = await getSubjectIdsForSection(sectionId);
  if (allowedSubjectIds.length && !allowedSubjectIds.some((id) => String(id) === String(subject._id))) {
    const error = new Error('Selected subject is not linked to this section');
    error.statusCode = 400;
    throw error;
  }

  if (String(subject.program?._id || subject.program) !== String(section.program?._id || section.program)) {
    const error = new Error('Subject must belong to the selected section program');
    error.statusCode = 400;
    throw error;
  }
  if (String(subject.academicSession?._id || subject.academicSession) !== String(section.academicSession?._id || section.academicSession)) {
    const error = new Error('Subject must belong to the selected section academic session');
    error.statusCode = 400;
    throw error;
  }

  const maxMarks = normalizeNumber(body.maxMarks ?? existingAssessment?.maxMarks, 100);
  if (!maxMarks || maxMarks <= 0) {
    const error = new Error('Maximum marks must be greater than zero');
    error.statusCode = 400;
    throw error;
  }

  const title = normalizeString(body.title || existingAssessment?.title);
  if (!title) {
    const error = new Error('Assessment title is required');
    error.statusCode = 400;
    throw error;
  }

  const assessmentType = normalizeAssessmentType(body.assessmentType || existingAssessment?.assessmentType);
  const date = normalizeDate(body.date || existingAssessment?.date, null);
  if (!date) {
    const error = new Error('Assessment date is required');
    error.statusCode = 400;
    throw error;
  }

  const teachingAssignment = body.teachingAssignmentId || existingAssessment?.teachingAssignmentId
    ? await TeachingAssignment.findById(body.teachingAssignmentId || existingAssessment?.teachingAssignmentId).lean()
    : await TeachingAssignment.findOne({ section: sectionId, subject: subjectId, isActive: true }).lean();

  if (teachingAssignment) {
    if (String(teachingAssignment.section) !== String(sectionId) || String(teachingAssignment.subject) !== String(subjectId)) {
      const error = new Error('Teaching assignment does not match the selected section and subject');
      error.statusCode = 400;
      throw error;
    }
  }

  const facultyId = toObjectId(body.faculty || existingAssessment?.faculty || teachingAssignment?.teacher || user.id);
  if (!facultyId) {
    const error = new Error('Faculty assignment is required');
    error.statusCode = 400;
    throw error;
  }

  const existingFaculty = teachingAssignment?.teacher || existingAssessment?.faculty;
  if (body.faculty && existingFaculty && String(existingFaculty) !== String(facultyId)) {
    const error = new Error('Faculty must match the linked teaching assignment');
    error.statusCode = 400;
    throw error;
  }

  const academicSessionId = toObjectId(
    body.academicSessionId ||
    body.academicSession ||
    section.academicSession?._id ||
    section.academicSession
  );
  const departmentId = toObjectId(body.department || section.department?._id || section.department);
  const programId = toObjectId(body.program || section.program?._id || section.program);

  if (!academicSessionId) {
    const error = new Error('Academic session is required for the selected section');
    error.statusCode = 400;
    throw error;
  }

  const records = await normalizeRecords(body.records || existingAssessment?.records || [], sectionId, maxMarks, user.id);

  return {
    section,
    subject,
    teachingAssignment,
    payload: {
      title,
      assessmentType,
      subject: subject.name,
      subjectId: subject._id,
      teachingAssignmentId: teachingAssignment?._id || existingAssessment?.teachingAssignmentId || null,
      academicSessionId,
      department: departmentId,
      program: programId,
      sectionId,
      section: section.name,
      date,
      faculty: facultyId,
      topic: normalizeString(body.topic || existingAssessment?.topic),
      maxMarks,
      passingMarks: normalizeNumber(body.passingMarks ?? existingAssessment?.passingMarks, 40),
      weightage: body.weightage === null || body.weightage === '' ? null : normalizeNumber(body.weightage, null),
      status: normalizeAssessmentStatus(body.status || existingAssessment?.status),
      records,
    },
  };
};

const createAssessment = async (user, body = {}, req = null) => {
  const { payload, subject, section } = await resolveAssessmentContext(user, body);

  const doc = await AssessmentSession.create({
    ...payload,
    publishedAt: payload.status === 'published' ? new Date() : null,
    createdBy: user.id,
  });

  await logAuditEvent({
    actor: user.id,
    actorRole: user.role,
    action: 'create',
    resource: 'assessments',
    resourceId: doc._id,
    description: `Created ${getAssessmentTypeLabel(payload.assessmentType)} assessment for ${subject.code} (${section.name})`,
    nextValue: { title: doc.title, assessmentType: doc.assessmentType, subjectId: doc.subjectId, sectionId: doc.sectionId },
    metadata: { subjectCode: subject.code, sectionName: section.name },
    ipAddress: req?.ip || '',
    userAgent: req?.headers?.['user-agent'] || '',
  });

  return populateAssessmentDoc(await AssessmentSession.findById(doc._id));
};

const updateAssessment = async (user, assessmentId, body = {}, req = null) => {
  const existing = await AssessmentSession.findById(assessmentId).lean();
  if (!existing || existing.isDeleted) {
    const error = new Error('Assessment not found');
    error.statusCode = 404;
    throw error;
  }

  await ensureAssessmentAccess(user, existing);
  const { payload, subject, section } = await resolveAssessmentContext(user, body, existing);

  const updated = await AssessmentSession.findByIdAndUpdate(
    assessmentId,
    {
      $set: {
        ...payload,
        updatedBy: user.id,
        publishedAt: payload.status === 'published' && !existing.publishedAt ? new Date() : existing.publishedAt,
      },
    },
    { new: true }
  ).populate(buildAssessmentPopulate());

  await logAuditEvent({
    actor: user.id,
    actorRole: user.role,
    action: 'update',
    resource: 'assessments',
    resourceId: updated._id,
    description: `Updated ${getAssessmentTypeLabel(payload.assessmentType)} assessment for ${subject.code} (${section.name})`,
    previousValue: { title: existing.title, assessmentType: existing.assessmentType, subjectId: existing.subjectId, sectionId: existing.sectionId },
    nextValue: { title: updated.title, assessmentType: updated.assessmentType, subjectId: updated.subjectId, sectionId: updated.sectionId },
    metadata: { subjectCode: subject.code, sectionName: section.name },
    ipAddress: req?.ip || '',
    userAgent: req?.headers?.['user-agent'] || '',
  });

  return updated;
};

const deleteAssessment = async (user, assessmentId, req = null) => {
  const existing = await AssessmentSession.findById(assessmentId).populate(buildAssessmentPopulate());
  if (!existing || existing.isDeleted) {
    const error = new Error('Assessment not found');
    error.statusCode = 404;
    throw error;
  }

  await ensureAssessmentAccess(user, existing);

  await AssessmentSession.findByIdAndUpdate(assessmentId, {
    $set: {
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: user.id,
      status: 'archived',
    },
  });

  await logAuditEvent({
    actor: user.id,
    actorRole: user.role,
    action: 'delete',
    resource: 'assessments',
    resourceId: existing._id,
    description: `Deleted ${getAssessmentTypeLabel(existing.assessmentType)} assessment for ${existing.subjectId?.code || 'subject'} (${existing.sectionId?.name || 'section'})`,
    previousValue: { title: existing.title, assessmentType: existing.assessmentType, subjectId: existing.subjectId?._id || existing.subjectId, sectionId: existing.sectionId?._id || existing.sectionId },
    metadata: { subjectCode: existing.subjectId?.code || '', sectionName: existing.sectionId?.name || '' },
    ipAddress: req?.ip || '',
    userAgent: req?.headers?.['user-agent'] || '',
  });
};

const getAttendanceRateForStudent = async (studentId, sectionId) => {
  const sessions = await AttendanceSession.find({ sectionId, isDeleted: false })
    .populate('records.student', '_id')
    .sort({ date: -1 })
    .lean();

  let attended = 0;
  let total = 0;
  sessions.forEach((session) => {
    const record = (session.records || []).find((entry) => String(entry.student?._id || entry.student) === String(studentId));
    if (!record) return;
    total += 1;
    if (['present', 'late'].includes(record.status)) attended += 1;
  });

  return {
    totalSessions: total,
    attendedSessions: attended,
    attendanceRate: total ? Math.round((attended / total) * 100) : 0,
  };
};

const summarizeSubjectAssessments = (subjects = [], sessions = [], studentId = null) => {
  const subjectMap = new Map();

  subjects.forEach((subject) => {
    subjectMap.set(String(subject._id), {
      subjectId: subject._id,
      code: subject.code,
      name: subject.name,
      faculty: subject.teachers?.[0]
        ? {
            id: subject.teachers[0]._id,
            name: subject.teachers[0].name,
            email: subject.teachers[0].email,
            systemId: subject.teachers[0].systemId,
          }
        : null,
      totalAssessments: 0,
      completedAssessments: 0,
      pendingAssessments: 0,
      absentAssessments: 0,
      totalMarks: 0,
      obtainedMarks: 0,
      percentage: 0,
      latestAssessmentAt: null,
      riskLevel: 'normal',
    });
  });

  let overallTotalMarks = 0;
  let overallObtainedMarks = 0;
  let overallCount = 0;
  let overallCompleted = 0;
  let overallPending = 0;
  let overallAbsent = 0;

  sessions.forEach((session) => {
    const subjectId = String(session.subjectId?._id || session.subjectId || '');
    if (!subjectMap.has(subjectId)) {
      subjectMap.set(subjectId, {
        subjectId: session.subjectId?._id || session.subjectId,
        code: session.subjectId?.code || session.subject || 'SUBJECT',
        name: session.subjectId?.name || session.subject || 'Subject',
        faculty: session.faculty ? {
          id: session.faculty._id || session.faculty,
          name: session.faculty.name,
          email: session.faculty.email,
          systemId: session.faculty.systemId,
        } : null,
        totalAssessments: 0,
        completedAssessments: 0,
        pendingAssessments: 0,
        absentAssessments: 0,
        totalMarks: 0,
        obtainedMarks: 0,
        percentage: 0,
        latestAssessmentAt: null,
        riskLevel: 'normal',
      });
    }

    const bucket = subjectMap.get(subjectId);
    bucket.totalAssessments += 1;
    overallCount += 1;
    bucket.latestAssessmentAt = !bucket.latestAssessmentAt || new Date(session.date) > new Date(bucket.latestAssessmentAt)
      ? session.date
      : bucket.latestAssessmentAt;

    const record = studentId
      ? (session.records || []).find((entry) => String(entry.student?._id || entry.student) === String(studentId))
      : null;

    if (studentId && !record) {
      bucket.pendingAssessments += 1;
      overallPending += 1;
      return;
    }

    if (record?.status === 'pending') {
      bucket.pendingAssessments += 1;
      overallPending += 1;
      return;
    }

    if (record?.status === 'exempt') {
      return;
    }

    const marks = record?.status === 'absent' ? 0 : normalizeNumber(record?.marks, 0);
    bucket.totalMarks += session.maxMarks;
    bucket.obtainedMarks += marks;
    overallTotalMarks += session.maxMarks;
    overallObtainedMarks += marks;

    if (record?.status === 'absent') {
      bucket.absentAssessments += 1;
      overallAbsent += 1;
    } else {
      bucket.completedAssessments += 1;
      overallCompleted += 1;
    }
  });

  const breakdown = [...subjectMap.values()].map((entry) => ({
    ...entry,
    percentage: entry.totalMarks ? Number(((entry.obtainedMarks / entry.totalMarks) * 100).toFixed(2)) : 0,
    riskLevel: entry.totalMarks && (entry.obtainedMarks / entry.totalMarks) < 0.4
      ? 'high'
      : entry.totalMarks && (entry.obtainedMarks / entry.totalMarks) < 0.6
        ? 'moderate'
        : 'normal',
  }));

  return {
    breakdown,
    overall: {
      totalAssessments: overallCount,
      completedAssessments: overallCompleted,
      pendingAssessments: overallPending,
      absentAssessments: overallAbsent,
      totalMarks: overallTotalMarks,
      obtainedMarks: overallObtainedMarks,
      percentage: overallTotalMarks ? Number(((overallObtainedMarks / overallTotalMarks) * 100).toFixed(2)) : 0,
    },
  };
};

const buildRecommendations = ({ attendanceRate, percentage, weakSubjects }) => {
  const recommendations = [];
  if (attendanceRate < 75) {
    recommendations.push('Improve attendance to stay eligible for semester-end evaluation.');
  }
  if (percentage < 50) {
    recommendations.push('Focus on core assessment preparation and revise weak chapters weekly.');
  }
  weakSubjects.slice(0, 3).forEach((subject) => {
    recommendations.push(`Prioritize ${subject.code} because current performance is below target.`);
  });
  if (!recommendations.length) {
    recommendations.push('Keep the current pace and continue revising regularly to maintain performance.');
  }
  return recommendations;
};

const getStudentAssessmentOverview = async (studentId, requester) => {
  const student = await User.findById(studentId).select('name role section sectionId department departmentId systemId status isActive').lean();
  if (!student) {
    const error = new Error('Student not found');
    error.statusCode = 404;
    throw error;
  }

  const requesterRole = normalizeRole(requester?.role);
  if (String(studentId) !== String(requester?.id) && !['faculty', 'staff', 'admin'].includes(requesterRole)) {
    const error = new Error('You are not allowed to view this student performance overview');
    error.statusCode = 403;
    throw error;
  }

  const enrollment = await Enrollment.findOne({ student: studentId, status: 'active' })
    .populate({
      path: 'section',
      populate: [
        { path: 'program', select: 'name code department' },
        { path: 'course', select: 'name code' },
        { path: 'department', select: 'name code' },
        { path: 'academicSession', select: 'label yearNumber' },
      ],
    })
    .populate('student', 'systemId name email department section')
    .lean();

  if (!enrollment?.section?._id) {
    const error = new Error('No active enrollment found for this student');
    error.statusCode = 404;
    throw error;
  }

  const sectionId = enrollment.section._id;
  const scope = await getScopeFilter(requester, 'sections');
  if (String(studentId) !== String(requester?.id) && scope && Object.keys(scope).length) {
    const allowed = await Section.exists({ _id: sectionId, ...scope, isActive: true });
    if (!allowed) {
      const error = new Error('This student is outside your assigned academic scope');
      error.statusCode = 403;
      throw error;
    }
  }

  const [subjectIds, attendanceSummary, subjectCatalog, assessments] = await Promise.all([
    getSubjectIdsForSection(sectionId),
    getAttendanceRateForStudent(studentId, sectionId),
    buildSubjectCatalog({ subjectQuery: { _id: { $in: await getSubjectIdsForSection(sectionId) } }, scopedSectionIds: [sectionId] }),
    AssessmentSession.find({ sectionId, isDeleted: false, status: { $ne: 'draft' } })
      .sort({ date: -1, createdAt: -1 })
      .populate(buildAssessmentPopulate())
      .lean(),
  ]);

  const assessmentSummary = summarizeSubjectAssessments(subjectCatalog, assessments, studentId);
  const weakSubjects = assessmentSummary.breakdown.filter((entry) => entry.totalMarks > 0 && entry.percentage < 60);
  const eligible = attendanceSummary.attendanceRate >= 75 && assessmentSummary.overall.percentage >= 40 && weakSubjects.length === 0;

  return {
    student,
    enrollment,
    attendance: attendanceSummary,
    assessments: {
      ...assessmentSummary,
      weakSubjects,
      eligibility: {
        isEligible: eligible,
        attendanceThreshold: 75,
        marksThreshold: 40,
        reasons: [
          attendanceSummary.attendanceRate < 75 ? 'Attendance is below the eligibility threshold.' : '',
          assessmentSummary.overall.percentage < 40 ? 'Overall marks are below the minimum threshold.' : '',
          weakSubjects.length ? 'One or more subjects need focused improvement.' : '',
        ].filter(Boolean),
      },
      recommendations: buildRecommendations({
        attendanceRate: attendanceSummary.attendanceRate,
        percentage: assessmentSummary.overall.percentage,
        weakSubjects,
      }),
    },
  };
};

const getAssessmentDashboardSummary = async (user) => {
  const role = normalizeRole(user?.role);
  if (role === 'student') {
    const overview = await getStudentAssessmentOverview(user.id, user);
    return {
      role,
      totalAssessments: overview.assessments.overall.totalAssessments,
      completedAssessments: overview.assessments.overall.completedAssessments,
      pendingAssessments: overview.assessments.overall.pendingAssessments,
      percentage: overview.assessments.overall.percentage,
      attendanceRate: overview.attendance.attendanceRate,
      eligible: overview.assessments.eligibility.isEligible,
      eligibilityReasons: overview.assessments.eligibility.reasons,
      recommendations: overview.assessments.recommendations,
      weakSubjects: overview.assessments.weakSubjects.slice(0, 3),
      subjectPerformance: overview.assessments.breakdown.slice(0, 6),
      recentAssessments: overview.assessments.breakdown.slice(0, 4),
    };
  }

  const query = await buildAssessmentQuery(user, {});
  const assessments = await AssessmentSession.find({ ...query, isDeleted: false })
    .sort({ date: -1, createdAt: -1 })
    .limit(50)
    .populate(buildAssessmentPopulate())
    .lean();

  const recentAssessments = assessments.slice(0, 5).map((assessment) => ({
    id: assessment._id,
    title: assessment.title,
    type: assessment.assessmentType,
    subject: assessment.subjectId?.code || assessment.subject || '',
    section: assessment.sectionId?.name || '',
    date: assessment.date,
    maxMarks: assessment.maxMarks,
    status: assessment.status,
  }));

  const pendingGrading = assessments.reduce((count, assessment) => count + (assessment.records || []).filter((record) => record.status === 'pending' || record.marks === null).length, 0);
  let overallTotalMarks = 0;
  let overallObtainedMarks = 0;
  const lowPerformanceAlerts = assessments.reduce((count, assessment) => {
    const completed = (assessment.records || []).filter((record) => record.status === 'graded' || record.status === 'absent');
    if (!completed.length) return count;
    const totalMarks = completed.length * assessment.maxMarks;
    const obtainedMarks = completed.reduce((sum, record) => sum + (record.status === 'absent' ? 0 : normalizeNumber(record.marks, 0)), 0);
    overallTotalMarks += totalMarks;
    overallObtainedMarks += obtainedMarks;
    const percentage = totalMarks ? (obtainedMarks / totalMarks) * 100 : 0;
    return percentage < 50 ? count + 1 : count;
  }, 0);

  return {
    role,
    totalAssessments: assessments.length,
    completedAssessments: assessments.filter((assessment) => (assessment.records || []).some((record) => ['graded', 'absent'].includes(record.status))).length,
    pendingGrading,
    pendingAssessments: pendingGrading,
    lowPerformanceAlerts,
    percentage: overallTotalMarks ? Number(((overallObtainedMarks / overallTotalMarks) * 100).toFixed(2)) : 0,
    recentAssessments,
  };
};

module.exports = {
  normalizeAssessmentType,
  getAssessmentTypeLabel,
  listAssessments,
  getAssessmentById,
  createAssessment,
  updateAssessment,
  deleteAssessment,
  getStudentAssessmentOverview,
  getAssessmentDashboardSummary,
};
