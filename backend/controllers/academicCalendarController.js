const AcademicCalendar = require('../models/AcademicCalendar');

exports.getEvents = async (req, res, next) => {
  try {
    const events = await AcademicCalendar.find({ date: { $gte: new Date() } })
      .sort({ date: 1 }).limit(20).populate('postedBy', 'name');
    res.json({ success: true, data: events });
  } catch (e) { next(e); }
};

exports.getAllEvents = async (req, res, next) => {
  try {
    const events = await AcademicCalendar.find().sort({ date: 1 }).populate('postedBy', 'name');
    res.json({ success: true, data: events });
  } catch (e) { next(e); }
};

exports.createEvent = async (req, res, next) => {
  try {
    const event = await AcademicCalendar.create({ ...req.body, postedBy: req.user.id });
    res.status(201).json({ success: true, data: event });
  } catch (e) { next(e); }
};

exports.deleteEvent = async (req, res, next) => {
  try {
    await AcademicCalendar.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Deleted' });
  } catch (e) { next(e); }
};
