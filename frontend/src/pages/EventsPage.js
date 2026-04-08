import React, { useState, useEffect, useCallback } from 'react';
import API from '../utils/api';
import { usePermissions } from '../context/PermissionContext';
import toast from 'react-hot-toast';
import { PageHeader, FullPageSpinner, EmptyState, Alert } from '../components/ui';
import { formatDate, getAssetUrl } from '../utils/helpers';
import {
  FiPlus, FiSearch, FiX, FiCalendar, FiMapPin,
  FiUsers, FiExternalLink, FiVideo, FiUpload, FiHeart,
  FiTag,
} from 'react-icons/fi';

// ── Category config ───────────────────────────────────
const CAT_CONFIG = {
  Technical: { emoji: '💻', color: 'from-blue-500 to-cyan-500',    bg: 'bg-blue-50',   text: 'text-blue-700'   },
  Cultural:  { emoji: '🎭', color: 'from-pink-500 to-rose-500',    bg: 'bg-pink-50',   text: 'text-pink-700'   },
  Sports:    { emoji: '⚽', color: 'from-green-500 to-emerald-500',bg: 'bg-green-50',  text: 'text-green-700'  },
  Academic:  { emoji: '🎓', color: 'from-indigo-500 to-violet-500',bg: 'bg-indigo-50', text: 'text-indigo-700' },
  Workshop:  { emoji: '🔧', color: 'from-orange-500 to-amber-500', bg: 'bg-orange-50', text: 'text-orange-700' },
  Seminar:   { emoji: '🎤', color: 'from-teal-500 to-cyan-500',    bg: 'bg-teal-50',   text: 'text-teal-700'   },
  Other:     { emoji: '📌', color: 'from-gray-500 to-slate-500',   bg: 'bg-gray-50',   text: 'text-gray-700'   },
};

const CATEGORIES = Object.keys(CAT_CONFIG);

// ── Event status helper ───────────────────────────────
const getEventStatus = (date, endDate) => {
  const now  = new Date();
  const start = new Date(date);
  const end   = endDate ? new Date(endDate) : null;

  if (now < start) {
    const days = Math.ceil((start - now) / (1000 * 60 * 60 * 24));
    if (days === 0) return { label: 'Today!',    color: 'bg-yellow-100 text-yellow-700 animate-pulse' };
    if (days === 1) return { label: 'Tomorrow',  color: 'bg-orange-100 text-orange-700' };
    if (days <= 7)  return { label: `In ${days}d`, color: 'bg-blue-100 text-blue-700' };
    return { label: formatDate(date).split(',')[0], color: 'bg-gray-100 text-gray-600' };
  }
  if (end && now <= end) return { label: 'Ongoing 🔴', color: 'bg-green-100 text-green-700' };
  return { label: 'Completed', color: 'bg-gray-100 text-gray-500' };
};

