const express  = require('express');
const cors     = require('cors');
const morgan   = require('morgan');
const dotenv   = require('dotenv');
const path     = require('path');
const connectDB    = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

dotenv.config();
connectDB();

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
if (process.env.NODE_ENV === 'development') app.use(morgan('dev'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth',          require('./routes/authRoutes'));
app.use('/api/tickets',       require('./routes/ticketRoutes'));
app.use('/api/users',         require('./routes/userRoutes'));
app.use('/api/stats',         require('./routes/statsRoutes'));
app.use('/api/announcements', require('./routes/announcementRoutes'));
app.use('/api/opportunities', require('./routes/opportunityRoutes'));
app.use('/api/events',        require('./routes/eventRoutes'));

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Sharda Helpdesk API is running', timestamp: new Date() });
});

app.use(errorHandler);

const PORT = process.env.PORT || 8080;
const server = app.listen(PORT, () => {
  console.log(`\n🚀 Sharda Platform Server running on port ${PORT}`);
  console.log(`📡 API: http://localhost:${PORT}/api`);
});

process.on('unhandledRejection', (err) => {
  console.error(`Unhandled Rejection: ${err.message}`);
  server.close(() => process.exit(1));
});
