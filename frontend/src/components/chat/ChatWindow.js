import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import API from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useGroupChat } from '../../hooks/useGroupChat';
import MessageBubble, { DateSeparator } from './MessageBubble';
import { isAdminUser } from '../../utils/access';
import toast from 'react-hot-toast';
import { ConfirmDialog } from '../ui';
import {
  FiSend, FiPaperclip, FiInfo, FiX,
  FiChevronUp, FiWifi, FiWifiOff,
} from 'react-icons/fi';

const TypingIndicator = memo(({ users }) => {
  if (!users.length) return null;
  const names = users.map(u => u.userName.split(' ')[0]).join(', ');
  return (
    <div className="flex items-center gap-3 px-4 py-2">
      <div className="w-8 h-8 rounded-xl bg-gray-200 flex items-center justify-center flex-shrink-0">
        <div className="flex gap-0.5">
          {[0,1,2].map(i => (
            <div key={i} className="w-1.5 h-1.5 rounded-full bg-gray-500"
              style={{ animation: `bounce 1s ease-in-out ${i * 0.2}s infinite` }} />
          ))}
        </div>
      </div>
      <p className="text-xs text-gray-500 italic">
        {names} {users.length === 1 ? 'is' : 'are'} typing...
      </p>
    </div>
  );
});

// ── Group into date sections for DateSeparator ─────────
const shouldShowDateSeparator = (curr, prev) => {
  if (!prev) return true;
  const currDate = new Date(curr.createdAt).toDateString();
  const prevDate = new Date(prev.createdAt).toDateString();
  return currDate !== prevDate;
};

// ── Should we show the avatar? (first message in a sequence from same sender)
const shouldShowAvatar = (curr, prev) => {
  if (!prev) return true;
  if (prev.type === 'system') return true;
  return prev.sender?._id !== curr.sender?._id;
};

