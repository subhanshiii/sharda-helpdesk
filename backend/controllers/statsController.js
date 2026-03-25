const Ticket = require('../models/Ticket');
const User   = require('../models/User');
const { withCache, del, delPattern, TTL, KEYS } = require('../config/cache');

// @desc    Get dashboard stats
// @route   GET /api/stats
// @access  Private
exports.getStats = async (req, res, next) => {
  try {
    const cacheKey = KEYS.stats(req.user.id, req.user.role);

    // withCache: try Redis first, fall back to DB query
    const { data, fromCache } = await withCache(cacheKey, TTL.STATS, async () => {
      let baseQuery = {};
      if (req.user.role === 'student') baseQuery.user = req.user.id;
      if (req.user.role === 'agent')   baseQuery.$or = [{ assignedTo: req.user.id }, { assignedTo: null }];

      const [
        totalTickets, openTickets, inProgressTickets,
        resolvedTickets, closedTickets,
        categoryStats, priorityStats, recentTickets, dailyStats,
      ] = await Promise.all([
        Ticket.countDocuments(baseQuery),
        Ticket.countDocuments({ ...baseQuery, status: 'Open' }),
        Ticket.countDocuments({ ...baseQuery, status: 'In Progress' }),
        Ticket.countDocuments({ ...baseQuery, status: 'Resolved' }),
        Ticket.countDocuments({ ...baseQuery, status: 'Closed' }),
        Ticket.aggregate([
          { $match: baseQuery },
          { $group: { _id: '$category', count: { $sum: 1 } } },
          { $sort:  { count: -1 } },
        ]),
        Ticket.aggregate([
          { $match: baseQuery },
          { $group: { _id: '$priority', count: { $sum: 1 } } },
        ]),
        Ticket.find({ ...baseQuery })
          .populate('user', 'name email')
          .sort({ createdAt: -1 })
          .limit(5),
        Ticket.aggregate([
          { $match: { ...baseQuery, createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } },
          { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
          { $sort: { _id: 1 } },
        ]),
      ]);

      let adminStats = {};
      if (['admin', 'agent'].includes(req.user.role)) {
        const [totalUsers, totalAgents] = await Promise.all([
          User.countDocuments({ role: 'student' }),
          User.countDocuments({ role: { $in: ['agent', 'admin'] } }),
        ]);
        adminStats = { totalUsers, totalAgents };
      }

      return {
        totalTickets, openTickets, inProgressTickets,
        resolvedTickets, closedTickets,
        categoryStats, priorityStats, recentTickets,
        dailyStats, ...adminStats,
      };
    });

    // Add cache metadata in development so you can verify it's working
    const meta = process.env.NODE_ENV === 'development' ? { fromCache } : {};
    res.status(200).json({ success: true, data, ...meta });
  } catch (error) { next(error); }
};

// ── Cache invalidation: call this when tickets change ──
// Called by ticketController after create/update/delete
exports.invalidateStatsCache = async (userId, userRole) => {
  try {
    // Invalidate this user's stats
    await del(KEYS.stats(userId, userRole));
    // Invalidate all admin stats (they see everything)
    await delPattern('stats:admin:*');
    // Invalidate all agent stats (they see aggregated data)
    await delPattern('stats:agent:*');
  } catch (err) {
    console.warn('Stats cache invalidation error:', err.message);
  }
};
