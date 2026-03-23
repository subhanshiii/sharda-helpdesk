import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API from '../utils/api';
import { FullPageSpinner, CategoryBadge, StatusBadge, PriorityBadge } from '../components/ui';
import { formatRelative, getCategoryIcon } from '../utils/helpers';
import { FiPlusCircle, FiArrowRight, FiTrendingUp } from 'react-icons/fi';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const StatCard = ({ label, value, icon, from, to, trend }) => (
  <div className="card p-5 overflow-hidden relative group hover:-translate-y-1 transition-all duration-200 animate-fade-in-up">
    <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-5 -translate-y-10 translate-x-10"
      style={{ background: `linear-gradient(135deg, ${from}, ${to})` }} />
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{label}</p>
        <p className="font-display text-4xl font-black mt-1 text-gray-900">{value ?? 0}</p>
        {trend && <p className="text-xs text-emerald-600 font-medium mt-1 flex items-center gap-1"><FiTrendingUp size={11} />{trend}</p>}
      </div>
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-sm"
        style={{ background: `linear-gradient(135deg, ${from}18, ${to}18)` }}>
        {icon}
      </div>
    </div>
    <div className="mt-4 h-1 rounded-full overflow-hidden bg-gray-100">
      <div className="h-full rounded-full transition-all duration-1000"
        style={{ width: `${Math.min((value / 20) * 100, 100)}%`, background: `linear-gradient(90deg, ${from}, ${to})` }} />
    </div>
  </div>
);

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    API.get('/stats').then(r => setStats(r.data.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <FullPageSpinner />;

  const categoryData = (stats?.categoryStats || []).map(c => ({ name: c._id, count: c.count }));
  const BAR_COLORS = ['#1e40af','#7c3aed','#0891b2','#059669','#d97706','#dc2626','#2563eb','#db2777'];

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="space-y-6">
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
          <Link to="/tickets/new" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-blue-900 flex-shrink-0 hover:-translate-y-0.5 transition-all shadow-lg"
            style={{ background: 'linear-gradient(135deg, #fcd34d, #f97316)' }}>
            <FiPlusCircle size={16} /> New Ticket
          </Link>
        </div>
        {/* Color bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: 'linear-gradient(90deg,#f59e0b,#ec4899,#06b6d4,#10b981,#f97316)' }} />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger">
        <StatCard label="Total"       value={stats?.totalTickets}       icon="🎫" from="#1e40af" to="#2563eb" />
        <StatCard label="Open"        value={stats?.openTickets}        icon="🔵" from="#0891b2" to="#06b6d4" trend="Needs attention" />
        <StatCard label="In Progress" value={stats?.inProgressTickets}  icon="⚡" from="#d97706" to="#f59e0b" />
        <StatCard label="Resolved"    value={stats?.resolvedTickets}    icon="✅" from="#059669" to="#10b981" trend="Great work!" />
      </div>

      {['admin','agent'].includes(user?.role) && (
        <div className="grid grid-cols-2 gap-4 stagger">
          <StatCard label="Students"     value={stats?.totalUsers}  icon="🎓" from="#7c3aed" to="#8b5cf6" />
          <StatCard label="Support Staff" value={stats?.totalAgents} icon="👨‍💼" from="#db2777" to="#ec4899" />
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Bar chart */}
        {categoryData.length > 0 && (
          <div className="card p-5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display font-bold text-gray-900">Tickets by Category</h2>
              <span className="badge bg-blue-50 text-blue-700 border border-blue-100">This month</span>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={categoryData} margin={{ top:0, right:0, left:-20, bottom:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize:10, fill:'#94a3b8' }} interval={0} angle={-20} textAnchor="end" height={45} />
                <YAxis tick={{ fontSize:11, fill:'#94a3b8' }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize:12, borderRadius:12, border:'1px solid #e2e8f0', boxShadow:'0 4px 20px rgba(0,0,0,0.1)' }} formatter={v => [v,'Tickets']} />
                <Bar dataKey="count" radius={[6,6,0,0]}>
                  {categoryData.map((_,i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Priority breakdown */}
        {stats?.priorityStats?.length > 0 && (
          <div className="card p-5">
            <h2 className="font-display font-bold text-gray-900 mb-5">Priority Breakdown</h2>
            <div className="space-y-4">
              {stats.priorityStats.map(p => {
                const pct = Math.round((p.count / (stats.totalTickets || 1)) * 100);
                const styles = {
                  Critical: { bar:'#dc2626', bg:'bg-red-50',    text:'text-red-700'    },
                  High:     { bar:'#f97316', bg:'bg-orange-50', text:'text-orange-700' },
                  Medium:   { bar:'#2563eb', bg:'bg-blue-50',   text:'text-blue-700'   },
                  Low:      { bar:'#10b981', bg:'bg-green-50',  text:'text-green-700'  },
                };
                const s = styles[p._id] || { bar:'#94a3b8', bg:'bg-gray-50', text:'text-gray-600' };
                return (
                  <div key={p._id} className={`p-3 rounded-xl ${s.bg}`}>
                    <div className="flex justify-between items-center mb-2">
                      <span className={`text-sm font-bold ${s.text}`}>{p._id}</span>
                      <span className="text-xs text-gray-500 font-medium">{p.count} tickets · {pct}%</span>
                    </div>
                    <div className="h-2 bg-white/60 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width:`${pct}%`, backgroundColor: s.bar }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Recent tickets */}
      {stats?.recentTickets?.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <h2 className="font-display font-bold text-gray-900">Recent Tickets</h2>
            <Link to="/tickets" className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1">
              View all <FiArrowRight size={12} />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {stats.recentTickets.map(t => (
              <Link key={t._id} to={`/tickets/${t._id}`}
                className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-blue-50/50 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-mono text-gray-400">{t.ticketId}</span>
                    <CategoryBadge category={t.category} />
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

      {!stats?.totalTickets && (
        <div className="card p-12 text-center">
          <div className="text-6xl mb-4">🎫</div>
          <h3 className="font-display text-xl font-bold text-gray-800">No tickets yet</h3>
          <p className="text-gray-500 text-sm mb-5 mt-1">Create your first support ticket to get started</p>
          <Link to="/tickets/new" className="btn-primary inline-flex"><FiPlusCircle size={16} /> Create Ticket</Link>
        </div>
      )}
    </div>
  );
}
