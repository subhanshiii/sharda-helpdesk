const express = require('express');
const router = express.Router();

const workspaceController = require('../controllers/academics/workspaceController');
const orgUnitController = require('../controllers/academics/orgUnitController');
const setupController = require('../controllers/academics/setupController');
const subjectController = require('../controllers/academics/subjectController');
const collegeController = require('../controllers/academics/collegeController');
const departmentController = require('../controllers/academics/departmentController');
const programController = require('../controllers/academics/programController');
const courseController = require('../controllers/academics/courseController');
const sectionController = require('../controllers/academics/sectionController');
const enrollmentController = require('../controllers/academics/enrollmentController');
const academicSessionController = require('../controllers/academics/academicSessionController');
const reportController = require('../controllers/academics/reportController');

const academicPlanningController = require('../controllers/academicPlanningController');
const {
  getTimetable,
  getTimetableEntry,
  createTimetableEntry,
  updateTimetableEntry,
  deleteTimetableEntry,
  getTeachingAssignments,
  getAttendanceOptions,
  getAttendanceSessions,
  createAttendanceSession,
  updateAttendanceSession,
  deleteAttendanceSession,
} = require('../controllers/academicOpsController');
const { verifyAuth, permissionMiddleware, anyPermissionMiddleware, checkPermission } = require('../middleware/auth');

const academicReadAccess = (req, res, next) => {
  const resource = req.params.resource;
  if (['subjects', 'enrollments'].includes(resource)) {
    return anyPermissionMiddleware('canManageAcademics', 'canManageUsers')(req, res, next);
  }

  return anyPermissionMiddleware(
    'canManageAcademics',
    'canManageUsers',
    'canManageTimetable',
    'canMarkAttendance'
  )(req, res, next);
};

router.use(verifyAuth);

router.get('/reports/programs', permissionMiddleware('canManageAcademics'), reportController.getProgramReport);
router.get('/reports/enrollments', permissionMiddleware('canManageAcademics'), reportController.getEnrollmentReport);
router.get('/workspace-summary', permissionMiddleware('canManageAcademics'), workspaceController.getWorkspaceSummary);
router.get('/workspace-data', permissionMiddleware('canManageAcademics'), workspaceController.getWorkspaceData);
router.get('/workspace-options', anyPermissionMiddleware('canManageAcademics', 'canManageUsers', 'canManageTimetable', 'canMarkAttendance', 'canPostNotice'), subjectController.getSubjectManagementWorkspace);
router.get('/org-units', anyPermissionMiddleware('canManageAcademics', 'canManageUsers'), workspaceController.getOrganizationWorkspace);
router.post('/org-units', permissionMiddleware('canManageAcademics'), orgUnitController.createOrgUnit);
router.put('/org-units/:id', permissionMiddleware('canManageAcademics'), orgUnitController.updateOrgUnit);
router.delete('/org-units/:id', permissionMiddleware('canManageAcademics'), orgUnitController.deleteOrgUnit);
router.get('/subject-management', permissionMiddleware('canManageAcademics'), subjectController.getSubjectManagementWorkspace);
router.get('/subjects/:id/detail', permissionMiddleware('canManageAcademics'), subjectController.getSubjectRecord);
router.post('/subjects/:id/courses', permissionMiddleware('canManageAcademics'), subjectController.linkCourseToSubject);
router.delete('/subjects/:id/courses/:courseId', permissionMiddleware('canManageAcademics'), subjectController.unlinkCourseFromSubject);
router.put('/subjects/:id/teachers', permissionMiddleware('canManageAcademics'), subjectController.updateSubjectTeachers);
router.put('/subjects/:id/sections/:sectionId/teachers', permissionMiddleware('canManageAcademics'), subjectController.updateSubjectSectionTeachers);
router.get('/reports/students/:studentId', permissionMiddleware('canManageAcademics'), reportController.getStudentAcademicOverview);
router.get('/me/overview', reportController.getStudentAcademicOverview);
router.get('/structure-tree', permissionMiddleware('canManageAcademics'), workspaceController.getStructureTree);
router.post('/setup', permissionMiddleware('canManageAcademics'), setupController.quickSetup);

