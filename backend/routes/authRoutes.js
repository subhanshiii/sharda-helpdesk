const express = require('express');
const { body } = require('express-validator');
const router  = express.Router();

const {
  register, login, adminLogin, logout, getMe, updateProfile, changePassword, getPendingUsers, updateApprovalStatus, verifyEmail, resendVerification,
} = require('../controllers/authController');
const {
  forgotPassword, resetPassword, verifyResetToken,
} = require('../controllers/passwordResetController');
const { protect, permissionMiddleware }              = require('../middleware/auth');
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

router.get('/verify-email/:token', verifyEmail);
router.post('/resend-verification',
  authLimiter,
  [body('email').isEmail().normalizeEmail().withMessage('Valid email is required')],
  resendVerification
);

router.post('/admin/login',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  adminLogin
);

// Logout should clear cookie state even when the session is already invalidated.
router.post('/logout', logout);

// Password reset
router.post('/forgot-password',  passwordResetLimiter, forgotPassword);
router.post('/reset-password',   resetPassword);
router.get('/verify-reset-token/:token', verifyResetToken);

// Protected routes
router.get('/me',                protect, getMe);
router.put('/updateprofile',     protect, updateProfile);
router.put('/changepassword',    protect, changePassword);
router.get('/pending-users',     protect, permissionMiddleware('canManageUsers'), getPendingUsers);
router.patch('/approve/:userId', protect, permissionMiddleware('canManageUsers'), (req, res, next) => {
  req.body.status = 'approved';
  return updateApprovalStatus(req, res, next);
});
router.patch('/reject/:userId',  protect, permissionMiddleware('canManageUsers'), (req, res, next) => {
  req.body.status = 'rejected';
  return updateApprovalStatus(req, res, next);
});
router.patch('/status/:userId',  protect, permissionMiddleware('canManageUsers'), updateApprovalStatus);

module.exports = router;
