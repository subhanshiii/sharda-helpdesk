/**
 * Global Error Handler
 * Upgraded with structured logging and better error categorization
 */

const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message    = err.message    || 'Internal Server Error';

  // ── Mongoose bad ObjectId ──────────────────────────────
  if (err.name === 'CastError') {
    statusCode = 404;
    message    = `Resource not found with id: ${err.value}`;
  }

  // ── Mongoose duplicate key ─────────────────────────────
  if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyValue)[0];
    message    = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`;
  }

  // ── Mongoose validation error ──────────────────────────
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message    = Object.values(err.errors).map(e => e.message).join(', ');
  }

  // ── JWT errors ─────────────────────────────────────────
  if (err.name === 'JsonWebTokenError') { statusCode = 401; message = 'Invalid token'; }
  if (err.name === 'TokenExpiredError') { statusCode = 401; message = 'Token expired. Please log in again.'; }

  // ── Multer file errors ─────────────────────────────────
  if (err.code === 'LIMIT_FILE_SIZE') { statusCode = 400; message = 'File too large. Maximum size is 5MB.'; }

  // ── Structured error logging ───────────────────────────
  const logData = {
    correlationId: req.correlationId,
    method:        req.method,
    url:           req.originalUrl,
    statusCode,
    errorName:     err.name,
    stack:         process.env.NODE_ENV === 'development' ? err.stack : undefined,
    userId:        req.user?.id,
  };

  if (statusCode >= 500) {
    logger.error(`💥 ${message}`, logData);
  } else if (statusCode >= 400) {
    logger.warn(`⚠️  ${message}`, logData);
  }

  res.status(statusCode).json({
    success: false,
    message,
    // Only send stack trace in development
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    // Include correlation ID so users can report it
    correlationId: req.correlationId,
  });
};

module.exports = errorHandler;
