const mongoose = require('mongoose');
const Program = require('../../models/Program');
const Course = require('../../models/Course');
const Section = require('../../models/Section');
const Enrollment = require('../../models/Enrollment');
const CourseSubject = require('../../models/CourseSubject');
const AttendanceSession = require('../../models/AttendanceSession');
const assessmentService = require('../../services/assessmentService');
const { getScopeFilter } = require('../../utils/scopeGuard');
const { normalizeRole } = require('../../utils/roleHelpers');
const { buildSubjectCatalog, getSubjectIdsForSection } = require('../../utils/subjectManagement');

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
      CourseSubject.aggregate([
        { $match: { isActive: true } },
        {
          $lookup: {
            from: 'courses',
            localField: 'course',
            foreignField: '_id',
            as: 'course',
          },
        },
        { $unwind: '$course' },
        { $match: { 'course.program': { $in: programIds }, 'course.isActive': true } },
        { $group: { _id: '$course._id', subjectCount: { $sum: 1 } } },
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
          { path: 'academicSession', select: 'label yearNumber' },
          { path: 'department', select: 'name code' },
        ],
      })
      .populate('academicSession', 'label yearNumber')
      .sort({ createdAt: -1 })
      .lean();

    const sectionIds = [...new Set(enrollments.map((entry) => entry.section?._id).filter(Boolean).map(String))];
    const sections = await Section.find({ _id: { $in: sectionIds } }).select('course').lean();
    const courseIds = [...new Set(sections.map((section) => String(section.course || '')).filter(Boolean))];
    const courseSubjectRows = await CourseSubject.aggregate([
      { $match: { course: { $in: courseIds.map((id) => new mongoose.Types.ObjectId(id)) }, isActive: true } },
      { $group: { _id: '$course', subjectCount: { $sum: 1 } } },
    ]);
    const courseSubjectCountMap = new Map(courseSubjectRows.map((entry) => [String(entry._id), entry.subjectCount]));
    const sectionCourseMap = new Map(sections.map((section) => [String(section._id), String(section.course || '')]));

    const data = enrollments.map((entry) => ({
      ...entry,
      subjectCount: courseSubjectCountMap.get(sectionCourseMap.get(String(entry.section?._id))) || 0,
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

    if (req.params.studentId && req.params.studentId !== String(req.user.id)) {
      const scope = await getScopeFilter(req.user, 'sections');
      if (Object.keys(scope).length) {
        const activeEnrollment = await Enrollment.findOne({ student: studentId, status: 'active' }).select('section').lean();
        const allowedSection = activeEnrollment?.section
          ? await Section.exists({ ...scope, _id: activeEnrollment.section })
          : false;
        if (!allowedSection) {
          return res.status(403).json({ success: false, message: 'This student is outside your assigned academic scope' });
        }
      }
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

    const [subjectIds, attendanceRows] = await Promise.all([
      getSubjectIdsForSection(sectionId),
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

    const subjects = await buildSubjectCatalog({
      subjectQuery: { _id: { $in: subjectIds } },
      scopedSectionIds: [sectionId],
    });

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

    const assessmentOverview = await assessmentService.getStudentAssessmentOverview(studentId, req.user);

    const data = {
      enrollment,
      subjects: subjects.map((entry) => {
        const sectionTeachers = (entry.sectionTeachers || [])
          .filter((mapping) => String(mapping.section?._id || mapping.section) === String(sectionId))
          .map((mapping) => mapping.teacher)
          .filter(Boolean);
        const assignedTeachers = sectionTeachers.length ? sectionTeachers : (entry.teachers || []);

        return {
          id: entry._id,
          code: entry.code,
          name: entry.name,
          credits: entry.credits,
          semester: enrollment.semester,
          facultyMembers: assignedTeachers.map((teacher) => ({
            id: teacher._id,
            systemId: teacher.systemId,
            name: teacher.name,
            email: teacher.email,
          })),
          faculty: assignedTeachers[0]
            ? {
                id: assignedTeachers[0]._id,
                systemId: assignedTeachers[0].systemId,
                name: assignedTeachers[0].name,
                email: assignedTeachers[0].email,
              }
            : null,
          attendance: attendanceMap.get(String(entry._id)) || {
          totalSessions: 0,
          attendedSessions: 0,
          percentage: 0,
          lastMarkedAt: null,
          },
        };
      }),
      assessments: assessmentOverview.assessments,
    };

    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};
