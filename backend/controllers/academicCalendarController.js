const contentService = require('../services/contentService');

exports.getEvents = async (req, res, next) => {
  try {
    const events = await contentService.listContent({
      user: req.user,
      view: 'calendar',
      search: req.query.search,
      month: req.query.month,
      limit: req.query.limit || 20,
      upcomingOnly: true,
    });
    res.json({ success: true, data: events });
  } catch (e) { next(e); }
};

exports.getAllEvents = async (req, res, next) => {
  try {
    const events = await contentService.listContent({
      user: req.user,
      view: 'calendar',
      search: req.query.search,
      month: req.query.month,
      limit: req.query.limit,
    });
    res.json({ success: true, data: events });
  } catch (e) { next(e); }
};

exports.createEvent = async (req, res, next) => {
  try {
    const data = await contentService.createContent({
      body: {
        ...req.body,
        contentType: 'calendar',
        startsAt: req.body.startsAt || req.body.date,
        endsAt: req.body.endsAt || req.body.endDate,
      },
      userId: req.user.id,
    });
    res.status(201).json({ success: true, data });
  } catch (e) { next(e); }
};

exports.deleteEvent = async (req, res, next) => {
  try {
    await contentService.deleteContent({
      contentId: req.params.id,
      requesterId: req.user.id,
      requesterRole: req.user.role,
    });
    res.json({ success: true, message: 'Deleted' });
  } catch (e) {
    if (e.statusCode) return res.status(e.statusCode).json({ success: false, message: e.message });
    next(e);
  }
};
