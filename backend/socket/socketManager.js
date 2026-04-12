const { Server } = require('socket.io');
const { loadAuthenticatedUser } = require('../middleware/auth');
const { isPlatformAdmin } = require('../utils/permissionDefaults');
const User = require('../models/User');
const Group = require('../models/Group');

const onlineUsers = new Map();

const initSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true,
      methods: ['GET', 'POST'],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.cookie
          ?.split(';')
          .find(c => c.trim().startsWith('token='))
          ?.split('=')[1];
      if (!token) return next(new Error('Authentication required'));
      const user = await loadAuthenticatedUser(token);
      socket.user = user;
      next();
    } catch (err) {
      if (err.name === 'TokenExpiredError') return next(new Error('Session expired. Please log in again.'));
      if (err.statusCode === 403 && err.message) return next(new Error(err.message));
      if (err.statusCode === 401 && err.message) return next(new Error(err.message));
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.user;
    socket.allowedTicketRooms = new Set();
    console.log(`🔌 ${user.name} (${user.role}) connected`);
    onlineUsers.set(user._id.toString(), socket.id);
    io.emit('online_count', onlineUsers.size);
    socket.join(`user:${user._id}`);

    const emitToGroupAudience = async (groupId, event, payload) => {
      const [groupMembers, admins] = await Promise.all([
        Group.findById(groupId).select('members.user'),
        User.find({ role: 'admin', isActive: true }).select('_id'),
      ]);

      const recipientIds = new Set(admins.map((admin) => admin._id.toString()));
      if (groupMembers) {
        groupMembers.members.forEach((member) => {
          recipientIds.add(member.user.toString());
        });
      }

      recipientIds.forEach((recipientId) => {
        io.to(`user:${recipientId}`).emit(event, payload);
      });
    };

    // ── Ticket events (same access as GET /api/tickets/:id) ──
    socket.on('join_ticket', async (ticketId) => {
      try {
        if (!ticketId) return;
        const tid = String(ticketId);
        const ticketService = require('../services/ticketService');
        await ticketService.getTicketById(tid, user);
        socket.join(`ticket:${tid}`);
        socket.allowedTicketRooms.add(tid);
        socket.emit('ticket:joined', { ticketId: tid });
      } catch (err) {
        socket.emit('ticket:error', {
          ticketId: String(ticketId || ''),
          message: err.statusCode === 404 ? 'Ticket not found' : (err.message || 'Not authorized'),
        });
      }
    });
    socket.on('leave_ticket', (ticketId) => {
      const tid = String(ticketId || '');
      socket.leave(`ticket:${tid}`);
      socket.allowedTicketRooms?.delete(tid);
    });
    socket.on('typing_start', ({ ticketId }) => {
      const tid = String(ticketId || '');
      if (!socket.allowedTicketRooms?.has(tid)) return;
      socket.to(`ticket:${tid}`).emit('user_typing', { userId: user._id, userName: user.name, role: user.role });
    });
    socket.on('typing_stop', ({ ticketId }) => {
      const tid = String(ticketId || '');
      if (!socket.allowedTicketRooms?.has(tid)) return;
      socket.to(`ticket:${tid}`).emit('user_stopped_typing', { userId: user._id });
    });

    // ── Group chat events ──
    socket.on('group:join', async ({ groupId }) => {
      try {
        const group = await Group.findById(groupId).select('members.user isActive');
        const isMember = group?.members.some((member) => member.user.toString() === user._id.toString());

        if (!group?.isActive || (!isMember && !isPlatformAdmin(user))) {
          socket.emit('group:error', { message: 'Not authorized for this group' });
          return;
        }

        socket.join(`group:${groupId}`);
        socket.to(`group:${groupId}`).emit('group:user_online', { userId: user._id, userName: user.name, groupId });
        console.log(`💬 ${user.name} joined group:${groupId}`);
      } catch (err) { socket.emit('group:error', { message: 'Failed to join group' }); }
    });

    socket.on('group:leave', ({ groupId }) => {
      socket.leave(`group:${groupId}`);
      socket.to(`group:${groupId}`).emit('group:user_offline', { userId: user._id, groupId });
    });

    socket.on('chat:send', async ({ groupId, content }) => {
      try {
        if (!content?.trim()) return;
        const { saveMessage } = require('../services/groupChatService');
        const message = await saveMessage({ groupId, senderId: user._id, content: content.trim(), type: 'text' });
        await emitToGroupAudience(groupId, 'chat:message', message);
      } catch (err) {
        socket.emit('group:error', { message: err.statusCode === 403 ? 'You are not a member of this group' : 'Failed to send message' });
      }
    });

    socket.on('chat:typing_start', ({ groupId }) => socket.to(`group:${groupId}`).emit('chat:typing',      { userId: user._id, userName: user.name, groupId }));
    socket.on('chat:typing_stop',  ({ groupId }) => socket.to(`group:${groupId}`).emit('chat:stop_typing', { userId: user._id, groupId }));

    socket.on('chat:read', async ({ groupId }) => {
      try {
        const Message = require('../models/Message');
        await Message.updateMany(
          { group: groupId, sender: { $ne: user._id }, 'readBy.user': { $ne: user._id } },
          { $push: { readBy: { user: user._id, readAt: new Date() } } }
        );
        socket.to(`group:${groupId}`).emit('chat:read_receipt', { userId: user._id, groupId });
      } catch {}
    });

    socket.on('disconnect', () => {
      console.log(`🔌 ${user.name} disconnected`);
      socket.allowedTicketRooms?.clear?.();
      onlineUsers.delete(user._id.toString());
      io.emit('online_count', onlineUsers.size);
    });
  });

  return io;
};

const emitToUser   = (io, userId,   event, data) => io.to(`user:${userId}`).emit(event, data);
const emitToTicket = (io, ticketId, event, data) => io.to(`ticket:${ticketId}`).emit(event, data);
const emitToGroup  = (io, groupId,  event, data) => io.to(`group:${groupId}`).emit(event, data);
const emitToAll    = (io, event, data)            => io.emit(event, data);

module.exports = { initSocket, emitToUser, emitToTicket, emitToGroup, emitToAll, onlineUsers };
