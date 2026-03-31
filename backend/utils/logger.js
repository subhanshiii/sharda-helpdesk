/**
 * Winston Logger
 *
 * Structured logging with:
 * - Log levels (error, warn, info, http, debug)
 * - JSON format in production (parseable by tools like DataDog, ELK)
 * - Human-readable format in development
 * - Separate files for errors and combined logs
 * - Request correlation IDs for tracing
 */

const winston   = require('winston');
const path      = require('path');
const fs        = require('fs');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

// ── Custom log format for development ─────────────────
const devFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? `\n  ${JSON.stringify(meta, null, 2)}` : '';
    return `[${timestamp}] ${level}: ${message}${metaStr}`;
  })
);

// ── JSON format for production ─────────────────────────
// Machine-readable, can be ingested by log aggregation tools
const prodFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// ── Create logger ──────────────────────────────────────
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),

  format: process.env.NODE_ENV === 'production' ? prodFormat : devFormat,

  defaultMeta: {
    service: 'sharda-helpdesk',
    version: process.env.npm_package_version || '3.0.0',
    environment: process.env.NODE_ENV || 'development',
  },

  transports: [
    // Console output
    new winston.transports.Console(),

    // Error log file — only errors and above
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level:    'error',
      maxsize:  5 * 1024 * 1024, // 5MB max
      maxFiles: 5,               // Keep 5 rotated files
      format:   winston.format.combine(winston.format.timestamp(), winston.format.json()),
    }),

    // Combined log file — all levels
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize:  10 * 1024 * 1024, // 10MB max
      maxFiles: 10,
      format:   winston.format.combine(winston.format.timestamp(), winston.format.json()),
    }),
  ],

  // Don't crash on uncaught exceptions — log them
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log'),
      format:   winston.format.combine(winston.format.timestamp(), winston.format.json()),
    }),
  ],

  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log'),
      format:   winston.format.combine(winston.format.timestamp(), winston.format.json()),
    }),
  ],
});

module.exports = logger;
