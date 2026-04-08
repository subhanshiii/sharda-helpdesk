const express = require('express');
const router  = express.Router();
const {
  getEvents, getEvent, createEvent,
  updateEvent, deleteEvent, toggleInterest,
} = require('../controllers/eventController');
const { protect, permissionMiddleware } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.route('/')
  .get(protect, getEvents)
  .post(protect, permissionMiddleware('canPostNotice'), upload.single('poster'), createEvent);

router.route('/:id')
  .get(protect, getEvent)
  .put(protect, permissionMiddleware('canPostNotice'), upload.single('poster'), updateEvent)
  .delete(protect, permissionMiddleware('canPostNotice'), deleteEvent);

router.put('/:id/interest', protect, toggleInterest);

module.exports = router;
