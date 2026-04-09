/**
 * Ticket Service
 *
 * Contains ALL business logic for tickets.
 * Controllers call this service — they don't touch the DB directly.
 *
 * Benefits:
 * - Testable in isolation (no HTTP layer needed)
 * - Reusable across different routes/contexts
 * - Single place to change business rules
 * - Clear separation of concerns
 */

const Ticket = require('../models/Ticket');
const User   = require('../models/User');
const { emitToTicket, emitToUser, emitToAll } = require('../socket/socketManager');
const { queueTicketCreatedEmail, queueTicketUpdatedEmail, queueTicketAssignedEmail } = require('../queues/emailQueue');
const { invalidateStatsCache } = require('./statsService');
const logger = require('../utils/logger');
const { isSupportRole, getAssignableRoles } = require('../utils/roleHelpers');

const CATEGORY_ROUTING = {
  'IT Support': 'IT',
  Administration: 'Administration',
  Hostel: 'Hostel',
  Library: 'Library',
  Finance: 'Accounts',
  Academic: 'Academic',
  Infrastructure: 'Maintenance',
  Other: 'Student Services',
};

const SLA_HOURS = {
  Low: 72,
  Medium: 48,
  High: 24,
  Critical: 8,
};

const pickBestAssignee = async (category) => {
  const routingDepartment = CATEGORY_ROUTING[category] || 'Student Services';
  const roleQuery = { role: { $in: getAssignableRoles() }, isActive: true };

  const candidates = await User.find({
    ...roleQuery,
    $or: [
      { department: routingDepartment },
      { department: category },
    ],
  }).select('_id name email role department');

  const fallbackCandidates = candidates.length
    ? candidates
    : await User.find(roleQuery).select('_id name email role department');

  if (!fallbackCandidates.length) {
    return { assignee: null, routingDepartment };
  }

  const loads = await Promise.all(
    fallbackCandidates.map(async (candidate) => ({
      user: candidate,
      openTickets: await Ticket.countDocuments({
        assignedTo: candidate._id,
        status: { $in: ['Open', 'In Progress'] },
      }),
    }))
  );

  loads.sort((a, b) => a.openTickets - b.openTickets);
  return {
    assignee: loads[0]?.user || null,
    routingDepartment,
  };
};

// ── Query builder ──────────────────────────────────────
const buildTicketQuery = (user, filters = {}) => {
  let query = {};

  // Role-based filtering
  if (!isSupportRole(user.role)) {
    query.user = user.id;
  } else if (user.role !== 'admin') {
    query.$or = [{ assignedTo: user.id }, { assignedTo: null }];
  }

  // Apply filters
  const { status, category, priority, search } = filters;
  if (status)   query.status   = status;
  if (category) query.category = category;
  if (priority) query.priority = priority;

  if (search) {
    const searchOr = [
      { title:       { $regex: search, $options: 'i' } },
      { ticketId:    { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
    ];
    // Merge with existing $or if present
    if (query.$or) {
      query.$or = [...query.$or, ...searchOr];
    } else {
      query.$or = searchOr;
    }
  }

  return query;
};

// ── Get paginated tickets ──────────────────────────────
const getTickets = async (user, filters, pagination) => {
  const { page = 1, limit = 10 } = pagination;
  const query = buildTicketQuery(user, filters);

  const [total, tickets] = await Promise.all([
    Ticket.countDocuments(query),
    Ticket.find(query)
      .populate('user',       'name email role enrollmentId')
      .populate('assignedTo', 'name email role')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean(), // .lean() returns plain JS objects — faster for read-only operations
  ]);

  return {
    tickets,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: parseInt(page),
  };
};

// ── Get single ticket (with authorization) ─────────────
const getTicketById = async (ticketId, user) => {
  const ticket = await Ticket.findById(ticketId)
    .populate('user',           'name email role enrollmentId department')
    .populate('assignedTo',     'name email role')
    .populate('replies.author', 'name email role');

  if (!ticket) {
    const err = new Error('Ticket not found');
    err.statusCode = 404;
    throw err;
  }

  // Students can only see own tickets
  if (!isSupportRole(user.role) && ticket.user._id.toString() !== user.id) {
    const err = new Error('Not authorized to view this ticket');
    err.statusCode = 403;
    throw err;
  }

  // Filter internal notes for students
  if (!isSupportRole(user.role)) {
    ticket.replies = ticket.replies.filter(r => !r.isInternal);
  }

  return ticket;
};

// ── Create ticket ──────────────────────────────────────
const createTicket = async (data, user, files, io, frontendUrl) => {
  const { title, description, category, priority, tags } = data;
  const { assignee, routingDepartment } = await pickBestAssignee(category);

  const attachments = (files || []).map(file => ({
    filename:     file.filename,
    originalName: file.originalname,
    mimetype:     file.mimetype,
    size:         file.size,
    url:          `/api/files/general/${file.filename}`,
  }));

  const ticket = await Ticket.create({
    title, description, category,
    priority: priority || 'Medium',
    user:     user.id,
    assignedTo: assignee?._id || null,
    routingDepartment,
    status: assignee ? 'In Progress' : 'Open',
    slaDueAt: new Date(Date.now() + ((SLA_HOURS[priority || 'Medium'] || 48) * 60 * 60 * 1000)),
    attachments,
    tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim())) : [],
  });

  const populated = await Ticket.findById(ticket._id)
    .populate('user',       'name email role')
    .populate('assignedTo', 'name email role');

  logger.info('Ticket created', {
    ticketId: ticket.ticketId,
    userId:   user.id,
    category, priority, routingDepartment, assignedTo: assignee?._id || null,
  });

  // Side effects — run after DB save, don't block response
  if (io) {
    emitToAll(io, 'ticket:new', {
      ticket:  populated,
      message: `New ticket from ${user.name}: ${title}`,
    });
    if (assignee?._id) {
      emitToUser(io, assignee._id.toString(), 'ticket:assigned', {
        ticketId: populated._id,
        ticketTitle: populated.title,
        message: `A new ${routingDepartment} ticket has been assigned to you.`,
      });
    }
  }

  // Queue confirmation email
  queueTicketCreatedEmail({
    toEmail:     user.email,
    userName:    user.name,
    ticketId:    ticket.ticketId,
    ticketTitle: ticket.title,
    ticketLink:  `${frontendUrl || 'http://localhost:3000'}/tickets/${ticket._id}`,
  }).catch(err => logger.warn('Failed to queue ticket email', { error: err.message }));

  // Invalidate stats cache
  invalidateStatsCache(user.id, user.role).catch(() => {});

  return populated;
};

