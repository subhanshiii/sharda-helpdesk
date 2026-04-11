const express = require('express');
const router = express.Router();
const { upsertAdminScopes } = require('../controllers/adminScopeController');
const { protect, requireAdminTier } = require('../middleware/auth');

router.post('/', protect, requireAdminTier('super_admin'), upsertAdminScopes);

module.exports = router;
