/**
 * Group Chat Service
 * All business logic for group chat operations.
 * Controllers are thin — all logic lives here.
 */

const mongoose = require('mongoose');
const Group   = require('../models/Group');
const Message = require('../models/Message');
const User    = require('../models/User');
const Department = require('../models/Department');
const Section = require('../models/Section');
const Permission = require('../models/Permission');
const logger  = require('../utils/logger');
const {
  buildResolvedPermissions,
  DEFAULT_ROLE_PERMISSIONS,
  resolveEffectiveTier,
  isPlatformAdmin,
} = require('../utils/permissionDefaults');
const { normalizeRole, getStoredRolesForRoles } = require('../utils/roleHelpers');

const GROUP_MEMBER_ROLES = ['member', 'admin', 'student', 'faculty', 'staff', 'agent'];
const FILTERABLE_ROLES = ['student', 'faculty', 'staff', 'admin'];
const GROUP_ADMIN_ROLE = 'admin';
const GROUP_DEFAULT_ROLE = 'member';
const USER_SELECT_FIELDS = 'name email role department departmentId programId section sectionId enrollmentId status isActive emailVerified adminTier';

const normalizeGroupValue = (value) => {
  if (value === undefined || value === null) return undefined;
  const trimmed = String(value).trim();
  return trimmed || '';
};

const toObjectId = (value) => {
  if (!value || !mongoose.Types.ObjectId.isValid(value)) return null;
  return new mongoose.Types.ObjectId(value);
};

const normalizeIdList = (values = []) => [...new Set(
  (Array.isArray(values) ? values : [values])
    .map((value) => (mongoose.Types.ObjectId.isValid(value) ? String(value) : null))
    .filter(Boolean)
)];

const normalizeRoleList = (values = []) => [...new Set(
  (Array.isArray(values) ? values : [values])
    .map((value) => normalizeRole(value))
    .filter((value) => FILTERABLE_ROLES.includes(value))
)];

const isStudentRole = (roles = []) => roles.includes('student');

const describeSelectionRules = ({ roles = [], departmentNames = [], sectionNames = [] }) => {
  const parts = [];
  if (roles.length) parts.push(`roles: ${roles.join(', ')}`);
  if (departmentNames.length) parts.push(`departments: ${departmentNames.join(', ')}`);
  if (sectionNames.length) parts.push(`sections: ${sectionNames.join(', ')}`);
  return parts.join(' · ');
};

const isGroupManager = (group, userId) => group.members.some(
  (member) => member.user.toString() === userId.toString() && member.role === GROUP_ADMIN_ROLE
);

const buildUserFilterQuery = ({ q, roles = [], departmentIds = [], sectionIds = [], excludeUserIds = [] } = {}) => {
  const query = {
    isActive: true,
    status: 'approved',
    emailVerified: true,
  };

  const storedRoles = getStoredRolesForRoles(roles);
  if (storedRoles.length === 1) {
    query.role = storedRoles[0];
  } else if (storedRoles.length > 1) {
    query.role = { $in: storedRoles };
  }

  if (departmentIds.length) {
    query.departmentId = { $in: departmentIds.map((id) => toObjectId(id)).filter(Boolean) };
  }

  if (sectionIds.length) {
    query.sectionId = { $in: sectionIds.map((id) => toObjectId(id)).filter(Boolean) };
  }

  if (excludeUserIds.length) {
    query._id = { $nin: excludeUserIds.map((id) => toObjectId(id)).filter(Boolean) };
  }

  const searchValue = normalizeGroupValue(q);
  if (searchValue) {
    query.$or = [
      { name: { $regex: searchValue, $options: 'i' } },
      { email: { $regex: searchValue, $options: 'i' } },
      { enrollmentId: { $regex: searchValue, $options: 'i' } },
    ];
  }

  return query;
};

const getFilteredUsers = async ({
  q = '',
  roles = [],
  departmentIds = [],
  sectionIds = [],
  excludeUserIds = [],
  page = 1,
  limit = 24,
} = {}) => {
  const normalizedRoles = normalizeRoleList(roles);
  const normalizedDepartmentIds = normalizeIdList(departmentIds);
  const normalizedSectionIds = normalizeIdList(sectionIds);
  const safePage = Math.max(parseInt(page, 10) || 1, 1);
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 24, 1), 100);
  const query = buildUserFilterQuery({
    q,
    roles: normalizedRoles,
    departmentIds: normalizedDepartmentIds,
    sectionIds: normalizedSectionIds,
    excludeUserIds,
  });

  const [users, total] = await Promise.all([
    User.find(query)
      .select(USER_SELECT_FIELDS)
      .populate('departmentId', 'name code')
      .populate('sectionId', 'name studyYear')
      .sort({ name: 1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit),
    User.countDocuments(query),
  ]);

  return {
    users,
    total,
    page: safePage,
    limit: safeLimit,
    hasMore: safePage * safeLimit < total,
  };
};

