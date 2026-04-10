const User = require('../models/User');
const Enrollment = require('../models/Enrollment');
const SectionSubject = require('../models/SectionSubject');
const Ticket = require('../models/Ticket');
const Notification = require('../models/Notification');
const { del, KEYS } = require('../config/cache');
const { isSupportRole, normalizeRole } = require('../utils/roleHelpers');
const {
  createManagedUser,
  serializeManagedUser,
  parseCsvImport,
  findUserByIdentifier,
  isValidSystemId,
} = require('../services/userProvisioningService');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MANAGED_ROLES = ['student', 'faculty', 'staff', 'admin'];

const sanitizeUserDoc = (user) => serializeManagedUser(user);
const isSuperAdminRequest = (req) => req.user?.role === 'admin' && req.user?.adminTier === 'super_admin';

const normalizeBooleanFilter = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (String(value).toLowerCase() === 'true') return true;
  if (String(value).toLowerCase() === 'false') return false;
  return undefined;
};

const normalizeUserPayload = (body = {}) => {
  const normalizedRole = normalizeRole(body.role);
  const payload = {
    name: body.name,
    email: body.email,
    password: body.password,
    role: normalizedRole,
    adminTier: normalizedRole === 'admin' ? 'admin' : null,
    systemId: body.systemId,
    department: body.department || '',
    departmentId: body.departmentId || null,
    year: normalizedRole === 'student' ? (body.year || '') : '',
    section: normalizedRole === 'student' ? (body.section || '') : '',
    sectionId: normalizedRole === 'student' ? (body.sectionId || null) : null,
    expiryDate: body.expiryDate || null,
    status: body.status || 'pending',
    emailVerified: Boolean(body.emailVerified),
    isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
    avatarChoice: body.avatarChoice || null,
  };

  if (normalizedRole !== 'student') {
    payload.year = '';
    payload.section = '';
    payload.sectionId = null;
  }

  if (normalizedRole === 'admin') {
    payload.year = '';
    payload.section = '';
    payload.sectionId = null;
  }

  return payload;
};

const buildUserDetail = async (user) => {
  const populatedUser = await User.findById(user._id)
    .select('-password')
    .populate({
      path: 'sectionId',
      populate: [
        { path: 'program', select: 'name code' },
        { path: 'course', select: 'name code' },
        { path: 'academicYear', select: 'label yearNumber' },
        { path: 'department', select: 'name code' },
      ],
    })
    .lean();

  const enrollment = await Enrollment.findOne({ student: user._id, status: 'active' })
    .populate({
      path: 'section',
      populate: [
        { path: 'program', select: 'name code' },
        { path: 'course', select: 'name code' },
        { path: 'academicYear', select: 'label yearNumber' },
        { path: 'department', select: 'name code' },
      ],
    })
    .lean();

  const sectionContext = enrollment?.section || populatedUser?.sectionId || null;
  const [subjectAssignments, teachingAssignments, recentTickets, recentNotifications] = await Promise.all([
    sectionContext?._id
      ? SectionSubject.find({ section: sectionContext._id, isActive: true })
        .populate('subject', 'name code credits')
        .populate('faculty', 'name email systemId')
        .lean()
      : [],
    populatedUser?.role === 'faculty'
      ? SectionSubject.find({ faculty: populatedUser._id, isActive: true })
        .populate('section', 'name')
        .populate('subject', 'name code')
        .lean()
      : [],
    Ticket.find({
      $or: [{ user: populatedUser._id }, { assignedTo: populatedUser._id }],
    })
      .select('ticketId title status priority createdAt updatedAt')
      .sort({ updatedAt: -1 })
      .limit(5)
      .lean(),
    Notification.find({ user: populatedUser._id })
      .select('type title message link createdAt readAt')
      .sort({ createdAt: -1 })
      .limit(6)
      .lean(),
  ]);

  return {
    ...sanitizeUserDoc(populatedUser),
    sectionContext: sectionContext
      ? {
          id: sectionContext._id,
          name: sectionContext.name,
          program: sectionContext.program || null,
          course: sectionContext.course || null,
          academicYear: sectionContext.academicYear || null,
          department: sectionContext.department || null,
        }
      : null,
    enrollment: enrollment
      ? {
          id: enrollment._id,
          semester: enrollment.semester,
          status: enrollment.status,
          academicYearId: enrollment.academicYear || null,
        }
      : null,
    subjects: subjectAssignments.map((entry) => ({
      id: entry.subject?._id,
      code: entry.subject?.code,
      name: entry.subject?.name,
      credits: entry.subject?.credits,
      semester: entry.semester,
      faculty: entry.faculty
        ? {
            id: entry.faculty._id,
            systemId: entry.faculty.systemId,
            name: entry.faculty.name,
            email: entry.faculty.email,
          }
        : null,
    })),
    teachingAssignments: teachingAssignments.map((entry) => ({
      id: entry._id,
      semester: entry.semester,
      section: entry.section ? { id: entry.section._id, name: entry.section.name } : null,
      subject: entry.subject ? { id: entry.subject._id, code: entry.subject.code, name: entry.subject.name } : null,
    })),
    recentTickets,
    recentNotifications,
  };
};

