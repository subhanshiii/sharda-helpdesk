import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import API from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import {
  StatusBadge, PriorityBadge, CategoryBadge,
  FullPageSpinner, Avatar, Alert,
} from '../components/ui';
import { formatDate, formatRelative, getRoleColor, STATUSES, PRIORITIES, CATEGORIES } from '../utils/helpers';
import { FiSend, FiArrowLeft, FiEdit2, FiTrash2, FiPaperclip, FiLock, FiCheck } from 'react-icons/fi';

// Reply bubble component
const ReplyBubble = ({ reply, isOwn, currentUserRole }) => {
  const isInternal = reply.isInternal;
  return (
    <div className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : ''}`}>
      <Avatar name={reply.author?.name || 'U'} size="sm" />
      <div className={`max-w-[75%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          {!isOwn && <span className="font-medium text-gray-700">{reply.author?.name}</span>}
          <span className={`badge text-xs ${getRoleColor(reply.authorRole)}`}>{reply.authorRole}</span>
          {isInternal && (
            <span className="flex items-center gap-1 text-orange-500 font-medium">
              <FiLock size={10} /> Internal
            </span>
          )}
        </div>
        <div
          className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
            isInternal
              ? 'bg-orange-50 border border-orange-200 text-orange-800'
              : isOwn
              ? 'bg-primary-600 text-white rounded-tr-sm'
              : 'bg-white border border-gray-100 text-gray-800 rounded-tl-sm shadow-card'
          }`}
        >
          {reply.message}
          {reply.attachments?.length > 0 && (
            <div className="mt-2 space-y-1">
              {reply.attachments.map((a, i) => (
                <a key={i} href={a.url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1 text-xs underline opacity-80 hover:opacity-100">
                  <FiPaperclip size={10} /> {a.originalName}
                </a>
              ))}
            </div>
          )}
        </div>
        <span className="text-xs text-gray-400">{formatRelative(reply.createdAt)}</span>
      </div>
    </div>
  );
};

export default function TicketDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const bottomRef = useRef(null);

  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const [editing, setEditing] = useState(false);
  const [agents, setAgents] = useState([]);
  const [editForm, setEditForm] = useState({});
  const [error, setError] = useState('');

  useEffect(() => {
    fetchTicket();
    if (['admin', 'agent'].includes(user?.role)) fetchAgents();
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ticket?.replies?.length]);

  const fetchTicket = async () => {
    try {
      const res = await API.get(`/tickets/${id}`);
      setTicket(res.data.data);
      setEditForm({
        status: res.data.data.status,
        priority: res.data.data.priority,
        category: res.data.data.category,
        assignedTo: res.data.data.assignedTo?._id || '',
      });
    } catch {
      toast.error('Ticket not found');
      navigate('/tickets');
    } finally {
      setLoading(false);
    }
  };

  const fetchAgents = async () => {
    try {
      const res = await API.get('/users/agents');
      setAgents(res.data.data);
    } catch {}
  };

  const handleReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    setSending(true);
    try {
      const formData = new FormData();
      formData.append('message', replyText);
      formData.append('isInternal', isInternal);
      const res = await API.post(`/tickets/${id}/replies`, formData);
      setTicket(res.data.data);
      setReplyText('');
      setIsInternal(false);
      toast.success('Reply sent');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send reply');
    } finally {
      setSending(false);
    }
  };

  const handleUpdate = async () => {
    try {
      const res = await API.put(`/tickets/${id}`, editForm);
      setTicket(res.data.data);
      setEditing(false);
      toast.success('Ticket updated');
    } catch (err) {
      setError(err.response?.data?.message || 'Update failed');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this ticket permanently?')) return;
    try {
      await API.delete(`/tickets/${id}`);
      toast.success('Ticket deleted');
      navigate('/tickets');
    } catch {
      toast.error('Delete failed');
    }
  };

  if (loading) return <FullPageSpinner />;
  if (!ticket) return null;

  const canManage = ['admin', 'agent'].includes(user?.role);
  const isOwner   = ticket.user?._id === user?._id || ticket.user === user?._id;

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-secondary p-2">
          <FiArrowLeft size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-gray-400">{ticket.ticketId}</span>
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mt-0.5 truncate">{ticket.title}</h1>
        </div>
        {canManage && (
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={() => setEditing(!editing)} className="btn-secondary py-1.5 px-3">
              <FiEdit2 size={14} /> {editing ? 'Cancel' : 'Edit'}
            </button>
            {user?.role === 'admin' && (
              <button onClick={handleDelete} className="btn-danger py-1.5 px-3">
                <FiTrash2 size={14} />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Left: chat area */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* Original description */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Avatar name={ticket.user?.name} size="md" />
              <div>
                <p className="text-sm font-semibold text-gray-800">{ticket.user?.name}</p>
                <p className="text-xs text-gray-400">{formatDate(ticket.createdAt)}</p>
              </div>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{ticket.description}</p>
            {ticket.attachments?.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-2">Attachments</p>
                <div className="flex flex-wrap gap-2">
                  {ticket.attachments.map((a, i) => (
                    <a key={i} href={a.url} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1 text-xs px-2 py-1 bg-gray-100 rounded-md hover:bg-gray-200 text-gray-600">
                      <FiPaperclip size={11} /> {a.originalName}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Chat replies */}
          {ticket.replies?.length > 0 && (
            <div className="card p-5 space-y-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Conversation ({ticket.replies.length})
              </h3>
              {ticket.replies.map((reply) => (
                <ReplyBubble
                  key={reply._id}
                  reply={reply}
                  isOwn={reply.author?._id === user?._id}
                  currentUserRole={user?.role}
                />
              ))}
              <div ref={bottomRef} />
            </div>
          )}

          {/* Reply box */}
          {ticket.status !== 'Closed' && (
            <div className="card p-4">
              {canManage && (
                <div className="flex items-center gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setIsInternal(false)}
                    className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${!isInternal ? 'bg-primary-100 text-primary-700' : 'text-gray-500 hover:bg-gray-100'}`}
                  >
                    Public Reply
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsInternal(true)}
                    className={`flex items-center gap-1 text-xs px-3 py-1 rounded-full font-medium transition-colors ${isInternal ? 'bg-orange-100 text-orange-700' : 'text-gray-500 hover:bg-gray-100'}`}
                  >
                    <FiLock size={11} /> Internal Note
                  </button>
                </div>
              )}
              <form onSubmit={handleReply} className="flex gap-2">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className={`input flex-1 resize-none text-sm ${isInternal ? 'border-orange-300 focus:ring-orange-400' : ''}`}
                  rows={3}
                  placeholder={isInternal ? 'Internal note (only visible to staff)...' : 'Type your reply...'}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleReply(e);
                  }}
                />
                <button
                  type="submit"
                  disabled={sending || !replyText.trim()}
                  className={`self-end p-3 rounded-lg text-white transition-colors ${isInternal ? 'bg-orange-500 hover:bg-orange-600' : 'bg-primary-600 hover:bg-primary-700'} disabled:opacity-40`}
                >
                  {sending ? '...' : <FiSend size={16} />}
                </button>
              </form>
              <p className="text-xs text-gray-400 mt-1.5">Ctrl+Enter to send</p>
            </div>
          )}

          {ticket.status === 'Closed' && (
            <div className="card p-4 text-center text-sm text-gray-400 bg-gray-50">
              🔒 This ticket is closed and no longer accepts replies.
            </div>
          )}
        </div>

        {/* Right: ticket meta */}
        <div className="space-y-4">
          {/* Admin edit panel */}
          {canManage && editing && (
            <div className="card p-4 border-primary-200 bg-primary-50/50 animate-fade-in">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Update Ticket</h3>
              {error && <Alert type="error" message={error} />}
              <div className="space-y-3 mt-2">
                <div>
                  <label className="label text-xs">Status</label>
                  <select className="input text-sm" value={editForm.status}
                    onChange={(e) => setEditForm(f => ({...f, status: e.target.value}))}>
                    {STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label text-xs">Priority</label>
                  <select className="input text-sm" value={editForm.priority}
                    onChange={(e) => setEditForm(f => ({...f, priority: e.target.value}))}>
                    {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label text-xs">Category</label>
                  <select className="input text-sm" value={editForm.category}
                    onChange={(e) => setEditForm(f => ({...f, category: e.target.value}))}>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label text-xs">Assign To</label>
                  <select className="input text-sm" value={editForm.assignedTo}
                    onChange={(e) => setEditForm(f => ({...f, assignedTo: e.target.value}))}>
                    <option value="">Unassigned</option>
                    {agents.map(a => <option key={a._id} value={a._id}>{a.name} ({a.role})</option>)}
                  </select>
                </div>
                <button onClick={handleUpdate} className="btn-primary w-full justify-center">
                  <FiCheck size={14} /> Save Changes
                </button>
              </div>
            </div>
          )}

          {/* Ticket info card */}
          <div className="card p-4 space-y-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Ticket Details</h3>

            <InfoRow label="Ticket ID" value={<span className="font-mono text-sm">{ticket.ticketId}</span>} />
            <InfoRow label="Status"   value={<StatusBadge status={ticket.status} />} />
            <InfoRow label="Priority" value={<PriorityBadge priority={ticket.priority} />} />
            <InfoRow label="Category" value={<CategoryBadge category={ticket.category} />} />

            <div className="pt-2 border-t border-gray-50 space-y-3">
              <InfoRow label="Raised by" value={
                <div className="flex items-center gap-2">
                  <Avatar name={ticket.user?.name} size="sm" />
                  <div>
                    <p className="text-xs font-medium text-gray-800">{ticket.user?.name}</p>
                    <p className="text-xs text-gray-400">{ticket.user?.enrollmentId || ticket.user?.email}</p>
                  </div>
                </div>
              } />

              {ticket.assignedTo ? (
                <InfoRow label="Assigned to" value={
                  <div className="flex items-center gap-2">
                    <Avatar name={ticket.assignedTo.name} size="sm" />
                    <div>
                      <p className="text-xs font-medium text-gray-800">{ticket.assignedTo.name}</p>
                      <span className={`badge text-xs ${getRoleColor(ticket.assignedTo.role)}`}>{ticket.assignedTo.role}</span>
                    </div>
                  </div>
                } />
              ) : (
                <InfoRow label="Assigned to" value={<span className="text-xs text-gray-400 italic">Unassigned</span>} />
              )}
            </div>

            <div className="pt-2 border-t border-gray-50 space-y-2 text-xs text-gray-400">
              <InfoRow label="Created"  value={formatDate(ticket.createdAt)} small />
              <InfoRow label="Updated"  value={formatDate(ticket.updatedAt)} small />
              {ticket.resolvedAt && <InfoRow label="Resolved" value={formatDate(ticket.resolvedAt)} small />}
            </div>

            {ticket.tags?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Tags</p>
                <div className="flex flex-wrap gap-1">
                  {ticket.tags.map((tag) => (
                    <span key={tag} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">{tag}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const InfoRow = ({ label, value, small = false }) => (
  <div className={`flex items-start justify-between gap-2 ${small ? 'text-xs' : ''}`}>
    <span className="text-xs text-gray-400 flex-shrink-0 pt-0.5">{label}</span>
    <div className="text-right">{value}</div>
  </div>
);
