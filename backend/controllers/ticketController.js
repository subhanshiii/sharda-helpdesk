const Ticket = require('../models/Ticket');
const User = require('../models/User');
const path = require('path');

// @desc    Get all tickets (admin/agent sees all, student sees own)
// @route   GET /api/tickets
// @access  Private
exports.getTickets = async (req, res, next) => {
  try {
    const { status, category, priority, search, page = 1, limit = 10 } = req.query;

    let query = {};

    // Students can only see their own tickets
    if (req.user.role === 'student') {
      query.user = req.user.id;
    }

    // Agents see tickets assigned to them OR unassigned
    if (req.user.role === 'agent') {
      query.$or = [{ assignedTo: req.user.id }, { assignedTo: null }];
    }

    // Filters
    if (status) query.status = status;
    if (category) query.category = category;
    if (priority) query.priority = priority;
    if (search) {
      query.$or = [
        ...(query.$or || []),
        { title: { $regex: search, $options: 'i' } },
        { ticketId: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await Ticket.countDocuments(query);
    const tickets = await Ticket.find(query)
      .populate('user', 'name email role enrollmentId')
      .populate('assignedTo', 'name email role')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      count: tickets.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      data: tickets,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single ticket
// @route   GET /api/tickets/:id
// @access  Private
exports.getTicket = async (req, res, next) => {
  try {
    const ticket = await Ticket.findById(req.params.id)
      .populate('user', 'name email role enrollmentId department')
      .populate('assignedTo', 'name email role')
      .populate('replies.author', 'name email role');

    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    // Authorization: students can only view own tickets
    if (req.user.role === 'student' && ticket.user._id.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this ticket' });
    }

    // Filter internal notes for students
    if (req.user.role === 'student') {
      ticket.replies = ticket.replies.filter((r) => !r.isInternal);
    }

    res.status(200).json({ success: true, data: ticket });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new ticket
// @route   POST /api/tickets
// @access  Private (student/admin)
exports.createTicket = async (req, res, next) => {
  try {
    const { title, description, category, priority, tags } = req.body;

    // Handle file attachments
    const attachments = [];
    if (req.files && req.files.length > 0) {
      req.files.forEach((file) => {
        attachments.push({
          filename: file.filename,
          originalName: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          url: `/uploads/${file.filename}`,
        });
      });
    }

    // Basic AI suggestion for priority based on keywords
    let aiSuggestedPriority = priority || 'Medium';
    const urgentKeywords = ['urgent', 'emergency', 'critical', 'broken', 'not working', 'cannot access', 'immediately'];
    const lowKeywords = ['suggestion', 'feedback', 'question', 'inquiry', 'info'];

    const descLower = (description || '').toLowerCase();
    const titleLower = (title || '').toLowerCase();
    const combined = descLower + ' ' + titleLower;

    if (urgentKeywords.some((kw) => combined.includes(kw))) {
      aiSuggestedPriority = 'High';
    } else if (lowKeywords.some((kw) => combined.includes(kw))) {
      aiSuggestedPriority = 'Low';
    }

    const ticket = await Ticket.create({
      title,
      description,
      category,
      priority: priority || aiSuggestedPriority,
      user: req.user.id,
      attachments,
      tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map((t) => t.trim())) : [],
      aiSuggestedPriority,
    });

    const populatedTicket = await Ticket.findById(ticket._id)
      .populate('user', 'name email role')
      .populate('assignedTo', 'name email role');

    res.status(201).json({ success: true, data: populatedTicket });
  } catch (error) {
    next(error);
  }
};

// @desc    Update ticket (status, priority, assign)
// @route   PUT /api/tickets/:id
// @access  Private (admin/agent)
exports.updateTicket = async (req, res, next) => {
  try {
    let ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    // Students can only update their own ticket's title/description if still Open
    if (req.user.role === 'student') {
      if (ticket.user.toString() !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Not authorized' });
      }
      if (ticket.status !== 'Open') {
        return res.status(400).json({ success: false, message: 'Cannot edit ticket that is already in progress' });
      }
      const { title, description } = req.body;
      ticket.title = title || ticket.title;
      ticket.description = description || ticket.description;
      await ticket.save();
      return res.status(200).json({ success: true, data: ticket });
    }

    // Admin/Agent can update anything
    const { status, priority, assignedTo, category, title, description } = req.body;

    if (status) ticket.status = status;
    if (priority) ticket.priority = priority;
    if (category) ticket.category = category;
    if (title) ticket.title = title;
    if (description) ticket.description = description;

    if (assignedTo !== undefined) {
      if (assignedTo === null || assignedTo === '') {
        ticket.assignedTo = null;
      } else {
        const agent = await User.findById(assignedTo);
        if (!agent || !['agent', 'admin'].includes(agent.role)) {
          return res.status(400).json({ success: false, message: 'Invalid agent ID' });
        }
        ticket.assignedTo = assignedTo;
        if (ticket.status === 'Open') ticket.status = 'In Progress';
      }
    }

    await ticket.save();

    const updatedTicket = await Ticket.findById(ticket._id)
      .populate('user', 'name email role enrollmentId')
      .populate('assignedTo', 'name email role')
      .populate('replies.author', 'name email role');

    res.status(200).json({ success: true, data: updatedTicket });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete ticket
// @route   DELETE /api/tickets/:id
// @access  Private (admin only)
exports.deleteTicket = async (req, res, next) => {
  try {
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    await ticket.deleteOne();
    res.status(200).json({ success: true, message: 'Ticket deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// @desc    Add reply to ticket
// @route   POST /api/tickets/:id/replies
// @access  Private
exports.addReply = async (req, res, next) => {
  try {
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    // Students can only reply to their own tickets
    if (req.user.role === 'student' && ticket.user.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // Cannot reply to closed tickets
    if (ticket.status === 'Closed') {
      return res.status(400).json({ success: false, message: 'Cannot reply to a closed ticket' });
    }

    const { message, isInternal } = req.body;

    // Handle reply attachments
    const attachments = [];
    if (req.files && req.files.length > 0) {
      req.files.forEach((file) => {
        attachments.push({
          filename: file.filename,
          originalName: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          url: `/uploads/${file.filename}`,
        });
      });
    }

    const reply = {
      message,
      author: req.user.id,
      authorRole: req.user.role,
      attachments,
      isInternal: req.user.role !== 'student' && isInternal === 'true',
    };

    ticket.replies.push(reply);

    // Auto-update status when agent/admin replies
    if (['agent', 'admin'].includes(req.user.role) && ticket.status === 'Open') {
      ticket.status = 'In Progress';
    }

    // Re-open ticket if student replies on resolved ticket
    if (req.user.role === 'student' && ticket.status === 'Resolved') {
      ticket.status = 'In Progress';
    }

    await ticket.save();

    const updatedTicket = await Ticket.findById(ticket._id)
      .populate('user', 'name email role enrollmentId')
      .populate('assignedTo', 'name email role')
      .populate('replies.author', 'name email role');

    res.status(200).json({ success: true, data: updatedTicket });
  } catch (error) {
    next(error);
  }
};
