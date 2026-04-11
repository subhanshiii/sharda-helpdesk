const mongoose = require('mongoose');
const College = require('../models/College');
const Department = require('../models/Department');
const Program = require('../models/Program');
const Course = require('../models/Course');
const AcademicSession = require('../models/AcademicSession');
const Section = require('../models/Section');
const Subject = require('../models/Subject');
const SectionSubject = require('../models/SectionSubject');
const Enrollment = require('../models/Enrollment');
const AttendanceSession = require('../models/AttendanceSession');
const User = require('../models/User');
const { normalizeRole } = require('../utils/roleHelpers');
const { getScopeFilter } = require('../utils/scopeGuard');
const { buildStructureTree, runQuickAcademicSetup } = require('../utils/academicSetupService');

const normalizeString = (value) => String(value || '').trim();
const normalizeCode = (value) => normalizeString(value).toUpperCase();
const normalizeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const ensureResourceExists = async (Model, id, label) => {
  const doc = await Model.findById(id).lean();
  if (!doc) {
    const error = new Error(`${label} not found`);
    error.statusCode = 404;
    throw error;
  }
  return doc;
};

const resolveAcademicSessionId = (body = {}) => body.academicSession || body.academicYear || '';

const buildAcademicPayload = async (resource, body = {}) => {
  const payload = { ...body };

  if (resource === 'colleges') {
    payload.name = normalizeString(body.name);
    payload.code = normalizeCode(body.code);
    payload.description = normalizeString(body.description);
    return payload;
  }

  if (resource === 'departments') {
    const college = await ensureResourceExists(College, body.college || body.collegeId, 'College');
    payload.college = college._id;
    payload.name = normalizeString(body.name);
    payload.code = normalizeCode(body.code);
    return payload;
  }

  if (resource === 'programs') {
    const department = await ensureResourceExists(Department, body.department, 'Department');
    payload.name = normalizeString(body.name);
    payload.code = normalizeCode(body.code);
    payload.department = department._id;
    payload.durationYears = normalizeNumber(body.durationYears, 4);
    return payload;
  }

  if (resource === 'courses') {
    const [program, department] = await Promise.all([
      ensureResourceExists(Program, body.program, 'Program'),
      ensureResourceExists(Department, body.department, 'Department'),
    ]);
    if (String(program.department) !== String(department._id)) {
      const error = new Error('Course department must match the selected program department');
      error.statusCode = 400;
      throw error;
    }
    payload.name = normalizeString(body.name);
    payload.code = normalizeCode(body.code);
    payload.program = program._id;
    payload.department = department._id;
    return payload;
  }

  if (resource === 'years' || resource === 'academic-sessions') {
    const program = await ensureResourceExists(Program, body.program, 'Program');
    payload.program = program._id;
    payload.yearNumber = normalizeNumber(body.yearNumber, 1);
    payload.label = normalizeString(body.label);
    return payload;
  }

  if (resource === 'sections') {
    const [program, course, academicSession, department] = await Promise.all([
      ensureResourceExists(Program, body.program, 'Program'),
      body.course ? ensureResourceExists(Course, body.course, 'Course') : null,
      ensureResourceExists(AcademicSession, resolveAcademicSessionId(body), 'Academic Session'),
      ensureResourceExists(Department, body.department, 'Department'),
    ]);

    if (String(program.department) !== String(department._id)) {
      const error = new Error('Section department must match the selected program department');
      error.statusCode = 400;
      throw error;
    }
    if (course && String(course.program) !== String(program._id)) {
      const error = new Error('Selected course does not belong to the selected program');
      error.statusCode = 400;
      throw error;
    }
    if (String(academicSession.program) !== String(program._id)) {
      const error = new Error('Academic session must belong to the selected program');
      error.statusCode = 400;
      throw error;
    }

    payload.program = program._id;
    payload.course = course?._id || null;
    payload.academicSession = academicSession._id;
    payload.studyYear = academicSession.yearNumber;
    payload.department = department._id;
    payload.name = normalizeString(body.name);
    payload.capacity = normalizeNumber(body.capacity, 60);
    return payload;
  }

  if (resource === 'subjects') {
    const [department, program, course, academicSession] = await Promise.all([
      ensureResourceExists(Department, body.department, 'Department'),
      ensureResourceExists(Program, body.program, 'Program'),
      body.course ? ensureResourceExists(Course, body.course, 'Course') : null,
      ensureResourceExists(AcademicSession, resolveAcademicSessionId(body), 'Academic Session'),
    ]);

    if (String(program.department) !== String(department._id)) {
      const error = new Error('Subject department must match the selected program department');
      error.statusCode = 400;
      throw error;
    }
    if (course && String(course.program) !== String(program._id)) {
      const error = new Error('Selected course does not belong to the selected program');
      error.statusCode = 400;
      throw error;
    }
    if (String(academicSession.program) !== String(program._id)) {
      const error = new Error('Academic session must belong to the selected program');
      error.statusCode = 400;
      throw error;
    }

    payload.code = normalizeCode(body.code);
    payload.name = normalizeString(body.name);
    payload.department = department._id;
    payload.program = program._id;
    payload.course = course?._id || null;
    payload.academicSession = academicSession._id;
    payload.credits = normalizeNumber(body.credits, 0);
    return payload;
  }

  if (resource === 'section-subjects') {
    const [section, subject, faculty] = await Promise.all([
      ensureResourceExists(Section, body.section, 'Section'),
      ensureResourceExists(Subject, body.subject, 'Subject'),
      body.faculty || body.facultyId ? ensureResourceExists(User, body.faculty || body.facultyId, 'Faculty user') : null,
    ]);

    if (faculty && normalizeRole(faculty.role) !== 'faculty' && normalizeRole(faculty.role) !== 'admin') {
      const error = new Error('Selected user cannot be assigned as faculty');
      error.statusCode = 400;
      throw error;
    }
    if (String(subject.program) !== String(section.program)) {
      const error = new Error('Subject program must match the selected section program');
      error.statusCode = 400;
      throw error;
    }
    if (section.course && subject.course && String(subject.course) !== String(section.course)) {
      const error = new Error('Subject course must match the selected section course');
      error.statusCode = 400;
      throw error;
    }
    if (String(subject.academicSession) !== String(section.academicSession)) {
      const error = new Error('Subject academic session must match the selected section academic session');
      error.statusCode = 400;
      throw error;
    }

    payload.section = section._id;
    payload.subject = subject._id;
    payload.faculty = faculty?._id || null;
    payload.semester = normalizeString(body.semester);
    return payload;
  }

  if (resource === 'enrollments') {
    const [student, section, academicSession] = await Promise.all([
      ensureResourceExists(User, body.student, 'Student user'),
      ensureResourceExists(Section, body.section, 'Section'),
      ensureResourceExists(AcademicSession, resolveAcademicSessionId(body) || body.academicSession, 'Academic Session'),
    ]);

    if (normalizeRole(student.role) !== 'student') {
      const error = new Error('Only student users can be enrolled into sections');
      error.statusCode = 400;
      throw error;
    }
    if (String(section.academicSession) !== String(academicSession._id)) {
      const error = new Error('Enrollment academic session must match the selected section academic session');
      error.statusCode = 400;
      throw error;
    }

    payload.student = student._id;
    payload.section = section._id;
    payload.academicSession = academicSession._id;
    payload.semester = normalizeString(body.semester);
    payload.status = normalizeString(body.status) || 'active';
    return payload;
  }

  return payload;
};

