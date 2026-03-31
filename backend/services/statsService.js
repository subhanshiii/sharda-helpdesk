/**
 * Stats Service
 * Centralized stats logic used by controller and other services
 */
const Ticket = require('../models/Ticket');
const User   = require('../models/User');
const { del, delPattern, withCache, TTL, KEYS } = require('../config/cache');

const getStats = async (user) => {
  const cacheKey = KEYS.stats(user.id, user.role);

  const { data, fromCache } = await withCache(cacheKey, TTL.STATS, async () => {
    let baseQuery = {};
    if (user.role === 'student') baseQuery.user = user.id;
    if (user.role === 'agent')   baseQuery.$or  = [{ assignedTo: user.id }, { assignedTo: null }];

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

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
      Ticket.find(baseQuery)
        .populate('user', 'name email')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      Ticket.aggregate([
        { $match: { ...baseQuery, createdAt: { $gte: sevenDaysAgo } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
    ]);

    let adminStats = {};
    if (['admin', 'agent'].includes(user.role)) {
      const [totalUsers, totalAgents] = await Promise.all([
        User.countDocuments({ role: 'student' }),
        User.countDocuments({ role: { $in: ['agent', 'admin'] } }),
      ]);
      adminStats = { totalUsers, totalAgents };
    }

    return {
      totalTickets, openTickets, inProgressTickets,
      resolvedTickets, closedTickets,
      categoryStats, priorityStats, recentTickets, dailyStats,
      ...adminStats,
    };
  });

  return { data, fromCache };
};

const invalidateStatsCache = async (userId, userRole) => {
  try {
    await Promise.all([
      del(KEYS.stats(userId, userRole)),
      delPattern('stats:admin:*'),
      delPattern('stats:agent:*'),
    ]);
  } catch (err) {
    console.warn('Stats cache invalidation error:', err.message);
  }
};

module.exports = { getStats, invalidateStatsCache };
