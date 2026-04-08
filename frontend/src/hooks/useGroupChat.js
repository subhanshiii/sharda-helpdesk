import { useEffect, useRef, useCallback, useState } from 'react';
import { useSocket } from './useSocket';

export const useGroupChat = (groupId, initialMessages = []) => {
  const socket = useSocket();
  const [messages, setMessages]           = useState(initialMessages);
  const [typingUsers, setTypingUsers]     = useState([]);
  const [onlineMembers, setOnlineMembers] = useState([]);
  const [isConnected, setIsConnected]     = useState(false);
  const typingTimers = useRef({});

  useEffect(() => {
    if (!socket || !groupId) return;
    socket.emit('group:join', { groupId });
    setIsConnected(true);

    const onMessage = (message) => {
      setMessages(prev => {
        const exists = prev.some(m => m._id === message._id);
        if (exists) return prev;
        return [...prev, message];
      });
      setTypingUsers(prev => prev.filter(u => u.userId !== message.sender?._id));
    };

    const onMessageDeleted = ({ messageId }) => {
      setMessages(prev => prev.map(m =>
        m._id === messageId ? { ...m, isDeleted: true, content: null } : m
      ));
    };

    const onTyping = ({ userId, userName }) => {
      setTypingUsers(prev => {
        const exists = prev.some(u => u.userId === userId);
        if (exists) return prev;
        return [...prev, { userId, userName }];
      });
      clearTimeout(typingTimers.current[userId]);
      typingTimers.current[userId] = setTimeout(() => {
        setTypingUsers(prev => prev.filter(u => u.userId !== userId));
      }, 3000);
    };

    const onStopTyping  = ({ userId }) => { clearTimeout(typingTimers.current[userId]); setTypingUsers(prev => prev.filter(u => u.userId !== userId)); };
    const onUserOnline  = ({ userId, userName }) => setOnlineMembers(prev => prev.some(u => u.userId === userId) ? prev : [...prev, { userId, userName }]);
    const onUserOffline = ({ userId }) => setOnlineMembers(prev => prev.filter(u => u.userId !== userId));

    socket.on('chat:message',         onMessage);
    socket.on('chat:message_deleted', onMessageDeleted);
    socket.on('chat:typing',          onTyping);
    socket.on('chat:stop_typing',     onStopTyping);
    socket.on('group:user_online',    onUserOnline);
    socket.on('group:user_offline',   onUserOffline);

    return () => {
      socket.emit('group:leave', { groupId });
      socket.off('chat:message',         onMessage);
      socket.off('chat:message_deleted', onMessageDeleted);
      socket.off('chat:typing',          onTyping);
      socket.off('chat:stop_typing',     onStopTyping);
      socket.off('group:user_online',    onUserOnline);
      socket.off('group:user_offline',   onUserOffline);
      setIsConnected(false);
    };
  }, [socket, groupId]);

  useEffect(() => { setMessages(initialMessages); }, [groupId]);

  const sendMessage    = useCallback((content) => { if (!socket || !content?.trim()) return false; socket.emit('chat:send', { groupId, content: content.trim() }); return true; }, [socket, groupId]);
  const startTyping    = useCallback(() => { if (socket) socket.emit('chat:typing_start', { groupId }); }, [socket, groupId]);
  const stopTyping     = useCallback(() => { if (socket) socket.emit('chat:typing_stop',  { groupId }); }, [socket, groupId]);
  const markAsRead     = useCallback(() => { if (socket) socket.emit('chat:read', { groupId }); }, [socket, groupId]);
  const prependMessages = useCallback((older) => setMessages(prev => [...older, ...prev]), []);

  return { messages, setMessages, prependMessages, typingUsers, onlineMembers, isConnected, sendMessage, startTyping, stopTyping, markAsRead };
};
