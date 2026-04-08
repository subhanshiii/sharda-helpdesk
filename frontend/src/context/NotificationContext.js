import React, { createContext, useContext, useState } from 'react';
import { useNotifications } from '../hooks/useSocket';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [onlineCount,   setOnlineCount]   = useState(0);

  const addNotification = (notif) => {
    const newNotif = {
      id:        Date.now(),
      ...notif,
      read:      false,
      timestamp: new Date(),
    };
    setNotifications(prev => [newNotif, ...prev].slice(0, 20)); // keep last 20
    setUnreadCount(prev => prev + 1);
  };

  useNotifications({
    onNewTicket: (data) => {
      addNotification({ type: 'new_ticket', title: 'New Ticket', body: data.message, ticketId: data.ticket._id });
      toast('🎫 ' + data.message, { duration: 4000 });
    },
    onAssigned: (data) => {
      addNotification({ type: 'assigned', title: 'Ticket Assigned', body: data.message, ticketId: data.ticketId });
      toast.success('📋 ' + data.message);
    },
    onReply: (data) => {
      addNotification({ type: 'reply', title: 'New Reply', body: data.message, ticketId: data.ticketId });
      toast('💬 ' + data.message, { duration: 4000 });
    },
    onStatusChange: (data) => {
      addNotification({ type: 'status', title: 'Ticket Updated', body: data.message, ticketId: data.ticketId });
      toast('🔄 ' + data.message, { duration: 4000 });
    },
    onOnlineCount: (count) => setOnlineCount(count),
    onChatMessage: (message) => {
      const senderId = message.sender?._id || message.sender;
      if (!message?.group || senderId === user?._id) return;

      addNotification({
        type: 'group_chat',
        title: message.group?.name || 'New Group Message',
        body: message.type === 'system'
          ? message.systemMessage
          : `${message.sender?.name || 'Someone'}: ${message.content || (message.file ? 'Sent an attachment' : 'New message')}`,
        groupId: message.group?._id || message.group,
      });

      toast(message.group?.name ? `New message in ${message.group.name}` : 'New group message', {
        duration: 3000,
      });
    },
  });

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const markRead = (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, onlineCount, markAllRead, markRead }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotificationContext = () => useContext(NotificationContext);
