/**
 * Request Logger Middleware
 *
 * Adds:
 * 1. Correlation ID to every request (for distributed tracing)
 * 2. Request/response logging with timing
 * 3. Performance monitoring (slow request detection)
 */

const crypto = require('crypto');
const logger = require('../utils/logger');

const SLOW_REQUEST_THRESHOLD_MS = 1000; // Warn if request takes > 1s

module.exports = (req, res, next) => {
  // ── Correlation ID ─────────────────────────────────────
  // Unique ID per request — lets you trace one request through all logs
  const correlationId = req.headers['x-correlation-id'] || crypto.randomUUID();
  req.correlationId   = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);

  // ── Start timer ────────────────────────────────────────
  const startTime = Date.now();

  // ── Log incoming request ───────────────────────────────
  logger.http(`→ ${req.method} ${req.originalUrl}`, {
    correlationId,
    ip:        req.ip,
    userAgent: req.headers['user-agent'],
    userId:    req.user?.id,
  });

  // ── Log response when finished ─────────────────────────
  res.on('finish', () => {
    const duration  = Date.now() - startTime;
    const logLevel  = res.statusCode >= 500 ? 'error'
                    : res.statusCode >= 400 ? 'warn'
                    : 'http';

    const logData = {
      correlationId,
      method:     req.method,
      url:        req.originalUrl,
      statusCode: res.statusCode,
      duration:   `${duration}ms`,
      userId:     req.user?.id,
      userRole:   req.user?.role,
    };

    logger[logLevel](`← ${req.method} ${req.originalUrl} ${res.statusCode} [${duration}ms]`, logData);

    // ── Slow request warning ───────────────────────────────
    if (duration > SLOW_REQUEST_THRESHOLD_MS) {
      logger.warn(`🐌 SLOW REQUEST: ${req.method} ${req.originalUrl} took ${duration}ms`, {
        correlationId,
        duration,
        threshold: SLOW_REQUEST_THRESHOLD_MS,
      });
    }
  });

  next();
};
