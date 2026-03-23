const Ticket = require('../models/Ticket');
const User = require('../models/User');

// @desc    Get dashboard stats
// @route   GET /api/stats
// @access  Private
exports.getStats = async (req, res, next) => {
  try {
    let baseQuery = {};

    // Students see only their own stats
    if (req.user.role === 'student') {
      baseQuery.user = req.user.id;
    }

    // Agents see assigned tickets
    if (req.user.role === 'agent') {
      baseQuery.$or = [{ assignedTo: req.user.id }, { assignedTo: null }];
    }

    const [totalTickets, openTickets, inProgressTickets, resolvedTickets, closedTickets] =
      await Promise.all([
        Ticket.countDocuments(baseQuery),
        Ticket.countDocuments({ ...baseQuery, status: 'Open' }),
        Ticket.countDocuments({ ...baseQuery, status: 'In Progress' }),
        Ticket.countDocuments({ ...baseQuery, status: 'Resolved' }),
        Ticket.countDocuments({ ...baseQuery, status: 'Closed' }),
      ]);

    // Category breakdown
    const categoryStats = await Ticket.aggregate([
      { $match: baseQuery },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // Priority breakdown
    const priorityStats = await Ticket.aggregate([
      { $match: baseQuery },
      { $group: { _id: '$priority', count: { $sum: 1 } } },
    ]);

    // Recent tickets (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentTickets = await Ticket.find({
      ...baseQuery,
      createdAt: { $gte: sevenDaysAgo },
    })
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .limit(5);

    // Tickets over last 7 days (for chart)
    const dailyStats = await Ticket.aggregate([
      { $match: { ...baseQuery, createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    let adminStats = {};
    if (['admin', 'agent'].includes(req.user.role)) {
      const totalUsers = await User.countDocuments({ role: 'student' });
      const totalAgents = await User.countDocuments({ role: { $in: ['agent', 'admin'] } });
      adminStats = { totalUsers, totalAgents };
    }

    res.status(200).json({
      success: true,
      data: {
        totalTickets,
        openTickets,
        inProgressTickets,
        resolvedTickets,
        closedTickets,
        categoryStats,
        priorityStats,
        recentTickets,
        dailyStats,
        ...adminStats,
      },
    });
  } catch (error) {
    next(error);
  }
};
