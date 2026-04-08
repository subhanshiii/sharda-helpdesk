const { del, KEYS } = require('../config/cache');
const contentService = require('../services/contentService');

// @desc    Get active notice board feed
// @route   GET /api/announcements
// @access  Private
exports.getAnnouncements = async (req, res, next) => {
  try {
    const data = await contentService.listContent({
      user: req.user,
      view: 'feed',
      category: req.query.category,
      priority: req.query.priority,
      search: req.query.search,
      limit: req.query.limit,
    });

    res.status(200).json({ success: true, data });
  } catch (error) { next(error); }
};

// @desc    Create notice
// @route   POST /api/announcements
// @access  Private (roles with notice-posting permission)
exports.createAnnouncement = async (req, res, next) => {
  try {
    const data = await contentService.createContent({
      body: { ...req.body, contentType: 'notice' },
      files: req.files,
      userId: req.user.id,
    });

    await del(KEYS.announcements());

    res.status(201).json({ success: true, data });
  } catch (error) { next(error); }
};

// @desc    Delete notice
// @route   DELETE /api/announcements/:id
// @access  Private (admins or the original notice author)
exports.deleteAnnouncement = async (req, res, next) => {
  try {
    await contentService.deleteContent({
      contentId: req.params.id,
      requesterId: req.user.id,
      requesterRole: req.user.role,
    });
    await del(KEYS.announcements());

    res.status(200).json({ success: true, message: 'Announcement deleted' });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    next(error);
  }
};

// @desc    Update notice
// @route   PUT /api/announcements/:id
// @access  Private (admins or the original notice author)
exports.updateAnnouncement = async (req, res, next) => {
  try {
    const data = await contentService.updateContent({
      contentId: req.params.id,
      body: { ...req.body, contentType: 'notice' },
      files: req.files,
      requesterId: req.user.id,
      requesterRole: req.user.role,
    });

    await del(KEYS.announcements());

    res.status(200).json({ success: true, data });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    next(error);
  }
};
