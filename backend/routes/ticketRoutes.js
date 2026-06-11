const express = require('express');
const router = express.Router();
const {
  getTickets,
  getTicket,
  createTicket,
  updateTicket,
  deleteTicket,
  bulkDeleteTickets,
  addReply,
} = require('../controllers/ticketController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { validate, createTicketRules, mongoIdParam } = require('../middleware/validate');

router
  .route('/')
  .get(protect, getTickets)
  .post(protect, upload.array('attachments', 5), validate(createTicketRules), createTicket)
  .delete(protect, bulkDeleteTickets);

router
  .route('/:id')
  .get(protect, getTicket)
  .put(protect, updateTicket)
  .delete(protect, deleteTicket);

router
  .route('/:id/replies')
  .post(protect, upload.array('attachments', 3), addReply);

module.exports = router;
