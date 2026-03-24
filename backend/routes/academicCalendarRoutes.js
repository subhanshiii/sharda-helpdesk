const express = require('express');
const router  = express.Router();
const { getEvents, getAllEvents, createEvent, deleteEvent } = require('../controllers/academicCalendarController');
const { protect, authorize } = require('../middleware/auth');

router.get('/',        protect, getEvents);
router.get('/all',     protect, getAllEvents);
router.post('/',       protect, authorize('admin'), createEvent);
router.delete('/:id',  protect, authorize('admin'), deleteEvent);

module.exports = router;
