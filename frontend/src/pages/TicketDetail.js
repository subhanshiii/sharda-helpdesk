import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import API from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../context/PermissionContext';
import { useTicketSocket } from '../hooks/useSocket';
import toast from 'react-hot-toast';
import {
  StatusBadge, PriorityBadge, CategoryBadge,
  FullPageSpinner, Avatar, Alert, ConfirmDialog,
} from '../components/ui';
import { formatDate, formatRelative, getAssetUrl, getRoleColor, getRoleLabel, STATUSES, PRIORITIES, CATEGORIES } from '../utils/helpers';
import { isAdminUser } from '../utils/access';
import { FiSend, FiArrowLeft, FiEdit2, FiTrash2, FiPaperclip, FiLock, FiCheck, FiWifi } from 'react-icons/fi';

// ── Reply bubble ──────────────────────────────────────
const ReplyBubble = ({ reply, isOwn }) => (
  <div className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : ''} animate-fade-in-up`}>
    <Avatar name={reply.author?.name || 'U'} size="sm" />
    <div className={`max-w-[75%] flex flex-col gap-1 ${isOwn ? 'items-end' : 'items-start'}`}>
      <div className="flex items-center gap-2 text-xs text-gray-400">
        {!isOwn && <span className="font-medium text-gray-700">{reply.author?.name}</span>}
        <span className={`badge text-xs ${getRoleColor(reply.authorRole)}`}>{getRoleLabel(reply.authorRole)}</span>
        {reply.isInternal && (
          <span className="flex items-center gap-1 text-orange-500 font-semibold">
            <FiLock size={10}/> Internal
          </span>
        )}
      </div>
      <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
        reply.isInternal
          ? 'bg-orange-50 border border-orange-200 text-orange-800 rounded-tl-sm'
          : isOwn
          ? 'text-white rounded-tr-sm'
          : 'bg-white border border-gray-100 text-gray-800 rounded-tl-sm shadow-card'
      }`}
        style={isOwn && !reply.isInternal ? { background:'linear-gradient(135deg,#1e40af,#2563eb)' } : {}}>
        {reply.message}
        {reply.attachments?.length > 0 && (
          <div className="mt-2 space-y-1">
            {reply.attachments.map((a, i) => (
              <a key={i} href={getAssetUrl(a.url)} target="_blank" rel="noreferrer"
                className="flex items-center gap-1 text-xs underline opacity-80 hover:opacity-100">
                <FiPaperclip size={10}/> {a.originalName}
              </a>
            ))}
          </div>
        )}
      </div>
      <span className="text-xs text-gray-400">{formatRelative(reply.createdAt)}</span>
    </div>
  </div>
);

// ── Typing indicator ──────────────────────────────────
const TypingIndicator = ({ typingUser }) => (
  <div className="flex gap-3 items-end animate-fade-in">
    <Avatar name={typingUser.userName} size="sm" />
    <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-card">
      <div className="flex gap-1 items-center h-4">
        {[0,1,2].map(i => (
          <div key={i} className="w-2 h-2 rounded-full bg-blue-400"
            style={{ animation:`bounce 1s ease-in-out ${i*0.2}s infinite` }}/>
        ))}
      </div>
    </div>
    <span className="text-xs text-gray-400">{typingUser.userName} is typing...</span>
  </div>
);

const InfoRow = ({ label, value }) => (
  <div className="flex items-start justify-between gap-2">
    <span className="text-xs text-gray-400 flex-shrink-0 pt-0.5">{label}</span>
    <div className="text-right">{value}</div>
  </div>
);

