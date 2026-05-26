const express = require('express');
const router = express.Router();

const academicController = require('../controllers/academicController');
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

router.get('/reports/programs', permissionMiddleware('canManageAcademics'), academicController.getProgramReport);
router.get('/reports/enrollments', permissionMiddleware('canManageAcademics'), academicController.getEnrollmentReport);
router.get('/workspace-summary', permissionMiddleware('canManageAcademics'), academicController.getWorkspaceSummary);
router.get('/workspace-data', permissionMiddleware('canManageAcademics'), academicController.getWorkspaceData);
router.get('/workspace-options', anyPermissionMiddleware('canManageAcademics', 'canManageUsers', 'canManageTimetable', 'canMarkAttendance', 'canPostNotice'), academicController.getWorkspaceOptions);
router.get('/org-units', anyPermissionMiddleware('canManageAcademics', 'canManageUsers'), academicController.getOrganizationWorkspace);
router.post('/org-units', permissionMiddleware('canManageAcademics'), academicController.createOrgUnit);
router.put('/org-units/:id', permissionMiddleware('canManageAcademics'), academicController.updateOrgUnit);
router.delete('/org-units/:id', permissionMiddleware('canManageAcademics'), academicController.deleteOrgUnit);
router.get('/subject-management', permissionMiddleware('canManageAcademics'), academicController.getSubjectManagementWorkspace);
router.get('/subjects/:id/detail', permissionMiddleware('canManageAcademics'), academicController.getSubjectRecord);
router.post('/subjects/:id/courses', permissionMiddleware('canManageAcademics'), academicController.linkCourseToSubject);
router.delete('/subjects/:id/courses/:courseId', permissionMiddleware('canManageAcademics'), academicController.unlinkCourseFromSubject);
router.put('/subjects/:id/teachers', permissionMiddleware('canManageAcademics'), academicController.updateSubjectTeachers);
router.put('/subjects/:id/sections/:sectionId/teachers', permissionMiddleware('canManageAcademics'), academicController.updateSubjectSectionTeachers);
router.get('/reports/students/:studentId', permissionMiddleware('canManageAcademics'), academicController.getStudentAcademicOverview);
router.get('/me/overview', academicController.getStudentAcademicOverview);
router.get('/structure-tree', permissionMiddleware('canManageAcademics'), academicController.getStructureTree);
router.post('/setup', permissionMiddleware('canManageAcademics'), academicController.quickSetup);

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

router.get('/:resource(colleges|departments|programs|courses|years|academic-sessions|sections|subjects|enrollments)', academicReadAccess, academicController.list);
router.post('/:resource(colleges|departments|programs|courses|years|academic-sessions|sections|subjects|enrollments)', permissionMiddleware('canManageAcademics'), academicController.create);
router.put('/:resource(colleges|departments|programs|courses|years|academic-sessions|sections|subjects|enrollments)/:id', permissionMiddleware('canManageAcademics'), academicController.update);
router.patch('/:resource(colleges|departments|programs|courses|years|academic-sessions|sections|subjects|enrollments)/:id', permissionMiddleware('canManageAcademics'), academicController.update);
router.delete('/:resource(colleges|departments|programs|courses|years|academic-sessions|sections|subjects|enrollments)/:id', permissionMiddleware('canManageAcademics'), academicController.remove);

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
