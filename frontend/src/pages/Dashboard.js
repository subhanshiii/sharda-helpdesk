import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API from '../utils/api';
import { FullPageSpinner, StatusBadge, PriorityBadge } from '../components/ui';
import { formatRelative, getCategoryIcon } from '../utils/helpers';
import {
  FiPlusCircle, FiArrowRight, FiTrendingUp,
  FiCalendar, FiBriefcase, FiMessageSquare, FiSpeaker,
} from 'react-icons/fi';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const StatCard = ({ label, value, icon, from, to, trend, link }) => (
  <Link to={link || '#'} className="card p-5 overflow-hidden relative group hover:-translate-y-1 transition-all duration-200 block animate-fade-in-up">
    <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-5 -translate-y-10 translate-x-10"
      style={{ background: `linear-gradient(135deg, ${from}, ${to})` }} />
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{label}</p>
        <p className="font-display text-4xl font-black mt-1 text-gray-900">{value ?? 0}</p>
        {trend && <p className="text-xs text-emerald-600 font-medium mt-1 flex items-center gap-1"><FiTrendingUp size={11} />{trend}</p>}
      </div>
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
        style={{ background: `linear-gradient(135deg, ${from}18, ${to}18)` }}>
        {icon}
      </div>
    </div>
    <div className="mt-4 h-1 rounded-full overflow-hidden bg-gray-100">
      <div className="h-full rounded-full transition-all duration-1000"
        style={{ width: `${Math.min(((value || 0) / 20) * 100, 100)}%`, background: `linear-gradient(90deg, ${from}, ${to})` }} />
    </div>
  </Link>
);

const AnnouncementBanner = ({ a }) => {
  const colors = {
    urgent:  'from-red-500 to-rose-600',
    warning: 'from-amber-500 to-orange-500',
    info:    'from-blue-500 to-cyan-500',
    success: 'from-green-500 to-emerald-500',
  };
  const icons = { urgent: '🚨', warning: '⚠️', info: 'ℹ️', success: '✅' };
  return (
    <div className={`flex items-start gap-3 p-3 rounded-xl text-white bg-gradient-to-r ${colors[a.type] || colors.info}`}>
      <span className="text-lg flex-shrink-0">{icons[a.type] || 'ℹ️'}</span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm">{a.title}</p>
        <p className="text-xs text-white/80 mt-0.5 line-clamp-1">{a.message}</p>
      </div>
      <span className="text-xs text-white/70 flex-shrink-0">{formatRelative(a.createdAt)}</span>
    </div>
  );
};