// Course-centric academic planning reads (additive, course -> subjects, section -> active subjects)
router.get(
  '/courses/:id/subjects',
  anyPermissionMiddleware('canManageAcademics', 'canManageTimetable', 'canMarkAttendance'),
  academicPlanningController.getSubjectsForCourse
);
router.get(
  '/sections/:id/active-subjects',
  anyPermissionMiddleware('canManageAcademics', 'canManageTimetable', 'canMarkAttendance'),
  academicPlanningController.getActiveSubjectsForSection
);

// Generic Academic CRUD
const resourceRouter = (controller) => {
  const r = express.Router();
  r.get('/', academicReadAccess, controller.list);
  r.post('/', permissionMiddleware('canManageAcademics'), controller.create);
  r.put('/:id', permissionMiddleware('canManageAcademics'), controller.update);
  r.patch('/:id', permissionMiddleware('canManageAcademics'), controller.update);
  r.delete('/:id', permissionMiddleware('canManageAcademics'), controller.remove);
  return r;
};

const assessmentController = require('../controllers/assessmentController');

router.get('/assessments/summary', permissionMiddleware('canManageAcademics'), assessmentController.getAssessmentSummary);
router.get('/assessments/overview', assessmentController.getStudentAssessmentOverview);
router.get('/assessments', permissionMiddleware('canManageAcademics'), assessmentController.listAssessments);
router.get('/assessments/:id', permissionMiddleware('canManageAcademics'), assessmentController.getAssessment);
router.post('/assessments', permissionMiddleware('canManageAcademics'), assessmentController.createAssessment);
router.put('/assessments/:id', permissionMiddleware('canManageAcademics'), assessmentController.updateAssessment);
router.delete('/assessments/:id', permissionMiddleware('canManageAcademics'), assessmentController.deleteAssessment);

router.use('/colleges', resourceRouter(collegeController));
router.use('/departments', resourceRouter(departmentController));
router.use('/programs', resourceRouter(programController));
router.use('/courses', resourceRouter(courseController));

router.post('/academic-sessions/:id/rollover', permissionMiddleware('canManageAcademics'), academicSessionController.rolloverSession);
router.post('/years/:id/rollover', permissionMiddleware('canManageAcademics'), academicSessionController.rolloverSession);

router.use('/academic-sessions', resourceRouter(academicSessionController));
router.use('/years', resourceRouter(academicSessionController));
router.use('/sections', resourceRouter(sectionController));
router.use('/subjects', resourceRouter(subjectController));
router.use('/enrollments', resourceRouter(enrollmentController));

// New Curriculum-driven routes
const academicCrudController = require('../controllers/academics/academicCrudController');
router.use('/curriculums', resourceRouter(academicCrudController));
router.use('/semesters', resourceRouter(academicCrudController));
router.use('/batches', resourceRouter(academicCrudController));
router.use('/student-progress', resourceRouter(academicCrudController));

router.get('/timetable', getTimetable);
router.get('/teaching-assignments', getTeachingAssignments);
router.get('/timetable/:id', getTimetableEntry);
router.post('/timetable', checkPermission('create', 'timetable'), createTimetableEntry);
router.put('/timetable/:id', checkPermission('edit', 'timetable'), updateTimetableEntry);
router.delete('/timetable/:id', checkPermission('delete', 'timetable'), deleteTimetableEntry);

router.get('/attendance/options', getAttendanceOptions);
router.get('/attendance', getAttendanceSessions);
router.post('/attendance', permissionMiddleware('canMarkAttendance'), createAttendanceSession);
router.put('/attendance/:id', permissionMiddleware('canMarkAttendance'), updateAttendanceSession);
router.delete('/attendance/:id', permissionMiddleware('canMarkAttendance'), deleteAttendanceSession);

module.exports = router;
