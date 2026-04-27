const express = require('express');
const router  = express.Router();
const {
  getEvents, getEvent, createEvent,
  updateEvent, deleteEvent, toggleInterest,
} = require('../controllers/eventController');
const { verifyAuth, checkPermission } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.route('/')
  .get(verifyAuth, getEvents)
  .post(verifyAuth, checkPermission('create', 'events'), upload.single('poster'), createEvent);

router.route('/:id')
  .get(verifyAuth, getEvent)
  .put(verifyAuth, checkPermission('edit', 'events'), upload.single('poster'), updateEvent)
  .delete(verifyAuth, checkPermission('delete', 'events'), deleteEvent);

router.put('/:id/interest', verifyAuth, toggleInterest);

module.exports = router;
