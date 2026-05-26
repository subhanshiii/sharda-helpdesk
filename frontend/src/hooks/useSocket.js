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
  const {
    onNewReply,
    onTicketUpdated,
    onTyping,
    onStopTyping,
  } = callbacks || {};

  useEffect(() => {
    if (!socket || !ticketId) return;

    const onTicketError = (data) => {
      if (data?.ticketId === ticketId) {
        console.warn('Ticket realtime:', data.message || 'Not authorized');
      }
    };
    socket.on('ticket:error', onTicketError);

    // Join this ticket's room (server validates access like GET /api/tickets/:id)
    socket.emit('join_ticket', ticketId);

    // Listen for new replies
    const handleNewReply = (data) => {
      if (data.ticketId === ticketId) onNewReply?.(data);
    };
    if (onNewReply) {
      socket.on('ticket:new_reply', handleNewReply);
    }

    // Listen for ticket updates (status, priority changes)
    const handleTicketUpdated = (data) => {
      if (data.ticket._id === ticketId) onTicketUpdated?.(data);
    };
    if (onTicketUpdated) {
      socket.on('ticket:updated', handleTicketUpdated);
    }

    // Listen for typing indicators
    const handleTyping = (data) => onTyping?.(data);
    const handleStopTyping = (data) => onStopTyping?.(data);
    if (onTyping) {
      socket.on('user_typing', handleTyping);
      socket.on('user_stopped_typing', handleStopTyping);
    }

    // Cleanup: leave room when component unmounts
    return () => {
      socket.emit('leave_ticket', ticketId);
      socket.off('ticket:error', onTicketError);
      socket.off('ticket:new_reply', handleNewReply);
      socket.off('ticket:updated', handleTicketUpdated);
      socket.off('user_typing', handleTyping);
      socket.off('user_stopped_typing', handleStopTyping);
      console.log(`📋 Left ticket room: ${ticketId}`);
    };
  }, [socket, ticketId, onNewReply, onTicketUpdated, onTyping, onStopTyping]);

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
  const {
    onNewTicket,
    onAssigned,
    onReply,
    onStatusChange,
    onOnlineCount,
    onChatMessage,
  } = callbacks || {};

  useEffect(() => {
    if (!socket) return;

    if (onNewTicket) {
      socket.on('ticket:new', onNewTicket);
    }
    if (onAssigned) {
      socket.on('ticket:assigned', onAssigned);
    }
    if (onReply) {
      socket.on('notification:new_reply', onReply);
    }
    if (onStatusChange) {
      socket.on('ticket:status_changed', onStatusChange);
    }
    if (onOnlineCount) {
      socket.on('online_count', onOnlineCount);
    }
    if (onChatMessage) {
      socket.on('chat:message', onChatMessage);
    }

    return () => {
      socket.off('ticket:new', onNewTicket);
      socket.off('ticket:assigned', onAssigned);
      socket.off('notification:new_reply', onReply);
      socket.off('ticket:status_changed', onStatusChange);
      socket.off('online_count', onOnlineCount);
      socket.off('chat:message', onChatMessage);
    };
  }, [socket, onAssigned, onChatMessage, onNewTicket, onOnlineCount, onReply, onStatusChange]);
};
