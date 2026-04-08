/**
 * Group Chat Service
 * All business logic for group chat operations.
 * Controllers are thin — all logic lives here.
 */

const Group   = require('../models/Group');
const Message = require('../models/Message');
const User    = require('../models/User');
const logger  = require('../utils/logger');

// ── GROUP OPERATIONS ───────────────────────────────────

/**
 * Create a new group
 * Only admins can create groups
 */
const createGroup = async ({ name, department, year, section, description, creatorId }) => {
  // Check duplicate group name
  const existing = await Group.findOne({ name: name.trim(), isActive: true });
  if (existing) {
    const err = new Error(`A group named "${name}" already exists`);
    err.statusCode = 400;
    throw err;
  }

  const group = await Group.create({
    name: name.trim(),
    department,
    year,
    section,
    description,
    createdBy: creatorId,
    // Creator is automatically added as admin member
    members: [{ user: creatorId, role: 'admin' }],
  });

  // Send system message: "Group was created"
  await Message.create({
    group:         group._id,
    sender:        creatorId,
    type:          'system',
    systemMessage: `Group "${name}" was created`,
  });

  const populated = await Group.findById(group._id)
    .populate('createdBy', 'name email role')
    .populate('members.user', 'name email role department');

  logger.info('Group created', { groupId: group._id, name, creatorId });
  return populated;
};

/**
 * Get all groups a user belongs to
 * With last message preview for sidebar
 */
const getUserGroups = async (userId) => {
  const groups = await Group.find({
    'members.user': userId,
    isActive: true,
  })
    .populate('lastMessage')
    .populate('members.user', 'name email role')
    .sort({ updatedAt: -1 }); // Most recently active first

  // For each group, get unread count for this user
  const groupsWithUnread = await Promise.all(
    groups.map(async (group) => {
      const groupObj = group.toObject();

      // Count messages not read by this user
      const unreadCount = await Message.countDocuments({
        group:          group._id,
        sender:         { $ne: userId }, // Not sent by this user
        'readBy.user':  { $ne: userId }, // Not read by this user
        isDeleted:      false,
      });

      // Find this user's role in the group
      const memberInfo = group.members.find(
        (m) => m.user._id.toString() === userId.toString()
      );

      return {
        ...groupObj,
        unreadCount,
        myRole: memberInfo?.role || 'student',
      };
    })
  );

  return groupsWithUnread;
};

/**
 * Get a single group (with authorization check)
 */
const getGroup = async (groupId, userId) => {
  const group = await Group.findById(groupId)
    .populate('createdBy',     'name email role')
    .populate('members.user',  'name email role department enrollmentId')
    .populate('lastMessage');

  if (!group) {
    const err = new Error('Group not found');
    err.statusCode = 404;
    throw err;
  }

  // Check if user is a member
  const isMember = group.members.some(
    (m) => m.user._id.toString() === userId.toString()
  );

  if (!isMember) {
    const err = new Error('You are not a member of this group');
    err.statusCode = 403;
    throw err;
  }

  return group;
};

/**
 * Add members to a group
 */
const addMembers = async (groupId, userIds, roles, adminId) => {
  const group = await Group.findById(groupId);
  if (!group) {
    const err = new Error('Group not found');
    err.statusCode = 404;
    throw err;
  }

  // Check if requester is group admin or app admin
  const requester = await User.findById(adminId);
  const isGroupAdmin = group.members.some(
    (m) => m.user.toString() === adminId.toString() && m.role === 'admin'
  );

  if (!isGroupAdmin && requester.role !== 'admin') {
    const err = new Error('Only group admins can add members');
    err.statusCode = 403;
    throw err;
  }

  const addedUsers = [];
  const skippedUsers = [];

  for (let i = 0; i < userIds.length; i++) {
    const userId = userIds[i];
    const role   = roles?.[i] || 'student';

    // Check if already a member
    const alreadyMember = group.members.some(
      (m) => m.user.toString() === userId.toString()
    );

    if (alreadyMember) {
      skippedUsers.push(userId);
      continue;
    }

    // Verify user exists
    const user = await User.findById(userId);
    if (!user) continue;

    group.members.push({ user: userId, role });
    addedUsers.push({ userId, name: user.name, role });
  }

  await group.save();

  // Send system messages for each added user
  for (const added of addedUsers) {
    await Message.create({
      group:         groupId,
      sender:        adminId,
      type:          'system',
      systemMessage: `${added.name} was added to the group`,
    });
  }

  logger.info('Members added to group', { groupId, addedCount: addedUsers.length });
  return { addedUsers, skippedUsers };
};

/**
 * Remove a member from a group
 */