const buildGroupMembers = async ({ creatorId, memberIds = [], adminIds = [] }) => {
  const uniqueMemberIds = [...new Set([String(creatorId), ...memberIds.map(String)])];
  const adminSet = new Set([String(creatorId), ...adminIds.map(String)]);
  const users = await User.find({
    _id: { $in: uniqueMemberIds.map((id) => toObjectId(id)).filter(Boolean) },
    isActive: true,
    status: 'approved',
    emailVerified: true,
  }).select('_id');

  const allowedIds = new Set(users.map((user) => String(user._id)));

  return uniqueMemberIds
    .filter((id) => allowedIds.has(String(id)))
    .map((id) => ({
      user: id,
      role: adminSet.has(String(id)) ? GROUP_ADMIN_ROLE : GROUP_DEFAULT_ROLE,
    }));
};

const populateGroup = (groupId) => Group.findById(groupId)
  .populate('createdBy', 'name email role adminTier')
  .populate('selectionRules.departmentIds', 'name code')
  .populate('selectionRules.sectionIds', 'name studyYear')
  .populate('members.user', USER_SELECT_FIELDS)
  .populate('lastMessage');

const normalizeSelectionRules = (filters = {}) => {
  const roles = normalizeRoleList(filters.roles || filters.role || []);
  const departmentIds = normalizeIdList(filters.departmentIds || filters.departmentId || []);
  const sectionIds = normalizeIdList(filters.sectionIds || filters.sectionId || []);
  const autoIncludeFiltered = Boolean(filters.autoIncludeFiltered || filters.selectAllFiltered);

  return {
    roles,
    departmentIds,
    sectionIds: isStudentRole(roles) ? sectionIds : [],
    autoIncludeFiltered,
  };
};

const buildAudienceSignature = (rules = {}) => {
  const roleSignature = [...(rules.roles || [])].sort().join('|') || 'all-roles';
  const departmentSignature = [...(rules.departmentIds || [])].map(String).sort().join('|') || 'all-departments';
  const sectionSignature = [...(rules.sectionIds || [])].map(String).sort().join('|') || 'all-sections';
  return `${roleSignature}::${departmentSignature}::${sectionSignature}`;
};

const hasStructuredAudienceFilters = (rules = {}) => (
  Boolean(rules.roles?.length || rules.departmentIds?.length || rules.sectionIds?.length)
);

const buildSelectionContext = async (rules) => {
  const [departments, sections] = await Promise.all([
    rules.departmentIds.length
      ? Department.find({ _id: { $in: rules.departmentIds.map((id) => toObjectId(id)).filter(Boolean) } }).select('name code')
      : [],
    rules.sectionIds.length
      ? Section.find({ _id: { $in: rules.sectionIds.map((id) => toObjectId(id)).filter(Boolean) } }).select('name studyYear')
      : [],
  ]);

  return {
    departmentNames: departments.map((entry) => entry.name).filter(Boolean),
    sectionNames: sections.map((entry) => entry.name).filter(Boolean),
  };
};

const getUserDirectoryOptions = async () => {
  const [departments, sections] = await Promise.all([
    Department.find({ isActive: true }).sort({ name: 1 }).select('name code'),
    Section.find({ isActive: true }).sort({ name: 1 }).select('name studyYear program department academicSession')
      .populate('program', 'name code')
      .populate('department', 'name code')
      .populate('academicSession', 'label yearNumber'),
  ]);

  return {
    roles: FILTERABLE_ROLES.map((role) => ({
      value: role,
      label: role.charAt(0).toUpperCase() + role.slice(1),
    })),
    departments,
    sections: sections.map((section) => ({
      _id: section._id,
      name: section.name,
      studyYear: section.studyYear,
      departmentId: section.department?._id || null,
      departmentName: section.department?.name || '',
      programId: section.program?._id || null,
      programName: section.program?.name || '',
      academicSessionId: section.academicSession?._id || null,
      academicSessionLabel: section.academicSession?.label || '',
      label: [
        section.program?.name,
        section.academicSession?.label,
        section.studyYear ? `Year ${section.studyYear}` : '',
        section.name,
      ].filter(Boolean).join(' · '),
    })),
  };
};

const canManageGroup = async (groupId, userId) => {
  const requester = await User.findById(userId).select('role adminTier');
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
  if (!isManager && !isPlatformAdmin(requester)) {
    const err = new Error('Only group admins can manage this group');
    err.statusCode = 403;
    throw err;
  }

  return { group, requester, isManager };
};

