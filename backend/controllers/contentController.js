const contentService = require('../services/contentService');

exports.getContent = async (req, res, next) => {
  try {
    const data = await contentService.listContent({
      user: req.user,
      view: req.query.view || 'feed',
      contentType: req.query.contentType,
      category: req.query.category,
      priority: req.query.priority,
      search: req.query.search,
      month: req.query.month,
      limit: req.query.limit,
      upcomingOnly: req.query.upcoming === '1',
    });

    res.status(200).json({ success: true, data, count: data.length });
  } catch (error) {
    next(error);
  }
};

exports.createContent = async (req, res, next) => {
  try {
    const data = await contentService.createContent({
      body: req.body,
      files: req.files,
      userId: req.user.id,
    });

    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

exports.updateContent = async (req, res, next) => {
  try {
    const data = await contentService.updateContent({
      contentId: req.params.id,
      body: req.body,
      files: req.files,
      requesterId: req.user.id,
      requesterRole: req.user.role,
    });

    res.status(200).json({ success: true, data });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
};

exports.deleteContent = async (req, res, next) => {
  try {
    await contentService.deleteContent({
      contentId: req.params.id,
      requesterId: req.user.id,
      requesterRole: req.user.role,
    });

    res.status(200).json({ success: true, message: 'Content deleted' });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
};
