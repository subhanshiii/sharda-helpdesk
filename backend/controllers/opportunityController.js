const Opportunity = require('../models/Opportunity');
const { isPlatformAdmin } = require('../utils/permissionDefaults');
const Section = require('../models/Section');
const Department = require('../models/Department');
const { buildAudienceVisibilityQuery, buildTargetAudiencePayload, buildVisibilityFilterQuery, parseVisibilityValues } = require('../utils/visibility');

// @desc    Get all opportunities
// @route   GET /api/opportunities
// @access  Private
exports.getOpportunities = async (req, res, next) => {
  try {
    const { type, search } = req.query;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || 12, 1);
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

    const audienceQuery = await buildAudienceVisibilityQuery(req.user);
    if (audienceQuery) {
      query.$and = [...(query.$and || []), audienceQuery];
    }

    const visibilityFilter = buildVisibilityFilterQuery(req.query);
    if (visibilityFilter) {
      query.$and = [...(query.$and || []), visibilityFilter];
    }

    const total = await Opportunity.countDocuments(query);
    const opportunities = await Opportunity.find(query)
      .populate('postedBy', 'name role')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    // Add isBookmarked field for current user
    const data = opportunities.map(opp => ({
      ...opp.toObject(),
      isBookmarked: opp.bookmarks.some((id) => id.toString() === req.user.id),
      bookmarkCount: opp.bookmarks.length,
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

// @desc    Get single opportunity
// @route   GET /api/opportunities/:id
// @access  Private
exports.getOpportunity = async (req, res, next) => {
  try {
    const query = { _id: req.params.id };
    const audienceQuery = await buildAudienceVisibilityQuery(req.user);
    if (audienceQuery) {
      query.$and = [...(query.$and || []), audienceQuery];
    }
    const opp = await Opportunity.findOne(query)
      .populate('postedBy', 'name role');
    if (!opp) return res.status(404).json({ success: false, message: 'Opportunity not found' });

    res.status(200).json({
      success: true,
      data: {
        ...opp.toObject(),
        isBookmarked: opp.bookmarks.some((id) => id.toString() === req.user.id),
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
    const {
      title, description, type, company, location, externalLink, deadline, stipend, eligibility, tags,
    } = req.body;

    const audience = buildTargetAudiencePayload(req.body);

    if (audience.sectionId) {
      const section = await Section.findById(audience.sectionId).populate('department', 'name college');
      if (section) {
        audience.studyYear = audience.studyYear || section.studyYear || null;
        audience.courseId = audience.courseId || section.course || null;
        audience.programId = audience.programId || section.program || null;
        audience.departmentId = audience.departmentId || section.department?._id || null;
        audience.collegeId = audience.collegeId || section.department?.college || null;
        audience.departments = audience.departments?.length ? audience.departments : [section.department?.name].filter(Boolean);
        audience.years = audience.years?.length ? audience.years : [String(section.studyYear || '')].filter(Boolean);
        audience.sections = audience.sections?.length ? audience.sections : [section.name].filter(Boolean);
      }
    } else if (audience.departmentId) {
      const department = await Department.findById(audience.departmentId).select('name college');
      if (department) {
        audience.collegeId = audience.collegeId || department.college || null;
        audience.departments = audience.departments?.length ? audience.departments : [department.name].filter(Boolean);
      }
    }

    const opp = await Opportunity.create({
      title, description, type, company, location,
      externalLink, deadline, stipend, eligibility,
      tags: parseVisibilityValues(tags),
      targetAudience: audience,
      postedBy: req.user.id,
    });

    const populated = await Opportunity.findById(opp._id).populate('postedBy', 'name role');
    res.status(201).json({
      success: true,
      data: {
        ...populated.toObject(),
        isBookmarked: populated.bookmarks.some((id) => id.toString() === req.user.id),
        bookmarkCount: populated.bookmarks.length,
      },
    });
  } catch (error) { next(error); }
};

// @desc    Update opportunity
// @route   PUT /api/opportunities/:id
// @access  Private (admins or the original opportunity author)
exports.updateOpportunity = async (req, res, next) => {
  try {
    let opp = await Opportunity.findById(req.params.id);
    if (!opp) return res.status(404).json({ success: false, message: 'Not found' });

    if (!isPlatformAdmin(req.user) && opp.postedBy.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (
      req.body.audienceTiers !== undefined ||
      req.body.audienceRoles !== undefined ||
      req.body.audienceCollegeId !== undefined ||
      req.body.audienceDepartmentId !== undefined ||
      req.body.audienceProgramId !== undefined ||
      req.body.audienceCourseId !== undefined ||
      req.body.audienceStudyYear !== undefined ||
      req.body.audienceSectionId !== undefined ||
      req.body.audienceDepartments !== undefined ||
      req.body.audienceYears !== undefined ||
      req.body.audienceSections !== undefined
    ) {
      let audience = buildTargetAudiencePayload(req.body);

      if (audience.sectionId) {
        const section = await Section.findById(audience.sectionId).populate('department', 'name college');
        if (section) {
          audience.studyYear = audience.studyYear || section.studyYear || null;
          audience.courseId = audience.courseId || section.course || null;
          audience.programId = audience.programId || section.program || null;
          audience.departmentId = audience.departmentId || section.department?._id || null;
          audience.collegeId = audience.collegeId || section.department?.college || null;
          audience.departments = audience.departments?.length ? audience.departments : [section.department?.name].filter(Boolean);
          audience.years = audience.years?.length ? audience.years : [String(section.studyYear || '')].filter(Boolean);
          audience.sections = audience.sections?.length ? audience.sections : [section.name].filter(Boolean);
        }
      } else if (audience.departmentId) {
        const department = await Department.findById(audience.departmentId).select('name college');
        if (department) {
          audience.collegeId = audience.collegeId || department.college || null;
          audience.departments = audience.departments?.length ? audience.departments : [department.name].filter(Boolean);
        }
      }

      req.body.targetAudience = audience;
    }

    if (req.body.tags !== undefined) {
      req.body.tags = parseVisibilityValues(req.body.tags);
    }

    opp = await Opportunity.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
      .populate('postedBy', 'name role');

    res.status(200).json({
      success: true,
      data: {
        ...opp.toObject(),
        isBookmarked: opp.bookmarks.some((id) => id.toString() === req.user.id),
        bookmarkCount: opp.bookmarks.length,
      },
    });
  } catch (error) { next(error); }
};

// @desc    Delete opportunity
// @route   DELETE /api/opportunities/:id
// @access  Private (admins or the original opportunity author)
exports.deleteOpportunity = async (req, res, next) => {
  try {
    const opp = await Opportunity.findById(req.params.id);
    if (!opp) return res.status(404).json({ success: false, message: 'Not found' });

    if (!isPlatformAdmin(req.user) && opp.postedBy.toString() !== req.user.id) {
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

    const isBookmarked = opp.bookmarks.some((id) => id.toString() === req.user.id);

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
    const query = {
      bookmarks: req.user.id,
      isActive: true,
    };
    const audienceQuery = await buildAudienceVisibilityQuery(req.user);
    if (audienceQuery) {
      query.$and = [...(query.$and || []), audienceQuery];
    }
    const opps = await Opportunity.find(query).populate('postedBy', 'name role').sort({ createdAt: -1 });

    const data = opps.map(opp => ({
      ...opp.toObject(),
      isBookmarked: true,
      bookmarkCount: opp.bookmarks.length,
    }));

    res.status(200).json({ success: true, count: data.length, data });
  } catch (error) { next(error); }
};
