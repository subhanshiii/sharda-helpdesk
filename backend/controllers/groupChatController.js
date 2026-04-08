/**
 * Group Chat Controller — THIN LAYER
 * Parse HTTP request → call service → send response
 * Zero business logic here
 */

const chatService = require('../services/groupChatService');

// ── GROUP ENDPOINTS ────────────────────────────────────

// POST /api/chat-groups
exports.createGroup = async (req, res, next) => {
  try {
    const { name, department, year, section, description } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Group name is required' });

    const group = await chatService.createGroup({
      name, department, year, section, description,
      creatorId: req.user.id,
    });

    // Notify all connected sockets that a new group was created
    if (req.io) {
      req.io.emit('group:created', { group });
    }

    res.status(201).json({ success: true, data: group });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    next(error);
  }
};

// GET /api/chat-groups/my — groups for logged-in user
exports.getMyGroups = async (req, res, next) => {
  try {
    const groups = await chatService.getUserGroups(req.user.id);
    res.status(200).json({ success: true, data: groups });
  } catch (error) { next(error); }
};

// GET /api/chat-groups — all groups (admin only)
exports.getAllGroups = async (req, res, next) => {
  try {
    const { department, year } = req.query;
    const groups = await chatService.getAllGroups({ department, year });
    res.status(200).json({ success: true, data: groups, count: groups.length });
  } catch (error) { next(error); }
};

// GET /api/chat-groups/:id
exports.getGroup = async (req, res, next) => {
  try {
    const group = await chatService.getGroup(req.params.id, req.user.id);
    res.status(200).json({ success: true, data: group });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    next(error);
  }
};

// POST /api/chat-groups/:id/members — add members
exports.addMembers = async (req, res, next) => {
  try {
    const { userIds, roles } = req.body;
    if (!userIds?.length) return res.status(400).json({ success: false, message: 'userIds array is required' });

    const result = await chatService.addMembers(req.params.id, userIds, roles, req.user.id);

    // Notify added users via socket
    if (req.io) {
      result.addedUsers.forEach(({ userId }) => {
        req.io.to(`user:${userId}`).emit('group:added', { groupId: req.params.id });
      });
    }

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    next(error);
  }
};

// DELETE /api/chat-groups/:id/members/:userId — remove member
exports.removeMember = async (req, res, next) => {
  try {
    const group = await chatService.removeMember(req.params.id, req.params.userId, req.user.id);

    if (req.io) {
      req.io.to(`user:${req.params.userId}`).emit('group:removed', { groupId: req.params.id });
    }

    res.status(200).json({ success: true, data: group });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    next(error);
  }
};

// DELETE /api/chat-groups/:id
exports.deleteGroup = async (req, res, next) => {
  try {
    await chatService.deleteGroup(req.params.id, req.user.id);
    if (req.io) req.io.emit('group:deleted', { groupId: req.params.id });
    res.status(200).json({ success: true, message: 'Group deleted' });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    next(error);
  }
};

// ── MESSAGE ENDPOINTS ──────────────────────────────────

// GET /api/chat-groups/:id/messages
exports.getMessages = async (req, res, next) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const result = await chatService.getMessages(req.params.id, req.user.id, parseInt(page), parseInt(limit));
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    next(error);
  }
};

// POST /api/chat-groups/:id/messages — REST fallback (socket is primary)
exports.sendMessage = async (req, res, next) => {
  try {
    const { content } = req.body;
    let file;

    if (req.file) {
      file = {
        originalName: req.file.originalname,
        url:          `/uploads/chat/${req.file.filename}`,
        mimeType:     req.file.mimetype,
        size:         req.file.size,
        filename:     req.file.filename,
      };
    }

    if (!content && !file) {
      return res.status(400).json({ success: false, message: 'Message or file is required' });
    }

    const type = file
      ? file.mimeType.startsWith('image/') ? 'image' : 'document'
      : 'text';

    const message = await chatService.saveMessage({
      groupId:  req.params.id,
      senderId: req.user.id,
      content,
      type,
      file,
    });

    // Broadcast via socket
    if (req.io) {
      req.io.to(`group:${req.params.id}`).emit('chat:message', message);
    }

    res.status(201).json({ success: true, data: message });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    next(error);
  }
};

// DELETE /api/chat-groups/messages/:messageId
exports.deleteMessage = async (req, res, next) => {
  try {
    const message = await chatService.deleteMessage(req.params.messageId, req.user.id);

    if (req.io) {
      req.io.to(`group:${message.group}`).emit('chat:message_deleted', {
        messageId: message._id,
        groupId:   message.group,
      });
    }

    res.status(200).json({ success: true, message: 'Message deleted' });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    next(error);
  }
};

// GET /api/chat-groups/users/search — search users to add to group
exports.searchUsers = async (req, res, next) => {
  try {
    const { q, role } = req.query;
    if (!q || q.length < 2) return res.status(400).json({ success: false, message: 'Search query must be at least 2 characters' });

    const User  = require('../models/User');
    const query = {
      $or: [
        { name:         { $regex: q, $options: 'i' } },
        { email:        { $regex: q, $options: 'i' } },
        { enrollmentId: { $regex: q, $options: 'i' } },
      ],
      isActive: true,
    };
    if (role) query.role = role;

    const users = await User.find(query)
      .select('name email role department enrollmentId')
      .limit(20);

    res.status(200).json({ success: true, data: users });
  } catch (error) { next(error); }
};