const EventMini = ({ event }) => {
  const catEmoji = { Technical:'💻', Cultural:'🎭', Sports:'⚽', Academic:'🎓', Workshop:'🔧', Seminar:'🎤', Other:'📌' };
  const days = Math.ceil((new Date(event.date) - new Date()) / (1000*60*60*24));
  return (
    <Link to="/events" className="flex items-center gap-3 p-3 rounded-xl hover:bg-blue-50 transition-colors">
      <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-xl flex-shrink-0">
        {catEmoji[event.category] || '📌'}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate">{event.title}</p>
        <p className="text-xs text-gray-400">{event.venue || 'Sharda University'}</p>
      </div>
      <span className={`badge text-xs flex-shrink-0 ${days <= 1 ? 'bg-red-100 text-red-700' : days <= 7 ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
        {days === 0 ? 'Today!' : days === 1 ? 'Tomorrow' : `${days}d`}
      </span>
    </Link>
  );
};

const OpportunityMini = ({ opp }) => {
  const icons = { Internship:'💼', Hackathon:'💻', Competition:'🏆', Workshop:'🔧', Job:'👔', Scholarship:'🎓' };
  return (
    <Link to="/opportunities" className="flex items-center gap-3 p-3 rounded-xl hover:bg-blue-50 transition-colors">
      <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-xl flex-shrink-0">
        {icons[opp.type] || '💼'}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate">{opp.title}</p>
        <p className="text-xs text-gray-400">{opp.company || opp.type}</p>
      </div>
      {opp.deadline && (
        <span className="badge bg-gray-100 text-gray-500 text-xs flex-shrink-0">
          {new Date(opp.deadline).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}
        </span>
      )}
    </Link>
  );
};

export default function Dashboard() {
  const { user } = useAuth();
  const [stats,         setStats]         = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [events,        setEvents]        = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [loading,       setLoading]       = useState(true);

  useEffect(() => {
    Promise.all([
      API.get('/stats'),
      API.get('/announcements'),
      API.get('/events?filter=upcoming&limit=4'),
      API.get('/opportunities?limit=4'),
    ]).then(([statsRes, annRes, evRes, oppRes]) => {
      setStats(statsRes.data.data);
      setAnnouncements(annRes.data.data?.slice(0, 3) || []);
      setEvents(evRes.data.data || []);
      setOpportunities(oppRes.data.data || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <FullPageSpinner />;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const BAR_COLORS = ['#1e40af','#7c3aed','#0891b2','#059669','#d97706','#dc2626','#2563eb','#db2777'];
  const categoryData = (stats?.categoryStats || []).map(c => ({ name: c._id, count: c.count }));

  return (
    <div className="space-y-5">
      {/* Welcome banner */}
      <div className="rounded-2xl p-6 text-white relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0c1654 0%, #1e3a8a 50%, #1e40af 100%)' }}>
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/5 -translate-y-32 translate-x-32" />
        <div className="absolute bottom-0 left-1/2 w-48 h-48 rounded-full bg-white/5 translate-y-24" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-blue-300 text-sm font-medium">{greeting} 👋</p>
            <h1 className="font-display text-2xl font-black text-white mt-0.5">{user?.name}</h1>
            <p className="text-blue-200/70 text-sm mt-1">
              {new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link to="/tickets/new" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm text-blue-900 hover:-translate-y-0.5 transition-all shadow-lg"
              style={{ background: 'linear-gradient(135deg, #fcd34d, #f97316)' }}>
              <FiPlusCircle size={15} /> New Ticket
            </Link>
            <Link to="/ai-assistant" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm text-white border border-white/20 hover:bg-white/10 transition-all">
              <FiMessageSquare size={15} /> Ask AI
            </Link>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: 'linear-gradient(90deg,#f59e0b,#ec4899,#06b6d4,#10b981,#f97316)' }} />
      </div>

      {/* Announcements */}
      {announcements.length > 0 && (
        <div className="space-y-2">
          {announcements.map(a => <AnnouncementBanner key={a._id} a={a} />)}
          <Link to="/announcements" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
            View all announcements <FiArrowRight size={11} />
          </Link>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger">
        <StatCard label="Total Tickets"  value={stats?.totalTickets}      icon="🎫" from="#1e40af" to="#2563eb" link="/tickets" />
        <StatCard label="Open"           value={stats?.openTickets}       icon="🔵" from="#0891b2" to="#06b6d4" trend="Needs attention" link="/tickets?status=Open" />
        <StatCard label="In Progress"    value={stats?.inProgressTickets} icon="⚡" from="#d97706" to="#f59e0b" link="/tickets?status=In Progress" />
        <StatCard label="Resolved"       value={stats?.resolvedTickets}   icon="✅" from="#059669" to="#10b981" trend="Great work!" link="/tickets?status=Resolved" />
      </div>

      {/* Main grid */}
      <div className="grid lg:grid-cols-3 gap-5">

        {/* Left col: chart + recent tickets */}
        <div className="lg:col-span-2 space-y-5">

          {/* Category chart */}
          {categoryData.length > 0 && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display font-bold text-gray-900">Tickets by Category</h2>
                <Link to="/tickets" className="text-xs text-blue-600 hover:underline flex items-center gap-1">View all <FiArrowRight size={11} /></Link>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={categoryData} margin={{ top:0, right:0, left:-20, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize:10, fill:'#94a3b8' }} interval={0} angle={-20} textAnchor="end" height={45} />
                  <YAxis tick={{ fontSize:11, fill:'#94a3b8' }} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize:12, borderRadius:12, border:'1px solid #e2e8f0' }} formatter={v => [v,'Tickets']} />
                  <Bar dataKey="count" radius={[6,6,0,0]}>
                    {categoryData.map((_,i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Recent tickets */}
          {stats?.recentTickets?.length > 0 && (
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
                <h2 className="font-display font-bold text-gray-900">Recent Tickets</h2>
                <Link to="/tickets" className="text-xs text-blue-600 hover:underline flex items-center gap-1">View all <FiArrowRight size={11} /></Link>
              </div>
              <div className="divide-y divide-gray-50">
                {stats.recentTickets.map(t => (
                  <Link key={t._id} to={`/tickets/${t._id}`}
                    className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-blue-50/50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-mono text-gray-400">{t.ticketId}</span>
                        <span className="text-xs text-gray-400">{getCategoryIcon(t.category)}</span>
                      </div>
                      <p className="text-sm font-semibold text-gray-800 truncate">{t.title}</p>
                      <p className="text-xs text-gray-400">{t.user?.name} · {formatRelative(t.createdAt)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <StatusBadge status={t.status} />
                      <PriorityBadge priority={t.priority} />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Admin stats */}
          {['admin','agent'].includes(user?.role) && (
            <div className="grid grid-cols-2 gap-4 stagger">
              <StatCard label="Students"     value={stats?.totalUsers}  icon="🎓" from="#7c3aed" to="#8b5cf6" link="/users" />
              <StatCard label="Support Staff" value={stats?.totalAgents} icon="👨‍💼" from="#db2777" to="#ec4899" link="/users" />
            </div>
          )}
        </div>

        {/* Right col: events + opportunities */}
        <div className="space-y-5">

          {/* Upcoming events */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-50">
              <h2 className="font-display font-bold text-gray-900 flex items-center gap-2">
                <FiCalendar size={15} className="text-blue-500" /> Upcoming Events
              </h2>
              <Link to="/events" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                All <FiArrowRight size={11} />
              </Link>
            </div>
            {events.length > 0 ? (
              <div className="p-2 divide-y divide-gray-50">
                {events.slice(0,4).map(e => <EventMini key={e._id} event={e} />)}
              </div>
            ) : (
              <div className="px-4 py-6 text-center text-sm text-gray-400">
                <FiCalendar size={24} className="mx-auto mb-2 opacity-30" />
                No upcoming events
              </div>
            )}
          </div>

          {/* Latest opportunities */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-50">
              <h2 className="font-display font-bold text-gray-900 flex items-center gap-2">
                <FiBriefcase size={15} className="text-indigo-500" /> Opportunities
              </h2>
              <Link to="/opportunities" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                All <FiArrowRight size={11} />
              </Link>
            </div>
            {opportunities.length > 0 ? (
              <div className="p-2 divide-y divide-gray-50">
                {opportunities.slice(0,4).map(o => <OpportunityMini key={o._id} opp={o} />)}
              </div>
            ) : (
              <div className="px-4 py-6 text-center text-sm text-gray-400">
                <FiBriefcase size={24} className="mx-auto mb-2 opacity-30" />
                No opportunities yet
              </div>
            )}
          </div>

          {/* Quick links */}
          <div className="card p-4">
            <h2 className="font-display font-bold text-gray-900 mb-3">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label:'New Ticket',    icon:'🎫', link:'/tickets/new',    color:'bg-blue-50 text-blue-700'   },
                { label:'Ask AI',        icon:'🤖', link:'/ai-assistant',   color:'bg-cyan-50 text-cyan-700'   },
                { label:'FAQ',           icon:'❓', link:'/faq',            color:'bg-violet-50 text-violet-700'},
                { label:'Announcements', icon:'📢', link:'/announcements',  color:'bg-amber-50 text-amber-700' },
              ].map(item => (
                <Link key={item.label} to={item.link}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl text-center hover:-translate-y-0.5 transition-all ${item.color}`}>
                  <span className="text-xl">{item.icon}</span>
                  <span className="text-xs font-semibold">{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
