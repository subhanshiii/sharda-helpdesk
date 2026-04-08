const User = require('../models/User');
const { validationResult } = require('express-validator');

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
    department:   user.department,
    year:         user.year,
    section:      user.section,
    enrollmentId: user.enrollmentId,
    avatar:       user.avatar,
    createdAt:    user.createdAt,
  };

  res
    .status(statusCode)
    .cookie('token', token, getCookieOptions())
    .json({ success: true, token, user: userData });
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

    const { name, email, password, department, year, section, enrollmentId } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    const user = await User.create({
      name, email, password, role: 'student', department, year, section, enrollmentId,
    });

    sendTokenResponse(user, 201, res);
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
      // Generic message — don't reveal if email exists
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (!user.isActive) {
      return res.status(401).json({ success: false, message: 'Account deactivated. Contact admin.' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    sendTokenResponse(user, 200, res);
  } catch (error) { next(error); }
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