const modelMap = {
  colleges: College,
  departments: Department,
  programs: Program,
  courses: Course,
  years: AcademicSession,
  'academic-sessions': AcademicSession,
  sections: Section,
  subjects: Subject,
  'section-subjects': SectionSubject,
  enrollments: Enrollment,
};

const populateMap = {
  departments: 'college',
  programs: 'department',
  courses: 'program department',
  years: 'program',
  'academic-sessions': 'program',
  sections: 'program course academicSession department advisorFaculty',
  subjects: 'department program course academicSession',
  'section-subjects': 'section subject faculty',
  enrollments: 'student section academicSession',
};

const getModel = (resource) => modelMap[resource];

exports.getProgramReport = async (req, res, next) => {
  try {
    const programs = await Program.find({ isActive: true })
      .populate('department', 'name code')
      .sort({ createdAt: -1 })
      .lean();

    const programIds = programs.map((program) => program._id);
    const [coursesByProgram, subjectsByCourse, sectionsByProgram, enrollmentsBySection] = await Promise.all([
      Course.aggregate([
        { $match: { program: { $in: programIds }, isActive: true } },
        { $group: { _id: '$program', courseIds: { $addToSet: '$_id' }, courseCount: { $sum: 1 } } },
      ]),
      Subject.aggregate([
        { $match: { program: { $in: programIds }, isActive: true } },
        { $group: { _id: '$course', subjectCount: { $sum: 1 } } },
      ]),
      Section.aggregate([
        { $match: { program: { $in: programIds }, isActive: true } },
        { $group: { _id: '$program', sectionIds: { $addToSet: '$_id' }, sectionCount: { $sum: 1 } } },
      ]),
      Enrollment.aggregate([
        { $match: { status: 'active' } },
        { $group: { _id: '$section', activeStudents: { $sum: 1 } } },
      ]),
    ]);

    const courseMap = new Map(coursesByProgram.map((entry) => [String(entry._id), entry]));
    const subjectMap = new Map(subjectsByCourse.map((entry) => [String(entry._id), entry.subjectCount]));
    const enrollmentMap = new Map(enrollmentsBySection.map((entry) => [String(entry._id), entry.activeStudents]));

    const data = programs.map((program) => {
      const sectionEntry = sectionsByProgram.find((entry) => String(entry._id) === String(program._id));
      const courseEntry = courseMap.get(String(program._id));
      const enrolledStudents = (sectionEntry?.sectionIds || []).reduce(
        (total, sectionId) => total + (enrollmentMap.get(String(sectionId)) || 0),
        0
      );
      const subjectCount = (courseEntry?.courseIds || []).reduce((total, courseId) => total + (subjectMap.get(String(courseId)) || 0), 0);

      return {
        ...program,
        subjectCount,
        courseCount: courseEntry?.courseCount || 0,
        sectionCount: sectionEntry?.sectionCount || 0,
        enrolledStudents,
      };
    });

    res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    next(error);
  }
};

