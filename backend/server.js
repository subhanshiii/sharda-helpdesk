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
const { ensureInitialAdmin } = require('./utils/bootstrapAdmin');
const { backfillMissingSystemIds } = require('./services/userProvisioningService');
const { runAutomaticStudentPromotions } = require('./services/academicPromotionService');
const { backfillAcademicSessionRefs, migrateAcademicIndexes } = require('./utils/academicSetupService');
const { migrateAssignmentIndexes } = require('./utils/assignmentMigration');
const { backfillDerivedAcademicFields } = require('./utils/userAcademicContext');
const { migrateGroupChatIndexes } = require('./utils/groupChatMigration');
const AcademicSession = require('./models/AcademicSession');

// Load security middleware (graceful if packages missing)
let helmetConfig = (req,res,next) => next();
let mongoSanitize  = (req,res,next) => next();
let hppProtection  = (req,res,next) => next();

try {
  const sec = require('./middleware/security');
  helmetConfig  = sec.helmetConfig;
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

// Redis (optional — caching, chat, Bull email queue)
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
  methods:        ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','X-Correlation-ID','x-preview-role','x-preview-tier'],
}));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));
app.use(cookieParser());
try {
  const requestLogger = require('./middleware/requestLogger');
  app.use(requestLogger);
} catch {}
app.use(mongoSanitize);
app.use(hppProtection);

if (process.env.NODE_ENV === 'development') app.use(morgan('dev'));

// Uploads are not served publicly — use GET /api/files/general|chat/:filename (+ JWT or ?token=)
app.use('/uploads', (req, res) => {
  res.status(403).json({
    success: false,
    message: 'Use /api/files/general/… or /api/files/chat/… with authentication.',
  });
});
app.use('/avatars', express.static(path.join(__dirname, '../frontend/public/avatars')));

app.use(trackRequest);

// ── Routes ─────────────────────────────────────────────
// All routes are mounted under both /api/ (legacy) and /api/v1/ (versioned).
// When v2 is needed, add a new set of routes under /api/v2/ without breaking v1.
const routeTable = [
  ['auth',              require('./routes/authRoutes')],
  ['verify-email',      require('./routes/emailVerificationRoutes')],
  ['tickets',           require('./routes/ticketRoutes')],
  ['users',             require('./routes/userRoutes')],
  ['admin-scope',       require('./routes/adminScopeRoutes')],
  ['academics',         require('./routes/academicRoutes')],
  ['stats',             require('./routes/statsRoutes')],
  ['dashboard',         require('./routes/dashboardRoutes')],
  ['content',           require('./routes/contentRoutes')],
  ['assignments',       require('./routes/assignmentRoutes')],
  ['announcements',     require('./routes/announcementRoutes')],
  ['opportunities',     require('./routes/opportunityRoutes')],
  ['events',            require('./routes/eventRoutes')],
  ['chat',              require('./routes/chatRoutes')],
  ['files',             require('./routes/fileRoutes')],
  ['academic-calendar', require('./routes/academicCalendarRoutes')],
  ['chat-groups',       require('./routes/groupChatRoutes')],
  ['permissions',       require('./routes/permissionRoutes')],
  ['motivation',        require('./routes/motivationRoutes')],
  ['resources',         require('./routes/resourceRoutes')],
];

routeTable.forEach(([name, router]) => {
  app.use(`/api/${name}`,    router);  // legacy (backward-compatible)
  app.use(`/api/v1/${name}`, router);  // versioned
});

// Queue routes (optional)
try { app.use('/api/queue', require('./routes/queueRoutes')); app.use('/api/v1/queue', require('./routes/queueRoutes')); } catch {}

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
const startServer = async () => {
  try {
    await connectDB();
    await migrateAcademicIndexes();
    await migrateAssignmentIndexes();
    await migrateGroupChatIndexes(logger);
    await backfillAcademicSessionRefs();
    await backfillDerivedAcademicFields();
    await backfillMissingSystemIds();
    await ensureInitialAdmin(logger);
    const promotionSummary = await runAutomaticStudentPromotions();
    const academicSessionCount = await AcademicSession.countDocuments();

    server.listen(PORT, () => {
      logger.info(`🚀 Sharda Platform v5.0 running on port ${PORT}`);
      logger.info(`💬 Group Chat: enabled`);
      logger.info(`🔌 Socket.io:  real-time enabled`);
      logger.info(`📚 AcademicSession collection count: ${academicSessionCount}`);
      logger.info(`🎓 Auto-promotion sync: ${promotionSummary.promoted} promoted, ${promotionSummary.completed} completed`);
    });
  } catch (error) {
    logger.error(`Startup bootstrap failed: ${error.message}`);
    process.exit(1);
  }
};

startServer();

module.exports = { app, server, io };

process.on('unhandledRejection', (err) => {
  logger.error(`💥 Unhandled Rejection: ${err.message}`);
  server.close(() => process.exit(1));
});
