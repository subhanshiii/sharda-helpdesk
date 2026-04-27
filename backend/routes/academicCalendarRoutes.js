const express = require('express');
const router  = express.Router();
const { getEvents, getAllEvents, createEvent, deleteEvent } = require('../controllers/academicCalendarController');
const { verifyAuth, checkPermission } = require('../middleware/auth');

router.get('/', verifyAuth, getEvents);
router.get('/all', verifyAuth, getAllEvents);
router.post('/', verifyAuth, checkPermission('create', 'events'), createEvent);
router.delete('/:id', verifyAuth, checkPermission('delete', 'events'), deleteEvent);

module.exports = router;
