import React, { useState, useEffect } from 'react';
import API from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { PageHeader, FullPageSpinner, EmptyState, Alert } from '../components/ui';
import { formatRelative } from '../utils/helpers';
import { FiPlus, FiTrash2, FiX, FiBell, FiAlertTriangle, FiInfo, FiCheckCircle, FiZap } from 'react-icons/fi';

const typeConfig = {
  info:    { icon: FiInfo,          bg: 'bg-blue-50',   border: 'border-blue-200',  text: 'text-blue-700',   badge: 'bg-blue-100 text-blue-700',   label: 'Info'    },
  warning: { icon: FiAlertTriangle, bg: 'bg-amber-50',  border: 'border-amber-200', text: 'text-amber-700',  badge: 'bg-amber-100 text-amber-700', label: 'Warning' },
  urgent:  { icon: FiZap,           bg: 'bg-red-50',    border: 'border-red-200',   text: 'text-red-700',    badge: 'bg-red-100 text-red-700',     label: 'Urgent'  },
  success: { icon: FiCheckCircle,   bg: 'bg-green-50',  border: 'border-green-200', text: 'text-green-700',  badge: 'bg-green-100 text-green-700', label: 'Success' },
};

function AnnouncementCard({ announcement, canDelete, onDelete }) {
  const cfg = typeConfig[announcement.type] || typeConfig.info;
  const Icon = cfg.icon;
  return (
    <div className={`card border ${cfg.border} ${cfg.bg} p-5 animate-fade-in-up`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.badge}`}>
            <Icon size={16} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className={`font-display font-bold text-sm ${cfg.text}`}>{announcement.title}</h3>
              <span className={`badge text-xs ${cfg.badge}`}>{cfg.label}</span>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">{announcement.message}</p>
            <p className="text-xs text-gray-400 mt-2">
              Posted by <strong>{announcement.postedBy?.name}</strong> · {formatRelative(announcement.createdAt)}
            </p>
          </div>
        </div>
        {canDelete && (
          <button onClick={() => onDelete(announcement._id)}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0">
            <FiTrash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

function CreateModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ title: '', message: '', type: 'info' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.message) { setError('Title and message are required'); return; }
    setLoading(true);
    try {
      const res = await API.post('/announcements', form);
      onCreated(res.data.data);
      toast.success('Announcement posted!');
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to post');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-fade-in-up">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-display font-bold text-gray-900 flex items-center gap-2">
            <FiBell size={18} className="text-blue-600" /> New Announcement
          </h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
            <FiX size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && <Alert type="error" message={error} />}
          <div>
            <label className="label">Title</label>
            <input className="input" value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))}
              placeholder="e.g. Portal Maintenance Tonight" />
          </div>
          <div>
            <label className="label">Message</label>
            <textarea className="input resize-none" rows={4} value={form.message}
              onChange={e => setForm(f => ({...f, message: e.target.value}))}
              placeholder="Write your announcement here..." />
          </div>
          <div>
            <label className="label">Type</label>
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(typeConfig).map(([key, cfg]) => {
                const Icon = cfg.icon;
                return (
                  <button key={key} type="button"
                    onClick={() => setForm(f => ({...f, type: key}))}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-xs font-semibold ${
                      form.type === key ? `${cfg.border} ${cfg.bg} ${cfg.text}` : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}>
                    <Icon size={16} />
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">
              {loading ? 'Posting...' : 'Post Announcement'}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AnnouncementsPage() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const canManage = ['admin', 'agent'].includes(user?.role);

  useEffect(() => {
    API.get('/announcements')
      .then(r => setAnnouncements(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this announcement?')) return;
    try {
      await API.delete(`/announcements/${id}`);
      setAnnouncements(a => a.filter(x => x._id !== id));
      toast.success('Deleted');
    } catch { toast.error('Delete failed'); }
  };

  return (
    <div>
      {showModal && (
        <CreateModal
          onClose={() => setShowModal(false)}
          onCreated={(a) => setAnnouncements(prev => [a, ...prev])}
        />
      )}
      <PageHeader
        title="Announcements"
        subtitle={`${announcements.length} active announcements`}
        action={
          canManage && (
            <button onClick={() => setShowModal(true)} className="btn-primary">
              <FiPlus size={15} /> Post Announcement
            </button>
          )
        }
      />

      {loading ? <FullPageSpinner /> : announcements.length === 0 ? (
        <EmptyState icon="📢" title="No announcements" description="No announcements have been posted yet." />
      ) : (
        <div className="space-y-4 stagger">
          {announcements.map(a => (
            <AnnouncementCard
              key={a._id} announcement={a}
              canDelete={canManage}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
