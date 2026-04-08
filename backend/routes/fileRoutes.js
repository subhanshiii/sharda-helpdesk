const express = require('express');
const router = express.Router();
const { downloadFile } = require('../controllers/fileController');
const { protectFileAccess } = require('../middleware/auth');

router.get('/:scope/:filename', protectFileAccess, downloadFile);

module.exports = router;
