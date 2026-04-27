const express = require('express');
const router = express.Router();
const { getContent, createContent, updateContent, deleteContent } = require('../controllers/contentController');
const { verifyAuth, checkPermission } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.get('/', verifyAuth, getContent);
router.post('/', verifyAuth, checkPermission('create', 'notices'), upload.array('attachments', 5), createContent);
router.put('/:id', verifyAuth, checkPermission('edit', 'notices'), upload.array('attachments', 5), updateContent);
router.delete('/:id', verifyAuth, checkPermission('delete', 'notices'), deleteContent);

module.exports = router;
