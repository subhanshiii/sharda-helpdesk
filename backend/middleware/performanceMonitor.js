/**
 * Performance Monitor
 * Tracks API response times, memory usage, and system health
 */

const logger  = require('../utils/logger');
const os      = require('os');

// Track request metrics in memory (use Prometheus/DataDog in real prod)
const metrics = {
  requestCount:   0,
  errorCount:     0,
  totalDuration:  0,
  slowRequests:   0,
  startTime:      Date.now(),
};

// Increment on every request
const trackRequest = (req, res, next) => {
  metrics.requestCount++;
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    metrics.totalDuration += duration;
    if (res.statusCode >= 500) metrics.errorCount++;
    if (duration > 1000)       metrics.slowRequests++;
  });

  next();
};

// Get current metrics snapshot
const getMetrics = () => {
  const uptimeSeconds = Math.floor((Date.now() - metrics.startTime) / 1000);
  const memUsage      = process.memoryUsage();
  const avgDuration   = metrics.requestCount
    ? Math.round(metrics.totalDuration / metrics.requestCount)
    : 0;

  return {
    uptime:       `${uptimeSeconds}s`,
    requests: {
      total:       metrics.requestCount,
      errors:      metrics.errorCount,
      slow:        metrics.slowRequests,
      avgDuration: `${avgDuration}ms`,
      errorRate:   metrics.requestCount
        ? `${((metrics.errorCount / metrics.requestCount) * 100).toFixed(2)}%`
        : '0%',
    },
    memory: {
      heapUsed:  `${Math.round(memUsage.heapUsed  / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
      rss:       `${Math.round(memUsage.rss       / 1024 / 1024)}MB`,
    },
    system: {
      cpus:      os.cpus().length,
      freeMemory:`${Math.round(os.freemem()   / 1024 / 1024)}MB`,
      totalMemory:`${Math.round(os.totalmem() / 1024 / 1024)}MB`,
      platform:  os.platform(),
    },
  };
};

// Log metrics every 5 minutes
setInterval(() => {
  const m = getMetrics();
  logger.info('📊 Performance metrics snapshot', m);

  // Warn on high error rate
  if (metrics.requestCount > 100) {
    const errorRate = (metrics.errorCount / metrics.requestCount) * 100;
    if (errorRate > 5) {
      logger.warn(`⚠️  High error rate detected: ${errorRate.toFixed(2)}%`);
    }
  }
}, 5 * 60 * 1000);

module.exports = { trackRequest, getMetrics };
