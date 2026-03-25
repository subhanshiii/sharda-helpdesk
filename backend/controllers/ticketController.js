const Ticket = require('../models/Ticket');
const User   = require('../models/User');
const { emitToTicket, emitToUser, emitToAll } = require('../socket/socketManager');

// ── Get all tickets ───────────────────────────────────
exports.getTickets = async (req, res, next) => {
  try {
    const { status, category, priority, search, page = 1, limit = 10 } = req.query;
    let query = {};

    if (req.user.role === 'student') query.user = req.user.id;
    if (req.user.role === 'agent')   query.$or = [{ assignedTo: req.user.id }, { assignedTo: null }];
    if (status)   query.status   = status;
    if (category) query.category = category;
    if (priority) query.priority = priority;
    if (search) {
      const searchOr = [
        { title:       { $regex: search, $options: 'i' } },
        { ticketId:    { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
      query.$or = query.$or ? [...query.$or, ...searchOr] : searchOr;
    }

    const total   = await Ticket.countDocuments(query);
    const tickets = await Ticket.find(query)
      .populate('user',       'name email role enrollmentId')
      .populate('assignedTo', 'name email role')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    res.status(200).json({
      success: true, count: tickets.length, total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page), data: tickets,
    });
  } catch (error) { next(error); }
};

// ── Get single ticket ─────────────────────────────────
exports.getTicket = async (req, res, next) => {
  try {
    const ticket = await Ticket.findById(req.params.id)
      .populate('user',           'name email role enrollmentId department')
      .populate('assignedTo',     'name email role')
      .populate('replies.author', 'name email role');

    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    if (req.user.role === 'student' && ticket.user._id.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // Filter internal notes for students
    if (req.user.role === 'student') {
      ticket.replies = ticket.replies.filter(r => !r.isInternal);
    }

    res.status(200).json({ success: true, data: ticket });
  } catch (error) { next(error); }
};

// ── Create ticket ─────────────────────────────────────
exports.createTicket = async (req, res, next) => {
  try {
    const { title, description, category, priority, tags } = req.body;

    const attachments = (req.files || []).map(file => ({
      filename: file.filename, originalName: file.originalname,
      mimetype: file.mimetype, size: file.size, url: `/uploads/${file.filename}`,
    }));

    // AI priority suggestion based on keywords
    const combined  = `${title} ${description}`.toLowerCase();
    const urgentKws = ['urgent','emergency','critical','broken','cannot access','immediately'];
    const lowKws    = ['suggestion','feedback','question','inquiry'];
    let aiSuggestedPriority = 'Medium';
    if (urgentKws.some(k => combined.includes(k))) aiSuggestedPriority = 'High';
    if (lowKws.some(k => combined.includes(k)))    aiSuggestedPriority = 'Low';

    const ticket = await Ticket.create({
      title, description, category,
      priority: priority || aiSuggestedPriority,
      user: req.user.id, attachments, aiSuggestedPriority,
      tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim())) : [],
    });

    const populated = await Ticket.findById(ticket._id)
      .populate('user',       'name email role')
      .populate('assignedTo', 'name email role');

    // ── Real-time: notify all agents/admins of new ticket ─
    emitToAll(req.io, 'ticket:new', {
      ticket:  populated,
      message: `New ticket from ${req.user.name}: ${title}`,
    });

    res.status(201).json({ success: true, data: populated });
  } catch (error) { next(error); }
};

// ── Update ticket ─────────────────────────────────────
exports.updateTicket = async (req, res, next) => {
  try {
    let ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    if (req.user.role === 'student') {
      if (ticket.user.toString() !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Not authorized' });
      }
      if (ticket.status !== 'Open') {
        return res.status(400).json({ success: false, message: 'Cannot edit ticket already in progress' });
      }
      const { title, description } = req.body;
      if (title)       ticket.title       = title;
      if (description) ticket.description = description;
      await ticket.save();
      return res.status(200).json({ success: true, data: ticket });
    }

    const { status, priority, assignedTo, category, title, description } = req.body;
    const oldStatus = ticket.status;

    if (status)      ticket.status      = status;
    if (priority)    ticket.priority    = priority;
    if (category)    ticket.category    = category;
    if (title)       ticket.title       = title;
    if (description) ticket.description = description;

    if (assignedTo !== undefined) {
      if (!assignedTo || assignedTo === '') {
        ticket.assignedTo = null;
      } else {
        const agent = await User.findById(assignedTo);
        if (!agent || !['agent','admin'].includes(agent.role)) {
          return res.status(400).json({ success: false, message: 'Invalid agent' });
        }
        ticket.assignedTo = assignedTo;
        if (ticket.status === 'Open') ticket.status = 'In Progress';

        // ── Real-time: notify assigned agent ──────────────
        emitToUser(req.io, assignedTo, 'ticket:assigned', {
          ticketId: ticket._id, ticketTitle: ticket.title,
          message: `You have been assigned ticket: ${ticket.title}`,
        });
      }
    }

    await ticket.save();

    const updated = await Ticket.findById(ticket._id)
      .populate('user',           'name email role enrollmentId')
      .populate('assignedTo',     'name email role')
      .populate('replies.author', 'name email role');

    // ── Real-time: notify everyone in the ticket room ─────
    emitToTicket(req.io, ticket._id.toString(), 'ticket:updated', {
      ticket:  updated,
      updatedBy: req.user.name,
      changes: { oldStatus, newStatus: ticket.status },
    });

    // ── Real-time: notify ticket owner if status changed ──
    if (oldStatus !== ticket.status) {
      emitToUser(req.io, ticket.user.toString(), 'ticket:status_changed', {
        ticketId:    ticket._id,
        ticketTitle: ticket.title,
        oldStatus,
        newStatus:   ticket.status,
        message:     `Your ticket "${ticket.title}" status changed to ${ticket.status}`,
      });
    }

    res.status(200).json({ success: true, data: updated });
  } catch (error) { next(error); }
};

// ── Delete ticket ─────────────────────────────────────
exports.deleteTicket = async (req, res, next) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });
    await ticket.deleteOne();

    // Notify room that ticket was deleted
    emitToTicket(req.io, req.params.id, 'ticket:deleted', { ticketId: req.params.id });

    res.status(200).json({ success: true, message: 'Ticket deleted' });
  } catch (error) { next(error); }
};

