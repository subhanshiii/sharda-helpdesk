const express = require('express');
const router = express.Router();
const { getUsers, getUser, createUser, updateUser, deleteUser, getAgents } = require('../controllers/userController');
const { protect, permissionMiddleware } = require('../middleware/auth');

// Legacy path kept for compatibility — returns support staff assignees.
router.get('/agents', protect, permissionMiddleware('canHandleTickets'), getAgents);
router.get('/staff', protect, permissionMiddleware('canHandleTickets'), getAgents);

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
