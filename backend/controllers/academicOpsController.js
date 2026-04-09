const TimetableEntry = require('../models/TimetableEntry');
const AttendanceSession = require('../models/AttendanceSession');
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

exports.getTimetable = async (req, res, next) => {
  try {
    const role = normalizeRole(req.user.role);
    const query = { isActive: true };

    if (role === 'student') {
      query.department = req.user.department;
      query.year = req.user.year;
      query.section = req.user.section;
    } else if (role === 'faculty') {
      query.$or = [
        { faculty: req.user.id },
        { department: req.user.department },
      ];
    }

    const entries = await TimetableEntry.find(query)
      .populate('faculty', 'name email role department')
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

    const entry = await TimetableEntry.create({
      ...req.body,
      faculty: req.body.faculty || req.user.id,
      createdBy: req.user.id,
    });

    const populated = await TimetableEntry.findById(entry._id)
      .populate('faculty', 'name email role department')
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

    const updated = await TimetableEntry.findOneAndUpdate(query, req.body, { new: true, runValidators: true })
      .populate('faculty', 'name email role department')
      .lean();

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Timetable entry not found' });
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
      query.department = req.user.department;
      query.year = req.user.year;
      query.section = req.user.section;
    } else if (role === 'faculty') {
      query.$or = [{ faculty: req.user.id }, { department: req.user.department }];
    }

    const sessions = await AttendanceSession.find(query)
      .populate('faculty', 'name email role department')
      .populate('records.student', 'name email department year section')
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

    const session = await AttendanceSession.create({
      ...req.body,
      faculty: req.user.id,
      createdBy: req.user.id,
      records: Array.isArray(req.body.records) ? req.body.records : [],
    });

    const populated = await AttendanceSession.findById(session._id)
      .populate('faculty', 'name email role department')
      .populate('records.student', 'name email department year section')
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

    const update = {
      title: req.body.title,
      subject: req.body.subject,
      department: req.body.department,
      year: req.body.year,
      section: req.body.section,
      date: req.body.date,
      topic: req.body.topic,
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
      .lean();

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Attendance session not found' });
    }

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};
