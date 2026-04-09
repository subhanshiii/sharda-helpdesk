import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getNotificationLink, useNotificationContext } from '../context/NotificationContext';
import { useTheme } from '../context/ThemeContext';
import { FiBell, FiX, FiCheck } from 'react-icons/fi';
import { formatRelative } from '../utils/helpers';

const TYPE_CONFIG = {
  new_ticket: { icon:'🎫', color:'text-blue-600',  bg:'bg-blue-50'   },
  assigned:   { icon:'📋', color:'text-violet-600', bg:'bg-violet-50' },
  reply:      { icon:'💬', color:'text-green-600',  bg:'bg-green-50'  },
  status:     { icon:'🔄', color:'text-orange-600', bg:'bg-orange-50' },
  group_chat: { icon:'💬', color:'text-cyan-600', bg:'bg-cyan-50' },
};

export default function NotificationBell() {
  const { notifications, unreadCount, markAllRead, markRead } = useNotificationContext();
  const { isDark } = useTheme();
  const [open, setOpen] = useState(false);
  const ref  = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`relative p-2.5 rounded-xl transition-colors ${
          isDark
            ? 'text-slate-400 hover:text-sky-300 hover:bg-slate-800'
            : 'text-gray-400 hover:text-blue-700 hover:bg-blue-50'
        }`}>
        <FiBell size={19}/>
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className={`absolute right-0 top-12 w-80 rounded-2xl z-50 animate-fade-in-up overflow-hidden ${
          isDark
            ? 'bg-slate-950/95 border border-slate-700 shadow-2xl backdrop-blur-xl'
            : 'bg-white border border-gray-100 shadow-xl'
        }`}>
          <div className={`flex items-center justify-between px-4 py-3 ${
            isDark ? 'border-b border-slate-800' : 'border-b border-gray-100'
          }`}>
            <h3 className={`font-display font-bold text-sm ${isDark ? 'text-slate-100' : 'text-gray-900'}`}>Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                  <FiCheck size={11}/> Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} className={isDark ? 'text-slate-400 hover:text-slate-200' : 'text-gray-400 hover:text-gray-600'}>
                <FiX size={16}/>
              </button>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-10 text-center">
                <div className="text-3xl mb-2">🔔</div>
                <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-400'}`}>No notifications yet</p>
              </div>
            ) : (
              notifications.map(notif => {
                const cfg = TYPE_CONFIG[notif.type] || TYPE_CONFIG.reply;
                return (
                  <Link
                    key={notif.id}
                    to={getNotificationLink(notif)}
                    onClick={() => { markRead(notif.id); setOpen(false); }}
                    className={`flex items-start gap-3 px-4 py-3 transition-colors last:border-0 ${
                      isDark
                        ? `border-b border-slate-800 hover:bg-slate-900 ${!notif.read ? 'bg-slate-900/70' : ''}`
                        : `border-b border-gray-50 hover:bg-gray-50 ${!notif.read ? 'bg-blue-50/40' : ''}`
                    }`}>
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-base flex-shrink-0 ${cfg.bg}`}>
                      {cfg.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold ${notif.read ? (isDark ? 'text-slate-300' : 'text-gray-600') : (isDark ? 'text-slate-100' : 'text-gray-900')}`}>{notif.title}</p>
                      <p className={`text-xs line-clamp-2 mt-0.5 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>{notif.body}</p>
                      <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>{formatRelative(notif.timestamp)}</p>
                    </div>
                    {!notif.read && <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1"/>}
                  </Link>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
