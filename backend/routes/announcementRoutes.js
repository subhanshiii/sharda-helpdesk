const express = require('express');
const router = express.Router();
const { getAnnouncements, createAnnouncement, deleteAnnouncement, updateAnnouncement } = require('../controllers/announcementController');
const { protect, authorize } = require('../middleware/auth');

router.get('/',    protect, getAnnouncements);
router.post('/',   protect, authorize('admin', 'agent'), createAnnouncement);
router.put('/:id', protect, authorize('admin', 'agent'), updateAnnouncement);
router.delete('/:id', protect, authorize('admin', 'agent'), deleteAnnouncement);

module.exports = router;
