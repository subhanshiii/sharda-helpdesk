/**
 * Group Chat Service
 * All business logic for group chat operations.
 * Controllers are thin — all logic lives here.
 */

const Group   = require('../models/Group');
const Message = require('../models/Message');
const User    = require('../models/User');
const logger  = require('../utils/logger');

const GROUP_MEMBER_ROLES = ['student', 'agent', 'admin'];

const normalizeGroupValue = (value) => {
  if (value === undefined || value === null) return undefined;
  const trimmed = String(value).trim();
  return trimmed || '';
};

const isGroupManager = (group, userId) => group.members.some(
  (member) => member.user.toString() === userId.toString() && member.role === 'admin'
);

const canManageGroup = async (groupId, userId) => {
  const requester = await User.findById(userId).select('role');
  if (!requester) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }

  const group = await Group.findById(groupId);
  if (!group || !group.isActive) {
    const err = new Error('Group not found');
    err.statusCode = 404;
    throw err;
  }

  const isManager = isGroupManager(group, userId);
  if (!isManager && requester.role !== 'admin') {
    const err = new Error('Only group admins can manage this group');
    err.statusCode = 403;
    throw err;
  }

  return { group, requester, isManager };
};

const canCreateGroup = async (userId) => {
  const requester = await User.findById(userId).select('role');
  if (!requester) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }

  if (requester.role === 'admin') return requester;

  const managesAnyGroup = await Group.exists({
    isActive: true,
    members: { $elemMatch: { user: userId, role: 'admin' } },
  });

  if (!managesAnyGroup) {
    const err = new Error('Only system admins or existing group admins can create groups');
    err.statusCode = 403;
    throw err;
  }

  return requester;
};

const canAccessGroup = async (groupId, userId) => {
  const user = await User.findById(userId).select('role');
  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }

  const group = await Group.findById(groupId);
  if (!group || !group.isActive) {
    const err = new Error('Group not found');
    err.statusCode = 404;
    throw err;
  }

  const isMember = group.members.some(
    (member) => member.user.toString() === userId.toString()
  );

  if (!isMember && user.role !== 'admin') {
    const err = new Error('You are not a member of this group');
    err.statusCode = 403;
    throw err;
  }

  return { group, user, isMember };
};

// ── GROUP OPERATIONS ───────────────────────────────────

/**
 * Create a new group
 * Only admins can create groups
 */