exports.getStructureTree = async (req, res, next) => {
  try {
    const data = await buildStructureTree(req.user);
    res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    next(error);
  }
};

exports.quickSetup = async (req, res, next) => {
  try {
    const payload = req.body || {};
    const years = Array.isArray(payload.years) ? payload.years : [];
    if (!payload.collegeId || !payload.department || !payload.program || !payload.course || !(payload.academicSession || payload.academicYear) || !years.length) {
      return res.status(400).json({
        success: false,
        message: 'College, department, program, course, academic session, and study years are required',
      });
    }

    const result = await runQuickAcademicSetup({
      collegeId: payload.collegeId,
      department: payload.department,
      departmentCode: payload.departmentCode,
      program: payload.program,
      programCode: payload.programCode,
      course: payload.course,
      courseCode: payload.courseCode,
      academicSession: payload.academicSession || payload.academicYear,
      years,
      sectionsPerYear: payload.sectionsPerYear || {},
      capacity: payload.capacity,
    });

    res.status(201).json({
      success: true,
      message: 'Academic structure created successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

exports.getEnrollmentReport = async (req, res, next) => {
  try {
    const status = req.query.status || 'active';
    const query = {};
    if (status) query.status = status;
    if (req.query.program) query.program = req.query.program;
    if (req.query.section) query.section = req.query.section;
    if (req.query.student) query.student = req.query.student;

    const enrollments = await Enrollment.find(query)
      .populate('student', 'systemId name email role department section')
      .populate({
        path: 'section',
        populate: [
          { path: 'program', select: 'name code department' },
          { path: 'course', select: 'name code' },
          { path: 'academicSession', select: 'label yearNumber' },
          { path: 'department', select: 'name code' },
        ],
      })
      .populate('academicSession', 'label yearNumber')
      .sort({ createdAt: -1 })
      .lean();

    const sectionIds = [...new Set(enrollments.map((entry) => entry.section?._id).filter(Boolean).map(String))];
    const sectionObjectIds = sectionIds.map((id) => new mongoose.Types.ObjectId(id));
    const subjectsBySection = await SectionSubject.aggregate([
      { $match: { section: { $in: sectionObjectIds }, isActive: true } },
      { $group: { _id: '$section', subjectCount: { $sum: 1 } } },
    ]);
    const subjectCountMap = new Map(subjectsBySection.map((entry) => [String(entry._id), entry.subjectCount]));

    const data = enrollments.map((entry) => ({
      ...entry,
      subjectCount: subjectCountMap.get(String(entry.section?._id)) || 0,
    }));

    res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    next(error);
  }
};

exports.getStudentAcademicOverview = async (req, res, next) => {
  try {
    const studentId = req.params.studentId || req.user.id;
    const requesterRole = normalizeRole(req.user.role);

    if (req.params.studentId && req.params.studentId !== String(req.user.id) && !['faculty', 'staff', 'admin'].includes(requesterRole)) {
      return res.status(403).json({ success: false, message: 'You are not allowed to view this student overview' });
    }

    const enrollment = await Enrollment.findOne({ student: studentId, status: 'active' })
      .populate({
        path: 'section',
        populate: [
          { path: 'program', select: 'name code department' },
          { path: 'course', select: 'name code' },
          { path: 'academicSession', select: 'label yearNumber' },
          { path: 'department', select: 'name code' },
        ],
      })
      .populate('student', 'systemId name email department section')
      .lean();

    if (!enrollment?.section?._id) {
      return res.status(404).json({ success: false, message: 'No active enrollment found for this student' });
    }

    const sectionId = enrollment.section._id;

    const [subjects, attendanceRows] = await Promise.all([
      SectionSubject.find({ section: sectionId, isActive: true })
        .populate('subject', 'name code credits')
        .populate('faculty', 'name email')
        .sort({ createdAt: 1 })
        .lean(),
      AttendanceSession.aggregate([
        { $match: { sectionId, 'records.student': enrollment.student._id } },
        { $unwind: '$records' },
        { $match: { 'records.student': enrollment.student._id } },
        {
          $group: {
            _id: '$subjectId',
            totalSessions: { $sum: 1 },
            attendedSessions: {
              $sum: {
                $cond: [{ $eq: ['$records.status', 'present'] }, 1, 0],
              },
            },
            lastMarkedAt: { $max: '$date' },
          },
        },
      ]),
    ]);

    const attendanceMap = new Map(
      attendanceRows.map((entry) => [
        String(entry._id || 'general'),
        {
          totalSessions: entry.totalSessions,
          attendedSessions: entry.attendedSessions,
          percentage: entry.totalSessions ? Number(((entry.attendedSessions / entry.totalSessions) * 100).toFixed(2)) : 0,
          lastMarkedAt: entry.lastMarkedAt,
        },
      ])
    );

    const data = {
      enrollment,
      subjects: subjects.map((entry) => ({
        ...entry,
        attendance: attendanceMap.get(String(entry.subject?._id)) || {
          totalSessions: 0,
          attendedSessions: 0,
          percentage: 0,
          lastMarkedAt: null,
        },
      })),
    };

    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

exports.list = async (req, res, next) => {
  try {
    const model = getModel(req.params.resource);
    if (!model) return res.status(404).json({ success: false, message: 'Academic resource not found' });

    const query = {};
    Object.assign(query, await getScopeFilter(req.user, req.params.resource));
    if (req.query.department) query.department = req.query.department;
    if (req.query.program) query.program = req.query.program;
    if (req.query.academicSession || req.query.academicYear) query.academicSession = req.query.academicSession || req.query.academicYear;
    if (req.query.section) query.section = req.query.section;
    if (req.query.student) query.student = req.query.student;
    if (req.query.subject) query.subject = req.query.subject;
    if (req.query.faculty) query.faculty = req.query.faculty;
    if (req.query.status) query.status = req.query.status;

    let cursor = model.find(query).sort({ createdAt: -1 });
    if (populateMap[req.params.resource]) {
      cursor = cursor.populate(populateMap[req.params.resource]);
    }
    const data = await cursor.lean();
    res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const model = getModel(req.params.resource);
    if (!model) return res.status(404).json({ success: false, message: 'Academic resource not found' });

    const payload = await buildAcademicPayload(req.params.resource, req.body);

    if (req.params.resource === 'enrollments') {
      const existing = await Enrollment.findOne({ student: payload.student, status: 'active' });
      if (existing) {
        existing.status = 'inactive';
        await existing.save({ validateBeforeSave: false });
      }

      if (payload.section) {
        const section = await Section.findById(payload.section).populate('department academicSession');
        await User.findByIdAndUpdate(payload.student, {
          sectionId: section?._id || null,
          section: section?.name || '',
          departmentId: section?.department?._id || null,
          department: section?.department?.name || '',
          year: section?.academicSession?.yearNumber ? String(section.academicSession.yearNumber) : '',
        });
      }
    }

    const doc = await model.create(payload);
    const data = populateMap[req.params.resource]
      ? await model.findById(doc._id).populate(populateMap[req.params.resource]).lean()
      : doc;

    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const model = getModel(req.params.resource);
    if (!model) return res.status(404).json({ success: false, message: 'Academic resource not found' });

    const payload = await buildAcademicPayload(req.params.resource, req.body);
    const doc = await model.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });
    if (!doc) return res.status(404).json({ success: false, message: 'Academic record not found' });

    if (req.params.resource === 'enrollments' && payload.section && payload.student) {
      const section = await Section.findById(payload.section).populate('department academicSession');
      await User.findByIdAndUpdate(payload.student, {
        sectionId: section?._id || null,
        section: section?.name || '',
        departmentId: section?.department?._id || null,
        department: section?.department?.name || '',
        year: section?.academicSession?.yearNumber ? String(section.academicSession.yearNumber) : '',
      });
    }

    const data = populateMap[req.params.resource]
      ? await model.findById(doc._id).populate(populateMap[req.params.resource]).lean()
      : doc;

    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const model = getModel(req.params.resource);
    if (!model) return res.status(404).json({ success: false, message: 'Academic resource not found' });

    if (req.params.resource === 'colleges') {
      const departmentCount = await Department.countDocuments({ college: req.params.id });
      if (departmentCount > 0) {
        return res.status(409).json({ success: false, message: 'Cannot delete a college that still has departments' });
      }
    }

    const doc = await model.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Academic record not found' });

    res.status(200).json({ success: true, message: 'Academic record deleted' });
  } catch (error) {
    next(error);
  }
};

exports.updateSectionSubjectFaculty = async (req, res, next) => {
  try {
    const facultyId = req.body?.facultyId || null;
    const sectionSubject = await SectionSubject.findById(req.params.id);
    if (!sectionSubject) {
      return res.status(404).json({ success: false, message: 'Teaching assignment not found' });
    }

    if (facultyId) {
      const faculty = await User.findById(facultyId).select('role');
      if (!faculty || !['faculty', 'admin'].includes(normalizeRole(faculty.role))) {
        return res.status(400).json({ success: false, message: 'Selected user cannot be assigned as faculty' });
      }
      sectionSubject.faculty = faculty._id;
    } else {
      sectionSubject.faculty = null;
    }

    await sectionSubject.save();
    const data = await SectionSubject.findById(sectionSubject._id).populate(populateMap['section-subjects']).lean();
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};
