const express        = require('express');
const http           = require('http');
const cors           = require('cors');
const dotenv         = require('dotenv');
const path           = require('path');
const cookieParser   = require('cookie-parser');

const connectDB      = require('./config/db');
const { getRedisClient } = require('./config/redis');
const { initSocket } = require('./socket/socketManager');
const errorHandler   = require('./middleware/errorHandler');
const requestLogger  = require('./middleware/requestLogger');
const { trackRequest, getMetrics } = require('./middleware/performanceMonitor');
const {
  helmetConfig, generalLimiter, mongoSanitize, hppProtection,
} = require('./middleware/security');
const logger = require('./utils/logger');

dotenv.config();

// ── Connect databases ──────────────────────────────────
connectDB();

const redisClient = getRedisClient();
redisClient.connect().catch(() => {
  logger.warn('Redis unavailable — caching disabled');
});

// ── Initialize queue worker ────────────────────────────
require('./queues/emailQueue');
logger.info('📬 Email queue worker initialized');

const app    = express();
const server = http.createServer(app);
const io     = initSocket(server);

// Make io available in all controllers
app.use((req, res, next) => { req.io = io; next(); });

// ── Security ───────────────────────────────────────────
app.use(helmetConfig);
app.use(cors({
  origin:         process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials:    true,
  methods:        ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID'],
  exposedHeaders: ['X-Correlation-ID'],
}));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));
app.use(cookieParser());
app.use(mongoSanitize);
app.use(hppProtection);

// ── Observability ──────────────────────────────────────
app.use(trackRequest);   // Performance metrics collection
app.use(requestLogger);  // Structured request/response logging

// ── Static files ───────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/', generalLimiter);

// ── Routes ─────────────────────────────────────────────
app.use('/api/auth',              require('./routes/authRoutes'));
app.use('/api/tickets',           require('./routes/ticketRoutes'));
app.use('/api/users',             require('./routes/userRoutes'));
app.use('/api/stats',             require('./routes/statsRoutes'));
app.use('/api/announcements',     require('./routes/announcementRoutes'));
app.use('/api/opportunities',     require('./routes/opportunityRoutes'));
app.use('/api/events',            require('./routes/eventRoutes'));
app.use('/api/chat',              require('./routes/chatRoutes'));
app.use('/api/academic-calendar', require('./routes/academicCalendarRoutes'));
app.use('/api/queue',             require('./routes/queueRoutes'));

// ── Health + Metrics endpoint ──────────────────────────
app.get('/api/health', async (req, res) => {
  const { getQueueStats } = require('./queues/emailQueue');
  const { onlineUsers }   = require('./socket/socketManager');

  let redisStatus = 'disconnected';
  try { await redisClient.ping(); redisStatus = 'connected'; } catch {}

  const [queueStats, perfMetrics] = await Promise.all([
    getQueueStats().catch(() => null),
    Promise.resolve(getMetrics()),
  ]);

  res.json({
    success:   true,
    version:   '4.0.0',
    timestamp: new Date(),
    services: {
      database:   'connected',
      redis:      redisStatus,
      sockets:    `${onlineUsers.size} users online`,
      emailQueue: queueStats,
    },
    performance: perfMetrics,
  });
});

// ── 404 ────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// ── Error handler (must be last) ───────────────────────
app.use(errorHandler);

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  logger.info(`🚀 Sharda Platform v4.0 running on port ${PORT}`, {
    port: PORT, environment: process.env.NODE_ENV,
    features: ['Socket.io', 'Redis Cache', 'Bull Queue', 'Winston Logging', 'Performance Monitor'],
  });
});

module.exports = { app, server, io };

process.on('unhandledRejection', (err) => {
  logger.error('💥 Unhandled Rejection', { error: err.message, stack: err.stack });
  server.close(() => process.exit(1));
});
process.on('uncaughtException', (err) => {
  logger.error('💥 Uncaught Exception', { error: err.message, stack: err.stack });
  process.exit(1);
});