const removeMember = async (groupId, userId, requesterId) => {
  const group = await Group.findById(groupId);
  if (!group) {
    const err = new Error('Group not found');
    err.statusCode = 404;
    throw err;
  }

  const requester     = await User.findById(requesterId);
  const isGroupAdmin  = group.members.some(
    (m) => m.user.toString() === requesterId.toString() && m.role === 'admin'
  );
  const isSelfLeaving = userId === requesterId;

  if (!isGroupAdmin && requester.role !== 'admin' && !isSelfLeaving) {
    const err = new Error('Not authorized to remove members');
    err.statusCode = 403;
    throw err;
  }

  const userToRemove = await User.findById(userId);
  group.members = group.members.filter(
    (m) => m.user.toString() !== userId.toString()
  );

  await group.save();

  // System message
  await Message.create({
    group:         groupId,
    sender:        requesterId,
    type:          'system',
    systemMessage: isSelfLeaving
      ? `${userToRemove?.name} left the group`
      : `${userToRemove?.name} was removed from the group`,
  });

  logger.info('Member removed from group', { groupId, userId });
  return group;
};

/**
 * Get all groups (admin view)
 */
const getAllGroups = async (filters = {}) => {
  const query = { isActive: true };
  if (filters.department) query.department = filters.department;
  if (filters.year)       query.year       = filters.year;

  const groups = await Group.find(query)
    .populate('createdBy',    'name email')
    .populate('members.user', 'name email role')
    .sort({ createdAt: -1 });

  return groups;
};

/**
 * Delete a group (admin only)
 */
const deleteGroup = async (groupId, adminId) => {
  const group = await Group.findById(groupId);
  if (!group) {
    const err = new Error('Group not found');
    err.statusCode = 404;
    throw err;
  }

  // Soft delete — keep messages in DB
  group.isActive = false;
  await group.save();

  logger.info('Group deleted', { groupId, adminId });
};

// ── MESSAGE OPERATIONS ─────────────────────────────────

/**
 * Get chat history for a group (paginated)
 * Returns messages in chronological order
 */
const getMessages = async (groupId, userId, page = 1, limit = 50) => {
  // Verify user is a member
  const group = await Group.findOne({
    _id:            groupId,
    'members.user': userId,
    isActive:       true,
  });

  if (!group) {
    const err = new Error('Group not found or you are not a member');
    err.statusCode = 403;
    throw err;
  }

  const total    = await Message.countDocuments({ group: groupId, isDeleted: false });
  const messages = await Message.find({ group: groupId, isDeleted: false })
    .populate('sender', 'name email role department')
    .sort({ createdAt: -1 }) // Latest first
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  // Reverse so newest is at bottom (like chat UI)
  messages.reverse();

  // Mark messages as read
  await Message.updateMany(
    {
      group:          groupId,
      sender:         { $ne: userId },
      'readBy.user':  { $ne: userId },
      isDeleted:      false,
    },
    {
      $push: { readBy: { user: userId, readAt: new Date() } },
    }
  );

  return {
    messages,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: page,
    hasMore: page < Math.ceil(total / limit),
  };
};

/**
 * Save a new message (called from socket handler)
 */
const saveMessage = async ({ groupId, senderId, content, type = 'text', file }) => {
  // Verify sender is a member
  const group = await Group.findOne({
    _id:            groupId,
    'members.user': senderId,
    isActive:       true,
  });

  if (!group) {
    const err = new Error('Not a member of this group');
    err.statusCode = 403;
    throw err;
  }

  // Create message
  const message = await Message.create({
    group:   groupId,
    sender:  senderId,
    content: content?.trim(),
    type,
    file,
    // Sender has automatically "read" their own message
    readBy: [{ user: senderId, readAt: new Date() }],
  });

  // Update group's lastMessage for sidebar preview
  await Group.findByIdAndUpdate(groupId, {
    lastMessage: message._id,
    updatedAt:   new Date(),
  });

  // Populate sender info before returning
  const populated = await Message.findById(message._id)
    .populate('sender', 'name email role department')
    .lean();

  return populated;
};

/**
 * Delete a message (soft delete)
 */
const deleteMessage = async (messageId, userId) => {
  const message = await Message.findById(messageId);
  if (!message) {
    const err = new Error('Message not found');
    err.statusCode = 404;
    throw err;
  }

  // Only sender can delete their message
  if (message.sender.toString() !== userId.toString()) {
    const err = new Error('You can only delete your own messages');
    err.statusCode = 403;
    throw err;
  }

  message.isDeleted = true;
  message.deletedAt = new Date();
  message.content   = null;
  message.file      = undefined;
  await message.save();

  return message;
};

module.exports = {
  createGroup, getUserGroups, getGroup, getAllGroups, deleteGroup,
  addMembers, removeMember,
  getMessages, saveMessage, deleteMessage,
};
