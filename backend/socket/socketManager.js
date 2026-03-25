const { Server } = require('socket.io');
const jwt  = require('jsonwebtoken');
const User = require('../models/User');

// Track online users: userId -> socketId
const onlineUsers = new Map();

const initSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin:      process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true,
      methods:     ['GET', 'POST'],
    },
    pingTimeout:  60000,
    pingInterval: 25000,
  });

  // ── Auth middleware ────────────────────────────────────
  // Every socket connection must provide a valid JWT
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.cookie
          ?.split(';')
          .find(c => c.trim().startsWith('token='))
          ?.split('=')[1];

      if (!token) return next(new Error('Authentication required'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user    = await User.findById(decoded.id).select('-password');

      if (!user || !user.isActive) return next(new Error('User not found'));

      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  // ── Connection handler ────────────────────────────────
  io.on('connection', (socket) => {
    const user = socket.user;
    console.log(`🔌 ${user.name} (${user.role}) connected`);

    // Track online status
    onlineUsers.set(user._id.toString(), socket.id);
    io.emit('online_count', onlineUsers.size);

    // Personal room for direct notifications
    socket.join(`user:${user._id}`);

    // Join ticket room when user opens a ticket
    socket.on('join_ticket', (ticketId) => {
      socket.join(`ticket:${ticketId}`);
      console.log(`📋 ${user.name} joined ticket:${ticketId}`);
    });

    // Leave ticket room when user navigates away
    socket.on('leave_ticket', (ticketId) => {
      socket.leave(`ticket:${ticketId}`);
    });

    // Typing indicators
    socket.on('typing_start', ({ ticketId }) => {
      socket.to(`ticket:${ticketId}`).emit('user_typing', {
        userId: user._id, userName: user.name, role: user.role,
      });
    });

    socket.on('typing_stop', ({ ticketId }) => {
      socket.to(`ticket:${ticketId}`).emit('user_stopped_typing', { userId: user._id });
    });

    socket.on('disconnect', () => {
      console.log(`🔌 ${user.name} disconnected`);
      onlineUsers.delete(user._id.toString());
      io.emit('online_count', onlineUsers.size);
    });
  });

  return io;
};

const emitToUser   = (io, userId,   event, data) => io.to(`user:${userId}`).emit(event, data);
const emitToTicket = (io, ticketId, event, data) => io.to(`ticket:${ticketId}`).emit(event, data);
const emitToAll    = (io, event, data)           => io.emit(event, data);

module.exports = { initSocket, emitToUser, emitToTicket, emitToAll, onlineUsers };