const canCreateGroup = async (userId) => {
  const requester = await User.findById(userId).select('role adminTier');
  if (!requester) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }

  const normalizedRole = normalizeRole(requester.role);
  const permissionDoc = await Permission.getRolePermissions(normalizedRole);
  const permissions = buildResolvedPermissions(
    normalizedRole,
    permissionDoc?.permissions || DEFAULT_ROLE_PERMISSIONS[normalizedRole],
    requester.adminTier
  );

  if (!permissions?.canManageGroups) {
    const err = new Error('Only system admins or existing group admins can create groups');
    err.statusCode = 403;
    throw err;
  }

  return requester;
};

const canAccessGroup = async (groupId, userId) => {
  const user = await User.findById(userId).select('role adminTier');
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

  if (!isMember && !isPlatformAdmin(user)) {
    const err = new Error('You are not a member of this group');
    err.statusCode = 403;
    throw err;
  }

  return { group, user, isMember };
};

const createGroup = async ({ title, name, description, filters = {}, memberIds = [], adminIds = [], creatorId }) => {
  await canCreateGroup(creatorId);

  const normalizedName = normalizeGroupValue(title || name);
  const normalizedDescription = normalizeGroupValue(description);
  const selectionRules = normalizeSelectionRules(filters);
  const audienceSignature = buildAudienceSignature(selectionRules);

  if (!normalizedName) {
    const err = new Error('Group title is required');
    err.statusCode = 400;
    throw err;
  }

  const existing = await Group.findOne({
    name: normalizedName,
    createdBy: creatorId,
    audienceSignature,
    isActive: true,
  });
  if (existing) {
    const creatorMembership = existing.members.find(
      (member) => member.user.toString() === creatorId.toString()
    );

    if (!creatorMembership) {
      existing.members.push({
        user: creatorId,
        role: GROUP_ADMIN_ROLE,
      });

      if (normalizedDescription && !existing.description) {
        existing.description = normalizedDescription;
      }

      await existing.save();
      await Message.create({
        group: existing._id,
        sender: creatorId,
        type: 'system',
        systemMessage: `${normalizedName} was restored and the creator rejoined as group admin`,
      });

      logger.info('Existing hidden group restored to creator', {
        groupId: existing._id,
        name: normalizedName,
        creatorId,
      });

      return populateGroup(existing._id);
    }

    const err = new Error(`A group named "${normalizedName}" already exists for the same audience`);
    err.statusCode = 400;
    throw err;
  }

  const filteredUsers = selectionRules.autoIncludeFiltered && hasStructuredAudienceFilters(selectionRules)
    ? await getFilteredUsers({
      roles: selectionRules.roles,
      departmentIds: selectionRules.departmentIds,
      sectionIds: selectionRules.sectionIds,
      excludeUserIds: [creatorId],
      page: 1,
      limit: 1000,
    })
    : { users: [] };

  const mergedMemberIds = [
    ...memberIds.map(String),
    ...filteredUsers.users.map((user) => String(user._id)),
  ];
  const members = await buildGroupMembers({
    creatorId,
    memberIds: mergedMemberIds,
    adminIds,
  });

  const group = await Group.create({
    name: normalizedName,
    description: normalizedDescription,
    createdBy: creatorId,
    selectionRules,
    audienceSignature,
    department: '',
    year: '',
    section: '',
    members,
  });

  await Message.create({
    group: group._id,
    sender: creatorId,
    type: 'system',
    systemMessage: `Group "${normalizedName}" was created`,
  });

  if (selectionRules.autoIncludeFiltered && filteredUsers.users.length) {
    const context = await buildSelectionContext(selectionRules);
    await Message.create({
      group: group._id,
      sender: creatorId,
      type: 'system',
      systemMessage: `${filteredUsers.users.length} users were added from ${describeSelectionRules({
        roles: selectionRules.roles,
        departmentNames: context.departmentNames,
        sectionNames: context.sectionNames,
      }) || 'the selected audience'}`,
    });
  }

  const populated = await populateGroup(group._id);

  logger.info('Group created', { groupId: group._id, name: normalizedName, creatorId, memberCount: members.length });
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
    .populate('members.user', 'name email role department departmentId section sectionId')
    .sort({ updatedAt: -1 });

  const groupsWithUnread = await Promise.all(
    groups.map(async (group) => {
      const groupObj = group.toObject();
      const unreadCount = await Message.countDocuments({
        group: group._id,
        sender: { $ne: userId },
        'readBy.user': { $ne: userId },
        isDeleted: false,
      });
      const memberInfo = group.members.find(
        (m) => m.user._id.toString() === userId.toString()
      );

      return {
        ...groupObj,
        unreadCount,
        myRole: memberInfo?.role || GROUP_DEFAULT_ROLE,
      };
    })
  );

  return groupsWithUnread;
};

/**
 * Get a single group (with authorization check)
 */
