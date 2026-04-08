const express = require('express');
const router = express.Router();
const { getAnnouncements, createAnnouncement, deleteAnnouncement, updateAnnouncement } = require('../controllers/announcementController');
const { protect, permissionMiddleware } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.get('/',    protect, getAnnouncements);
router.post('/',   protect, permissionMiddleware('canPostNotice'), upload.array('attachments', 5), createAnnouncement);
router.put('/:id', protect, permissionMiddleware('canPostNotice'), upload.array('attachments', 5), updateAnnouncement);
router.delete('/:id', protect, permissionMiddleware('canPostNotice'), deleteAnnouncement);

module.exports = router;
