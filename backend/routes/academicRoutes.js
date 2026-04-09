const express = require('express');
const router = express.Router();

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
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/timetable', getTimetable);
router.post('/timetable', createTimetableEntry);
router.put('/timetable/:id', updateTimetableEntry);
router.delete('/timetable/:id', deleteTimetableEntry);

router.get('/attendance/options', getAttendanceOptions);
router.get('/attendance', getAttendanceSessions);
router.post('/attendance', createAttendanceSession);
router.put('/attendance/:id', updateAttendanceSession);

module.exports = router;
