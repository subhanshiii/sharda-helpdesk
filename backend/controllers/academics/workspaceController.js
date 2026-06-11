const AcademicService = require('../../services/academicService');
const { getScopeFilter } = require('../../utils/scopeGuard');
const College = require('../../models/College');
const Department = require('../../models/Department');
const Program = require('../../models/Program');
const Course = require('../../models/Course');
const AcademicSession = require('../../models/AcademicSession');
const Section = require('../../models/Section');
const Subject = require('../../models/Subject');
const Enrollment = require('../../models/Enrollment');
const { normalizeRole } = require('../../utils/roleHelpers');

const countDocumentsForScope = async (Model, scope = {}, extra = {}) => (
  Model.countDocuments({ ...scope, ...extra })
);

exports.getStructureTree = async (req, res, next) => {
  try {
    const { buildStructureTree } = require('../../utils/academicSetupService');
    const data = await buildStructureTree(req.user);
    res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    next(error);
  }
};

exports.getWorkspaceSummary = async (req, res, next) => {
  try {
    const [collegeScope, departmentScope, programScope, courseScope, academicSessionScope, sectionScope, subjectScope, enrollmentScope] = await Promise.all([
      getScopeFilter(req.user, 'colleges'),
      getScopeFilter(req.user, 'departments'),
      getScopeFilter(req.user, 'programs'),
      getScopeFilter(req.user, 'courses'),
      getScopeFilter(req.user, 'academic-sessions'),
      getScopeFilter(req.user, 'sections'),
      getScopeFilter(req.user, 'subjects'),
      getScopeFilter(req.user, 'enrollments'),
    ]);

    const [
      colleges,
      departments,
      programs,
      courses,
      academicSessions,
      sections,
      subjects,
      activeEnrollments,
    ] = await Promise.all([
      countDocumentsForScope(College, collegeScope, { isActive: true }),
      countDocumentsForScope(Department, departmentScope, { isActive: true }),
      countDocumentsForScope(Program, programScope, { isActive: true }),
      countDocumentsForScope(Course, courseScope, { isActive: true }),
      countDocumentsForScope(AcademicSession, academicSessionScope, { isActive: true }),
      countDocumentsForScope(Section, sectionScope, { isActive: true }),
      countDocumentsForScope(Subject, subjectScope, { isActive: true }),
      Enrollment.distinct('student', { ...enrollmentScope, status: 'active' }).then((rows) => rows.length),
    ]);

    res.status(200).json({
      success: true,
      data: {
        colleges,
        departments,
        programs,
        courses,
        academicSessions,
        sections,
        subjects,
        students: activeEnrollments,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.getWorkspaceData = async (req, res, next) => {
  try {
    const cache = require('../../config/cache');
    const cacheKey = `academic:workspace:${req.user._id}:${normalizeRole(req.user.role)}`;
    const { data, fromCache } = await cache.withCache(cacheKey, 30, () => AcademicService.getWorkspaceCollections(req.user));
    res.status(200).json({ success: true, data, fromCache });
  } catch (error) {
    next(error);
  }
};

exports.getOrganizationWorkspace = async (req, res, next) => {
  try {
    const data = await AcademicService.getOrganizationWorkspacePayload();
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};
