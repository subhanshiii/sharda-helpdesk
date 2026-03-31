/**
 * Stats Controller — THIN LAYER
 */
const statsService = require('../services/statsService');

exports.getStats = async (req, res, next) => {
  try {
    const { data, fromCache } = await statsService.getStats(req.user);
    const meta = process.env.NODE_ENV === 'development' ? { fromCache } : {};
    res.status(200).json({ success: true, data, ...meta });
  } catch (error) { next(error); }
};

// Exported for use by other services
exports.invalidateStatsCache = statsService.invalidateStatsCache;
