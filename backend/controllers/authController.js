const User = require('../models/User');
const Notification = require('../models/Notification');
const EmailVerification = require('../models/EmailVerification');
const crypto = require('crypto');
const { queueEmailVerificationEmail } = require('../queues/emailQueue');
const { validationResult } = require('express-validator');

const ALLOWED_SIGNUP_ROLES = ['student', 'faculty', 'staff'];

const getAllowedDomains = () => (
  process.env.ALLOWED_EMAIL_DOMAINS
    ? process.env.ALLOWED_EMAIL_DOMAINS.split(',').map((domain) => domain.trim().toLowerCase()).filter(Boolean)
    : []
);

const isAllowedEmailDomain = (email) => {
  const allowedDomains = getAllowedDomains();
  if (!allowedDomains.length) return true;
  const domain = String(email).toLowerCase().split('@')[1] || '';
  return allowedDomains.includes(domain);
};

const createEmailVerificationToken = async (user) => {
  await EmailVerification.deleteMany({ user: user._id });
  const token = crypto.randomBytes(32).toString('hex');
  await EmailVerification.create({ user: user._id, token });

  const verificationLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${token}`;
  await queueEmailVerificationEmail({
    toEmail: user.email,
    userName: user.name,
    verificationLink,
  });
};

// ── Cookie options ─────────────────────────────────────
// httpOnly = JS cannot access this cookie (prevents XSS token theft)
// secure   = only sent over HTTPS in production
// sameSite = prevents CSRF attacks
// path     = ensure the cookie is available across the entire app
const getCookieOptions = () => ({
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
  path:     '/',
  maxAge:   7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
});

const getClearCookieOptions = () => ({
  ...getCookieOptions(),
  expires: new Date(Date.now() + 5 * 1000),
  maxAge:  5,
});

// ── Send token response ────────────────────────────────
// Sets JWT in httpOnly cookie AND returns it in body (for mobile clients)
const sendTokenResponse = (user, statusCode, res) => {
  const token = user.getSignedJwtToken();

  const userData = {
    _id:          user._id,
    name:         user.name,
    email:        user.email,
    role:         user.role,
    status:       user.status,
    department:   user.department,
    departmentId: user.departmentId,
    year:         user.year,
    section:      user.section,
    sectionId:    user.sectionId,
    enrollmentId: user.enrollmentId,
    expiryDate:   user.expiryDate,
    avatar:       user.avatar,
    emailVerified:user.emailVerified,
    createdAt:    user.createdAt,
  };

  res
    .status(statusCode)
    .cookie('token', token, getCookieOptions())
    .json({ success: true, token, user: userData });
};

const validateAccountForLogin = (user) => {
  if (!user) {
    return { ok: false, statusCode: 401, message: 'Invalid credentials' };
  }

  if (!user.isActive) {
    return { ok: false, statusCode: 401, message: 'Account deactivated. Contact admin.' };
  }

  if (user.status !== 'approved') {
    return {
      ok: false,
      statusCode: 403,
      message: user.status === 'pending'
        ? 'Your account is awaiting admin approval'
        : 'Your account is not allowed to sign in',
    };
  }

  if (user.expiryDate && new Date() >= user.expiryDate) {
    return { ok: false, statusCode: 403, message: 'Your account access has expired' };
  }

  return { ok: true };
};

// @desc    Register user
// @route   POST /api/v1/auth/register
// @access  Public
exports.register = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }

    const { name, email, password, role, department, departmentId, year, section, sectionId, enrollmentId, expiryDate } = req.body;
    const normalizedEmail = email.toLowerCase();
    const requestedRole = ALLOWED_SIGNUP_ROLES.includes(role) ? role : 'student';

    if (!isAllowedEmailDomain(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Please register with your university email address.',
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    const user = await User.create({
      name,
      email: normalizedEmail,
      password,
      role: requestedRole,
      status: 'pending',
      department,
      departmentId: departmentId || null,
      year,
      section,
      sectionId: sectionId || null,
      enrollmentId,
      expiryDate: expiryDate || null,
    });

    await createEmailVerificationToken(user);

    res.status(201).json({
      success: true,
      message: 'Registration submitted. Verify your email, then wait for admin approval.',
      data: {
        _id: user._id,
        email: user.email,
        role: user.role,
        status: user.status,
        emailVerified: user.emailVerified,
      },
    });
  } catch (error) { next(error); }
};

// @desc    Login user
// @route   POST /api/v1/auth/login
// @access  Public
exports.login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }

    const { email, password } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const accountValidation = validateAccountForLogin(user);
    if (!accountValidation.ok) {
      return res.status(accountValidation.statusCode).json({ success: false, message: accountValidation.message });
    }

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    sendTokenResponse(user, 200, res);
  } catch (error) { next(error); }
};

exports.adminLogin = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }

    const { email, password } = req.body;
    const user = await User.findOne({ email: email.toLowerCase(), role: 'admin' }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const accountValidation = validateAccountForLogin(user);
    if (!accountValidation.ok) {
      return res.status(accountValidation.statusCode).json({ success: false, message: accountValidation.message });
    }

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
};

// @desc    Logout — clears httpOnly cookie
// @route   POST /api/v1/auth/logout
// @access  Public
exports.logout = (req, res) => {
  res
    .cookie('token', 'none', getClearCookieOptions())
    .json({ success: true, message: 'Logged out successfully' });
};

// @desc    Get current user
// @route   GET /api/v1/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    res.status(200).json({ success: true, data: user });
  } catch (error) { next(error); }
};

// @desc    Update profile
// @route   PUT /api/v1/auth/updateprofile
// @access  Private
exports.updateProfile = async (req, res, next) => {
  try {
    const allowedFields = ['name', 'department', 'year', 'section', 'enrollmentId'];
    const updates = {};
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    const user = await User.findByIdAndUpdate(req.user.id, updates, {
      new: true, runValidators: true,
    });
    res.status(200).json({ success: true, data: user });
  } catch (error) { next(error); }
};

// @desc    Change password
// @route   PUT /api/v1/auth/changepassword
// @access  Private
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Both passwords are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
    }

    const user = await User.findById(req.user.id).select('+password');
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();

    sendTokenResponse(user, 200, res);
  } catch (error) { next(error); }
};

exports.verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.params;
    const record = await EmailVerification.findOne({ token });

    if (!record || record.expiresAt < new Date()) {
      if (record) await record.deleteOne();
      return res.status(400).json({ success: false, message: 'Invalid or expired verification link' });
    }

    const user = await User.findById(record.user);
    if (!user) {
      await record.deleteOne();
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.emailVerified = true;
    await user.save({ validateBeforeSave: false });
    await EmailVerification.deleteMany({ user: user._id });

    return res.status(200).json({ success: true, message: 'Email verified successfully' });
  } catch (error) {
    next(error);
  }
};

exports.resendVerification = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const user = await User.findOne({ email: String(email).toLowerCase() });
    if (!user || user.emailVerified) {
      return res.status(200).json({
        success: true,
        message: 'If verification is still required, a new link has been sent.',
      });
    }

    await createEmailVerificationToken(user);

    return res.status(200).json({
      success: true,
      message: 'If verification is still required, a new link has been sent.',
    });
  } catch (error) {
    next(error);
  }
};

exports.getPendingUsers = async (req, res, next) => {
  try {
    const users = await User.find({ status: 'pending' })
      .select('-password')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: users.length, data: users });
  } catch (error) {
    next(error);
  }
};

exports.updateApprovalStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['approved', 'rejected', 'suspended'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid approval status' });
    }

    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.status = status;
    if (req.body.expiryDate !== undefined) {
      user.expiryDate = req.body.expiryDate || null;
    }
    await user.save({ validateBeforeSave: false });

    await Notification.create({
      user: user._id,
      type: 'approval',
      title: status === 'approved' ? 'Account approved' : 'Account status updated',
      message:
        status === 'approved'
          ? 'Your university account has been approved. You can now log in.'
          : `Your account status is now ${status}.`,
      link: '/login',
      meta: { status },
    });

    res.status(200).json({
      success: true,
      data: {
        _id: user._id,
        email: user.email,
        role: user.role,
        status: user.status,
        expiryDate: user.expiryDate,
      },
    });
  } catch (error) {
    next(error);
  }
};
