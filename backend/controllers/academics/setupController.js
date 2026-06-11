const AcademicService = require('../../services/academicService');
const { runQuickAcademicSetup } = require('../../utils/academicSetupService');
exports.quickSetup = async (req, res, next) => {
  try {
    const payload = req.body || {};
    const years = Array.isArray(payload.years) ? payload.years : [];
    if (!payload.collegeId || !payload.department || !payload.program || !payload.course || !(payload.academicSession || payload.academicYear) || !years.length) {
      return res.status(400).json({ success: false, message: 'College, department, program, course, academic session, and study years are required' });
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
    res.status(201).json({ success: true, message: 'Academic structure created successfully', data: result });
  } catch (error) { next(error); }
};
