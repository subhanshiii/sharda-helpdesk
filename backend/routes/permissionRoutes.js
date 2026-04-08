const express = require('express');
const router = express.Router();
const { getPermissions, updateRolePermissions } = require('../controllers/permissionController');
const { protect, permissionMiddleware } = require('../middleware/auth');

router.get('/', protect, getPermissions);
router.put('/:role', protect, permissionMiddleware('canManagePermissions'), updateRolePermissions);

module.exports = router;
