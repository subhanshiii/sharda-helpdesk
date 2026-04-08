const { Server } = require('socket.io');
const jwt  = require('jsonwebtoken');
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
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user    = await User.findById(decoded.id).select('-password');
      if (!user || !user.isActive) return next(new Error('User not found'));
      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.user;
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

    // ── Ticket events ──
    socket.on('join_ticket',   (ticketId) => { socket.join(`ticket:${ticketId}`); });
    socket.on('leave_ticket',  (ticketId) => { socket.leave(`ticket:${ticketId}`); });
    socket.on('typing_start',  ({ ticketId }) => socket.to(`ticket:${ticketId}`).emit('user_typing', { userId: user._id, userName: user.name, role: user.role }));
    socket.on('typing_stop',   ({ ticketId }) => socket.to(`ticket:${ticketId}`).emit('user_stopped_typing', { userId: user._id }));

    // ── Group chat events ──
    socket.on('group:join', async ({ groupId }) => {
      try {
        const group = await Group.findById(groupId).select('members.user isActive');
        const isMember = group?.members.some((member) => member.user.toString() === user._id.toString());

        if (!group?.isActive || (!isMember && user.role !== 'admin')) {
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
