import React, { useState, useEffect, useCallback, memo } from 'react';
import API from '../utils/api';
import { usePermissions } from '../context/PermissionContext';
import toast from 'react-hot-toast';
import { PageHeader, EmptyState, Alert, ConfirmDialog } from '../components/ui';
import { OpportunitiesSkeleton } from '../components/skeletons/SkeletonComponents';
import { useOptimisticUpdate } from '../hooks/useOptimisticUpdate';
import { formatDate } from '../utils/helpers';
import {
  FiPlus, FiSearch, FiBookmark, FiExternalLink, FiX,
  FiCalendar, FiMapPin, FiDollarSign, FiTag, FiBriefcase,
  FiAward, FiCode, FiBook, FiStar, FiUsers,
} from 'react-icons/fi';

const TYPE_CONFIG = {
  Internship:  { icon: FiBriefcase, color: 'from-blue-500 to-cyan-500',    bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200'   },
  Hackathon:   { icon: FiCode,      color: 'from-violet-500 to-purple-600', bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
  Competition: { icon: FiAward,     color: 'from-orange-500 to-amber-500',  bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  Workshop:    { icon: FiBook,      color: 'from-teal-500 to-green-500',    bg: 'bg-teal-50',   text: 'text-teal-700',   border: 'border-teal-200'   },
  Job:         { icon: FiUsers,     color: 'from-pink-500 to-rose-500',     bg: 'bg-pink-50',   text: 'text-pink-700',   border: 'border-pink-200'   },
  Scholarship: { icon: FiStar,      color: 'from-yellow-500 to-orange-400', bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
};
const TYPES = Object.keys(TYPE_CONFIG);

const DeadlineBadge = memo(({ deadline }) => {
  if (!deadline) return null;
  const days = Math.ceil((new Date(deadline) - new Date()) / (1000*60*60*24));
  if (days < 0)  return <span className="badge bg-gray-100 text-gray-500">Expired</span>;
  if (days <= 3) return <span className="badge bg-red-100 text-red-700 animate-pulse">🔥 {days}d left</span>;
  if (days <= 7) return <span className="badge bg-orange-100 text-orange-700">⚡ {days}d left</span>;
  return <span className="badge bg-green-100 text-green-700">📅 {days}d left</span>;
});

/**
 * Memoized opportunity card
 * Only re-renders when this specific opportunity's data changes
 */
const OpportunityCard = memo(({ opp, onBookmark, canDelete, onDelete }) => {
  const cfg  = TYPE_CONFIG[opp.type] || TYPE_CONFIG.Internship;
  const Icon = cfg.icon;

  return (
    <div className="card overflow-hidden hover:-translate-y-1 hover:shadow-card-hover transition-all duration-200 flex flex-col animate-fade-in-up">
      <div className={`h-1.5 w-full bg-gradient-to-r ${cfg.color}`} />
      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br ${cfg.color}`}>
              <Icon size={18} className="text-white" />
            </div>
            <div>
              <span className={`badge text-xs ${cfg.bg} ${cfg.text} ${cfg.border} border`}>{opp.type}</span>
              {opp.company && <p className="text-xs text-gray-400 mt-0.5">{opp.company}</p>}
            </div>
          </div>
          {/* Optimistic bookmark — updates immediately on click */}
          <button onClick={() => onBookmark(opp._id, opp.isBookmarked)}
            className={`p-2 rounded-xl transition-all ${opp.isBookmarked ? 'text-yellow-500 bg-yellow-50' : 'text-gray-300 hover:text-yellow-500 hover:bg-yellow-50'}`}>
            <FiBookmark size={16} className={opp.isBookmarked ? 'fill-current' : ''} />
          </button>
        </div>

        <h3 className="font-display font-bold text-gray-900 text-sm mb-1.5 line-clamp-2">{opp.title}</h3>
        <p className="text-xs text-gray-500 leading-relaxed line-clamp-3 flex-1">{opp.description}</p>

        <div className="mt-3 space-y-1.5">
          {opp.location && <div className="flex items-center gap-1.5 text-xs text-gray-400"><FiMapPin size={11}/>{opp.location}</div>}
          {opp.stipend  && <div className="flex items-center gap-1.5 text-xs text-gray-400"><FiDollarSign size={11}/>{opp.stipend}</div>}
          {opp.deadline && <div className="flex items-center gap-1.5 text-xs text-gray-400"><FiCalendar size={11}/>Deadline: {formatDate(opp.deadline).split(',')[0]}</div>}
        </div>

        {opp.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {opp.tags.slice(0,3).map(tag => (
              <span key={tag} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">{tag}</span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-50">
          <DeadlineBadge deadline={opp.deadline} />
          <div className="flex items-center gap-1.5">
            {canDelete && (
              <button onClick={() => onDelete(opp._id)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                <FiX size={13}/>
              </button>
            )}
            {opp.externalLink && (
              <a href={opp.externalLink} target="_blank" rel="noreferrer" className="btn-primary py-1.5 px-3 text-xs">
                Apply <FiExternalLink size={11}/>
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

const OpportunityModal = memo(({ onClose, onSaved }) => {
  const [form, setForm] = useState({
    title:'', description:'', type:'Internship', company:'', location:'Remote',
    externalLink:'', deadline:'', stipend:'', eligibility:'', tags:'',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.description || !form.type) { setError('Title, description and type are required'); return; }
    setLoading(true);
    try {
      await API.post('/opportunities', form);
      toast.success('Opportunity posted!');
      onSaved(); onClose();
    } catch (err) { setError(err.response?.data?.message || 'Failed to save'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-fade-in-up">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="font-display font-bold text-gray-900">Post New Opportunity</h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"><FiX size={18}/></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && <Alert type="error" message={error} />}
          <div>
            <label className="label">Type</label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {TYPES.map(type => {
                const cfg = TYPE_CONFIG[type]; const Icon = cfg.icon;
                return (
                  <button key={type} type="button" onClick={() => setForm(f => ({...f, type}))}
                    className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 transition-all text-xs font-semibold ${
                      form.type === type ? `border-transparent bg-gradient-to-br ${cfg.color} text-white shadow-md` : 'border-gray-200 text-gray-500'
                    }`}>
                    <Icon size={16}/>{type}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="label">Title *</label>
              <input className="input" value={form.title} onChange={e => setForm(f => ({...f,title:e.target.value}))} placeholder="e.g. Software Engineer Intern at Google"/>
            </div>
            <div><label className="label">Company</label><input className="input" value={form.company} onChange={e => setForm(f => ({...f,company:e.target.value}))} placeholder="e.g. Google"/></div>
            <div><label className="label">Location</label><input className="input" value={form.location} onChange={e => setForm(f => ({...f,location:e.target.value}))} placeholder="Remote / Delhi"/></div>
          </div>
          <div><label className="label">Description *</label><textarea className="input resize-none" rows={3} value={form.description} onChange={e => setForm(f => ({...f,description:e.target.value}))} placeholder="Describe the opportunity..."/></div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div><label className="label">Deadline</label><input type="date" className="input" value={form.deadline} onChange={e => setForm(f => ({...f,deadline:e.target.value}))}/></div>
            <div><label className="label">Stipend</label><input className="input" value={form.stipend} onChange={e => setForm(f => ({...f,stipend:e.target.value}))} placeholder="₹15,000/month or Unpaid"/></div>
          </div>
          <div><label className="label">Apply Link</label><div className="relative"><FiExternalLink className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={14}/><input className="input pl-9" value={form.externalLink} onChange={e => setForm(f => ({...f,externalLink:e.target.value}))} placeholder="https://apply.example.com"/></div></div>
          <div><label className="label">Tags</label><div className="relative"><FiTag className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={14}/><input className="input pl-9" value={form.tags} onChange={e => setForm(f => ({...f,tags:e.target.value}))} placeholder="React, Python, ML (comma-separated)"/></div></div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">{loading ? 'Saving...' : 'Post Opportunity'}</button>
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
});

export default function OpportunitiesPage() {
  const { hasPermission } = usePermissions();
  const [loading, setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showBookmarked, setShowBookmarked] = useState(false);
  const [activeType, setActiveType] = useState('');
  const [search, setSearch]       = useState('');
  const [error, setError]         = useState('');
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1, currentPage: 1 });
  const [deleteState, setDeleteState] = useState({ open: false, id: '', loading: false });

  // useOptimisticUpdate: bookmarks update instantly without waiting for server
  const { data: opportunities, setData: setOpportunities, optimisticUpdate } = useOptimisticUpdate([]);

  const canPost = hasPermission('canPostNotice');

  const fetchOpps = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      if (showBookmarked) {
        const res = await API.get('/opportunities/bookmarked');
        setOpportunities(Array.isArray(res.data?.data) ? res.data.data : []);
        setPagination({ total: Number(res.data?.count) || 0, totalPages: 1, currentPage: 1 });
      } else {
        const params = new URLSearchParams({ page, limit: 12 });
        if (activeType) params.append('type',   activeType);
        if (search)     params.append('search', search);
        const res = await API.get(`/opportunities?${params}`);
        setOpportunities(Array.isArray(res.data?.data) ? res.data.data : []);
        setPagination({
          total: Number(res.data?.total) || 0,
          totalPages: Number(res.data?.totalPages) || 1,
          currentPage: Number(res.data?.currentPage) || 1,
        });
      }
    } catch (requestError) {
      setOpportunities([]);
      setPagination({ total: 0, totalPages: 1, currentPage: 1 });
      setError(requestError.response?.data?.message || 'Unable to load opportunities right now.');
    }
    finally { setLoading(false); }
  }, [activeType, search, showBookmarked, setOpportunities]);

  useEffect(() => { fetchOpps(1); }, [fetchOpps]);

  // Optimistic bookmark — updates UI instantly, syncs with server in background
  const handleBookmark = useCallback(async (id, currentlyBookmarked) => {
    try {
      await optimisticUpdate(
        items => items.map(o => o._id === id ? { ...o, isBookmarked: !o.isBookmarked } : o),
        () => API.put(`/opportunities/${id}/bookmark`)
      );
      toast.success(currentlyBookmarked ? 'Bookmark removed' : 'Bookmarked!');
      if (showBookmarked && currentlyBookmarked) {
        setOpportunities(prev => prev.filter(o => o._id !== id));
      }
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || 'Failed to update bookmark');
    }
  }, [optimisticUpdate, setOpportunities, showBookmarked]);

  const handleDelete = useCallback(async () => {
    if (!deleteState.id) return;
    setDeleteState((current) => ({ ...current, loading: true }));
    try {
      await API.delete(`/opportunities/${deleteState.id}`);
      setOpportunities(prev => prev.filter(o => o._id !== deleteState.id));
      setDeleteState({ open: false, id: '', loading: false });
      toast.success('Deleted');
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || 'Delete failed');
      setDeleteState((current) => ({ ...current, loading: false }));
    }
  }, [deleteState.id, setOpportunities]);

  const bookmarkedCount = opportunities.filter(o => o.isBookmarked).length;

  return (
    <div>
      <ConfirmDialog
        open={deleteState.open}
        title="Delete opportunity"
        description="Are you sure you want to delete this opportunity?"
        confirmLabel="Delete"
        loading={deleteState.loading}
        onConfirm={handleDelete}
        onClose={() => setDeleteState({ open: false, id: '', loading: false })}
      />
      {showModal && <OpportunityModal onClose={() => setShowModal(false)} onSaved={() => fetchOpps(1)} />}

      <PageHeader
        title="Opportunities"
        subtitle={`${pagination.total} opportunities available`}
        action={canPost && <button onClick={() => setShowModal(true)} className="btn-primary"><FiPlus size={15}/> Post Opportunity</button>}
      />

      {error ? <Alert type="error" message={error} /> : null}

      {/* Type filter tabs */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-5">
        {TYPES.map(type => {
          const cfg = TYPE_CONFIG[type]; const Icon = cfg.icon;
          return (
            <button key={type} onClick={() => setActiveType(activeType === type ? '' : type)}
              className={`card p-3 flex flex-col items-center gap-1.5 text-center transition-all hover:-translate-y-0.5 ${activeType === type ? `ring-2 ring-offset-1 ${cfg.border}` : ''}`}>
              <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${cfg.color} flex items-center justify-center`}>
                <Icon size={14} className="text-white"/>
              </div>
              <p className="text-xs font-semibold text-gray-700">{type}</p>
            </button>
          );
        })}
      </div>

      {/* Search + filter bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={15}/>
          <input className="input pl-10" placeholder="Search opportunities..." value={search} onChange={e => setSearch(e.target.value)}/>
        </div>
        <button onClick={() => setShowBookmarked(!showBookmarked)}
          className={`btn-secondary gap-2 ${showBookmarked ? 'border-yellow-400 text-yellow-600 bg-yellow-50' : ''}`}>
          <FiBookmark size={15} className={showBookmarked ? 'fill-current' : ''}/>
          Saved {bookmarkedCount > 0 && `(${bookmarkedCount})`}
        </button>
        {(activeType || search || showBookmarked) && (
          <button onClick={() => { setActiveType(''); setSearch(''); setShowBookmarked(false); }}
            className="btn-secondary text-red-500 border-red-200">
            <FiX size={15}/> Clear
          </button>
        )}
      </div>

      {loading ? <OpportunitiesSkeleton /> : opportunities.length === 0 ? (
        <EmptyState
          icon={showBookmarked ? '🔖' : '💼'}
          title={showBookmarked ? 'No saved opportunities' : 'No opportunities found'}
          description={showBookmarked ? 'Bookmark opportunities to find them here' : 'Check back later for new opportunities'}
          action={canPost && !showBookmarked ? <button onClick={() => setShowModal(true)} className="btn-primary"><FiPlus size={15}/> Post First Opportunity</button> : null}
        />
      ) : (
        <>
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4 stagger">
            {opportunities.map(opp => (
              <OpportunityCard key={opp._id} opp={opp}
                onBookmark={handleBookmark}
                canDelete={canPost}
                onDelete={(id) => setDeleteState({ open: true, id, loading: false })}
              />
            ))}
          </div>
          {pagination.totalPages > 1 && (
            <div className="flex justify-center items-center gap-3 mt-6">
              <button onClick={() => fetchOpps(pagination.currentPage-1)} disabled={pagination.currentPage===1} className="btn-secondary">Previous</button>
              <span className="text-sm text-gray-500">Page {pagination.currentPage} of {pagination.totalPages}</span>
              <button onClick={() => fetchOpps(pagination.currentPage+1)} disabled={pagination.currentPage===pagination.totalPages} className="btn-secondary">Next</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
