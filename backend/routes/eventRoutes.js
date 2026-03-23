const express = require('express');
const router  = express.Router();
const {
  getEvents, getEvent, createEvent,
  updateEvent, deleteEvent, toggleInterest,
} = require('../controllers/eventController');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.route('/')
  .get(protect, getEvents)
  .post(protect, authorize('admin', 'clubhead'), upload.single('poster'), createEvent);

router.route('/:id')
  .get(protect, getEvent)
  .put(protect, authorize('admin', 'clubhead'), upload.single('poster'), updateEvent)
  .delete(protect, authorize('admin', 'clubhead'), deleteEvent);

router.put('/:id/interest', protect, toggleInterest);

module.exports = router;
