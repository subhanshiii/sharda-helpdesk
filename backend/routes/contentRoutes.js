const express = require('express');
const router = express.Router();
const { getContent, createContent, updateContent, deleteContent } = require('../controllers/contentController');
const { protect, permissionMiddleware } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.get('/', protect, getContent);
router.post('/', protect, permissionMiddleware('canPostNotice'), upload.array('attachments', 5), createContent);
router.put('/:id', protect, permissionMiddleware('canPostNotice'), upload.array('attachments', 5), updateContent);
router.delete('/:id', protect, permissionMiddleware('canPostNotice'), deleteContent);

module.exports = router;
