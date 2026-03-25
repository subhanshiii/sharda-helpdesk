const express = require('express');
const { body } = require('express-validator');
const router  = express.Router();

const {
  register, login, logout, getMe, updateProfile, changePassword,
} = require('../controllers/authController');
const {
  forgotPassword, resetPassword, verifyResetToken,
} = require('../controllers/passwordResetController');
const { protect }              = require('../middleware/auth');
const { authLimiter, passwordResetLimiter } = require('../middleware/security');

// Public routes
router.post('/register',
  authLimiter,
  [
    body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }).withMessage('Name too long'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  register
);

router.post('/login',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  login
);

router.post('/logout', protect, logout);

// Password reset
router.post('/forgot-password',  passwordResetLimiter, forgotPassword);
router.post('/reset-password',   resetPassword);
router.get('/verify-reset-token/:token', verifyResetToken);

// Protected routes
router.get('/me',                protect, getMe);
router.put('/updateprofile',     protect, updateProfile);
router.put('/changepassword',    protect, changePassword);

module.exports = router;