// ── Add reply ─────────────────────────────────────────
exports.addReply = async (req, res, next) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    if (req.user.role === 'student' && ticket.user.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    if (ticket.status === 'Closed') {
      return res.status(400).json({ success: false, message: 'Cannot reply to closed ticket' });
    }

    const { message, isInternal } = req.body;
    const attachments = (req.files || []).map(file => ({
      filename: file.filename, originalName: file.originalname,
      mimetype: file.mimetype, size: file.size, url: `/uploads/${file.filename}`,
    }));

    const reply = {
      message, author: req.user.id, authorRole: req.user.role,
      attachments,
      isInternal: req.user.role !== 'student' && isInternal === 'true',
    };

    ticket.replies.push(reply);

    // Auto-update status
    if (['agent','admin'].includes(req.user.role) && ticket.status === 'Open') {
      ticket.status = 'In Progress';
    }
    if (req.user.role === 'student' && ticket.status === 'Resolved') {
      ticket.status = 'In Progress';
    }

    await ticket.save();

    const updated = await Ticket.findById(ticket._id)
      .populate('user',           'name email role enrollmentId')
      .populate('assignedTo',     'name email role')
      .populate('replies.author', 'name email role');

    const newReply = updated.replies[updated.replies.length - 1];

    // ── Real-time: broadcast new reply to ticket room ─────
    // This is the key event — everyone viewing the ticket sees it instantly
    emitToTicket(req.io, ticket._id.toString(), 'ticket:new_reply', {
      ticketId: ticket._id,
      reply:    newReply,
      ticket:   updated,
    });

    // ── Real-time: notify ticket owner if agent replied ───
    if (['agent','admin'].includes(req.user.role) && !reply.isInternal) {
      emitToUser(req.io, ticket.user.toString(), 'notification:new_reply', {
        ticketId:    ticket._id,
        ticketTitle: ticket.title,
        replierName: req.user.name,
        message:     `${req.user.name} replied to your ticket: "${ticket.title}"`,
      });
    }

    // ── Real-time: notify agent if student replied ────────
    if (req.user.role === 'student' && ticket.assignedTo) {
      emitToUser(req.io, ticket.assignedTo.toString(), 'notification:new_reply', {
        ticketId:    ticket._id,
        ticketTitle: ticket.title,
        replierName: req.user.name,
        message:     `Student replied on ticket: "${ticket.title}"`,
      });
    }

    res.status(200).json({ success: true, data: updated });
  } catch (error) { next(error); }
};


// ── Re-export with cache invalidation ─────────────────
// We patch createTicket and updateTicket to also invalidate stats cache

const { invalidateStatsCache } = require('./statsController');
const { queueTicketCreatedEmail } = require('../queues/emailQueue');

const originalCreate = exports.createTicket;
exports.createTicket = async (req, res, next) => {
  // Store original res.json to intercept response
  const originalJson = res.json.bind(res);
  res.json = async (body) => {
    if (body.success && body.data) {
      // Invalidate stats cache after ticket creation
      await invalidateStatsCache(req.user.id, req.user.role).catch(() => {});

      // Queue confirmation email to student
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      queueTicketCreatedEmail({
        toEmail:    req.user.email,
        userName:   req.user.name,
        ticketId:   body.data.ticketId,
        ticketTitle: body.data.title,
        ticketLink: `${frontendUrl}/tickets/${body.data._id}`,
      }).catch(() => {}); // Don't fail if queue is down
    }
    return originalJson(body);
  };
  return originalCreate(req, res, next);
};
