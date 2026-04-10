const express = require('express');
const router = express.Router();

const academicController = require('../controllers/academicController');
const {
  getTimetable,
  createTimetableEntry,
  updateTimetableEntry,
  deleteTimetableEntry,
  getAttendanceOptions,
  getAttendanceSessions,
  createAttendanceSession,
  updateAttendanceSession,
} = require('../controllers/academicOpsController');
const { protect, permissionMiddleware } = require('../middleware/auth');

router.use(protect);

router.get('/reports/programs', permissionMiddleware('canManageAcademics'), academicController.getProgramReport);
router.get('/reports/enrollments', permissionMiddleware('canManageAcademics'), academicController.getEnrollmentReport);
router.get('/reports/students/:studentId', academicController.getStudentAcademicOverview);
router.get('/me/overview', academicController.getStudentAcademicOverview);

router.get('/:resource(departments|programs|courses|years|sections|subjects|section-subjects|enrollments)', academicController.list);
router.post('/:resource(departments|programs|courses|years|sections|subjects|section-subjects|enrollments)', permissionMiddleware('canManageAcademics'), academicController.create);
router.put('/:resource(departments|programs|courses|years|sections|subjects|section-subjects|enrollments)/:id', permissionMiddleware('canManageAcademics'), academicController.update);
router.delete('/:resource(departments|programs|courses|years|sections|subjects|section-subjects|enrollments)/:id', permissionMiddleware('canManageAcademics'), academicController.remove);

router.get('/timetable', getTimetable);
router.post('/timetable', permissionMiddleware('canManageTimetable'), createTimetableEntry);
router.put('/timetable/:id', permissionMiddleware('canManageTimetable'), updateTimetableEntry);
router.delete('/timetable/:id', permissionMiddleware('canManageTimetable'), deleteTimetableEntry);

router.get('/attendance/options', getAttendanceOptions);
router.get('/attendance', getAttendanceSessions);
router.post('/attendance', permissionMiddleware('canMarkAttendance'), createAttendanceSession);
router.put('/attendance/:id', permissionMiddleware('canMarkAttendance'), updateAttendanceSession);

module.exports = router;