export default function TicketDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const navigate  = useNavigate();
  const bottomRef = useRef(null);
  const typingTimerRef = useRef(null);

  const [ticket,     setTicket]     = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [replyText,  setReplyText]  = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [sending,    setSending]    = useState(false);
  const [editing,    setEditing]    = useState(false);
  const [staffMembers, setStaffMembers] = useState([]);
  const [editForm,   setEditForm]   = useState({});
  const [error,      setError]      = useState('');
  const [typingUser, setTypingUser] = useState(null); // who is typing
  const [isLive,     setIsLive]     = useState(false); // socket connected?
  const [deleteState, setDeleteState] = useState({ open: false, loading: false });

  // ── Real-time: join ticket room + listen to events ────
  const { emitTyping } = useTicketSocket(id, {
    onNewReply: useCallback((data) => {
      // Update ticket with new reply — no page refresh needed!
      setTicket(data.ticket);
      setTypingUser(null);
    }, []),

    onTicketUpdated: useCallback((data) => {
      setTicket(data.ticket);
      if (data.changes.oldStatus !== data.changes.newStatus) {
        toast(`🔄 Ticket status: ${data.changes.newStatus}`, { icon: '📋' });
      }
    }, []),

    onTyping: useCallback((data) => {
      // Don't show typing indicator for own messages
      if (data.userId !== user?._id) {
        setTypingUser(data);
        // Auto-hide after 3 seconds if no stop event
        clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => setTypingUser(null), 3000);
      }
    }, [user?._id]),

    onStopTyping: useCallback((data) => {
      if (data.userId !== user?._id) setTypingUser(null);
    }, [user?._id]),
  });

  useEffect(() => {
    // Small delay to check if socket connected
    const timer = setTimeout(() => setIsLive(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  const fetchTicket = useCallback(async () => {
    try {
      const res = await API.get(`/tickets/${id}`);
      setTicket(res.data.data);
      setEditForm({
        status:     res.data.data.status,
        priority:   res.data.data.priority,
        category:   res.data.data.category,
        assignedTo: res.data.data.assignedTo?._id || '',
      });
    } catch {
      toast.error('Ticket not found');
      navigate('/tickets');
    } finally { setLoading(false); }
  }, [id, navigate]);

  const fetchStaffMembers = useCallback(async () => {
    try {
      const res = await API.get('/users/staff');
      setStaffMembers(res.data.data);
    } catch {}
  }, []);

  const loadTicket = useCallback(async () => {
    await fetchTicket();
    if (hasPermission('canHandleTickets')) {
      await fetchStaffMembers();
    }
  }, [fetchStaffMembers, fetchTicket, hasPermission]);

  useEffect(() => {
    loadTicket();
  }, [loadTicket]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ticket?.replies?.length, typingUser]);

  // Handle typing events
  const handleReplyChange = (e) => {
    setReplyText(e.target.value);

    // Emit typing start
    emitTyping(true);

    // Stop typing after 2 seconds of inactivity
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => emitTyping(false), 2000);
  };

  const handleReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    setSending(true);
    emitTyping(false); // Stop typing indicator
    try {
      const fd = new FormData();
      fd.append('message',    replyText);
      fd.append('isInternal', isInternal);
      // Socket.io will update the UI via 'ticket:new_reply' event
      // But we also update locally for instant feedback
      await API.post(`/tickets/${id}/replies`, fd);
      setReplyText('');
      setIsInternal(false);
      // Note: ticket state is updated by the socket event handler above
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send reply');
      // On error, refresh from server
      await fetchTicket();
    } finally { setSending(false); }
  };

  const handleUpdate = async () => {
    try {
      await API.put(`/tickets/${id}`, editForm);
      setEditing(false);
      toast.success('Ticket updated');
      // Socket event will update the UI
    } catch (err) {
      setError(err.response?.data?.message || 'Update failed');
    }
  };

  const handleDelete = async () => {
    setDeleteState({ open: true, loading: true });
    try {
      await API.delete(`/tickets/${id}`);
      toast.success('Ticket deleted');
      navigate('/tickets');
    } catch {
      toast.error('Delete failed');
      setDeleteState({ open: true, loading: false });
    }
  };

  if (loading) return <FullPageSpinner />;
  if (!ticket) return null;

  const canManage = hasPermission('canHandleTickets');
  const visibleReplies = canManage
    ? ticket.replies
    : ticket.replies.filter(r => !r.isInternal);

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <ConfirmDialog
        open={deleteState.open}
        title="Delete ticket"
        description="Are you sure you want to delete this ticket permanently?"
        confirmLabel="Delete"
        loading={deleteState.loading}
        onConfirm={handleDelete}
        onClose={() => setDeleteState({ open: false, loading: false })}
      />
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-secondary p-2"><FiArrowLeft size={16}/></button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-gray-400">{ticket.ticketId}</span>
            <StatusBadge status={ticket.status}/>
            <PriorityBadge priority={ticket.priority}/>
            {/* Live indicator */}
            <span className={`flex items-center gap-1 text-xs font-medium ${isLive ? 'text-green-500' : 'text-gray-400'}`}>
              <FiWifi size={11}/> {isLive ? 'Live' : 'Connecting...'}
            </span>
          </div>
          <h1 className="font-display text-xl font-bold text-gray-900 mt-0.5 truncate">{ticket.title}</h1>
        </div>
        {canManage && (
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={() => setEditing(!editing)} className="btn-secondary py-1.5 px-3">
              <FiEdit2 size={14}/> {editing ? 'Cancel' : 'Edit'}
            </button>
            {isAdminUser(user) && (
              <button onClick={() => setDeleteState({ open: true, loading: false })} className="btn-danger py-1.5 px-3"><FiTrash2 size={14}/></button>
            )}
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Chat area */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* Original message */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Avatar name={ticket.user?.name} size="md"/>
              <div>
                <p className="text-sm font-semibold text-gray-800">{ticket.user?.name}</p>
                <p className="text-xs text-gray-400">{formatDate(ticket.createdAt)}</p>
              </div>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{ticket.description}</p>
            {ticket.attachments?.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-2">
                {ticket.attachments.map((a,i) => (
                  <a key={i} href={getAssetUrl(a.url)} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1 text-xs px-2 py-1 bg-gray-100 rounded-md hover:bg-gray-200 text-gray-600">
                    <FiPaperclip size={11}/> {a.originalName}
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Replies */}
          {visibleReplies.length > 0 && (
            <div className="card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                  Conversation ({visibleReplies.length})
                </h3>
                {isLive && (
                  <span className="flex items-center gap-1 text-xs text-green-500 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"/>
                    Real-time
                  </span>
                )}
              </div>
              {visibleReplies.map(reply => (
                <ReplyBubble key={reply._id} reply={reply}
                  isOwn={reply.author?._id === user?._id || reply.author === user?._id} />
              ))}
              {typingUser && <TypingIndicator typingUser={typingUser}/>}
              <div ref={bottomRef}/>
            </div>
          )}

          {/* Reply box */}
          {ticket.status !== 'Closed' ? (
            <div className="card p-4">
              {canManage && (
                <div className="flex items-center gap-2 mb-3">
                  <button onClick={() => setIsInternal(false)}
                    className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${!isInternal ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}>
                    Public Reply
                  </button>
                  <button onClick={() => setIsInternal(true)}
                    className={`flex items-center gap-1 text-xs px-3 py-1 rounded-full font-medium transition-colors ${isInternal ? 'bg-orange-100 text-orange-700' : 'text-gray-500 hover:bg-gray-100'}`}>
                    <FiLock size={10}/> Internal Note
                  </button>
                </div>
              )}
              <form onSubmit={handleReply} className="flex gap-2">
                <textarea
                  value={replyText}
                  onChange={handleReplyChange}
                  className={`input flex-1 resize-none text-sm ${isInternal ? 'border-orange-300 focus:ring-orange-400' : ''}`}
                  rows={3}
                  placeholder={isInternal ? 'Internal note (staff only)...' : 'Type your reply... (Ctrl+Enter to send)'}
                  onKeyDown={e => { if (e.key==='Enter' && (e.metaKey||e.ctrlKey)) handleReply(e); }}
                />
                <button type="submit" disabled={sending || !replyText.trim()}
                  className={`self-end p-3 rounded-xl text-white transition-colors disabled:opacity-40 ${isInternal ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-600 hover:bg-blue-700'}`}>
                  {sending ? '...' : <FiSend size={16}/>}
                </button>
              </form>
              <p className="text-xs text-gray-400 mt-1.5">Ctrl+Enter to send</p>
            </div>
          ) : (
            <div className="card p-4 text-center text-sm text-gray-400 bg-gray-50">
              🔒 This ticket is closed and no longer accepts replies.
            </div>
          )}
        </div>

        {/* Sidebar: ticket meta + admin edit */}
        <div className="space-y-4">
          {canManage && editing && (
            <div className="card p-4 border-blue-200 bg-blue-50/50 animate-fade-in">
              <h3 className="text-sm font-bold text-gray-700 mb-3">Update Ticket</h3>
              {error && <Alert type="error" message={error}/>}
              <div className="space-y-3 mt-2">
                {[
                  { label:'Status',   key:'status',   options:STATUSES   },
                  { label:'Priority', key:'priority',  options:PRIORITIES },
                  { label:'Category', key:'category',  options:CATEGORIES },
                ].map(({ label, key, options }) => (
                  <div key={key}>
                    <label className="label text-xs">{label}</label>
                    <select className="input text-sm" value={editForm[key]}
                      onChange={e => setEditForm(f => ({...f, [key]: e.target.value}))}>
                      {options.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                ))}
                <div>
                  <label className="label text-xs">Assign To</label>
                    <select className="input text-sm" value={editForm.assignedTo}
                      onChange={e => setEditForm(f => ({...f, assignedTo: e.target.value}))}>
                    <option value="">Unassigned</option>
                    {staffMembers.map((member) => (
                      <option key={member._id} value={member._id}>{member.name} ({member.role})</option>
                    ))}
                  </select>
                </div>
                <button onClick={handleUpdate} className="btn-primary w-full justify-center">
                  <FiCheck size={14}/> Save Changes
                </button>
              </div>
            </div>
          )}

          <div className="card p-4 space-y-3">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Ticket Details</h3>
            <InfoRow label="ID"       value={<span className="font-mono text-sm">{ticket.ticketId}</span>}/>
            <InfoRow label="Status"   value={<StatusBadge   status={ticket.status}/>}/>
            <InfoRow label="Priority" value={<PriorityBadge priority={ticket.priority}/>}/>
            <InfoRow label="Category" value={<CategoryBadge category={ticket.category}/>}/>
            {ticket.routingDepartment ? <InfoRow label="Routed to" value={<span className="text-sm font-medium text-gray-700">{ticket.routingDepartment}</span>} /> : null}
            <div className="pt-2 border-t border-gray-50 space-y-3">
              <InfoRow label="Raised by" value={
                <div className="flex items-center gap-2">
                  <Avatar name={ticket.user?.name} size="sm"/>
                  <div>
                    <p className="text-xs font-medium text-gray-800">{ticket.user?.name}</p>
                    <p className="text-xs text-gray-400">{ticket.user?.enrollmentId || ticket.user?.email}</p>
                  </div>
                </div>
              }/>
              {ticket.assignedTo ? (
                <InfoRow label="Assigned to" value={
                  <div className="flex items-center gap-2">
                    <Avatar name={ticket.assignedTo.name} size="sm"/>
                    <div>
                      <p className="text-xs font-medium text-gray-800">{ticket.assignedTo.name}</p>
                      <span className={`badge text-xs ${getRoleColor(ticket.assignedTo.role)}`}>{ticket.assignedTo.role}</span>
                    </div>
                  </div>
                }/>
              ) : (
                <InfoRow label="Assigned to" value={<span className="text-xs text-gray-400 italic">Unassigned</span>}/>
              )}
            </div>
            <div className="pt-2 border-t border-gray-50 space-y-2 text-xs text-gray-400">
              <InfoRow label="Created" value={formatDate(ticket.createdAt)}/>
              <InfoRow label="Updated" value={formatDate(ticket.updatedAt)}/>
              {ticket.resolvedAt && <InfoRow label="Resolved" value={formatDate(ticket.resolvedAt)}/>}
            </div>
            {ticket.tags?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Tags</p>
                <div className="flex flex-wrap gap-1">
                  {ticket.tags.map(tag => (
                    <span key={tag} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">{tag}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}