// ── Update ticket ──────────────────────────────────────
const updateTicket = async (ticketId, updates, user, io) => {
  const ticket = await Ticket.findById(ticketId);
  if (!ticket) {
    const err = new Error('Ticket not found');
    err.statusCode = 404;
    throw err;
  }

  // Student can only update own open tickets
  if (!isSupportRole(user.role)) {
    if (ticket.user.toString() !== user.id) {
      const err = new Error('Not authorized');
      err.statusCode = 403;
      throw err;
    }
    if (ticket.status !== 'Open') {
      const err = new Error('Cannot edit ticket that is already in progress');
      err.statusCode = 400;
      throw err;
    }
    if (updates.title)       ticket.title       = updates.title;
    if (updates.description) ticket.description = updates.description;
    await ticket.save();
    return ticket;
  }

  const oldStatus     = ticket.status;
  const oldAssignedTo = ticket.assignedTo?.toString();

  // Apply updates
  if (updates.status)      ticket.status      = updates.status;
  if (updates.priority)    ticket.priority    = updates.priority;
  if (updates.category)    ticket.category    = updates.category;
  if (updates.title)       ticket.title       = updates.title;
  if (updates.description) ticket.description = updates.description;

  // Handle assignment
  if (updates.assignedTo !== undefined) {
    if (!updates.assignedTo || updates.assignedTo === '') {
      ticket.assignedTo = null;
    } else {
      const assignee = await User.findById(updates.assignedTo);
      if (!assignee || !getAssignableRoles().includes(assignee.role)) {
        const err = new Error('Invalid staff assignee');
        err.statusCode = 400;
        throw err;
      }
      ticket.assignedTo = updates.assignedTo;
      if (ticket.status === 'Open') ticket.status = 'In Progress';
      if (!ticket.firstResponseAt) ticket.firstResponseAt = new Date();

      // Notify newly assigned staff member
      const isNewAssignment = oldAssignedTo !== updates.assignedTo;
      if (io && isNewAssignment) {
        emitToUser(io, updates.assignedTo, 'ticket:assigned', {
          ticketId:    ticket._id,
          ticketTitle: ticket.title,
          message:     `You have been assigned ticket: ${ticket.title}`,
        });
      }

      // Queue assignment email
      if (isNewAssignment) {
        queueTicketAssignedEmail({
          toEmail:     assignee.email,
          agentName:   assignee.name,
          ticketId:    ticket.ticketId,
          ticketTitle: ticket.title,
        }).catch(() => {});
      }
    }
  }

  await ticket.save();

  const updated = await Ticket.findById(ticket._id)
    .populate('user',           'name email role enrollmentId')
    .populate('assignedTo',     'name email role')
    .populate('replies.author', 'name email role');

  logger.info('Ticket updated', { ticketId: ticket.ticketId, updatedBy: user.id, updates: Object.keys(updates) });

  // Emit real-time update
  if (io) {
    emitToTicket(io, ticketId, 'ticket:updated', {
      ticket:    updated,
      updatedBy: user.name,
      changes:   { oldStatus, newStatus: ticket.status },
    });

    // Notify owner if status changed
    if (oldStatus !== ticket.status) {
      emitToUser(io, ticket.user.toString(), 'ticket:status_changed', {
        ticketId:    ticket._id,
        ticketTitle: ticket.title,
        oldStatus,
        newStatus:   ticket.status,
        message:     `Your ticket "${ticket.title}" is now ${ticket.status}`,
      });
    }
  }

  // Invalidate stats
  invalidateStatsCache(ticket.user.toString(), 'student').catch(() => {});

  return updated;
};