const getGroup = async (groupId, userId) => {
  const group = await populateGroup(groupId);

  if (!group) {
    const err = new Error('Group not found');
    err.statusCode = 404;
    throw err;
  }

  const requester = await User.findById(userId).select('role adminTier');
  const isMember = group.members.some((m) => m.user._id.toString() === userId.toString());

  if (!isMember && !isPlatformAdmin(requester)) {
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
  const normalizedUserIds = normalizeIdList(userIds);
  const roleMap = Array.isArray(roles)
    ? roles.reduce((acc, role, index) => {
      acc[normalizedUserIds[index]] = role;
      return acc;
    }, {})
    : {};

  const addedUsers = [];
  const skippedUsers = [];

  for (const userId of normalizedUserIds) {
    const role = GROUP_MEMBER_ROLES.includes(roleMap[userId]) ? roleMap[userId] : GROUP_DEFAULT_ROLE;
    const alreadyMember = group.members.some(
      (m) => m.user.toString() === userId.toString()
    );

    if (alreadyMember) {
      skippedUsers.push(userId);
      continue;
    }

    const user = await User.findOne({
      _id: userId,
      isActive: true,
      status: 'approved',
      emailVerified: true,
    }).select('name');
    if (!user) continue;

    group.members.push({ user: userId, role });
    addedUsers.push({ userId, name: user.name, role });
  }

  await group.save();

  for (const added of addedUsers) {
    await Message.create({
      group: groupId,
      sender: adminId,
      type: 'system',
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
    systemMessage: `${updatedMember?.name || 'A member'} is now ${role === GROUP_ADMIN_ROLE ? 'a group admin' : 'a member'}`,
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

  const requester     = await User.findById(requesterId).select('role adminTier');
  const isGroupAdmin  = group.members.some(
    (m) => m.user.toString() === requesterId.toString() && m.role === 'admin'
  );
  const isSelfLeaving = userId === requesterId;

  if (!isGroupAdmin && !isPlatformAdmin(requester) && !isSelfLeaving) {
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
  const normalizedDepartmentIds = normalizeIdList(filters.departmentIds || filters.departmentId || []);
  const normalizedSectionIds = normalizeIdList(filters.sectionIds || filters.sectionId || []);
  const normalizedRoles = normalizeRoleList(filters.roles || filters.role || []);
  const searchValue = normalizeGroupValue(filters.q);

  if (normalizedDepartmentIds.length) query['selectionRules.departmentIds'] = { $in: normalizedDepartmentIds };
  if (normalizedSectionIds.length) query['selectionRules.sectionIds'] = { $in: normalizedSectionIds };
  if (normalizedRoles.length) query['selectionRules.roles'] = { $in: normalizedRoles };
  if (searchValue) query.name = { $regex: searchValue, $options: 'i' };

  const groups = await Group.find(query)
    .populate('createdBy', 'name email role')
    .populate('selectionRules.departmentIds', 'name code')
    .populate('selectionRules.sectionIds', 'name studyYear')
    .populate('members.user', 'name email role department departmentId section sectionId')
    .sort({ createdAt: -1 });

  return groups;
};

/**
 * Delete a group (admin only)
 */
const deleteGroup = async (groupId, adminId) => {
  const { group } = await canManageGroup(groupId, adminId);

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

  const nextName = normalizeGroupValue(updates.title || updates.name);
  const nextDescription = normalizeGroupValue(updates.description);
  const nextSelectionRules = updates.filters ? normalizeSelectionRules(updates.filters) : null;
  const nextAudienceSignature = buildAudienceSignature(nextSelectionRules || group.selectionRules || {});

  if (!nextName) {
    const err = new Error('Group title is required');
    err.statusCode = 400;
    throw err;
  }

  const duplicate = await Group.findOne({
    _id: { $ne: groupId },
    name: nextName,
    audienceSignature: nextAudienceSignature,
    isActive: true,
  });

  if (duplicate) {
    const err = new Error(`A group named "${nextName}" already exists`);
    err.statusCode = 400;
    throw err;
  }

  group.name = nextName;
  if (updates.description !== undefined) group.description = nextDescription;
  if (nextSelectionRules) {
    group.selectionRules = nextSelectionRules;
  }
  group.audienceSignature = nextAudienceSignature;

  await group.save();

  const populated = await populateGroup(group._id);

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
  const requester = await User.findById(userId).select('role adminTier');
  const isManager = group ? isGroupManager(group, userId) : false;

  // Sender, group admin, or platform admin can delete the message
  if (
    message.sender.toString() !== userId.toString() &&
    !isManager &&
    !isPlatformAdmin(requester)
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
  canAccessGroup, getFilteredUsers, getUserDirectoryOptions,
  buildAudienceSignature,
};
