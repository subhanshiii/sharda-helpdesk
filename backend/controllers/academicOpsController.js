const TimetableEntry = require('../models/TimetableEntry');
const AttendanceSession = require('../models/AttendanceSession');
const Enrollment = require('../models/Enrollment');
const Section = require('../models/Section');
const Subject = require('../models/Subject');
const SectionSubject = require('../models/SectionSubject');
const User = require('../models/User');
const { isAdminRole, normalizeRole } = require('../utils/roleHelpers');

const canManageAcademicOps = (user) => ['faculty', 'admin'].includes(normalizeRole(user.role));

const buildAcademicScope = (user) => {
  const role = normalizeRole(user.role);

  if (role === 'student') {
    return {
      department: user.department,
      year: user.year,
      section: user.section,
    };
  }

  if (role === 'faculty') {
    return { faculty: user.id };
  }

  return {};
};

const getActiveEnrollment = async (userId) => Enrollment.findOne({ student: userId, status: 'active' })
  .populate({
    path: 'section',
    populate: [{ path: 'department', select: 'name' }],
  });

const getFacultyAssignments = async (facultyId) => SectionSubject.find({ faculty: facultyId, isActive: true })
  .select('section subject')
  .lean();

const getFacultySectionIds = async (facultyId) => {
  const assignments = await getFacultyAssignments(facultyId);
  return [...new Set(assignments.map((assignment) => assignment.section?.toString()).filter(Boolean))];
};

const ensureFacultySectionAccess = async (user, sectionId, subjectId = null) => {
  if (normalizeRole(user.role) !== 'faculty') {
    return;
  }

  if (!sectionId) {
    return;
  }

  const query = {
    faculty: user.id,
    isActive: true,
    section: sectionId,
  };

  if (subjectId) {
    query.subject = subjectId;
  }

  const assignment = await SectionSubject.findOne(query).lean();
  if (!assignment) {
    const error = new Error('Faculty can only access sections assigned to them');
    error.statusCode = 403;
    throw error;
  }
};

const toMinutes = (value = '') => {
  const [hours, minutes] = String(value).split(':').map(Number);
  return (hours * 60) + (minutes || 0);
};

const overlaps = (startA, endA, startB, endB) => startA < endB && startB < endA;

const buildTimetablePayload = async (body, userId) => {
  const payload = {
    ...body,
    faculty: body.faculty || userId,
    subjectId: body.subjectId || null,
    sectionId: body.sectionId || null,
  };

  if (payload.sectionId) {
    const section = await Section.findById(payload.sectionId).populate('department');
    if (!section) {
      const error = new Error('Section not found');
      error.statusCode = 404;
      throw error;
    }
    payload.section = section.name;
    payload.department = section.department?.name || body.department || '';
  }

  if (payload.subjectId) {
    const subject = await Subject.findById(payload.subjectId);
    if (!subject) {
      const error = new Error('Subject not found');
      error.statusCode = 404;
      throw error;
    }
    payload.subject = subject.name;
    payload.subjectCode = body.subjectCode || subject.code || '';
  }

  if (!payload.subjectCode && body.subjectCode) {
    payload.subjectCode = String(body.subjectCode).trim();
  }

  return payload;
};

const ensureTimetableConflicts = async (payload, excludeId = null) => {
  const baseQuery = {
    dayOfWeek: payload.dayOfWeek,
    isActive: true,
  };
  if (excludeId) baseQuery._id = { $ne: excludeId };

  const sectionQuery = payload.sectionId
    ? { ...baseQuery, sectionId: payload.sectionId }
    : { ...baseQuery, department: payload.department, year: payload.year, section: payload.section };

  const facultyQuery = {
    ...baseQuery,
    faculty: payload.faculty,
  };

  const [sectionEntries, facultyEntries] = await Promise.all([
    TimetableEntry.find(sectionQuery).select('startTime endTime').lean(),
    TimetableEntry.find(facultyQuery).select('startTime endTime').lean(),
  ]);

  const start = toMinutes(payload.startTime);
  const end = toMinutes(payload.endTime);

  if (sectionEntries.some((entry) => overlaps(start, end, toMinutes(entry.startTime), toMinutes(entry.endTime)))) {
    const error = new Error('Section already has a class during this time');
    error.statusCode = 400;
    throw error;
  }

  if (facultyEntries.some((entry) => overlaps(start, end, toMinutes(entry.startTime), toMinutes(entry.endTime)))) {
    const error = new Error('Faculty is already scheduled during this time');
    error.statusCode = 400;
    throw error;
  }
};

