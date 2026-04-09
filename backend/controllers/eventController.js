const Event = require('../models/Event');
const path  = require('path');

// @desc    Get all events
// @route   GET /api/events
// @access  Private
exports.getEvents = async (req, res, next) => {
  try {
    const { category, search, filter } = req.query;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || 12, 1);
    let query = { isActive: true };

    if (category) query.category = category;
    if (search) {
      query.$or = [
        { title:       { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { organizer:   { $regex: search, $options: 'i' } },
        { venue:       { $regex: search, $options: 'i' } },
      ];
    }

    // upcoming / past filter
    if (filter === 'upcoming') query.date = { $gte: new Date() };
    if (filter === 'past')     query.date = { $lt:  new Date() };

    const total  = await Event.countDocuments(query);
    const events = await Event.find(query)
      .populate('postedBy', 'name role')
      .sort({ date: 1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const data = events.map(e => ({
      ...e.toObject(),
      isInterested:    e.interestedUsers.some((id) => id.toString() === req.user.id),
      interestedCount: e.interestedUsers.length,
    }));

    res.status(200).json({
      success: true,
      count: data.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      data,
    });
  } catch (error) { next(error); }
};

// @desc    Get single event
// @route   GET /api/events/:id
// @access  Private
exports.getEvent = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id).populate('postedBy', 'name role');
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
    res.status(200).json({
      success: true,
      data: {
        ...event.toObject(),
        isInterested:    event.interestedUsers.some((id) => id.toString() === req.user.id),
        interestedCount: event.interestedUsers.length,
      },
    });
  } catch (error) { next(error); }
};

// @desc    Create event
// @route   POST /api/events
// @access  Private (roles with notice-posting permission)
exports.createEvent = async (req, res, next) => {
  try {
    const {
      title, description, category, date, endDate,
      venue, videoLink, registrationLink, organizer,
      maxParticipants, tags,
    } = req.body;

    let poster = null;
    if (req.file) {
      poster = {
        filename: req.file.filename,
        url: `/api/files/general/${req.file.filename}`,
      };
    }

    const event = await Event.create({
      title, description, category, date, endDate,
      venue, videoLink, registrationLink, organizer,
      maxParticipants: maxParticipants ? parseInt(maxParticipants) : null,
      tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim())) : [],
      poster,
      postedBy: req.user.id,
    });

    const populated = await Event.findById(event._id).populate('postedBy', 'name role');
    res.status(201).json({ success: true, data: populated });
  } catch (error) { next(error); }
};

// @desc    Update event
// @route   PUT /api/events/:id
// @access  Private (admins or the original event author)
exports.updateEvent = async (req, res, next) => {
  try {
    let event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    if (req.user.role !== 'admin' && event.postedBy.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (req.file) {
      req.body.poster = { filename: req.file.filename, url: `/api/files/general/${req.file.filename}` };
    }

    event = await Event.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
      .populate('postedBy', 'name role');

    res.status(200).json({ success: true, data: event });
  } catch (error) { next(error); }
};

// @desc    Delete event
// @route   DELETE /api/events/:id
// @access  Private (admins or the original event author)
exports.deleteEvent = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    if (req.user.role !== 'admin' && event.postedBy.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    await event.deleteOne();
    res.status(200).json({ success: true, message: 'Event deleted' });
  } catch (error) { next(error); }
};

// @desc    Toggle interest in event
// @route   PUT /api/events/:id/interest
// @access  Private
exports.toggleInterest = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    const isInterested = event.interestedUsers.some((id) => id.toString() === req.user.id);
    if (isInterested) {
      event.interestedUsers = event.interestedUsers.filter(id => id.toString() !== req.user.id);
    } else {
      event.interestedUsers.push(req.user.id);
    }

    await event.save();
    res.status(200).json({
      success: true,
      isInterested: !isInterested,
      interestedCount: event.interestedUsers.length,
      message: isInterested ? 'Removed from interested' : 'Marked as interested!',
    });
  } catch (error) { next(error); }
};
