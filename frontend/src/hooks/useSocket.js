import { useEffect, useRef, useCallback, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';

// ── Singleton socket instance ──────────────────────────
// We only want ONE connection per browser session
let socketInstance = null;

export const useSocket = () => {
  const { token, user } = useAuth();
  const socketRef = useRef(null);
  const [socket, setSocket] = useState(socketInstance);

  useEffect(() => {
    if (!token || !user) {
      socketRef.current = null;
      setSocket(null);
      return;
    }

    // Reuse existing connection if already connected
    if (socketInstance) {
      socketRef.current = socketInstance;
      setSocket(socketInstance);
      return;
    }

    // Create new Socket.io connection
    const socket = io(
      process.env.REACT_APP_SOCKET_URL || 'http://localhost:8080',
      {
        auth:            { token },           // Send JWT for auth
        withCredentials: true,                // Send cookies
        transports:      ['websocket', 'polling'], // Try WebSocket first, fall back to polling
        reconnection:    true,
        reconnectionDelay:    1000,
        reconnectionAttempts: 5,
      }
    );

    socket.on('connect', () => {
      console.log('🔌 Socket connected:', socket.id);
    });

    socket.on('connect_error', (err) => {
      console.warn('🔌 Socket connection error:', err.message);
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 Socket disconnected:', reason);
    });

    socketInstance  = socket;
    socketRef.current = socket;
    setSocket(socket);

    // Cleanup on unmount
    return () => {
      // Don't disconnect on component unmount — keep connection alive
      // Only disconnect when user logs out (handled in AuthContext)
    };
  }, [token, user]);

  return socket || socketRef.current;
};

// ── Hook for ticket-specific real-time events ──────────
export const useTicketSocket = (ticketId, callbacks) => {
  const socket = useSocket();

  useEffect(() => {
    if (!socket || !ticketId) return;

    // Join this ticket's room
    socket.emit('join_ticket', ticketId);
    console.log(`📋 Joined ticket room: ${ticketId}`);

    // Listen for new replies
    if (callbacks.onNewReply) {
      socket.on('ticket:new_reply', (data) => {
        if (data.ticketId === ticketId) callbacks.onNewReply(data);
      });
    }

    // Listen for ticket updates (status, priority changes)
    if (callbacks.onTicketUpdated) {
      socket.on('ticket:updated', (data) => {
        if (data.ticket._id === ticketId) callbacks.onTicketUpdated(data);
      });
    }

    // Listen for typing indicators
    if (callbacks.onTyping) {
      socket.on('user_typing',         callbacks.onTyping);
      socket.on('user_stopped_typing', callbacks.onStopTyping || (() => {}));
    }

    // Cleanup: leave room when component unmounts
    return () => {
      socket.emit('leave_ticket', ticketId);
      socket.off('ticket:new_reply');
      socket.off('ticket:updated');
      socket.off('user_typing');
      socket.off('user_stopped_typing');
      console.log(`📋 Left ticket room: ${ticketId}`);
    };
  }, [socket, ticketId, callbacks]);

  // Emit typing event
  const emitTyping = useCallback((isTyping) => {
    if (!socket) return;
    socket.emit(isTyping ? 'typing_start' : 'typing_stop', { ticketId });
  }, [socket, ticketId]);

  return { emitTyping };
};

// ── Hook for global notifications ─────────────────────
export const useNotifications = (callbacks) => {
  const socket = useSocket();

  useEffect(() => {
    if (!socket) return;

    if (callbacks.onNewTicket) {
      socket.on('ticket:new',         callbacks.onNewTicket);
    }
    if (callbacks.onAssigned) {
      socket.on('ticket:assigned',    callbacks.onAssigned);
    }
    if (callbacks.onReply) {
      socket.on('notification:new_reply', callbacks.onReply);
    }
    if (callbacks.onStatusChange) {
      socket.on('ticket:status_changed', callbacks.onStatusChange);
    }
    if (callbacks.onOnlineCount) {
      socket.on('online_count',       callbacks.onOnlineCount);
    }
    if (callbacks.onChatMessage) {
      socket.on('chat:message', callbacks.onChatMessage);
    }

    return () => {
      socket.off('ticket:new');
      socket.off('ticket:assigned');
      socket.off('notification:new_reply');
      socket.off('ticket:status_changed');
      socket.off('online_count');
      socket.off('chat:message');
    };
  }, [socket, callbacks]);
};
