const TimetableEntry = require('../models/TimetableEntry');
const AttendanceSession = require('../models/AttendanceSession');
const Enrollment = require('../models/Enrollment');
const Section = require('../models/Section');
const Subject = require('../models/Subject');
const SectionSubject = require('../models/SectionSubject');
const User = require('../models/User');
const { isAdminRole, normalizeRole } = require('../utils/roleHelpers');
const { buildTimetableQuery } = require('../utils/timetableQuery');

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

const ensureFacultySectionAccess = async (user, sectionId, subjectId = null) => {
  if (normalizeRole(user.role) !== 'faculty') {
    return;
  }

  if (!sectionId) {
    return;
  }

  const query = {
    isActive: true,
    section: sectionId,
    $or: [
      { faculty: user.id },
      { facultyMembers: user.id },
    ],
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

const buildTimetablePayload = async (body, userId, userDoc = null) => {
  const payload = {
    ...body,
    faculty: body.faculty || userId,
    subjectId: body.subjectId || null,
    sectionId: body.sectionId || null,
  };

  if (payload.sectionId) {
    const section = await Section.findById(payload.sectionId).populate('department academicSession');
    if (!section) {
      const error = new Error('Section not found');
      error.statusCode = 404;
      throw error;
    }
    payload.section = section.name;
    payload.department = section.department?.name || body.department || '';
    payload.year = body.year || String(section.academicSession?.yearNumber || section.studyYear || '');
  } else {
    // Backward compatibility: use body fields if not using sectionId
    // Allow empty values for admins who don't have specific department/year/section
    payload.department = body.department || userDoc?.department || '';
    payload.year = body.year || userDoc?.year || '';
    payload.section = body.section || userDoc?.section || '';
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
    isDeleted: false,
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
    const query = await buildTimetableQuery(req.user, {
      collegeId: req.query.collegeId,
      departmentId: req.query.departmentId,
      programId: req.query.programId,
      courseId: req.query.courseId,
      studyYear: req.query.studyYear,
      sectionId: req.query.sectionId,
    });

    const entries = await TimetableEntry.find(query)
      .populate('faculty', 'name email role department')
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

    const payload = await buildTimetablePayload(req.body, req.user.id, req.user);
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

exports.getTimetableEntry = async (req, res, next) => {
  try {
    const scopeQuery = await buildTimetableQuery(req.user, {});
    const query = scopeQuery.$or || scopeQuery.sectionId || scopeQuery.department
      ? { $and: [{ _id: req.params.id }, scopeQuery] }
      : { _id: req.params.id, isActive: true, isDeleted: false };

    const entry = await TimetableEntry.findOne(query)
      .populate('faculty', 'name email role department')
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
      .lean();

    if (!entry) {
      return res.status(404).json({ success: false, message: 'Timetable entry not found' });
    }

    res.status(200).json({ success: true, data: entry });
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

    const payload = await buildTimetablePayload(req.body, req.user.id, req.user);
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

    // FIX #11: Implement soft delete instead of permanent deletion
    const entry = await TimetableEntry.findOneAndUpdate(
      query,
      {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: req.user.id,
      },
      { new: true }
    );
    
    if (!entry) {
      return res.status(404).json({ success: false, message: 'Timetable entry not found' });
    }

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
    const query = { isDeleted: false };  // FIX #11: Soft delete support

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
      if (!allowedSectionIds.length) {
        return res.status(200).json({ success: true, count: 0, data: [] });
      }
      query.sectionId = { $in: allowedSectionIds };
      query.faculty = req.user.id;
      if (req.query.sectionId && !allowedSectionIds.includes(String(req.query.sectionId))) {
        return res.status(403).json({ success: false, message: 'Faculty cannot access attendance for this section' });
      }
    } else if (req.query.sectionId) {
      query.sectionId = req.query.sectionId;
    }

    // FIX #8, #15: Add pagination with sensible limits
    const limit = Math.min(parseInt(req.query.limit) || 40, 100);
    const skip = parseInt(req.query.skip) || 0;

    // FIX #13: Optimize queries - use projection to limit fields returned
    const sessions = await AttendanceSession.find(query)
      .populate('faculty', 'name email role department')
      .populate('records.student', 'name email')
      .populate('sectionId', 'name')
      .populate('subjectId', 'name code')
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
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

    const payload = await buildTimetablePayload(req.body, req.user.id, req.user);
    await ensureFacultySectionAccess(req.user, payload.sectionId, payload.subjectId);
    
    // CRITICAL FIX #1: Prevent duplicate attendance for same session
    if (payload.sectionId && payload.date && payload.title) {
      const existing = await AttendanceSession.findOne({
        sectionId: payload.sectionId,
        date: { $gte: new Date(payload.date).setHours(0, 0, 0, 0), $lt: new Date(payload.date).setHours(23, 59, 59, 999) },
        title: payload.title,
        isDeleted: false,
      });
      if (existing) {
        const error = new Error('Attendance already marked for this session today. Update the existing record instead.');
        error.statusCode = 409;
        throw error;
      }
    }
    
    // CRITICAL FIX #2: Validate all students are actually enrolled in section
    const recordsArray = Array.isArray(req.body.records) ? req.body.records : [];
    if (payload.sectionId && recordsArray.length > 0) {
      const validStudentIds = await Enrollment.find({
        section: payload.sectionId,
        status: 'active',
      }).distinct('student');
      
      const submittedStudentIds = recordsArray.map(r => String(r.student));
      const invalidStudents = submittedStudentIds.filter(
        studentId => !validStudentIds.some(id => String(id) === studentId)
      );
      
      if (invalidStudents.length > 0) {
        const error = new Error(`${invalidStudents.length} student(s) are not enrolled in this section`);
        error.statusCode = 400;
        throw error;
      }
    }

    const session = await AttendanceSession.create({
      ...payload,
      faculty: req.user.id,
      createdBy: req.user.id,
      records: recordsArray,
      isDeleted: false,
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

    const payload = await buildTimetablePayload(req.body, req.user.id, req.user);
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

exports.deleteAttendanceSession = async (req, res, next) => {
  try {
    if (!canManageAcademicOps(req.user)) {
      return res.status(403).json({ success: false, message: 'Not authorized to manage attendance' });
    }

    const query = isAdminRole(req.user.role)
      ? { _id: req.params.id }
      : { _id: req.params.id, $or: [{ faculty: req.user.id }, { createdBy: req.user.id }] };

    // Soft delete - FIX #11: Soft delete support
    const session = await AttendanceSession.findOneAndUpdate(
      query,
      {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: req.user.id,
      },
      { new: true }
    );

    if (!session) {
      return res.status(404).json({ success: false, message: 'Attendance session not found' });
    }

    res.status(200).json({ success: true, message: 'Attendance session deleted' });
  } catch (error) {
    next(error);
  }
};
