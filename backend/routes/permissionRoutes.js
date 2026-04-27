const express = require('express');
const router = express.Router();
const { getPermissions, updateRolePermissions } = require('../controllers/permissionController');
const { verifyAuth, checkPermission } = require('../middleware/auth');

router.get('/', verifyAuth, getPermissions);
router.put('/:role', verifyAuth, checkPermission('manage', 'permissions'), updateRolePermissions);

module.exports = router;
