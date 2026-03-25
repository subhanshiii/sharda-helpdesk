const express       = require('express');
const http          = require('http');
const cors          = require('cors');
const morgan        = require('morgan');
const dotenv        = require('dotenv');
const path          = require('path');
const cookieParser  = require('cookie-parser');

const connectDB      = require('./config/db');
const { getRedisClient } = require('./config/redis');
const { initSocket } = require('./socket/socketManager');
const errorHandler  = require('./middleware/errorHandler');
const {
  helmetConfig, generalLimiter, mongoSanitize, hppProtection,
} = require('./middleware/security');

dotenv.config();

// ── Connect databases ──────────────────────────────────
connectDB();

// ── Connect Redis (non-blocking — app works without it) ─
const redisClient = getRedisClient();
redisClient.connect().catch(() => {
  console.warn('⚠️  Redis unavailable — caching disabled, app continues without it');
});

// ── Initialize email queue ─────────────────────────────
// This starts the Bull worker that processes email jobs
require('./queues/emailQueue');
console.log('📬 Email queue worker initialized');

const app    = express();
const server = http.createServer(app);

// ── Init Socket.io ─────────────────────────────────────
const io = initSocket(server);
app.use((req, res, next) => { req.io = io; next(); });

// ── Security middleware ────────────────────────────────
app.use(helmetConfig);
app.use(cors({
  origin:         process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials:    true,
  methods:        ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));
app.use(cookieParser());
app.use(mongoSanitize);
app.use(hppProtection);

if (process.env.NODE_ENV === 'development') app.use(morgan('dev'));
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

// ── Health check with system status ───────────────────
app.get('/api/health', async (req, res) => {
  const { getQueueStats } = require('./queues/emailQueue');
  const { onlineUsers }   = require('./socket/socketManager');

  let redisStatus = 'disconnected';
  try {
    await redisClient.ping();
    redisStatus = 'connected';
  } catch {}

  const queueStats = await getQueueStats().catch(() => null);

  res.json({
    success:   true,
    version:   '3.0.0',
    timestamp: new Date(),
    uptime:    `${Math.floor(process.uptime())}s`,
    services: {
      database:  'connected',
      redis:     redisStatus,
      sockets:   `${onlineUsers.size} users online`,
      emailQueue: queueStats,
    },
  });
});

app.use((req, res) =>
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` })
);
app.use(errorHandler);

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`\n🚀 Sharda Platform v3.0 running on port ${PORT}`);
  console.log(`🔌 Socket.io    — real-time enabled`);
  console.log(`⚡ Redis        — caching enabled`);
  console.log(`📬 Bull Queue   — async email enabled`);
  console.log(`🔒 Security     — helmet + rate limiting + sanitize`);
  console.log(`\n📡 Health: http://localhost:${PORT}/api/health`);
});

module.exports = { app, server, io };

process.on('unhandledRejection', (err) => {
  console.error(`💥 Unhandled Rejection: ${err.message}`);
  server.close(() => process.exit(1));
});
process.on('uncaughtException', (err) => {
  console.error(`💥 Uncaught Exception: ${err.message}`);
  process.exit(1);
});
