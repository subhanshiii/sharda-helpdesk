const Announcement = require('../models/Announcement');

// @desc    Get all active announcements
// @route   GET /api/announcements
// @access  Private
exports.getAnnouncements = async (req, res, next) => {
  try {
    const announcements = await Announcement.find({ isActive: true })
      .populate('postedBy', 'name role')
      .sort({ createdAt: -1 })
      .limit(20);
    res.status(200).json({ success: true, data: announcements });
  } catch (error) { next(error); }
};

// @desc    Create announcement
// @route   POST /api/announcements
// @access  Private (admin/agent)
exports.createAnnouncement = async (req, res, next) => {
  try {
    const { title, message, type, expiresAt } = req.body;
    if (!title || !message) return res.status(400).json({ success: false, message: 'Title and message are required' });

    const announcement = await Announcement.create({
      title, message, type: type || 'info',
      postedBy: req.user.id,
      expiresAt: expiresAt || null,
    });

    const populated = await Announcement.findById(announcement._id).populate('postedBy', 'name role');
    res.status(201).json({ success: true, data: populated });
  } catch (error) { next(error); }
};

// @desc    Delete announcement
// @route   DELETE /api/announcements/:id
// @access  Private (admin/agent)
exports.deleteAnnouncement = async (req, res, next) => {
  try {
    const announcement = await Announcement.findById(req.params.id);
    if (!announcement) return res.status(404).json({ success: false, message: 'Announcement not found' });

    // Only admin or the person who posted can delete
    if (req.user.role !== 'admin' && announcement.postedBy.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    await announcement.deleteOne();
    res.status(200).json({ success: true, message: 'Announcement deleted' });
  } catch (error) { next(error); }
};

// @desc    Toggle announcement active status
// @route   PUT /api/announcements/:id
// @access  Private (admin)
exports.updateAnnouncement = async (req, res, next) => {
  try {
    const announcement = await Announcement.findByIdAndUpdate(
      req.params.id, req.body, { new: true }
    ).populate('postedBy', 'name role');
    if (!announcement) return res.status(404).json({ success: false, message: 'Not found' });
    res.status(200).json({ success: true, data: announcement });
  } catch (error) { next(error); }
};
