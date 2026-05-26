/**
 * Group Chat Controller — THIN LAYER
 * Parse HTTP request → call service → send response
 * Zero business logic here
 */

const chatService = require('../services/groupChatService');
const Group = require('../models/Group');
const User = require('../models/User');

const emitGroupEventToMembers = async (io, groupId, event, payload) => {
  if (!io) return;

  const [group, admins] = await Promise.all([
    Group.findById(groupId).select('members.user'),
    User.find({ role: 'admin', isActive: true }).select('_id'),
  ]);

  const recipientIds = new Set(admins.map((admin) => admin._id.toString()));
  if (group) {
    group.members.forEach((member) => {
      recipientIds.add(member.user.toString());
    });
  }

  recipientIds.forEach((recipientId) => {
    io.to(`user:${recipientId}`).emit(event, payload);
  });
};

const getGroupSnapshot = async (groupId) => Group.findById(groupId)
  .populate('createdBy', 'name email role adminTier')
  .populate('selectionRules.departmentIds', 'name code')
  .populate('selectionRules.sectionIds', 'name studyYear')
  .populate('members.user', 'name email role department departmentId section sectionId enrollmentId')
  .populate('lastMessage');

// ── GROUP ENDPOINTS ────────────────────────────────────

// POST /api/chat-groups
exports.createGroup = async (req, res, next) => {
  try {
    const { title, name, description, filters, memberIds, adminIds } = req.body;
    if (!(title || name)) return res.status(400).json({ success: false, message: 'Group title is required' });

    const group = await chatService.createGroup({
      title, name, description, filters, memberIds, adminIds,
      creatorId: req.user.id,
    });

    await emitGroupEventToMembers(req.io, group._id, 'group:created', { group });

    res.status(201).json({ success: true, data: group });
  } catch (error) {
    if (error?.code === 11000) {
      const duplicateFields = Object.keys(error.keyPattern || {}).join(', ');
      return res.status(400).json({
        success: false,
        message: duplicateFields
          ? `Group creation was blocked by a duplicate database index on: ${duplicateFields}.`
          : 'Group creation was blocked by a duplicate database index.',
      });
    }
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

// GET /api/chat-groups — all groups with optional audience filters
exports.getAllGroups = async (req, res, next) => {
  try {
    const groups = await chatService.getAllGroups(req.query);
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
    const group = await chatService.getGroup(req.params.id, req.user.id);

    // Notify added users via socket
    if (req.io) {
      result.addedUsers.forEach(({ userId }) => {
        req.io.to(`user:${userId}`).emit('group:added', { groupId: req.params.id });
      });
    }

    await emitGroupEventToMembers(req.io, req.params.id, 'group:updated', { group });

    res.status(200).json({ success: true, data: { ...result, group } });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    next(error);
  }
};

// PUT /api/chat-groups/:id/members/:userId — update member role
exports.updateMemberRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!role) return res.status(400).json({ success: false, message: 'Member role is required' });

    await chatService.updateMemberRole(req.params.id, req.params.userId, role, req.user.id);
    const group = await chatService.getGroup(req.params.id, req.user.id);

    await emitGroupEventToMembers(req.io, req.params.id, 'group:updated', { group });

    res.status(200).json({ success: true, data: group });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    next(error);
  }
};

// DELETE /api/chat-groups/:id/members/:userId — remove member
exports.removeMember = async (req, res, next) => {
  try {
    await chatService.removeMember(req.params.id, req.params.userId, req.user.id);
    const group = await getGroupSnapshot(req.params.id);

    if (req.io) {
      req.io.to(`user:${req.params.userId}`).emit('group:removed', { groupId: req.params.id });
    }

    await emitGroupEventToMembers(req.io, req.params.id, 'group:updated', { group });

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
    await emitGroupEventToMembers(req.io, req.params.id, 'group:deleted', { groupId: req.params.id });
    res.status(200).json({ success: true, message: 'Group deleted' });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    next(error);
  }
};

// PUT /api/chat-groups/:id — update group
exports.updateGroup = async (req, res, next) => {
  try {
    const { title, name, description, filters } = req.body;
    if (!(title || name)) return res.status(400).json({ success: false, message: 'Group title is required' });

    const group = await chatService.updateGroup(req.params.id, {
      title, name, description, filters,
    }, req.user.id);

    await emitGroupEventToMembers(req.io, group._id, 'group:updated', { group });

    res.status(200).json({ success: true, data: group });
  } catch (error) {
    if (error?.code === 11000) {
      const duplicateFields = Object.keys(error.keyPattern || {}).join(', ');
      return res.status(400).json({
        success: false,
        message: duplicateFields
          ? `Group update was blocked by a duplicate database index on: ${duplicateFields}.`
          : 'Group update was blocked by a duplicate database index.',
      });
    }
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
        url:          `/api/files/chat/${req.file.filename}`,
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

    // Broadcast via socket to all group members
    await emitGroupEventToMembers(req.io, req.params.id, 'chat:message', message);

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

    await emitGroupEventToMembers(req.io, message.group, 'chat:message_deleted', {
      messageId: message._id,
      groupId: message.group,
    });

    res.status(200).json({ success: true, message: 'Message deleted' });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    next(error);
  }
};

// GET /api/chat-groups/users/options — filter metadata for group creation
exports.getUserFilterOptions = async (req, res, next) => {
  try {
    const options = await chatService.getUserDirectoryOptions();
    res.status(200).json({ success: true, data: options });
  } catch (error) { next(error); }
};

// GET /api/chat-groups/users/search — search or filter users for membership selection
exports.searchUsers = async (req, res, next) => {
  try {
    const {
      q = '',
      role,
      roles,
      departmentId,
      departmentIds,
      sectionId,
      sectionIds,
      page = 1,
      limit = 24,
      excludeUserIds,
    } = req.query;

    const parsedRoles = roles ? String(roles).split(',') : role ? [role] : [];
    const parsedDepartmentIds = departmentIds ? String(departmentIds).split(',') : departmentId ? [departmentId] : [];
    const parsedSectionIds = sectionIds ? String(sectionIds).split(',') : sectionId ? [sectionId] : [];
    const parsedExcludeIds = excludeUserIds ? String(excludeUserIds).split(',') : [];

    const result = await chatService.getFilteredUsers({
      q,
      roles: parsedRoles,
      departmentIds: parsedDepartmentIds,
      sectionIds: parsedSectionIds,
      excludeUserIds: parsedExcludeIds,
      page,
      limit,
    });

    res.status(200).json({ success: true, data: result.users, pagination: {
      total: result.total,
      page: result.page,
      limit: result.limit,
      hasMore: result.hasMore,
    } });
  } catch (error) { next(error); }
};
