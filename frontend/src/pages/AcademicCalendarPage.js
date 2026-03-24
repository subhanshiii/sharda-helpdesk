import React, { useState, useEffect } from 'react';
import API from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { PageHeader, FullPageSpinner, EmptyState, Alert } from '../components/ui';
import { FiPlus, FiTrash2, FiX, FiCalendar } from 'react-icons/fi';

const TYPES = ['Exam','Holiday','Event','Deadline','Result','Registration','Other'];
const TYPE_CONFIG = {
  Exam:         { emoji:'📝', bg:'bg-red-50',    text:'text-red-700',    border:'border-red-200'    },
  Holiday:      { emoji:'🏖️', bg:'bg-green-50',  text:'text-green-700',  border:'border-green-200'  },
  Deadline:     { emoji:'⏰', bg:'bg-orange-50', text:'text-orange-700', border:'border-orange-200' },
  Result:       { emoji:'📊', bg:'bg-blue-50',   text:'text-blue-700',   border:'border-blue-200'   },
  Registration: { emoji:'📋', bg:'bg-violet-50', text:'text-violet-700', border:'border-violet-200' },
  Event:        { emoji:'🎯', bg:'bg-pink-50',   text:'text-pink-700',   border:'border-pink-200'   },
  Other:        { emoji:'📌', bg:'bg-gray-50',   text:'text-gray-700',   border:'border-gray-200'   },
};

function AddModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ title:'', date:'', endDate:'', type:'Exam', description:'' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.date) { setError('Title and date are required'); return; }
    setLoading(true);
    try {
      await API.post('/academic-calendar', form);
      toast.success('Date added!');
      onSaved(); onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in-up">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-display font-bold text-gray-900">Add Calendar Date</h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"><FiX size={18}/></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && <Alert type="error" message={error} />}
          <div>
            <label className="label">Type</label>
            <div className="grid grid-cols-4 gap-2">
              {TYPES.map(type => {
                const cfg = TYPE_CONFIG[type];
                return (
                  <button key={type} type="button"
                    onClick={() => setForm(f => ({...f, type}))}
                    className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 text-xs font-semibold transition-all ${
                      form.type === type ? `${cfg.border} ${cfg.bg} ${cfg.text}` : 'border-gray-200 text-gray-500'
                    }`}>
                    <span>{cfg.emoji}</span>{type}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="label">Title</label>
            <input className="input" value={form.title} onChange={e => setForm(f => ({...f, title:e.target.value}))} placeholder="e.g. Mid-Term Examinations" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Date</label>
              <input type="date" className="input" value={form.date} onChange={e => setForm(f => ({...f, date:e.target.value}))} />
            </div>
            <div>
              <label className="label">End Date</label>
              <input type="date" className="input" value={form.endDate} onChange={e => setForm(f => ({...f, endDate:e.target.value}))} />
            </div>
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input resize-none" rows={2} value={form.description} onChange={e => setForm(f => ({...f, description:e.target.value}))} placeholder="Optional details..." />
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">{loading ? 'Adding...' : 'Add Date'}</button>
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AcademicCalendarPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [activeType, setActiveType] = useState('');

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await API.get('/academic-calendar/all');
      setEvents(res.data.data);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchEvents(); }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this date?')) return;
    try {
      await API.delete(`/academic-calendar/${id}`);
      toast.success('Removed');
      setEvents(prev => prev.filter(e => e._id !== id));
    } catch { toast.error('Failed'); }
  };

  const filtered = activeType ? events.filter(e => e.type === activeType) : events;
  const upcoming = filtered.filter(e => new Date(e.date) >= new Date());
  const past     = filtered.filter(e => new Date(e.date) < new Date());

  return (
    <div>
      {showModal && <AddModal onClose={() => setShowModal(false)} onSaved={fetchEvents} />}

      <PageHeader
        title="Academic Calendar"
        subtitle="Important dates, exams, and deadlines"
        action={user?.role === 'admin' && (
          <button onClick={() => setShowModal(true)} className="btn-primary">
            <FiPlus size={15}/> Add Date
          </button>
        )}
      />

      {/* Type filter */}
      <div className="flex flex-wrap gap-2 mb-5">
        <button onClick={() => setActiveType('')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${!activeType ? 'bg-blue-600 text-white border-transparent' : 'bg-white text-gray-600 border-gray-200'}`}>
          All
        </button>
        {TYPES.map(type => {
          const cfg = TYPE_CONFIG[type];
          return (
            <button key={type} onClick={() => setActiveType(activeType === type ? '' : type)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                activeType === type ? `${cfg.bg} ${cfg.text} ${cfg.border}` : 'bg-white text-gray-600 border-gray-200'
              }`}>
              {cfg.emoji} {type}
            </button>
          );
        })}
      </div>

      {loading ? <FullPageSpinner /> : events.length === 0 ? (
        <EmptyState icon="📅" title="No dates added yet"
          description={user?.role === 'admin' ? 'Add important academic dates for students' : 'No academic dates have been added yet'}
          action={user?.role === 'admin' && <button onClick={() => setShowModal(true)} className="btn-primary"><FiPlus size={15}/> Add First Date</button>}
        />
      ) : (
        <div className="space-y-6">
          {upcoming.length > 0 && (
            <div>
              <h2 className="font-display font-bold text-gray-900 mb-3 flex items-center gap-2">
                <FiCalendar size={16} className="text-blue-500"/> Upcoming
              </h2>
              <div className="space-y-3">
                {upcoming.map(item => {
                  const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.Other;
                  const days = Math.ceil((new Date(item.date) - new Date()) / (1000*60*60*24));
                  return (
                    <div key={item._id} className={`card p-4 border-l-4 ${cfg.border} flex items-center gap-4`}>
                      <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center flex-shrink-0 ${cfg.bg}`}>
                        <span className="text-xl">{cfg.emoji}</span>
                        <span className={`text-xs font-bold ${cfg.text}`}>
                          {new Date(item.date).toLocaleDateString('en-IN',{day:'numeric'})}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900">{item.title}</p>
                        {item.description && <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>}
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(item.date).toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
                          {item.endDate && ` – ${new Date(item.endDate).toLocaleDateString('en-IN',{day:'numeric',month:'long'})}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`badge text-xs ${days <= 3 ? 'bg-red-100 text-red-700' : days <= 7 ? 'bg-orange-100 text-orange-700' : `${cfg.bg} ${cfg.text}`}`}>
                          {days === 0 ? 'Today!' : days === 1 ? 'Tomorrow' : `${days} days`}
                        </span>
                        {user?.role === 'admin' && (
                          <button onClick={() => handleDelete(item._id)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                            <FiTrash2 size={13}/>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {past.length > 0 && (
            <div>
              <h2 className="font-display font-bold text-gray-500 mb-3 text-sm">Past Dates</h2>
              <div className="space-y-2 opacity-60">
                {past.map(item => {
                  const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.Other;
                  return (
                    <div key={item._id} className="card p-3 flex items-center gap-3">
                      <span className="text-lg">{cfg.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-700 truncate">{item.title}</p>
                        <p className="text-xs text-gray-400">{new Date(item.date).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}</p>
                      </div>
                      <span className={`badge text-xs ${cfg.bg} ${cfg.text}`}>{item.type}</span>
                      {user?.role === 'admin' && (
                        <button onClick={() => handleDelete(item._id)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                          <FiTrash2 size={13}/>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
