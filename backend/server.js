const express      = require('express');
const http         = require('http');
const cors         = require('cors');
const morgan       = require('morgan');
const dotenv       = require('dotenv');
const path         = require('path');
const cookieParser = require('cookie-parser');

const connectDB    = require('./config/db');
const { initSocket } = require('./socket/socketManager');
const errorHandler = require('./middleware/errorHandler');

// Load security middleware (graceful if packages missing)
let helmetConfig = (req,res,next) => next();
let generalLimiter = (req,res,next) => next();
let mongoSanitize  = (req,res,next) => next();
let hppProtection  = (req,res,next) => next();

try {
  const sec = require('./middleware/security');
  helmetConfig  = sec.helmetConfig;
  generalLimiter= sec.generalLimiter;
  mongoSanitize = sec.mongoSanitize;
  hppProtection = sec.hppProtection;
} catch {}

// Load logger (graceful if winston missing)
let logger = { info: console.log, warn: console.warn, error: console.error };
try { logger = require('./utils/logger'); } catch {}

// Load performance monitor (graceful)
let trackRequest = (req,res,next) => next();
let getMetrics   = () => ({});
try {
  const pm = require('./middleware/performanceMonitor');
  trackRequest = pm.trackRequest;
  getMetrics   = pm.getMetrics;
} catch {}

dotenv.config();
connectDB();

// Redis (optional)
try {
  const { getRedisClient } = require('./config/redis');
  const redis = getRedisClient();
  redis.connect().catch(() => logger.warn('Redis unavailable'));
  require('./queues/emailQueue');
} catch {}

const app    = express();
const server = http.createServer(app);
const io     = initSocket(server);

app.use((req, res, next) => { req.io = io; next(); });

app.use(helmetConfig);
app.use(cors({
  origin:         process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials:    true,
  methods:        ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','X-Correlation-ID'],
}));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));
app.use(cookieParser());
app.use(mongoSanitize);
app.use(hppProtection);

if (process.env.NODE_ENV === 'development') app.use(morgan('dev'));

// Static files — serve uploads
app.use('/uploads',      express.static(path.join(__dirname, 'uploads')));
app.use('/uploads/chat', express.static(path.join(__dirname, 'uploads/chat')));

app.use('/api/', generalLimiter);
app.use(trackRequest);

// ── Routes ─────────────────────────────────────────────
app.use('/api/auth',              require('./routes/authRoutes'));
app.use('/api/tickets',           require('./routes/ticketRoutes'));
app.use('/api/users',             require('./routes/userRoutes'));
app.use('/api/academics',         require('./routes/academicRoutes'));
app.use('/api/stats',             require('./routes/statsRoutes'));
app.use('/api/dashboard',         require('./routes/dashboardRoutes'));
app.use('/api/content',           require('./routes/contentRoutes'));
app.use('/api/assignments',       require('./routes/assignmentRoutes'));
app.use('/api/announcements',     require('./routes/announcementRoutes'));
app.use('/api/opportunities',     require('./routes/opportunityRoutes'));
app.use('/api/events',            require('./routes/eventRoutes'));
app.use('/api/chat',              require('./routes/chatRoutes'));
app.use('/api/files',             require('./routes/fileRoutes'));
app.use('/api/academic-calendar', require('./routes/academicCalendarRoutes'));
app.use('/api/chat-groups',       require('./routes/groupChatRoutes'));  // ← NEW
app.use('/api/permissions',       require('./routes/permissionRoutes'));
app.use('/api/motivation',        require('./routes/motivationRoutes'));

// Queue routes (optional)
try { app.use('/api/queue', require('./routes/queueRoutes')); } catch {}

app.get('/api/health', async (req, res) => {
  const { onlineUsers } = require('./socket/socketManager');
  res.json({
    success:   true,
    version:   '5.0.0',
    timestamp: new Date(),
    uptime:    `${Math.floor(process.uptime())}s`,
    services: {
      database:   'connected',
      sockets:    `${onlineUsers.size} users online`,
    },
    performance: getMetrics(),
  });
});

app.use((req, res) => res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` }));
app.use(errorHandler);

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  logger.info(`🚀 Sharda Platform v5.0 running on port ${PORT}`);
  logger.info(`💬 Group Chat: enabled`);
  logger.info(`🔌 Socket.io:  real-time enabled`);
});

module.exports = { app, server, io };

process.on('unhandledRejection', (err) => {
  logger.error(`💥 Unhandled Rejection: ${err.message}`);
  server.close(() => process.exit(1));
});
