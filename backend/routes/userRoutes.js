const express = require('express');
const multer = require('multer');
const router = express.Router();
const { getUsers, getUser, getUserBySystemId, createUser, importUsers, updateUser, deleteUser, uploadUserAvatar, getAgents, getIdentityAlerts } = require('../controllers/userController');
const { protect, permissionMiddleware } = require('../middleware/auth');
const upload = require('../middleware/upload');
const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const isCsv = file.mimetype === 'text/csv'
      || file.mimetype === 'application/vnd.ms-excel'
      || String(file.originalname || '').toLowerCase().endsWith('.csv');
    if (isCsv) return cb(null, true);
    return cb(new Error('Only CSV files are allowed for import'));
  },
});

// Legacy path kept for compatibility — returns support staff assignees.
router.get('/agents', protect, permissionMiddleware('canHandleTickets'), getAgents);
router.get('/staff', protect, permissionMiddleware('canHandleTickets'), getAgents);
router.get('/identity-alerts', protect, permissionMiddleware('canManageUsers'), getIdentityAlerts);
router.get('/by-system-id/:systemId', protect, permissionMiddleware('canManageUsers'), getUserBySystemId);
router.post('/import', protect, permissionMiddleware('canManageUsers'), csvUpload.single('file'), importUsers);
router.post('/:id/avatar', protect, permissionMiddleware('canManageUsers'), upload.single('profileImage'), uploadUserAvatar);

router
  .route('/')
  .get(protect, permissionMiddleware('canManageUsers'), getUsers)
  .post(protect, permissionMiddleware('canManageUsers'), createUser);

router
  .route('/:id')
  .get(protect, permissionMiddleware('canManageUsers'), getUser)
  .put(protect, permissionMiddleware('canManageUsers'), updateUser)
  .delete(protect, permissionMiddleware('canManageUsers'), deleteUser);

module.exports = router;