// ── Event Card ────────────────────────────────────────
const EventCard = ({ event, onInterest, canDelete, onDelete }) => {
  const cfg    = CAT_CONFIG[event.category] || CAT_CONFIG.Other;
  const status = getEventStatus(event.date, event.endDate);

  return (
    <div className="card overflow-hidden hover:-translate-y-1 hover:shadow-card-hover transition-all duration-200 flex flex-col animate-fade-in-up">
      {/* Poster / gradient banner */}
      {event.poster?.url ? (
        <div className="h-44 overflow-hidden">
          <img src={getAssetUrl(event.poster.url)} alt={event.title}
            className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className={`h-32 bg-gradient-to-br ${cfg.color} flex items-center justify-center text-5xl`}>
          {cfg.emoji}
        </div>
      )}

      <div className="p-5 flex flex-col flex-1">
        {/* Category + status */}
        <div className="flex items-center justify-between mb-2.5">
          <span className={`badge text-xs ${cfg.bg} ${cfg.text}`}>
            {cfg.emoji} {event.category}
          </span>
          <span className={`badge text-xs ${status.color}`}>{status.label}</span>
        </div>

        {/* Title */}
        <h3 className="font-display font-bold text-gray-900 text-sm mb-1.5 line-clamp-2">{event.title}</h3>
        <p className="text-xs text-gray-500 leading-relaxed line-clamp-2 flex-1 mb-3">{event.description}</p>

        {/* Meta */}
        <div className="space-y-1.5 mb-3">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <FiCalendar size={11} className="text-blue-400" />
            {formatDate(event.date).split(',')[0]}
            {event.endDate && ` – ${formatDate(event.endDate).split(',')[0]}`}
          </div>
          {event.venue && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <FiMapPin size={11} className="text-pink-400" /> {event.venue}
            </div>
          )}
          {event.organizer && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <FiUsers size={11} className="text-violet-400" /> {event.organizer}
            </div>
          )}
        </div>

        {/* Tags */}
        {event.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {event.tags.slice(0, 3).map(tag => (
              <span key={tag} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">{tag}</span>
            ))}
          </div>
        )}

        {/* Footer actions */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-50 mt-auto">
          <button
            onClick={() => onInterest(event._id)}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all ${
              event.isInterested
                ? 'bg-pink-50 text-pink-600 border border-pink-200'
                : 'bg-gray-50 text-gray-500 hover:bg-pink-50 hover:text-pink-600 border border-gray-200'
            }`}
          >
            <FiHeart size={12} className={event.isInterested ? 'fill-current' : ''} />
            {event.interestedCount} Interested
          </button>

          <div className="flex items-center gap-1.5">
            {canDelete && (
              <button onClick={() => onDelete(event._id)}
                className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                <FiX size={13} />
              </button>
            )}
            {event.videoLink && (
              <a href={event.videoLink} target="_blank" rel="noreferrer"
                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                <FiVideo size={14} />
              </a>
            )}
            {event.registrationLink && (
              <a href={event.registrationLink} target="_blank" rel="noreferrer"
                className="btn-primary py-1.5 px-3 text-xs">
                Register <FiExternalLink size={11} />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Create Modal ──────────────────────────────────────
const EventModal = ({ onClose, onSaved }) => {
  const [form, setForm] = useState({
    title: '', description: '', category: 'Technical',
    date: '', endDate: '', venue: 'Sharda University Campus',
    videoLink: '', registrationLink: '', organizer: '',
    maxParticipants: '', tags: '',
  });
  const [poster, setPoster] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.description || !form.date) {
      setError('Title, description and date are required');
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v); });
      if (poster) fd.append('poster', poster);
      await API.post('/events', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Event created!');
      onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create event');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-fade-in-up">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="font-display font-bold text-gray-900 flex items-center gap-2">
            <FiCalendar size={18} className="text-blue-600" /> Create New Event
          </h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
            <FiX size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && <Alert type="error" message={error} />}

          {/* Category */}
          <div>
            <label className="label">Category <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
              {CATEGORIES.map(cat => {
                const cfg = CAT_CONFIG[cat];
                return (
                  <button key={cat} type="button"
                    onClick={() => setForm(f => ({ ...f, category: cat }))}
                    className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all text-xs font-semibold ${
                      form.category === cat
                        ? `border-transparent bg-gradient-to-br ${cfg.color} text-white shadow-md`
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}>
                    <span className="text-lg">{cfg.emoji}</span>
                    <span className="truncate w-full text-center">{cat}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="label">Event Title <span className="text-red-500">*</span></label>
            <input className="input" value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Annual Hackathon 2024" />
          </div>

          <div>
            <label className="label">Description <span className="text-red-500">*</span></label>
            <textarea className="input resize-none" rows={3} value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Describe the event, what to expect, who should attend..." />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Start Date & Time <span className="text-red-500">*</span></label>
              <input type="datetime-local" className="input" value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div>
              <label className="label">End Date & Time</label>
              <input type="datetime-local" className="input" value={form.endDate}
                onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Venue</label>
              <div className="relative">
                <FiMapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <input className="input pl-9" value={form.venue}
                  onChange={e => setForm(f => ({ ...f, venue: e.target.value }))}
                  placeholder="Auditorium, Block A..." />
              </div>
            </div>
            <div>
              <label className="label">Organizer / Club</label>
              <div className="relative">
                <FiUsers className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <input className="input pl-9" value={form.organizer}
                  onChange={e => setForm(f => ({ ...f, organizer: e.target.value }))}
                  placeholder="e.g. Tech Club, NSS" />
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Registration Link</label>
              <div className="relative">
                <FiExternalLink className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <input className="input pl-9" value={form.registrationLink}
                  onChange={e => setForm(f => ({ ...f, registrationLink: e.target.value }))}
                  placeholder="https://forms.google.com/..." />
              </div>
            </div>
            <div>
              <label className="label">Video / Live Link</label>
              <div className="relative">
                <FiVideo className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <input className="input pl-9" value={form.videoLink}
                  onChange={e => setForm(f => ({ ...f, videoLink: e.target.value }))}
                  placeholder="https://youtube.com/..." />
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Max Participants</label>
              <input type="number" className="input" value={form.maxParticipants}
                onChange={e => setForm(f => ({ ...f, maxParticipants: e.target.value }))}
                placeholder="Leave blank for unlimited" />
            </div>
            <div>
              <label className="label">Tags</label>
              <div className="relative">
                <FiTag className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <input className="input pl-9" value={form.tags}
                  onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                  placeholder="coding, music, sports..." />
              </div>
            </div>
          </div>

          {/* Poster upload */}
          <div>
            <label className="label">Event Poster</label>
            <label className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl p-5 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
              <FiUpload className="text-gray-400" size={18} />
              <span className="text-sm text-gray-500">
                {poster ? poster.name : 'Click to upload poster (JPG, PNG)'}
              </span>
              <input type="file" className="hidden" accept=".jpg,.jpeg,.png,.gif"
                onChange={e => setPoster(e.target.files[0])} />
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center py-2.5">
              {loading ? 'Creating...' : '🎉 Create Event'}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────
export default function EventsPage() {
  const { hasPermission } = usePermissions();
  const [events,     setEvents]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [showModal,  setShowModal]  = useState(false);
  const [activeCategory, setActiveCategory] = useState('');
  const [activeFilter,   setActiveFilter]   = useState('upcoming');
  const [search,     setSearch]     = useState('');
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1, currentPage: 1 });

  const canPost = hasPermission('canPostNotice');

  const fetchEvents = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 12 });
      if (activeCategory) params.append('category', activeCategory);
      if (activeFilter)   params.append('filter', activeFilter);
      if (search)         params.append('search', search);
      const res = await API.get(`/events?${params}`);
      setEvents(res.data.data);
      setPagination({ total: res.data.total, totalPages: res.data.totalPages, currentPage: res.data.currentPage });
    } catch { setEvents([]); }
    finally { setLoading(false); }
  }, [activeCategory, activeFilter, search]);

  useEffect(() => { fetchEvents(1); }, [fetchEvents]);

  const handleInterest = async (id) => {
    try {
      const res = await API.put(`/events/${id}/interest`);
      toast.success(res.data.message);
      setEvents(prev => prev.map(e => e._id === id
        ? { ...e, isInterested: res.data.isInterested, interestedCount: res.data.interestedCount }
        : e
      ));
    } catch { toast.error('Failed'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this event?')) return;
    try {
      await API.delete(`/events/${id}`);
      toast.success('Event deleted');
      setEvents(prev => prev.filter(e => e._id !== id));
    } catch { toast.error('Delete failed'); }
  };

  return (
    <div>
      {showModal && (
        <EventModal
          onClose={() => setShowModal(false)}
          onSaved={() => fetchEvents(1)}
        />
      )}

      <PageHeader
        title="Events"
        subtitle={`${pagination.total} events`}
        action={
          canPost && (
            <button onClick={() => setShowModal(true)} className="btn-primary">
              <FiPlus size={15} /> Create Event
            </button>
          )
        }
      />

      {/* Filter tabs */}
      <div className="flex items-center gap-2 mb-4">
        {['upcoming', 'past', ''].map((f, i) => (
          <button key={i}
            onClick={() => setActiveFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeFilter === f
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-300'
            }`}>
            {f === 'upcoming' ? '📅 Upcoming' : f === 'past' ? '📁 Past' : '🌐 All'}
          </button>
        ))}
      </div>

      {/* Category pills */}
      <div className="flex flex-wrap gap-2 mb-4">
        {CATEGORIES.map(cat => {
          const cfg = CAT_CONFIG[cat];
          return (
            <button key={cat}
              onClick={() => setActiveCategory(activeCategory === cat ? '' : cat)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                activeCategory === cat
                  ? `bg-gradient-to-r ${cfg.color} text-white border-transparent shadow-md`
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}>
              {cfg.emoji} {cat}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="flex gap-3 mb-5">
        <div className="relative flex-1">
          <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
          <input className="input pl-10" placeholder="Search events..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {(activeCategory || search) && (
          <button onClick={() => { setActiveCategory(''); setSearch(''); }}
            className="btn-secondary text-red-500 border-red-200">
            <FiX size={15} /> Clear
          </button>
        )}
      </div>

      {/* Events grid */}
      {loading ? (
        <FullPageSpinner />
      ) : events.length === 0 ? (
        <EmptyState
          icon="🎉"
          title="No events found"
          description={activeFilter === 'upcoming' ? 'No upcoming events. Check back soon!' : 'No events match your filters.'}
          action={canPost ? (
            <button onClick={() => setShowModal(true)} className="btn-primary">
              <FiPlus size={15} /> Create First Event
            </button>
          ) : null}
        />
      ) : (
        <>
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4 stagger">
            {events.map(event => (
              <EventCard
                key={event._id}
                event={event}
                onInterest={handleInterest}
                canDelete={canPost}
                onDelete={handleDelete}
              />
            ))}
          </div>
          {pagination.totalPages > 1 && (
            <div className="flex justify-center items-center gap-3 mt-6">
              <button onClick={() => fetchEvents(pagination.currentPage - 1)}
                disabled={pagination.currentPage === 1} className="btn-secondary">Previous</button>
              <span className="text-sm text-gray-500">
                Page {pagination.currentPage} of {pagination.totalPages}
              </span>
              <button onClick={() => fetchEvents(pagination.currentPage + 1)}
                disabled={pagination.currentPage === pagination.totalPages} className="btn-secondary">Next</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
