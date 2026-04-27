const express = require('express');
const router = express.Router();
const { getAnnouncements, createAnnouncement, deleteAnnouncement, updateAnnouncement } = require('../controllers/announcementController');
const { verifyAuth, checkPermission } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.get('/', verifyAuth, getAnnouncements);
router.post('/', verifyAuth, checkPermission('create', 'notices'), upload.array('attachments', 5), createAnnouncement);
router.put('/:id', verifyAuth, checkPermission('edit', 'notices'), upload.array('attachments', 5), updateAnnouncement);
router.delete('/:id', verifyAuth, checkPermission('delete', 'notices'), deleteAnnouncement);

module.exports = router;
