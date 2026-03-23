const express = require('express');
const router = express.Router();
const { getUsers, getUser, createUser, updateUser, deleteUser, getAgents } = require('../controllers/userController');
const { protect, authorize } = require('../middleware/auth');

// Get agents list (admin + agent can see)
router.get('/agents', protect, authorize('admin', 'agent'), getAgents);

router
  .route('/')
  .get(protect, authorize('admin'), getUsers)
  .post(protect, authorize('admin'), createUser);

router
  .route('/:id')
  .get(protect, authorize('admin'), getUser)
  .put(protect, authorize('admin'), updateUser)
  .delete(protect, authorize('admin'), deleteUser);

module.exports = router;
