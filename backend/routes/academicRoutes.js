const express = require('express');
const router = express.Router();

const academicController = require('../controllers/academicController');
const {
  getTimetable,
  getTimetableEntry,
  createTimetableEntry,
  updateTimetableEntry,
  deleteTimetableEntry,
  getAttendanceOptions,
  getAttendanceSessions,
  createAttendanceSession,
  updateAttendanceSession,
  deleteAttendanceSession,
} = require('../controllers/academicOpsController');
const { protect, permissionMiddleware, anyPermissionMiddleware } = require('../middleware/auth');

const academicReadAccess = (req, res, next) => {
  const resource = req.params.resource;
  if (['subjects', 'section-subjects', 'enrollments'].includes(resource)) {
    return anyPermissionMiddleware('canManageAcademics', 'canManageUsers')(req, res, next);
  }

  return anyPermissionMiddleware(
    'canManageAcademics',
    'canManageUsers',
    'canManageTimetable',
    'canMarkAttendance'
  )(req, res, next);
};

router.use(protect);

router.get('/reports/programs', permissionMiddleware('canManageAcademics'), academicController.getProgramReport);
router.get('/reports/enrollments', permissionMiddleware('canManageAcademics'), academicController.getEnrollmentReport);
router.get('/workspace-summary', permissionMiddleware('canManageAcademics'), academicController.getWorkspaceSummary);
router.get('/workspace-data', permissionMiddleware('canManageAcademics'), academicController.getWorkspaceData);
router.get('/workspace-options', anyPermissionMiddleware('canManageAcademics', 'canManageUsers', 'canManageTimetable', 'canMarkAttendance', 'canPostNotice'), academicController.getWorkspaceOptions);
router.get('/reports/students/:studentId', permissionMiddleware('canManageAcademics'), academicController.getStudentAcademicOverview);
router.get('/me/overview', academicController.getStudentAcademicOverview);
router.get('/structure-tree', permissionMiddleware('canManageAcademics'), academicController.getStructureTree);
router.post('/setup', permissionMiddleware('canManageAcademics'), academicController.quickSetup);
router.patch('/section-subjects/:id', permissionMiddleware('canManageAcademics'), academicController.updateSectionSubjectFaculty);

router.get('/:resource(colleges|departments|programs|courses|years|academic-sessions|sections|subjects|section-subjects|enrollments)', academicReadAccess, academicController.list);
router.post('/:resource(colleges|departments|programs|courses|years|academic-sessions|sections|subjects|section-subjects|enrollments)', permissionMiddleware('canManageAcademics'), academicController.create);
router.put('/:resource(colleges|departments|programs|courses|years|academic-sessions|sections|subjects|section-subjects|enrollments)/:id', permissionMiddleware('canManageAcademics'), academicController.update);
router.patch('/:resource(colleges|departments|programs|courses|years|academic-sessions|sections|subjects|section-subjects|enrollments)/:id', permissionMiddleware('canManageAcademics'), academicController.update);
router.delete('/:resource(colleges|departments|programs|courses|years|academic-sessions|sections|subjects|section-subjects|enrollments)/:id', permissionMiddleware('canManageAcademics'), academicController.remove);

router.get('/timetable', getTimetable);
router.get('/timetable/:id', getTimetableEntry);
router.post('/timetable', permissionMiddleware('canManageTimetable'), createTimetableEntry);
router.put('/timetable/:id', permissionMiddleware('canManageTimetable'), updateTimetableEntry);
router.delete('/timetable/:id', permissionMiddleware('canManageTimetable'), deleteTimetableEntry);

router.get('/attendance/options', getAttendanceOptions);
router.get('/attendance', getAttendanceSessions);
router.post('/attendance', permissionMiddleware('canMarkAttendance'), createAttendanceSession);
router.put('/attendance/:id', permissionMiddleware('canMarkAttendance'), updateAttendanceSession);
router.delete('/attendance/:id', permissionMiddleware('canMarkAttendance'), deleteAttendanceSession);

module.exports = router;