const createGroup = async ({ name, department, year, section, description, creatorId }) => {
  await canCreateGroup(creatorId);

  const normalizedName = normalizeGroupValue(name);
  const normalizedDepartment = normalizeGroupValue(department);
  const normalizedYear = normalizeGroupValue(year);
  const normalizedSection = normalizeGroupValue(section);
  const normalizedDescription = normalizeGroupValue(description);

  // Check duplicate group name
  const existing = await Group.findOne({ name: normalizedName, isActive: true });
  if (existing) {
    const err = new Error(`A group named "${name}" already exists`);
    err.statusCode = 400;
    throw err;
  }

  const group = await Group.create({
    name: normalizedName,
    department: normalizedDepartment,
    year: normalizedYear,
    section: normalizedSection,
    description: normalizedDescription,
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

  const requester = await User.findById(userId).select('role');
  const isMember = group.members.some((m) => m.user._id.toString() === userId.toString());

  if (!isMember && requester?.role !== 'admin') {
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
  const { group } = await canManageGroup(groupId, adminId);

  const addedUsers = [];
  const skippedUsers = [];

  for (let i = 0; i < userIds.length; i++) {
    const userId = userIds[i];
    const role = GROUP_MEMBER_ROLES.includes(roles?.[i]) ? roles[i] : 'student';

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
 * Update an existing member role inside a group
 */
const updateMemberRole = async (groupId, userId, role, requesterId) => {
  if (!GROUP_MEMBER_ROLES.includes(role)) {
    const err = new Error('Invalid group role');
    err.statusCode = 400;
    throw err;
  }

  const { group, requester } = await canManageGroup(groupId, requesterId);
  const member = group.members.find((entry) => entry.user.toString() === userId.toString());

  if (!member) {
    const err = new Error('Member not found in this group');
    err.statusCode = 404;
    throw err;
  }

  const adminCount = group.members.filter((entry) => entry.role === 'admin').length;
  if (
    member.role === 'admin' &&
    role !== 'admin' &&
    adminCount === 1
  ) {
    const err = new Error('A group must have at least one group admin');
    err.statusCode = 400;
    throw err;
  }

  member.role = role;
  await group.save();

  const updatedMember = await User.findById(userId).select('name');
  await Message.create({
    group: groupId,
    sender: requesterId,
    type: 'system',
    systemMessage: `${updatedMember?.name || 'A member'} is now ${role === 'admin' ? 'a group admin' : `a ${role}`}`,
  });

  logger.info('Group member role updated', { groupId, userId, role, requesterId, requesterRole: requester.role });
  return group;
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
  const adminCount = group.members.filter((m) => m.role === 'admin').length;
  const isRemovingLastAdmin = group.members.some(
    (m) => m.user.toString() === userId.toString() && m.role === 'admin'
  ) && adminCount === 1;

  if (isRemovingLastAdmin) {
    const err = new Error('A group must have at least one group admin');
    err.statusCode = 400;
    throw err;
  }

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

  // Soft delete the group, but remove related chat history.
  group.isActive = false;
  group.lastMessage = null;
  await group.save();
  await Message.deleteMany({ group: groupId });

  logger.info('Group deleted', { groupId, adminId });
};

/**
 * Update a group (admin only)
 */
const updateGroup = async (groupId, updates, adminId) => {
  const { group } = await canManageGroup(groupId, adminId);

  const nextName = normalizeGroupValue(updates.name);
  const nextDepartment = normalizeGroupValue(updates.department);
  const nextYear = normalizeGroupValue(updates.year);
  const nextSection = normalizeGroupValue(updates.section);
  const nextDescription = normalizeGroupValue(updates.description);

  if (!nextName) {
    const err = new Error('Group name is required');
    err.statusCode = 400;
    throw err;
  }

  const duplicate = await Group.findOne({
    _id: { $ne: groupId },
    name: nextName,
    isActive: true,
  });

  if (duplicate) {
    const err = new Error(`A group named "${nextName}" already exists`);
    err.statusCode = 400;
    throw err;
  }

  // Update allowed fields
  group.name = nextName;
  if (updates.department !== undefined) group.department = nextDepartment;
  if (updates.year !== undefined) group.year = nextYear;
  if (updates.section !== undefined) group.section = nextSection;
  if (updates.description !== undefined) group.description = nextDescription;

  await group.save();

  const populated = await Group.findById(group._id)
    .populate('createdBy', 'name email role')
    .populate('members.user', 'name email role department');

  logger.info('Group updated', { groupId, updates, adminId });
  return populated;
};

// ── MESSAGE OPERATIONS ─────────────────────────────────

/**
 * Get chat history for a group (paginated)
 * Returns messages in chronological order
 */
const getMessages = async (groupId, userId, page = 1, limit = 50) => {
  await canAccessGroup(groupId, userId);

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
  await canAccessGroup(groupId, senderId);

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
    .populate('group', 'name')
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

  const group = await Group.findById(message.group);
  const requester = await User.findById(userId).select('role');
  const isManager = group ? isGroupManager(group, userId) : false;

  // Sender, group admin, or system admin can delete the message
  if (
    message.sender.toString() !== userId.toString() &&
    !isManager &&
    requester?.role !== 'admin'
  ) {
    const err = new Error('You are not authorized to delete this message');
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
  addMembers, updateMemberRole, removeMember,
  updateGroup, getMessages, saveMessage, deleteMessage,
};