exports.getTimetable = async (req, res, next) => {
  try {
    const role = normalizeRole(req.user.role);
    const query = { isActive: true };

    if (role === 'student') {
      const enrollment = await getActiveEnrollment(req.user.id);
      if (enrollment?.section?._id) {
        query.sectionId = enrollment.section._id;
      } else {
        query.department = req.user.department;
        query.year = req.user.year;
        query.section = req.user.section;
      }
    } else if (role === 'faculty') {
      query.faculty = req.user.id;
    } else if (req.query.sectionId) {
      query.sectionId = req.query.sectionId;
    }

    const entries = await TimetableEntry.find(query)
      .populate('faculty', 'name email role department')
      .populate('sectionId', 'name')
      .populate('subjectId', 'name code')
      .sort({ dayOfWeek: 1, startTime: 1 })
      .lean();

    res.status(200).json({ success: true, count: entries.length, data: entries });
  } catch (error) {
    next(error);
  }
};

exports.createTimetableEntry = async (req, res, next) => {
  try {
    if (!canManageAcademicOps(req.user)) {
      return res.status(403).json({ success: false, message: 'Not authorized to manage timetable' });
    }

    const payload = await buildTimetablePayload(req.body, req.user.id);
    await ensureFacultySectionAccess(req.user, payload.sectionId, payload.subjectId);
    await ensureTimetableConflicts(payload);

    const entry = await TimetableEntry.create({
      ...payload,
      createdBy: req.user.id,
    });

    if (payload.subjectCode && payload.subjectId) {
      await TimetableEntry.updateMany(
        {
          _id: { $ne: entry._id },
          subjectId: payload.subjectId,
        },
        { $set: { subjectCode: payload.subjectCode } }
      );
    }

    const populated = await TimetableEntry.findById(entry._id)
      .populate('faculty', 'name email role department')
      .populate('sectionId', 'name')
      .populate('subjectId', 'name code')
      .lean();

    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    next(error);
  }
};

