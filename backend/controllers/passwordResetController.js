const crypto = require('crypto');
const User = require('../models/User');
const PasswordReset = require('../models/PasswordReset');
const { sendPasswordResetEmail } = require('../utils/emailService');

// @desc    Request password reset
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    const user = await User.findOne({ email: email.toLowerCase() });

    // Always return success to prevent email enumeration
    if (!user) {
      return res.status(200).json({ success: true, message: 'If this email exists, a reset link has been sent.' });
    }

    // Delete any existing reset tokens for this user
    await PasswordReset.deleteMany({ user: user._id });

    // Generate token
    const token = crypto.randomBytes(32).toString('hex');
    await PasswordReset.create({ user: user._id, token });

    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;

    const emailResult = await sendPasswordResetEmail({
      toEmail: user.email,
      userName: user.name,
      resetLink,
    });

    if (!emailResult.success) {
      console.error('Email failed but token created:', emailResult.error);
    }

    res.status(200).json({ success: true, message: 'If this email exists, a reset link has been sent.' });
  } catch (error) {
    next(error);
  }
};

// @desc    Reset password with token
// @route   POST /api/auth/reset-password
// @access  Public
exports.resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ success: false, message: 'Token and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const resetRecord = await PasswordReset.findOne({ token, used: false });

    if (!resetRecord) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset link' });
    }

    if (resetRecord.expiresAt < new Date()) {
      await resetRecord.deleteOne();
      return res.status(400).json({ success: false, message: 'Reset link has expired. Please request a new one.' });
    }

    const user = await User.findById(resetRecord.user);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.password = newPassword;
    await user.save();

    await resetRecord.deleteOne();

    res.status(200).json({ success: true, message: 'Password reset successfully! You can now login.' });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify reset token (check if valid before showing form)
// @route   GET /api/auth/verify-reset-token/:token
// @access  Public
exports.verifyResetToken = async (req, res, next) => {
  try {
    const { token } = req.params;
    const resetRecord = await PasswordReset.findOne({ token, used: false });

    if (!resetRecord || resetRecord.expiresAt < new Date()) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset link' });
    }

    res.status(200).json({ success: true, message: 'Token is valid' });
  } catch (error) {
    next(error);
  }
};
