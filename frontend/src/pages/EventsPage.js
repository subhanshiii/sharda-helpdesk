import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../utils/api';
import { usePermissions } from '../context/PermissionContext';
import toast from 'react-hot-toast';
import { PageHeader, FullPageSpinner, EmptyState, Alert, ConfirmDialog } from '../components/ui';
import { formatDate, getAssetUrl } from '../utils/helpers';
import {
  FiPlus, FiSearch, FiX, FiCalendar, FiMapPin,
  FiUsers, FiExternalLink, FiVideo, FiHeart,
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

// ── Main Page ─────────────────────────────────────────
export default function EventsPage() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const [events,     setEvents]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [activeCategory, setActiveCategory] = useState('');
  const [activeFilter,   setActiveFilter]   = useState('upcoming');
  const [search,     setSearch]     = useState('');
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1, currentPage: 1 });
  const [deleteState, setDeleteState] = useState({ open: false, id: '', loading: false });

  const canPost = can('create', 'events');

  const fetchEvents = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page, limit: 12 });
      if (activeCategory) params.append('category', activeCategory);
      if (activeFilter)   params.append('filter', activeFilter);
      if (search)         params.append('search', search);
      const res = await API.get(`/events?${params}`);
      setEvents(Array.isArray(res.data?.data) ? res.data.data : []);
      setPagination({
        total: Number(res.data?.total) || 0,
        totalPages: Number(res.data?.totalPages) || 1,
        currentPage: Number(res.data?.currentPage) || 1,
      });
    } catch (requestError) {
      setEvents([]);
      setPagination({ total: 0, totalPages: 1, currentPage: 1 });
      setError(requestError.response?.data?.message || 'Unable to load events right now.');
    }
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
    } catch (requestError) { toast.error(requestError.response?.data?.message || 'Failed to update interest'); }
  };

  const handleDelete = async () => {
    if (!deleteState.id) return;
    setDeleteState((current) => ({ ...current, loading: true }));
    try {
      await API.delete(`/events/${deleteState.id}`);
      toast.success('Event deleted');
      setEvents(prev => prev.filter(e => e._id !== deleteState.id));
      setDeleteState({ open: false, id: '', loading: false });
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || 'Delete failed');
      setDeleteState((current) => ({ ...current, loading: false }));
    }
  };

  return (
    <div>
      <ConfirmDialog
        open={deleteState.open}
        title="Delete event"
        description="Are you sure you want to delete this event?"
        confirmLabel="Delete"
        loading={deleteState.loading}
        onConfirm={handleDelete}
        onClose={() => setDeleteState({ open: false, id: '', loading: false })}
      />
      <PageHeader
        title="Events"
        subtitle="Browse the complete event directory. Notice Board only highlights selected updates and does not replace this full event workspace."
        action={
          canPost ? (
            <button onClick={() => navigate('/events/new')} className="btn-primary">
              <FiPlus size={15} /> Create Event
            </button>
          ) : (
            <button className="btn-secondary cursor-not-allowed opacity-70" disabled title="Only staff and admins can create events.">
              <FiPlus size={15} /> Create Event
            </button>
          )
        }
      />

      {error ? <Alert type="error" message={error} /> : null}

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
            <button onClick={() => navigate('/events/new')} className="btn-primary">
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
                onDelete={(id) => setDeleteState({ open: true, id, loading: false })}
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
