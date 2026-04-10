const mongoose = require('mongoose');
const Department = require('../models/Department');
const Program = require('../models/Program');
const Course = require('../models/Course');
const AcademicYear = require('../models/AcademicYear');
const Section = require('../models/Section');
const Subject = require('../models/Subject');
const SectionSubject = require('../models/SectionSubject');
const Enrollment = require('../models/Enrollment');
const AttendanceSession = require('../models/AttendanceSession');
const User = require('../models/User');
const { normalizeRole } = require('../utils/roleHelpers');

const modelMap = {
  departments: Department,
  programs: Program,
  courses: Course,
  years: AcademicYear,
  sections: Section,
  subjects: Subject,
  'section-subjects': SectionSubject,
  enrollments: Enrollment,
};

const populateMap = {
  programs: 'department',
  courses: 'program department',
  years: 'program',
  sections: 'program course academicYear department advisorFaculty',
  subjects: 'department program course academicYear',
  'section-subjects': 'section subject faculty',
  enrollments: 'student section academicYear',
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
          { path: 'academicYear', select: 'label yearNumber' },
          { path: 'department', select: 'name code' },
        ],
      })
      .populate('academicYear', 'label yearNumber')
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
          { path: 'academicYear', select: 'label yearNumber' },
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
    if (req.query.department) query.department = req.query.department;
    if (req.query.program) query.program = req.query.program;
    if (req.query.academicYear) query.academicYear = req.query.academicYear;
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

    if (req.params.resource === 'enrollments') {
      const existing = await Enrollment.findOne({ student: req.body.student, status: 'active' });
      if (existing) {
        existing.status = 'completed';
        await existing.save({ validateBeforeSave: false });
      }

      if (req.body.section) {
        const section = await Section.findById(req.body.section).populate('department');
        await User.findByIdAndUpdate(req.body.student, {
          sectionId: section?._id || null,
          section: section?.name || '',
          departmentId: section?.department?._id || null,
          department: section?.department?.name || '',
        });
      }
    }

    const doc = await model.create(req.body);
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

    const doc = await model.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!doc) return res.status(404).json({ success: false, message: 'Academic record not found' });

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

    const doc = await model.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Academic record not found' });

    res.status(200).json({ success: true, message: 'Academic record deleted' });
  } catch (error) {
    next(error);
  }
};