export default function ChatWindow({ group, onGroupInfoClick }) {
  const { user }         = useAuth();
  const { isDark }       = useTheme();
  const messagesEndRef   = useRef(null);
  const inputRef         = useRef(null);
  const fileInputRef     = useRef(null);
  const typingTimerRef   = useRef(null);

  const [initialMessages, setInitialMessages] = useState([]);
  const [loadingHistory,  setLoadingHistory]  = useState(true);
  const [hasMore,         setHasMore]         = useState(false);
  const [loadingMore,     setLoadingMore]      = useState(false);
  const [currentPage,     setCurrentPage]      = useState(1);
  const [inputText,       setInputText]        = useState('');
  const [uploading,       setUploading]        = useState(false);
  const [selectedFile,    setSelectedFile]     = useState(null);
  const [deleteState,     setDeleteState]      = useState({ open: false, messageId: '', loading: false });

  // Real-time hook
  const {
    messages, prependMessages, typingUsers,
    isConnected, sendMessage, startTyping, stopTyping, markAsRead,
  } = useGroupChat(group._id, initialMessages);

  // ── Load initial message history ───────────────────────
  useEffect(() => {
    if (!group._id) return;
    setLoadingHistory(true);
    setInitialMessages([]);
    setCurrentPage(1);

    API.get(`/chat-groups/${group._id}/messages?page=1&limit=50`)
      .then(res => {
        setInitialMessages(res.data.messages || []);
        setHasMore(res.data.hasMore || false);
        setLoadingHistory(false);
      })
      .catch(() => { setLoadingHistory(false); });
  }, [group._id]);

  // ── Scroll to bottom on new message ───────────────────
  useEffect(() => {
    if (!loadingHistory) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, loadingHistory]);

  // ── Mark as read when window is focused ───────────────
  useEffect(() => {
    markAsRead();
  }, [group._id, markAsRead]);

  // ── Load older messages (pagination) ──────────────────
  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);

    try {
      const nextPage = currentPage + 1;
      const res = await API.get(`/chat-groups/${group._id}/messages?page=${nextPage}&limit=50`);
      prependMessages(res.data.messages || []);
      setHasMore(res.data.hasMore);
      setCurrentPage(nextPage);
    } catch {}
    finally { setLoadingMore(false); }
  }, [group._id, currentPage, hasMore, loadingMore, prependMessages]);

  // ── Send text message ──────────────────────────────────
  const handleSend = useCallback(async () => {
    const text = inputText.trim();

    // If file is selected, upload it
    if (selectedFile) {
      setUploading(true);
      try {
        const fd = new FormData();
        fd.append('file', selectedFile);
        if (text) fd.append('content', text);
        await API.post(`/chat-groups/${group._id}/messages`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        setSelectedFile(null);
        setInputText('');
        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch { toast.error('Failed to send file'); }
      finally { setUploading(false); }
      return;
    }

    if (!text) return;

    const sent = sendMessage(text); // Send via socket
    if (sent) {
      setInputText('');
      stopTyping();
      clearTimeout(typingTimerRef.current);
      inputRef.current?.focus();
    }
  }, [inputText, selectedFile, sendMessage, stopTyping, group._id]);

  // ── Handle input typing ────────────────────────────────
  const handleInputChange = useCallback((e) => {
    setInputText(e.target.value);

    // Debounced typing indicator
    startTyping();
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(stopTyping, 2000);
  }, [startTyping, stopTyping]);

  // ── Delete message ─────────────────────────────────────
  const handleDelete = useCallback(async () => {
    if (!deleteState.messageId) return;
    setDeleteState((current) => ({ ...current, loading: true }));
    try {
      await API.delete(`/chat-groups/messages/${deleteState.messageId}`);
      setDeleteState({ open: false, messageId: '', loading: false });
    } catch {
      toast.error('Failed to delete message');
      setDeleteState((current) => ({ ...current, loading: false }));
    }
  }, [deleteState.messageId]);

  // ── File selection ─────────────────────────────────────
  const handleFileSelect = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error('File must be under 10MB'); return; }
    setSelectedFile(file);
  }, []);

  const isMine = (msg) => msg.sender?._id === user?._id || msg.sender === user?._id;
  const canModerateGroup = isAdminUser(user) || group.members?.some(
    (member) => member.user?._id === user?._id && member.role === 'admin'
  );

  return (
    <div className={`flex h-full flex-col ${isDark ? 'bg-slate-950' : 'bg-transparent'}`}>
      <ConfirmDialog
        open={deleteState.open}
        title="Delete message"
        description="Are you sure you want to delete this message?"
        confirmLabel="Delete"
        loading={deleteState.loading}
        onConfirm={handleDelete}
        onClose={() => setDeleteState({ open: false, messageId: '', loading: false })}
      />
      {/* ── Header ── */}
      <div className={`theme-surface-soft flex flex-shrink-0 items-center justify-between border-b px-5 py-4 ${
        isDark ? 'border-slate-800' : 'border-[color:var(--border-soft)]'
      }`}>
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 text-sm font-bold text-white shadow-sm">
            {group.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display font-bold theme-text-strong">{group.name}</h3>
              <div className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${isConnected ? 'bg-emerald-100 text-emerald-700' : isDark ? 'bg-slate-800 text-slate-400' : 'theme-surface text-[var(--text-muted)]'}`}>
                {isConnected ? <FiWifi size={10} /> : <FiWifiOff size={10} />}
                {isConnected ? 'Live' : 'Reconnecting'}
              </div>
            </div>
            <p className="theme-text-muted text-xs">
              {group.members?.length || 0} members
              {group.department && ` · ${group.department}`}
              {group.year && ` Year ${group.year}`}
              {group.section && ` · Section ${group.section}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onGroupInfoClick}
            className={`theme-ghost-button rounded-2xl p-2.5 transition-colors ${
              isDark ? 'text-slate-400 hover:text-sky-300 hover:bg-slate-800' : 'theme-text-muted hover:text-[var(--accent-primary)]'
            }`}>
            <FiInfo size={18} />
          </button>
        </div>
      </div>

      {/* ── Messages area ── */}
      <div className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.14),transparent_45%)] px-4 py-4" id="messages-container">

        {/* Load more button */}
        {hasMore && (
          <div className="flex justify-center mb-4">
            <button onClick={loadMore} disabled={loadingMore}
              className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-medium transition-colors disabled:opacity-50 ${
                isDark ? 'bg-slate-900 text-sky-300 hover:bg-slate-800' : 'theme-surface-soft theme-text-main hover:shadow-sm'
              }`}>
              <FiChevronUp size={14} />
              {loadingMore ? 'Loading...' : 'Load older messages'}
            </button>
          </div>
        )}

        {loadingHistory ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            <p className="theme-text-muted text-sm">Loading messages...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="text-5xl mb-4">💬</div>
            <h3 className="theme-text-strong mb-1 font-display text-lg font-bold">No messages yet</h3>
            <p className="theme-text-muted text-sm">Be the first to say something in {group.name}!</p>
          </div>
        ) : (
          messages.map((message, index) => {
            const prev        = index > 0 ? messages[index - 1] : null;
            const showDate    = shouldShowDateSeparator(message, prev);
            const showAvatar  = shouldShowAvatar(message, prev);

            return (
              <React.Fragment key={message._id}>
                {showDate && <DateSeparator date={message.createdAt} />}
                <MessageBubble
                  message={message}
                  isOwn={isMine(message)}
                  showAvatar={showAvatar}
                  onDelete={isMine(message) || canModerateGroup ? ((messageId) => setDeleteState({ open: true, messageId, loading: false })) : null}
                />
              </React.Fragment>
            );
          })
        )}

        {/* Typing indicator */}
        <TypingIndicator users={typingUsers} />

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* ── File preview bar ── */}
      {selectedFile && (
        <div className={`flex flex-shrink-0 items-center gap-3 border-t px-4 py-2 ${
          isDark ? 'bg-slate-900 border-slate-800' : 'theme-surface-soft border-[color:var(--border-soft)]'
        }`}>
          <FiPaperclip size={16} className="text-blue-500" />
          <div className="flex-1 min-w-0">
            <p className={`truncate text-sm font-medium ${isDark ? 'text-sky-300' : 'theme-text-main'}`}>{selectedFile.name}</p>
            <p className="theme-text-muted text-xs">{(selectedFile.size / 1024).toFixed(1)} KB</p>
          </div>
          <button onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
            className="rounded p-1 text-blue-400 hover:text-red-500">
            <FiX size={16} />
          </button>
        </div>
      )}

      {/* ── Input bar ── */}
      <div className={`theme-surface-soft flex-shrink-0 border-t px-4 py-3 ${
        isDark ? 'border-slate-800' : 'border-[color:var(--border-soft)]'
      }`}>
        <div className="flex items-end gap-3">
          {/* File upload button */}
          <button onClick={() => fileInputRef.current?.click()}
            className={`theme-ghost-button flex-shrink-0 rounded-2xl p-2.5 transition-colors ${
              isDark ? 'text-slate-400 hover:text-sky-300 hover:bg-slate-800' : 'theme-text-muted hover:text-[var(--accent-primary)]'
            }`}
            title="Attach file">
            <FiPaperclip size={19} />
          </button>
          <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect}
            accept="image/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.zip" />

          {/* Text input */}
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={inputText}
              onChange={handleInputChange}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={`Message ${group.name}...`}
              rows={1}
              className={`theme-input max-h-32 w-full resize-none overflow-y-auto rounded-2xl px-4 py-2.5 text-sm transition-all ${
                isDark ? 'bg-slate-950 border-slate-700 text-slate-100' : ''
              }`}
              style={{ minHeight: '42px' }}
            />
          </div>

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={uploading || (!inputText.trim() && !selectedFile)}
            className="flex-shrink-0 rounded-2xl p-2.5 text-white shadow-sm transition-all hover:-translate-y-0.5 disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #1e40af, #2563eb)' }}>
            {uploading
              ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <FiSend size={19} />}
          </button>
        </div>
        <p className="theme-text-muted mt-1.5 text-center text-xs">
          Enter to send · Shift+Enter for new line · Max 10MB files
        </p>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-5px); }
        }
      `}</style>
    </div>
  );
}
