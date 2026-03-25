const express      = require('express');
const cors         = require('cors');
const morgan       = require('morgan');
const dotenv       = require('dotenv');
const path         = require('path');
const cookieParser = require('cookie-parser');

const connectDB    = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const {
  helmetConfig,
  generalLimiter,
  mongoSanitize,
  hppProtection,
} = require('./middleware/security');

dotenv.config();
connectDB();

const app = express();

// ── Security middleware (ORDER MATTERS) ────────────────
app.use(helmetConfig);           // Set secure HTTP headers
app.use(cors({
  origin:      process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,             // Required for cookies
  methods:     ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));
app.use(express.json({ limit: '10kb' }));        // Limit payload size — prevents large payload DoS
app.use(express.urlencoded({ extended: false, limit: '10kb' }));
app.use(cookieParser());         // Parse httpOnly cookies
app.use(mongoSanitize);          // Prevent MongoDB injection
app.use(hppProtection);          // Prevent HTTP param pollution

// ── Logging ────────────────────────────────────────────
if (process.env.NODE_ENV === 'development') app.use(morgan('dev'));

// ── Static files ───────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Apply general rate limit to all API routes ─────────
app.use('/api/', generalLimiter);

// ── Routes (versioned) ─────────────────────────────────
// Using /api/v1/ prefix — industry standard for API versioning
// Allows us to make breaking changes in v2 without breaking v1 clients
app.use('/api/v1/auth',              require('./routes/authRoutes'));
app.use('/api/v1/tickets',           require('./routes/ticketRoutes'));
app.use('/api/v1/users',             require('./routes/userRoutes'));
app.use('/api/v1/stats',             require('./routes/statsRoutes'));
app.use('/api/v1/announcements',     require('./routes/announcementRoutes'));
app.use('/api/v1/opportunities',     require('./routes/opportunityRoutes'));
app.use('/api/v1/events',            require('./routes/eventRoutes'));
app.use('/api/v1/chat',              require('./routes/chatRoutes'));
app.use('/api/v1/academic-calendar', require('./routes/academicCalendarRoutes'));

// ── Backward compat: redirect old /api/ to /api/v1/ ───
// This ensures existing frontend calls still work during migration
app.use('/api/auth',              require('./routes/authRoutes'));
app.use('/api/tickets',           require('./routes/ticketRoutes'));
app.use('/api/users',             require('./routes/userRoutes'));
app.use('/api/stats',             require('./routes/statsRoutes'));
app.use('/api/announcements',     require('./routes/announcementRoutes'));
app.use('/api/opportunities',     require('./routes/opportunityRoutes'));
app.use('/api/events',            require('./routes/eventRoutes'));
app.use('/api/chat',              require('./routes/chatRoutes'));
app.use('/api/academic-calendar', require('./routes/academicCalendarRoutes'));

// ── Health check ───────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    success:   true,
    message:   'Sharda University Platform API',
    version:   '1.0.0',
    timestamp: new Date(),
    uptime:    process.uptime(),
  });
});

// ── 404 handler ────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// ── Global error handler (must be last) ───────────────
app.use(errorHandler);

const PORT = process.env.PORT || 8080;

const server = app.listen(PORT, () => {
  console.log(`\n🚀 Sharda Platform running on port ${PORT}`);
  console.log(`🔒 Security: Helmet + Rate Limiting + Mongo Sanitize enabled`);
  console.log(`📡 API v1: http://localhost:${PORT}/api/v1`);
});

// ── Export server for WebSocket use later ─────────────
module.exports = { app, server };

process.on('unhandledRejection', (err) => {
  console.error(`💥 Unhandled Rejection: ${err.message}`);
  server.close(() => process.exit(1));
});

process.on('uncaughtException', (err) => {
  console.error(`💥 Uncaught Exception: ${err.message}`);
  process.exit(1);
});
