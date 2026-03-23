import React, { useState, useEffect, useCallback } from 'react';
import API from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { PageHeader, FullPageSpinner, EmptyState, Alert } from '../components/ui';
import { formatDate } from '../utils/helpers';
import {
  FiPlus, FiSearch, FiBookmark, FiExternalLink, FiX,
  FiCalendar, FiMapPin, FiDollarSign, FiTag, FiFilter,
  FiBriefcase, FiAward, FiCode, FiBook, FiStar, FiUsers,
} from 'react-icons/fi';

// ── Type config ───────────────────────────────────────
const TYPE_CONFIG = {
  Internship:  { icon: FiBriefcase, color: 'from-blue-500 to-cyan-500',    bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200'  },
  Hackathon:   { icon: FiCode,      color: 'from-violet-500 to-purple-600', bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200'},
  Competition: { icon: FiAward,     color: 'from-orange-500 to-amber-500',  bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200'},
  Workshop:    { icon: FiBook,      color: 'from-teal-500 to-green-500',    bg: 'bg-teal-50',   text: 'text-teal-700',   border: 'border-teal-200'  },
  Job:         { icon: FiUsers,     color: 'from-pink-500 to-rose-500',     bg: 'bg-pink-50',   text: 'text-pink-700',   border: 'border-pink-200'  },
  Scholarship: { icon: FiStar,      color: 'from-yellow-500 to-orange-400', bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200'},
};

const TYPES = Object.keys(TYPE_CONFIG);

// ── Deadline badge ────────────────────────────────────
const DeadlineBadge = ({ deadline }) => {
  if (!deadline) return null;
  const days = Math.ceil((new Date(deadline) - new Date()) / (1000 * 60 * 60 * 24));
  if (days < 0)  return <span className="badge bg-gray-100 text-gray-500">Expired</span>;
  if (days <= 3) return <span className="badge bg-red-100 text-red-700 animate-pulse">🔥 {days}d left</span>;
  if (days <= 7) return <span className="badge bg-orange-100 text-orange-700">⚡ {days}d left</span>;
  return <span className="badge bg-green-100 text-green-700">📅 {days}d left</span>;
};

// ── Opportunity Card ──────────────────────────────────
const OpportunityCard = ({ opp, onBookmark, canDelete, onDelete }) => {
  const cfg = TYPE_CONFIG[opp.type] || TYPE_CONFIG.Internship;
  const Icon = cfg.icon;

  return (
    <div className="card overflow-hidden hover:-translate-y-1 hover:shadow-card-hover transition-all duration-200 flex flex-col animate-fade-in-up">
      {/* Top gradient bar */}
      <div className={`h-1.5 w-full bg-gradient-to-r ${cfg.color}`} />

      <div className="p-5 flex flex-col flex-1">
        {/* Header */}
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
          <button
            onClick={() => onBookmark(opp._id)}
            className={`p-2 rounded-xl transition-all ${opp.isBookmarked ? 'text-yellow-500 bg-yellow-50' : 'text-gray-300 hover:text-yellow-500 hover:bg-yellow-50'}`}
          >
            <FiBookmark size={16} className={opp.isBookmarked ? 'fill-current' : ''} />
          </button>
        </div>

        {/* Title & Description */}
        <h3 className="font-display font-bold text-gray-900 text-sm mb-1.5 line-clamp-2">{opp.title}</h3>
        <p className="text-xs text-gray-500 leading-relaxed line-clamp-3 flex-1">{opp.description}</p>

        {/* Meta info */}
        <div className="mt-3 space-y-1.5">
          {opp.location && (
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <FiMapPin size={11} /> {opp.location}
            </div>
          )}
          {opp.stipend && (
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <FiDollarSign size={11} /> {opp.stipend}
            </div>
          )}
          {opp.deadline && (
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <FiCalendar size={11} /> Deadline: {formatDate(opp.deadline).split(',')[0]}
            </div>
          )}
        </div>

        {/* Tags */}
        {opp.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {opp.tags.slice(0, 3).map(tag => (
              <span key={tag} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">{tag}</span>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-50">
          <div className="flex items-center gap-2">
            <DeadlineBadge deadline={opp.deadline} />
          </div>
          <div className="flex items-center gap-1.5">
            {canDelete && (
              <button onClick={() => onDelete(opp._id)}
                className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                <FiX size={13} />
              </button>
            )}
            {opp.externalLink && (
              <a href={opp.externalLink} target="_blank" rel="noreferrer"
                className="btn-primary py-1.5 px-3 text-xs">
                Apply <FiExternalLink size={11} />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Create/Edit Modal ─────────────────────────────────
const OpportunityModal = ({ onClose, onSaved, editData = null }) => {
  const [form, setForm] = useState({
    title:       editData?.title       || '',
    description: editData?.description || '',
    type:        editData?.type        || 'Internship',
    company:     editData?.company     || '',
    location:    editData?.location    || 'Remote',
    externalLink:editData?.externalLink|| '',
    deadline:    editData?.deadline ? editData.deadline.slice(0, 10) : '',
    stipend:     editData?.stipend     || '',
    eligibility: editData?.eligibility || '',
    tags:        editData?.tags?.join(', ') || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.description || !form.type) {
      setError('Title, description and type are required');
      return;
    }
    setLoading(true);
    try {
      if (editData) {
        await API.put(`/opportunities/${editData._id}`, form);
        toast.success('Opportunity updated!');
      } else {
        await API.post('/opportunities', form);
        toast.success('Opportunity posted!');
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-fade-in-up">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="font-display font-bold text-gray-900">
            {editData ? 'Edit Opportunity' : 'Post New Opportunity'}
          </h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
            <FiX size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && <Alert type="error" message={error} />}

          {/* Type selector */}
          <div>
            <label className="label">Type <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {TYPES.map(type => {
                const cfg = TYPE_CONFIG[type];
                const Icon = cfg.icon;
                return (
                  <button key={type} type="button"
                    onClick={() => setForm(f => ({ ...f, type }))}
                    className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 transition-all text-xs font-semibold ${
                      form.type === type
                        ? `border-transparent bg-gradient-to-br ${cfg.color} text-white shadow-md`
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}>
                    <Icon size={16} />
                    {type}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="label">Title <span className="text-red-500">*</span></label>
              <input className="input" value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Software Engineer Intern at Google" />
            </div>
            <div>
              <label className="label">Company / Organization</label>
              <input className="input" value={form.company}
                onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
                placeholder="e.g. Google, IIT Delhi" />
            </div>
            <div>
              <label className="label">Location</label>
              <input className="input" value={form.location}
                onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                placeholder="Remote / Delhi / Hybrid" />
            </div>
          </div>

          <div>
            <label className="label">Description <span className="text-red-500">*</span></label>
            <textarea className="input resize-none" rows={4} value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Describe the opportunity, responsibilities, requirements..." />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Deadline</label>
              <input type="date" className="input" value={form.deadline}
                onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} />
            </div>
            <div>
              <label className="label">Stipend / Salary</label>
              <input className="input" value={form.stipend}
                onChange={e => setForm(f => ({ ...f, stipend: e.target.value }))}
                placeholder="e.g. ₹15,000/month or Unpaid" />
            </div>
          </div>

          <div>
            <label className="label">Eligibility</label>
            <input className="input" value={form.eligibility}
              onChange={e => setForm(f => ({ ...f, eligibility: e.target.value }))}
              placeholder="e.g. B.Tech 3rd/4th year, CGPA > 7.5" />
          </div>

          <div>
            <label className="label">Apply Link</label>
            <div className="relative">
              <FiExternalLink className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input className="input pl-9" value={form.externalLink}
                onChange={e => setForm(f => ({ ...f, externalLink: e.target.value }))}
                placeholder="https://apply.example.com" />
            </div>
          </div>

          <div>
            <label className="label">Tags <span className="text-gray-400 font-normal normal-case">(comma-separated)</span></label>
            <div className="relative">
              <FiTag className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input className="input pl-9" value={form.tags}
                onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                placeholder="e.g. React, Python, Machine Learning" />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center py-2.5">
              {loading ? 'Saving...' : editData ? 'Update Opportunity' : 'Post Opportunity'}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────
export default function OpportunitiesPage() {
  const { user } = useAuth();
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showBookmarked, setShowBookmarked] = useState(false);
  const [activeType, setActiveType] = useState('');
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1, currentPage: 1 });

  const canPost = ['admin', 'clubhead'].includes(user?.role);

  const fetchOpportunities = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      if (showBookmarked) {
        const res = await API.get('/opportunities/bookmarked');
        setOpportunities(res.data.data);
        setPagination({ total: res.data.count, totalPages: 1, currentPage: 1 });
      } else {
        const params = new URLSearchParams({ page, limit: 12 });
        if (activeType) params.append('type', activeType);
        if (search)     params.append('search', search);
        const res = await API.get(`/opportunities?${params}`);
        setOpportunities(res.data.data);
        setPagination({ total: res.data.total, totalPages: res.data.totalPages, currentPage: res.data.currentPage });
      }
    } catch { setOpportunities([]); }
    finally { setLoading(false); }
  }, [activeType, search, showBookmarked]);

  useEffect(() => { fetchOpportunities(1); }, [fetchOpportunities]);

  const handleBookmark = async (id) => {
    try {
      const res = await API.put(`/opportunities/${id}/bookmark`);
      toast.success(res.data.message);
      setOpportunities(prev =>
        prev.map(o => o._id === id
          ? { ...o, isBookmarked: res.data.isBookmarked, bookmarkCount: res.data.bookmarkCount }
          : o
        ).filter(o => showBookmarked ? o.isBookmarked : true)
      );
    } catch { toast.error('Failed to bookmark'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this opportunity?')) return;
    try {
      await API.delete(`/opportunities/${id}`);
      toast.success('Deleted');
      setOpportunities(prev => prev.filter(o => o._id !== id));
    } catch { toast.error('Delete failed'); }
  };

  const bookmarkedCount = opportunities.filter(o => o.isBookmarked).length;

  return (
    <div>
      {showModal && (
        <OpportunityModal
          onClose={() => setShowModal(false)}
          onSaved={() => fetchOpportunities(1)}
        />
      )}

      <PageHeader
        title="Opportunities"
        subtitle={`${pagination.total} opportunities available`}
        action={
          canPost && (
            <button onClick={() => setShowModal(true)} className="btn-primary">
              <FiPlus size={15} /> Post Opportunity
            </button>
          )
        }
      />

      {/* Stats bar */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-5">
        {TYPES.map(type => {
          const cfg = TYPE_CONFIG[type];
          const Icon = cfg.icon;
          const count = opportunities.filter(o => o.type === type).length;
          return (
            <button key={type}
              onClick={() => setActiveType(activeType === type ? '' : type)}
              className={`card p-3 flex flex-col items-center gap-1.5 text-center transition-all hover:-translate-y-0.5 ${
                activeType === type ? `ring-2 ring-offset-1 ${cfg.border}` : ''
              }`}>
              <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${cfg.color} flex items-center justify-center`}>
                <Icon size={14} className="text-white" />
              </div>
              <p className="text-xs font-semibold text-gray-700">{type}</p>
            </button>
          );
        })}
      </div>

      {/* Search + filter bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
          <input
            className="input pl-10"
            placeholder="Search opportunities, companies, skills..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button
          onClick={() => setShowBookmarked(!showBookmarked)}
          className={`btn-secondary gap-2 ${showBookmarked ? 'border-yellow-400 text-yellow-600 bg-yellow-50' : ''}`}
        >
          <FiBookmark size={15} className={showBookmarked ? 'fill-current' : ''} />
          Saved {bookmarkedCount > 0 && `(${bookmarkedCount})`}
        </button>
        {(activeType || search || showBookmarked) && (
          <button
            onClick={() => { setActiveType(''); setSearch(''); setShowBookmarked(false); }}
            className="btn-secondary text-red-500 border-red-200 hover:bg-red-50"
          >
            <FiX size={15} /> Clear
          </button>
        )}
      </div>

      {/* Opportunities grid */}
      {loading ? (
        <FullPageSpinner />
      ) : opportunities.length === 0 ? (
        <EmptyState
          icon={showBookmarked ? '🔖' : '💼'}
          title={showBookmarked ? 'No saved opportunities' : 'No opportunities found'}
          description={showBookmarked ? 'Bookmark opportunities to find them here' : 'Check back later for new opportunities'}
          action={
            canPost && !showBookmarked ? (
              <button onClick={() => setShowModal(true)} className="btn-primary">
                <FiPlus size={15} /> Post First Opportunity
              </button>
            ) : null
          }
        />
      ) : (
        <>
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4 stagger">
            {opportunities.map(opp => (
              <OpportunityCard
                key={opp._id}
                opp={opp}
                onBookmark={handleBookmark}
                canDelete={canPost || opp.postedBy?._id === user?._id}
                onDelete={handleDelete}
              />
            ))}
          </div>

          {pagination.totalPages > 1 && (
            <div className="flex justify-center items-center gap-3 mt-6">
              <button
                onClick={() => fetchOpportunities(pagination.currentPage - 1)}
                disabled={pagination.currentPage === 1}
                className="btn-secondary"
              >Previous</button>
              <span className="text-sm text-gray-500">
                Page {pagination.currentPage} of {pagination.totalPages}
              </span>
              <button
                onClick={() => fetchOpportunities(pagination.currentPage + 1)}
                disabled={pagination.currentPage === pagination.totalPages}
                className="btn-secondary"
              >Next</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