const buildSearchQuery = ({
  role,
  search,
  department,
  status,
  emailVerified,
  isActive,
  joinedFrom,
  joinedTo,
  expiryState,
}) => {
  const query = {};
  if (role) query.role = normalizeRole(role);
  if (department) query.department = { $regex: `^${String(department).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' };
  if (status) query.status = String(status).trim();
  if (emailVerified !== undefined) query.emailVerified = emailVerified;
  if (isActive !== undefined) query.isActive = isActive;
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { systemId: { $regex: search, $options: 'i' } },
    ];
  }
  if (joinedFrom || joinedTo) {
    query.createdAt = {};
    if (joinedFrom) query.createdAt.$gte = new Date(`${joinedFrom}T00:00:00.000Z`);
    if (joinedTo) query.createdAt.$lte = new Date(`${joinedTo}T23:59:59.999Z`);
  }
  if (expiryState) {
    const now = new Date();
    const next14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    if (expiryState === 'none') {
      query.expiryDate = null;
    } else if (expiryState === 'expired') {
      query.expiryDate = { $ne: null, $lt: now };
    } else if (expiryState === 'expiring') {
      query.expiryDate = { $ne: null, $gte: now, $lte: next14Days };
    } else if (expiryState === 'active') {
      query.expiryDate = { $ne: null, $gt: next14Days };
    }
  }
  return query;
};

const invalidateUserCaches = async (identifier) => {
  await del(KEYS.agents());
  if (identifier) {
    await del(KEYS.userProfile(identifier));
  }
};

exports.getUsers = async (req, res, next) => {
  try {
    const {
      role,
      search,
      department,
      status,
      emailVerified,
      isActive,
      joinedFrom,
      joinedTo,
      expiryState,
      page = 1,
      limit = 20,
    } = req.query;
    const numericPage = Math.max(parseInt(page, 10) || 1, 1);
    const numericLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const query = buildSearchQuery({
      role,
      search,
      department,
      status,
      emailVerified: normalizeBooleanFilter(emailVerified),
      isActive: normalizeBooleanFilter(isActive),
      joinedFrom,
      joinedTo,
      expiryState,
    });

    const [total, users, roleValues, departmentValues] = await Promise.all([
      User.countDocuments(query),
      User.find(query)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip((numericPage - 1) * numericLimit)
        .limit(numericLimit)
        .lean(),
      User.distinct('role'),
      User.distinct('department', { department: { $nin: [null, ''] } }),
    ]);

    res.status(200).json({
      success: true,
      count: users.length,
      total,
      totalPages: Math.ceil(total / numericLimit),
      currentPage: numericPage,
      data: users.map(sanitizeUserDoc),
      meta: {
        roles: roleValues.filter(Boolean).sort(),
        departments: departmentValues.filter(Boolean).sort((a, b) => a.localeCompare(b)),
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.getUser = async (req, res, next) => {
  try {
    const user = await findUserByIdentifier(req.params.id, '-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({ success: true, data: await buildUserDetail(user) });
  } catch (error) {
    next(error);
  }
};

exports.getUserBySystemId = async (req, res, next) => {
  try {
    const systemId = String(req.params.systemId || '').trim();
    const user = await User.findOne({ systemId }).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({ success: true, data: await buildUserDetail(user) });
  } catch (error) {
    next(error);
  }
};

exports.createUser = async (req, res, next) => {
  try {
    const normalizedRole = normalizeRole(req.body.role);
    if (!MANAGED_ROLES.includes(normalizedRole)) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }
    if (normalizedRole === 'admin' && !isSuperAdminRequest(req)) {
      return res.status(403).json({ success: false, message: 'Only the super admin can create admin accounts' });
    }

    const payload = normalizeUserPayload(req.body);

    const { user, verification } = await createManagedUser(payload);
    await invalidateUserCaches(String(user._id));

    res.status(201).json({
      success: true,
      message: verification?.deliveryMode === 'preview'
        ? 'User created. Verification link preview available for development.'
        : 'User created successfully.',
      data: {
        ...sanitizeUserDoc(user),
        verificationLink: verification?.deliveryMode === 'preview' ? verification.verificationLink : undefined,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.importUsers = async (req, res, next) => {
  try {
    const csvText = req.file
      ? String(req.file.buffer?.toString('utf8') || '')
      : String(req.body?.csv || '');
    const rows = parseCsvImport(csvText);
    const errors = [];
    const created = [];
    const seenSystemIds = new Set();
    const seenEmails = new Set();

    for (const row of rows) {
      const systemId = row.systemId.trim();
      const email = row.email.trim().toLowerCase();
      const role = normalizeRole(row.role);

      if (!row.name.trim()) {
        errors.push({ row: row.rowNumber, message: 'Name is required' });
        continue;
      }
      if (!isValidSystemId(systemId)) {
        errors.push({ row: row.rowNumber, message: 'systemId must match YYYY followed by 6 digits' });
        continue;
      }
      if (!EMAIL_REGEX.test(email)) {
        errors.push({ row: row.rowNumber, message: 'Invalid email' });
        continue;
      }
      if (!MANAGED_ROLES.includes(role)) {
        errors.push({ row: row.rowNumber, message: 'Invalid role' });
        continue;
      }
      if (role === 'admin' && !isSuperAdminRequest(req)) {
        errors.push({ row: row.rowNumber, message: 'Only the super admin can import admin accounts' });
        continue;
      }
      if (seenSystemIds.has(systemId)) {
        errors.push({ row: row.rowNumber, message: 'Duplicate systemId in CSV' });
        continue;
      }
      if (seenEmails.has(email)) {
        errors.push({ row: row.rowNumber, message: 'Duplicate email in CSV' });
        continue;
      }

      seenSystemIds.add(systemId);
      seenEmails.add(email);

      try {
        const { user, verification } = await createManagedUser({
          systemId,
          name: row.name,
          email,
          role,
          status: 'pending',
          emailVerified: false,
          isActive: true,
        });

        created.push({
          ...sanitizeUserDoc(user),
          verificationDelivery: verification?.deliveryMode || 'email',
          verificationLink: verification?.deliveryMode === 'preview' ? verification.verificationLink : undefined,
        });
      } catch (error) {
        errors.push({ row: row.rowNumber, message: error.message });
      }
    }

    await invalidateUserCaches();

    res.status(errors.length && !created.length ? 400 : 201).json({
      success: created.length > 0,
      message: created.length
        ? `CSV import completed: ${created.length} created${errors.length ? `, ${errors.length} failed` : ''}`
        : 'CSV import failed',
      data: created,
      errors,
      summary: {
        totalRows: rows.length,
        created: created.length,
        failed: errors.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.updateUser = async (req, res, next) => {
  try {
    const user = await findUserByIdentifier(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (req.body.systemId && req.body.systemId !== user.systemId) {
      return res.status(400).json({ success: false, message: 'systemId cannot be updated' });
    }
    if ((normalizeRole(user.role) === 'admin' || normalizeRole(req.body.role) === 'admin') && !isSuperAdminRequest(req)) {
      return res.status(403).json({ success: false, message: 'Only the super admin can modify admin accounts' });
    }

    const normalized = normalizeUserPayload({ ...user.toObject(), ...req.body, password: undefined, systemId: user.systemId });
    const allowedFields = ['name', 'email', 'role', 'adminTier', 'department', 'departmentId', 'year', 'section', 'sectionId', 'isActive', 'status', 'expiryDate', 'avatarChoice', 'emailVerified'];
    allowedFields.forEach((field) => {
      if (normalized[field] !== undefined) {
        user[field] = normalized[field];
      }
    });
    if (req.body.removeProfileImage) {
      user.profileImage = null;
    }

    await user.save();
    await invalidateUserCaches(String(user._id));

    res.status(200).json({ success: true, data: sanitizeUserDoc(user) });
  } catch (error) {
    next(error);
  }
};

exports.setUserPassword = async (req, res, next) => {
  try {
    if (!isSuperAdminRequest(req)) {
      return res.status(403).json({ success: false, message: 'Only the super admin can set account passwords' });
    }

    const user = await findUserByIdentifier(req.params.id).select('+password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const password = String(req.body?.password || '');
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    user.password = password;
    user.passwordNeedsSetup = false;
    await user.save();
    await invalidateUserCaches(String(user._id));

    return res.status(200).json({
      success: true,
      message: 'Password updated successfully',
      data: sanitizeUserDoc(user),
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteUser = async (req, res, next) => {
  try {
    if (normalizeRole(req.user.role) !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only admins can delete user accounts' });
    }

    const user = await findUserByIdentifier(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (String(user._id) === String(req.user.id)) {
      return res.status(400).json({ success: false, message: 'Cannot delete your own account' });
    }

    const systemAdminEmail = String(process.env.INITIAL_ADMIN_EMAIL || '').trim().toLowerCase();
    if (systemAdminEmail && String(user.email || '').toLowerCase() === systemAdminEmail) {
      return res.status(409).json({ success: false, message: 'System admin account cannot be deleted' });
    }

    const normalizedRole = normalizeRole(user.role);
    if (normalizedRole === 'admin' && !isSuperAdminRequest(req)) {
      return res.status(403).json({ success: false, message: 'Only the super admin can delete admin accounts' });
    }
    if (normalizedRole === 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin', isActive: true });
      if (adminCount <= 1) {
        return res.status(409).json({ success: false, message: 'Cannot delete the last active admin account' });
      }
    }

    const [activeEnrollment, teachingAssignment, assignedTicket] = await Promise.all([
      Enrollment.findOne({ student: user._id, status: 'active' }).lean(),
      SectionSubject.findOne({ faculty: user._id, isActive: true }).lean(),
      Ticket.findOne({ assignedTo: user._id, status: { $in: ['Open', 'In Progress'] } }).lean(),
    ]);

    if (activeEnrollment) {
      return res.status(409).json({
        success: false,
        message: 'Cannot delete a user with an active section enrollment. Remove the enrollment first.',
      });
    }

    if (teachingAssignment) {
      return res.status(409).json({
        success: false,
        message: 'Cannot delete a faculty user with active subject assignments. Remove teaching assignments first.',
      });
    }

    if (assignedTicket) {
      return res.status(409).json({
        success: false,
        message: 'Cannot delete a user who is assigned to active support tickets. Reassign tickets first.',
      });
    }

    await user.deleteOne();
    await invalidateUserCaches(String(user._id));

    res.status(200).json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    next(error);
  }
};

exports.uploadUserAvatar = async (req, res, next) => {
  try {
    const user = await findUserByIdentifier(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please choose an image to upload' });
    }
    if (!String(req.file.mimetype || '').startsWith('image/')) {
      return res.status(400).json({ success: false, message: 'Only image files can be used for profile avatars' });
    }

    user.profileImage = `/uploads/${req.file.filename}`;
    await user.save({ validateBeforeSave: false });
    await invalidateUserCaches(String(user._id));

    return res.status(200).json({ success: true, data: sanitizeUserDoc(user) });
  } catch (error) {
    next(error);
  }
};

exports.getAgents = async (req, res, next) => {
  try {
    const data = await User.find({ role: { $in: ['staff', 'admin', 'agent'] }, isActive: true, status: 'approved' })
      .select('systemId name email role department')
      .sort({ name: 1 })
      .lean();

    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

exports.getIdentityAlerts = async (req, res, next) => {
  try {
    const now = new Date();
    const in14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const role = req.query.role ? normalizeRole(req.query.role) : '';
    const roleFilter = role ? { role } : {};

    const blockedQuery = { ...roleFilter, status: { $in: ['rejected', 'suspended'] } };
    const inactiveQuery = {
      ...roleFilter,
      isActive: false,
      status: { $nin: ['rejected', 'suspended'] },
    };
    const unverifiedQuery = {
      ...roleFilter,
      emailVerified: false,
      isActive: true,
      status: { $nin: ['rejected', 'suspended'] },
    };
    const expiringQuery = {
      ...roleFilter,
      expiryDate: { $ne: null, $gte: now, $lte: in14Days },
      status: { $nin: ['rejected', 'suspended'] },
    };
    const mappingQuery = role && role !== 'student'
      ? { _id: null }
      : {
          ...roleFilter,
          role: 'student',
          $or: [
            { sectionId: null },
            { sectionId: { $exists: false } },
            { section: { $in: ['', null] } },
          ],
        };
    const recentLoginsQuery = {
      ...roleFilter,
      lastLogin: { $ne: null },
      status: 'approved',
      isActive: true,
    };

    const [
      unverifiedCount,
      inactiveCount,
      expiringSoonCount,
      blockedCount,
      mappingIssuesCount,
      recentLoginCount,
      unverifiedUsers,
      inactiveUsers,
      expiringUsers,
      blockedUsers,
      missingAcademicMapping,
      recentLogins,
    ] = await Promise.all([
      User.countDocuments(unverifiedQuery),
      User.countDocuments(inactiveQuery),
      User.countDocuments(expiringQuery),
      User.countDocuments(blockedQuery),
      User.countDocuments(mappingQuery),
      User.countDocuments(recentLoginsQuery),
      User.find(unverifiedQuery)
        .select('systemId name email role status createdAt avatar profileImage avatarChoice')
        .sort({ createdAt: -1 })
        .lean(),
      User.find(inactiveQuery)
        .select('systemId name email role status updatedAt avatar profileImage avatarChoice')
        .sort({ updatedAt: -1 })
        .lean(),
      User.find(expiringQuery)
        .select('systemId name email role expiryDate status avatar profileImage avatarChoice')
        .sort({ expiryDate: 1 })
        .lean(),
      User.find(blockedQuery)
        .select('systemId name email role status updatedAt avatar profileImage avatarChoice')
        .sort({ updatedAt: -1 })
        .lean(),
      User.find(mappingQuery)
        .select('systemId name email department year section status avatar profileImage avatarChoice')
        .sort({ createdAt: -1 })
        .lean(),
      User.find(recentLoginsQuery)
        .select('systemId name email role lastLogin avatar profileImage avatarChoice')
        .sort({ lastLogin: -1 })
        .lean(),
    ]);

    res.status(200).json({
      success: true,
      data: {
        summary: {
          unverifiedCount,
          inactiveCount,
          expiringSoonCount,
          blockedCount,
          mappingIssuesCount,
          recentLoginCount,
        },
        unverifiedUsers,
        inactiveUsers,
        expiringUsers,
        blockedUsers,
        missingAcademicMapping,
        recentLogins,
      },
    });
  } catch (error) {
    next(error);
  }
};
