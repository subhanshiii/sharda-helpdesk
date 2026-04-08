const Opportunity = require('../models/Opportunity');

// @desc    Get all opportunities
// @route   GET /api/opportunities
// @access  Private
exports.getOpportunities = async (req, res, next) => {
  try {
    const { type, search, page = 1, limit = 12 } = req.query;
    let query = { isActive: true };

    if (type) query.type = type;
    if (search) {
      query.$or = [
        { title:       { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { company:     { $regex: search, $options: 'i' } },
        { tags:        { $regex: search, $options: 'i' } },
      ];
    }

    const total = await Opportunity.countDocuments(query);
    const opportunities = await Opportunity.find(query)
      .populate('postedBy', 'name role')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    // Add isBookmarked field for current user
    const data = opportunities.map(opp => ({
      ...opp.toObject(),
      isBookmarked: opp.bookmarks.includes(req.user.id),
      bookmarkCount: opp.bookmarks.length,
    }));

    res.status(200).json({
      success: true,
      count: data.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      data,
    });
  } catch (error) { next(error); }
};

// @desc    Get single opportunity
// @route   GET /api/opportunities/:id
// @access  Private
exports.getOpportunity = async (req, res, next) => {
  try {
    const opp = await Opportunity.findById(req.params.id)
      .populate('postedBy', 'name role');
    if (!opp) return res.status(404).json({ success: false, message: 'Opportunity not found' });

    res.status(200).json({
      success: true,
      data: {
        ...opp.toObject(),
        isBookmarked: opp.bookmarks.includes(req.user.id),
        bookmarkCount: opp.bookmarks.length,
      },
    });
  } catch (error) { next(error); }
};

// @desc    Create opportunity
// @route   POST /api/opportunities
// @access  Private (roles with notice-posting permission)
exports.createOpportunity = async (req, res, next) => {
  try {
    const { title, description, type, company, location, externalLink, deadline, stipend, eligibility, tags } = req.body;

    const opp = await Opportunity.create({
      title, description, type, company, location,
      externalLink, deadline, stipend, eligibility,
      tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim())) : [],
      postedBy: req.user.id,
    });

    const populated = await Opportunity.findById(opp._id).populate('postedBy', 'name role');
    res.status(201).json({ success: true, data: populated });
  } catch (error) { next(error); }
};

// @desc    Update opportunity
// @route   PUT /api/opportunities/:id
// @access  Private (admins or the original opportunity author)
exports.updateOpportunity = async (req, res, next) => {
  try {
    let opp = await Opportunity.findById(req.params.id);
    if (!opp) return res.status(404).json({ success: false, message: 'Not found' });

    if (req.user.role !== 'admin' && opp.postedBy.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    opp = await Opportunity.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
      .populate('postedBy', 'name role');

    res.status(200).json({ success: true, data: opp });
  } catch (error) { next(error); }
};

// @desc    Delete opportunity
// @route   DELETE /api/opportunities/:id
// @access  Private (admins or the original opportunity author)
exports.deleteOpportunity = async (req, res, next) => {
  try {
    const opp = await Opportunity.findById(req.params.id);
    if (!opp) return res.status(404).json({ success: false, message: 'Not found' });

    if (req.user.role !== 'admin' && opp.postedBy.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    await opp.deleteOne();
    res.status(200).json({ success: true, message: 'Opportunity deleted' });
  } catch (error) { next(error); }
};

// @desc    Bookmark / unbookmark opportunity
// @route   PUT /api/opportunities/:id/bookmark
// @access  Private
exports.toggleBookmark = async (req, res, next) => {
  try {
    const opp = await Opportunity.findById(req.params.id);
    if (!opp) return res.status(404).json({ success: false, message: 'Not found' });

    const isBookmarked = opp.bookmarks.includes(req.user.id);

    if (isBookmarked) {
      opp.bookmarks = opp.bookmarks.filter(id => id.toString() !== req.user.id);
    } else {
      opp.bookmarks.push(req.user.id);
    }

    await opp.save();

    res.status(200).json({
      success: true,
      isBookmarked: !isBookmarked,
      bookmarkCount: opp.bookmarks.length,
      message: isBookmarked ? 'Bookmark removed' : 'Bookmarked!',
    });
  } catch (error) { next(error); }
};

// @desc    Get bookmarked opportunities for current user
// @route   GET /api/opportunities/bookmarked
// @access  Private
exports.getBookmarked = async (req, res, next) => {
  try {
    const opps = await Opportunity.find({
      bookmarks: req.user.id,
      isActive: true,
    }).populate('postedBy', 'name role').sort({ createdAt: -1 });

    const data = opps.map(opp => ({
      ...opp.toObject(),
      isBookmarked: true,
      bookmarkCount: opp.bookmarks.length,
    }));

    res.status(200).json({ success: true, count: data.length, data });
  } catch (error) { next(error); }
};
