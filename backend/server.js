const express       = require('express');
const http          = require('http');   // needed to share server with Socket.io
const cors          = require('cors');
const morgan        = require('morgan');
const dotenv        = require('dotenv');
const path          = require('path');
const cookieParser  = require('cookie-parser');

const connectDB     = require('./config/db');
const errorHandler  = require('./middleware/errorHandler');
const { initSocket } = require('./socket/socketManager');
const {
  helmetConfig, generalLimiter, mongoSanitize, hppProtection,
} = require('./middleware/security');

dotenv.config();
connectDB();

const app    = express();
// Create HTTP server separately so Socket.io can attach to same port
const server = http.createServer(app);

// ── Init Socket.io ─────────────────────────────────────
// Must happen before routes so controllers can access io
const io = initSocket(server);

// ── Make io accessible in controllers via req.io ───────
// This pattern avoids circular imports
app.use((req, res, next) => { req.io = io; next(); });

// ── Security middleware ────────────────────────────────
app.use(helmetConfig);
app.use(cors({
  origin:      process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods:     ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
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

app.get('/api/health', (req, res) => res.json({
  success: true, message: 'Sharda Platform API',
  version: '2.0.0', uptime: process.uptime(), timestamp: new Date(),
  sockets: require('./socket/socketManager').onlineUsers.size + ' online',
}));

app.use((req, res) => res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` }));
app.use(errorHandler);

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`\n🚀 Sharda Platform running on port ${PORT}`);
  console.log(`🔌 Socket.io real-time enabled`);
  console.log(`🔒 Security middleware active`);
});

module.exports = { app, server, io };

process.on('unhandledRejection', (err) => {
  console.error(`💥 Unhandled Rejection: ${err.message}`);
  server.close(() => process.exit(1));
});
