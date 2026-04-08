const express = require('express');
const router  = express.Router();
const { getEvents, getAllEvents, createEvent, deleteEvent } = require('../controllers/academicCalendarController');
const { protect, permissionMiddleware } = require('../middleware/auth');

router.get('/',        protect, getEvents);
router.get('/all',     protect, getAllEvents);
router.post('/',       protect, permissionMiddleware('canPostNotice'), createEvent);
router.delete('/:id',  protect, permissionMiddleware('canPostNotice'), deleteEvent);

module.exports = router;
