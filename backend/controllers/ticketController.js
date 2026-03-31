/**
 * Ticket Controller — THIN LAYER
 *
 * This controller only handles:
 * 1. Parsing HTTP request
 * 2. Calling the service
 * 3. Sending HTTP response
 *
 * NO business logic here. All logic is in ticketService.js
 */

const ticketService = require('../services/ticketService');

exports.getTickets = async (req, res, next) => {
  try {
    const filters    = { status: req.query.status, category: req.query.category, priority: req.query.priority, search: req.query.search };
    const pagination = { page: req.query.page, limit: req.query.limit };
    const result     = await ticketService.getTickets(req.user, filters, pagination);
    res.status(200).json({ success: true, ...result, data: result.tickets });
  } catch (error) { next(error); }
};

exports.getTicket = async (req, res, next) => {
  try {
    const ticket = await ticketService.getTicketById(req.params.id, req.user);
    res.status(200).json({ success: true, data: ticket });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    next(error);
  }
};

exports.createTicket = async (req, res, next) => {
  try {
    const ticket = await ticketService.createTicket(
      req.body, req.user, req.files, req.io,
      process.env.FRONTEND_URL
    );
    res.status(201).json({ success: true, data: ticket });
  } catch (error) { next(error); }
};

exports.updateTicket = async (req, res, next) => {
  try {
    const ticket = await ticketService.updateTicket(req.params.id, req.body, req.user, req.io);
    res.status(200).json({ success: true, data: ticket });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    next(error);
  }
};

exports.deleteTicket = async (req, res, next) => {
  try {
    await ticketService.deleteTicket(req.params.id, req.io);
    res.status(200).json({ success: true, message: 'Ticket deleted successfully' });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    next(error);
  }
};

exports.addReply = async (req, res, next) => {
  try {
    const ticket = await ticketService.addReply(req.params.id, req.body, req.user, req.files, req.io);
    res.status(200).json({ success: true, data: ticket });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    next(error);
  }
};
