const User = require('../models/User');
const Notification = require('../models/Notification');
const EmailVerification = require('../models/EmailVerification');
const PasswordReset = require('../models/PasswordReset');
const crypto = require('crypto');
const mongoose = require('mongoose');
const fs = require('fs/promises');
const path = require('path');
const logger = require('../utils/logger');
const { sendEmailVerificationEmail } = require('../utils/emailService');
const { validationResult } = require('express-validator');
const {
  createVerificationToken,
  findUserByIdentifier,
} = require('../services/userProvisioningService');

const RESEND_TEST_MODE_ERROR = 'You can only send testing emails to your own email address';
const GOOGLE_TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo';
const AVATAR_DIRECTORY = path.join(__dirname, '../../frontend/public/avatars');

const createPasswordSetupToken = async (user) => {
  await PasswordReset.deleteMany({ user: user._id });
  const token = crypto.randomBytes(32).toString('hex');
  await PasswordReset.create({ user: user._id, token });
  return `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
};

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
  const { token, verificationLink } = await createVerificationToken(user);
  try {
    const result = await sendEmailVerificationEmail({
      toEmail: user.email,
      userName: user.name,
      verificationLink,
    });

    if (!result?.success) {
      throw new Error(result?.error || 'Failed to send verification email');
    }

    logger.info('Verification email delivered', {
      userId: String(user._id),
      email: user.email,
      provider: result.provider || 'unknown',
    });
  } catch (error) {
    logger.error('Verification email delivery failed', {
      userId: String(user._id),
      email: user.email,
      error: error.message,
    });

    if (process.env.NODE_ENV !== 'production' && error.message.includes(RESEND_TEST_MODE_ERROR)) {
      return {
        token,
        verificationLink,
        deliveryMode: 'preview',
      };
    }

    throw error;
  }

  return {
    token,
    verificationLink,
    deliveryMode: 'email',
  };
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
    systemId:     user.systemId,
    name:         user.name,
    email:        user.email,
    role:         user.role,
    adminTier:    user.adminTier || null,
    status:       user.status,
    collegeId:    user.collegeId || null,
    department:   user.department,
    departmentId: user.departmentId,
    programId:    user.programId || null,
    year:         user.year,
    section:      user.section,
    sectionId:    user.sectionId,
    enrollmentId: user.enrollmentId,
    expiryDate:   user.expiryDate,
    avatar:       user.avatar,
    profileImage: user.profileImage,
    avatarChoice: user.avatarChoice,
    emailVerified:user.emailVerified,
    isActive:     user.isActive,
    lastLogin:    user.lastLogin,
    createdAt:    user.createdAt,
  };

  res
    .status(statusCode)
    .cookie('token', token, getCookieOptions())
    .json({ success: true, token, user: userData });
};

const validateAccountForLogin = (user) => {
  if (!user) {
    return { ok: false, statusCode: 404, message: 'Account does not exist. Please register.' };
  }

  if (!user.isActive) {
    return { ok: false, statusCode: 401, message: 'Account deactivated. Contact admin.' };
  }

  if (!user.emailVerified) {
    return { ok: false, statusCode: 403, message: 'Please verify your email' };
  }

  if (user.passwordNeedsSetup) {
    return { ok: false, statusCode: 403, message: 'Please set your password using the verification or reset link' };
  }

  if (user.status !== 'approved') {
    return {
      ok: false,
      statusCode: 403,
      message: user.status === 'pending'
        ? 'Waiting for admin approval'
        : user.status === 'rejected'
          ? 'Account has been rejected'
          : 'Your account is not allowed to sign in',
    };
  }

  if (user.expiryDate && new Date() >= user.expiryDate) {
    return { ok: false, statusCode: 403, message: 'Your account access has expired' };
  }

  return { ok: true };
};

const verifyGoogleCredential = async (credential) => {
  if (!credential) {
    throw new Error('Google credential is required');
  }

  if (!process.env.GOOGLE_CLIENT_ID) {
    throw new Error('Google Sign-In is not configured');
  }

  const response = await fetch(`${GOOGLE_TOKENINFO_URL}?id_token=${encodeURIComponent(credential)}`);
  const payload = await response.json();

  if (!response.ok || payload.error_description || payload.error) {
    throw new Error(payload.error_description || payload.error || 'Google token verification failed');
  }

  if (payload.aud !== process.env.GOOGLE_CLIENT_ID) {
    throw new Error('Google token audience mismatch');
  }

  if (payload.email_verified !== 'true') {
    throw new Error('Google email is not verified');
  }

  return {
    email: String(payload.email || '').toLowerCase(),
    name: payload.name || payload.given_name || 'Google User',
    picture: payload.picture || null,
    sub: payload.sub,
  };
};

// @desc    Register user
// @route   POST /api/v1/auth/register
// @access  Public
exports.register = async (req, res, next) => {
  try {
    return res.status(403).json({
      success: false,
      message: 'Open registration is disabled. Contact admin to receive an account.',
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
      return res.status(404).json({ success: false, message: 'Account does not exist. Please register.' });
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

exports.googleAuth = async (req, res, next) => {
  try {
    const { credential } = req.body;
    const googleProfile = await verifyGoogleCredential(credential);

    if (!isAllowedEmailDomain(googleProfile.email)) {
      return res.status(400).json({
        success: false,
        message: 'Please use your university Google account.',
      });
    }

    const user = await User.findOne({ email: googleProfile.email });

    if (!user) {
      return res.status(403).json({
        success: false,
        message: 'Account not registered. Contact admin',
      });
    }

    let hasChanges = false;

    if (!user.emailVerified) {
      user.emailVerified = true;
      hasChanges = true;
    }

    if (!user.avatar && googleProfile.picture) {
      user.avatar = googleProfile.picture;
      hasChanges = true;
    }

    if (!user.name && googleProfile.name) {
      user.name = googleProfile.name;
      hasChanges = true;
    }

    if (hasChanges) {
      await user.save({ validateBeforeSave: false });
    }

    const accountValidation = validateAccountForLogin(user);
    if (!accountValidation.ok) {
      return res.status(accountValidation.statusCode).json({
        success: false,
        message: accountValidation.message,
        data: {
          systemId: user.systemId,
          email: user.email,
          role: user.role,
          status: user.status,
          emailVerified: user.emailVerified,
        },
      });
    }

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    return sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
};

exports.getGoogleClientConfig = async (req, res) => (
  res.status(200).json({
    success: true,
    data: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
    },
  })
);

exports.getAvatarOptions = async (req, res, next) => {
  try {
    const entries = await fs.readdir(AVATAR_DIRECTORY, { withFileTypes: true });
    const files = entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => /\.(png|jpe?g|webp|svg)$/i.test(name))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
    const fallback = files.includes('default.png') ? 'default.png' : files[0] || null;
    const avatars = files.filter((name) => name !== fallback);

    return res.status(200).json({
      success: true,
      data: {
        avatars,
        fallback,
      },
    });
  } catch (error) {
    return next(error);
  }
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
    const user = await User.findById(req.user.id).select('-password');
    res.status(200).json({ success: true, data: user });
  } catch (error) { next(error); }
};

// @desc    Update profile
// @route   PUT /api/v1/auth/updateprofile
// @access  Private
exports.updateProfile = async (req, res, next) => {
  try {
    const allowedFields = ['name', 'department', 'year', 'section', 'enrollmentId', 'avatarChoice'];
    const updates = {};
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });
    if (req.body.removeProfileImage) {
      updates.profileImage = null;
    }

    const user = await User.findByIdAndUpdate(req.user.id, updates, {
      new: true, runValidators: true,
    });
    res.status(200).json({ success: true, data: user });
  } catch (error) { next(error); }
};

exports.uploadProfileAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please choose an image to upload' });
    }
    if (!String(req.file.mimetype || '').startsWith('image/')) {
      return res.status(400).json({ success: false, message: 'Only image files can be used for profile avatars' });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { profileImage: `/uploads/${req.file.filename}` },
      { new: true, runValidators: true }
    );

    return res.status(200).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
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
    const token = req.params.token || req.query.token;
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
    if (user.status === 'pending') {
      user.status = 'approved';
    }
    await user.save({ validateBeforeSave: false });
    await EmailVerification.deleteMany({ user: user._id });

    let resetLink = null;
    if (user.passwordNeedsSetup) {
      resetLink = await createPasswordSetupToken(user);
    }

    await Notification.create({
      user: user._id,
      type: 'approval',
      title: user.passwordNeedsSetup ? 'Set your password to finish onboarding' : 'Account verified',
      message: user.passwordNeedsSetup
        ? 'Your email has been verified. Set your password to finish activating your account.'
        : 'Your email has been verified and your account is now active. You can sign in.',
      link: user.passwordNeedsSetup && resetLink ? resetLink.replace(process.env.FRONTEND_URL || 'http://localhost:3000', '') : '/login',
      meta: { status: user.status, emailVerified: true, passwordNeedsSetup: user.passwordNeedsSetup },
    });

    return res.status(200).json({
      success: true,
      message: user.passwordNeedsSetup ? 'Email verified. Set your password to continue.' : 'Email verified successfully',
      data: user.passwordNeedsSetup
        ? {
            passwordSetupRequired: true,
            resetLink,
          }
        : {
            passwordSetupRequired: false,
          },
    });
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

    try {
      const verification = await createEmailVerificationToken(user);
      if (verification.deliveryMode === 'preview') {
        return res.status(200).json({
          success: true,
          message: 'Verification email could not be delivered through Resend test mode. Use the verification link below in development.',
          data: {
            verificationLink: verification.verificationLink,
            verificationDelivery: 'preview',
          },
        });
      }
    } catch (emailError) {
      logger.error('Verification resend failed', {
        email,
        userId: user ? String(user._id) : null,
        error: emailError.message,
      });
      return res.status(500).json({
        success: false,
        message: 'Failed to send verification email. Please try again.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Verification email sent successfully.',
    });
  } catch (error) {
    next(error);
  }
};

exports.getPendingUsers = async (req, res, next) => {
  try {
    const users = await User.find({ status: 'pending', emailVerified: true })
      .select('-password')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: users.length,
      data: users.map((user) => ({
        systemId: user.systemId,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        year: user.year,
        section: user.section,
        status: user.status,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
};

exports.updateApprovalStatus = async (req, res, next) => {
  try {
    const status = String(req.body?.status || '').toLowerCase().trim();
    if (!['approved', 'rejected', 'suspended'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid approval status' });
    }

    const user = await findUserByIdentifier(req.params.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.adminTier && req.user?.adminTier !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Only the super admin can change elevated-tier account state',
      });
    }

    if (user.status === status) {
      return res.status(200).json({
        success: true,
        message: `Account already marked as ${status}`,
        data: {
          systemId: user.systemId,
          email: user.email,
          role: user.role,
          status: user.status,
          expiryDate: user.expiryDate,
        },
      });
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
      message: `Account status updated to ${status}`,
      data: {
        systemId: user.systemId,
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