exports.updateTimetableEntry = async (req, res, next) => {
  try {
    if (!canManageAcademicOps(req.user)) {
      return res.status(403).json({ success: false, message: 'Not authorized to manage timetable' });
    }

    const query = isAdminRole(req.user.role)
      ? { _id: req.params.id }
      : { _id: req.params.id, $or: [{ faculty: req.user.id }, { createdBy: req.user.id }] };

    const payload = await buildTimetablePayload(req.body, req.user.id);
    await ensureFacultySectionAccess(req.user, payload.sectionId, payload.subjectId);
    await ensureTimetableConflicts(payload, req.params.id);

    const updated = await TimetableEntry.findOneAndUpdate(query, payload, { new: true, runValidators: true })
      .populate('faculty', 'name email role department')
      .populate('sectionId', 'name')
      .populate('subjectId', 'name code')
      .lean();

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Timetable entry not found' });
    }

    if (payload.subjectCode && payload.subjectId) {
      await TimetableEntry.updateMany(
        {
          _id: { $ne: updated._id },
          subjectId: payload.subjectId,
        },
        { $set: { subjectCode: payload.subjectCode } }
      );
    }

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

exports.deleteTimetableEntry = async (req, res, next) => {
  try {
    if (!canManageAcademicOps(req.user)) {
      return res.status(403).json({ success: false, message: 'Not authorized to manage timetable' });
    }

    const query = isAdminRole(req.user.role)
      ? { _id: req.params.id }
      : { _id: req.params.id, $or: [{ faculty: req.user.id }, { createdBy: req.user.id }] };

    const entry = await TimetableEntry.findOne(query);
    if (!entry) {
      return res.status(404).json({ success: false, message: 'Timetable entry not found' });
    }

    await entry.deleteOne();
    res.status(200).json({ success: true, message: 'Timetable entry deleted' });
  } catch (error) {
    next(error);
  }
};

exports.getAttendanceOptions = async (req, res, next) => {
  try {
    const { department, year, section } = req.query;
    const userScope = buildAcademicScope(req.user);
    const role = normalizeRole(req.user.role);

    if (req.query.sectionId) {
      await ensureFacultySectionAccess(req.user, req.query.sectionId, req.query.subjectId || null);
      const enrollmentQuery = { section: req.query.sectionId, status: 'active' };
      const enrollments = await Enrollment.find(enrollmentQuery)
        .populate('student', 'name email department year section sectionId')
        .lean();

      const students = enrollments
        .map((enrollment) => enrollment.student)
        .filter(Boolean)
        .sort((a, b) => String(a.name).localeCompare(String(b.name)));

      return res.status(200).json({ success: true, data: students });
    }

    if (role === 'faculty') {
      const allowedSectionIds = await getFacultySectionIds(req.user.id);
      const enrollments = await Enrollment.find({ section: { $in: allowedSectionIds }, status: 'active' })
        .populate('student', 'name email department year section sectionId')
        .lean();

      const filteredStudents = enrollments
        .map((enrollment) => enrollment.student)
        .filter(Boolean)
        .filter((student) => (!department || student.department === department)
          && (!year || student.year === year)
          && (!section || student.section === section))
        .sort((a, b) => String(a.name).localeCompare(String(b.name)));

      return res.status(200).json({ success: true, data: filteredStudents });
    }

    const lookup = {
      department: department || userScope.department,
      year: year || userScope.year,
      section: section || userScope.section,
      role: 'student',
      isActive: true,
    };

    const students = await User.find(lookup)
      .select('name email department year section')
      .sort({ name: 1 })
      .lean();

    res.status(200).json({ success: true, data: students });
  } catch (error) {
    next(error);
  }
};

exports.getAttendanceSessions = async (req, res, next) => {
  try {
    const role = normalizeRole(req.user.role);
    const query = {};

    if (role === 'student') {
      const enrollment = await getActiveEnrollment(req.user.id);
      if (enrollment?.section?._id) {
        query.sectionId = enrollment.section._id;
      } else {
        query.department = req.user.department;
        query.year = req.user.year;
        query.section = req.user.section;
      }
    } else if (role === 'faculty') {
      const allowedSectionIds = await getFacultySectionIds(req.user.id);
      query.sectionId = { $in: allowedSectionIds };
      query.faculty = req.user.id;
      if (req.query.sectionId && !allowedSectionIds.includes(String(req.query.sectionId))) {
        return res.status(403).json({ success: false, message: 'Faculty cannot access attendance for this section' });
      }
    } else if (req.query.sectionId) {
      query.sectionId = req.query.sectionId;
    }

    const sessions = await AttendanceSession.find(query)
      .populate('faculty', 'name email role department')
      .populate('records.student', 'name email department year section')
      .populate('sectionId', 'name')
      .populate('subjectId', 'name code')
      .sort({ date: -1 })
      .limit(40)
      .lean();

    const data = role === 'student'
      ? sessions.map((session) => ({
          ...session,
          myRecord: session.records.find((record) => record.student?._id?.toString() === req.user.id) || null,
        }))
      : sessions;

    res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    next(error);
  }
};

exports.createAttendanceSession = async (req, res, next) => {
  try {
    if (!canManageAcademicOps(req.user)) {
      return res.status(403).json({ success: false, message: 'Not authorized to manage attendance' });
    }

    const payload = await buildTimetablePayload(req.body, req.user.id);
    await ensureFacultySectionAccess(req.user, payload.sectionId, payload.subjectId);
    const session = await AttendanceSession.create({
      ...payload,
      faculty: req.user.id,
      createdBy: req.user.id,
      records: Array.isArray(req.body.records) ? req.body.records : [],
    });

    const populated = await AttendanceSession.findById(session._id)
      .populate('faculty', 'name email role department')
      .populate('records.student', 'name email department year section')
      .populate('sectionId', 'name')
      .populate('subjectId', 'name code')
      .lean();

    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    next(error);
  }
};

exports.updateAttendanceSession = async (req, res, next) => {
  try {
    if (!canManageAcademicOps(req.user)) {
      return res.status(403).json({ success: false, message: 'Not authorized to manage attendance' });
    }

    const query = isAdminRole(req.user.role)
      ? { _id: req.params.id }
      : { _id: req.params.id, $or: [{ faculty: req.user.id }, { createdBy: req.user.id }] };

    const payload = await buildTimetablePayload(req.body, req.user.id);
    await ensureFacultySectionAccess(req.user, payload.sectionId, payload.subjectId);
    const update = {
      title: payload.title,
      subject: payload.subject,
      subjectId: payload.subjectId,
      department: payload.department,
      year: payload.year,
      section: payload.section,
      sectionId: payload.sectionId,
      date: payload.date,
      topic: payload.topic,
    };

    if (Array.isArray(req.body.records)) {
      update.records = req.body.records.map((record) => ({
        student: record.student,
        status: record.status,
        markedAt: record.markedAt || new Date(),
      }));
    }

    const updated = await AttendanceSession.findOneAndUpdate(query, update, { new: true, runValidators: true })
      .populate('faculty', 'name email role department')
      .populate('records.student', 'name email department year section')
      .populate('sectionId', 'name')
      .populate('subjectId', 'name code')
      .lean();

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Attendance session not found' });
    }

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};