// ── Delete ticket ──────────────────────────────────────
const deleteTicket = async (ticketId, io) => {
  const ticket = await Ticket.findById(ticketId);
  if (!ticket) {
    const err = new Error('Ticket not found');
    err.statusCode = 404;
    throw err;
  }

  await ticket.deleteOne();
  logger.info('Ticket deleted', { ticketId });

  if (io) emitToTicket(io, ticketId, 'ticket:deleted', { ticketId });
};

// ── Add reply ──────────────────────────────────────────
const addReply = async (ticketId, replyData, user, files, io) => {
  const ticket = await Ticket.findById(ticketId);
  if (!ticket) {
    const err = new Error('Ticket not found');
    err.statusCode = 404;
    throw err;
  }

  if (!isSupportRole(user.role) && ticket.user.toString() !== user.id) {
    const err = new Error('Not authorized');
    err.statusCode = 403;
    throw err;
  }

  if (ticket.status === 'Closed') {
    const err = new Error('Cannot reply to a closed ticket');
    err.statusCode = 400;
    throw err;
  }

  const attachments = (files || []).map(file => ({
    filename:     file.filename,
    originalName: file.originalname,
    mimetype:     file.mimetype,
    size:         file.size,
    url:          `/api/files/general/${file.filename}`,
  }));

  const reply = {
    message:    replyData.message,
    author:     user.id,
    authorRole: user.role,
    attachments,
    isInternal: isSupportRole(user.role) && replyData.isInternal === 'true',
  };

  if (!ticket.firstResponseAt && isSupportRole(user.role)) {
    ticket.firstResponseAt = new Date();
  }
  ticket.replies.push(reply);

  // Business rules for status transitions
  if (isSupportRole(user.role) && ticket.status === 'Open') {
    ticket.status = 'In Progress';
  }
  if (!isSupportRole(user.role) && ticket.status === 'Resolved') {
    ticket.status = 'In Progress';
  }

  await ticket.save();

  const updated = await Ticket.findById(ticket._id)
    .populate('user',           'name email role enrollmentId')
    .populate('assignedTo',     'name email role')
    .populate('replies.author', 'name email role');

  const newReply = updated.replies[updated.replies.length - 1];

  logger.info('Reply added', { ticketId: ticket.ticketId, authorRole: user.role });

  // Real-time events
  if (io) {
    emitToTicket(io, ticketId, 'ticket:new_reply', {
      ticketId: ticket._id, reply: newReply, ticket: updated,
    });

    // Notify student if a support staff member replied (non-internal)
    if (isSupportRole(user.role) && !reply.isInternal) {
      emitToUser(io, ticket.user.toString(), 'notification:new_reply', {
        ticketId:    ticket._id,
        ticketTitle: ticket.title,
        replierName: user.name,
        message:     `${user.name} replied to your ticket: "${ticket.title}"`,
      });
    }

    // Notify assigned staff member if the student replied
    if (!isSupportRole(user.role) && ticket.assignedTo) {
      emitToUser(io, ticket.assignedTo.toString(), 'notification:new_reply', {
        ticketId:    ticket._id,
        ticketTitle: ticket.title,
        replierName: user.name,
        message:     `Student replied on ticket: "${ticket.title}"`,
      });
    }
  }

  return updated;
};

module.exports = { getTickets, getTicketById, createTicket, updateTicket, deleteTicket, addReply };
