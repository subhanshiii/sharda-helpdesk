import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API from '../utils/api';
import { FullPageSpinner, StatusBadge, PriorityBadge } from '../components/ui';
import { formatRelative } from '../utils/helpers';
import {
  FiPlusCircle, FiArrowRight, FiCalendar, FiBriefcase,
  FiMessageSquare, FiHelpCircle, FiBookmark, FiSpeaker,
  FiAlertTriangle, FiInfo, FiCheckCircle, FiZap, FiList,
  FiExternalLink, FiMapPin, FiClock,
} from 'react-icons/fi';

// ── Greeting ──────────────────────────────────────────
const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return { text: 'Good morning', emoji: '☀️' };
  if (h < 17) return { text: 'Good afternoon', emoji: '🌤️' };
  return { text: 'Good evening', emoji: '🌙' };
};

// ── Widget wrapper ────────────────────────────────────
const Widget = ({ title, icon: Icon, iconColor, action, children, className = '' }) => (
  <div className={`card flex flex-col overflow-hidden ${className}`}>
    <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-50">
      <div className="flex items-center gap-2">
        <Icon size={15} className={iconColor || 'text-blue-500'} />
        <h3 className="font-display font-bold text-gray-900 text-sm">{title}</h3>
      </div>
      {action && (
        <Link to={action.link} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium">
          {action.label} <FiArrowRight size={11} />
        </Link>
      )}
    </div>
    <div className="flex-1">{children}</div>
  </div>
);

const Empty = ({ icon, text }) => (
  <div className="flex flex-col items-center justify-center py-8 text-center px-4">
    <div className="text-3xl mb-2">{icon}</div>
    <p className="text-xs text-gray-400">{text}</p>
  </div>
);

// ── Quick links ───────────────────────────────────────
const QUICK_LINKS = [
  { label: 'New Ticket',    icon: '🎫', link: '/tickets/new',   bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-100'   },
  { label: 'AI Assistant',  icon: '🤖', link: '/ai-assistant',  bg: 'bg-cyan-50',   text: 'text-cyan-700',   border: 'border-cyan-100'   },
  { label: 'FAQ',           icon: '❓', link: '/faq',           bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-100' },
  { label: 'Notice Board', icon: '📢', link: '/notice-board', bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-100'  },
  { label: 'Campus Events', icon: '🎉', link: '/events',        bg: 'bg-pink-50',   text: 'text-pink-700',   border: 'border-pink-100'   },
  { label: 'Calendar',      icon: '📅', link: '/notice-board?view=calendar', bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-100'  },
];

// ── Announcement item ─────────────────────────────────
const ANN_CONFIG = {
  urgent:  { icon: FiZap,           color: 'text-red-500',    bg: 'bg-red-50'    },
  warning: { icon: FiAlertTriangle, color: 'text-amber-500',  bg: 'bg-amber-50'  },
  info:    { icon: FiInfo,          color: 'text-blue-500',   bg: 'bg-blue-50'   },
  success: { icon: FiCheckCircle,   color: 'text-green-500',  bg: 'bg-green-50'  },
};

const AnnouncementItem = ({ a }) => {
  const cfg = ANN_CONFIG[a.type] || ANN_CONFIG.info;
  const Icon = cfg.icon;
  return (
    <div className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${cfg.bg}`}>
        <Icon size={13} className={cfg.color} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate">{a.title}</p>
        <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{a.description || a.message}</p>
        <p className="text-xs text-gray-400 mt-1">{formatRelative(a.createdAt)}</p>
      </div>
    </div>
  );
};

// ── Event item ────────────────────────────────────────
const CAT_EMOJI = { Technical:'💻', Cultural:'🎭', Sports:'⚽', Academic:'🎓', Workshop:'🔧', Seminar:'🎤', Other:'📌' };

const EventItem = ({ event }) => {
  const days  = Math.ceil((new Date(event.date) - new Date()) / (1000*60*60*24));
  const badge = days === 0 ? { label:'Today!', cls:'bg-red-100 text-red-700' }
              : days === 1 ? { label:'Tomorrow', cls:'bg-orange-100 text-orange-700' }
              : days <= 7  ? { label:`${days}d`, cls:'bg-blue-100 text-blue-700' }
              : { label: new Date(event.date).toLocaleDateString('en-IN',{day:'numeric',month:'short'}), cls:'bg-gray-100 text-gray-600' };
  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
      <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-xl flex-shrink-0">
        {CAT_EMOJI[event.category] || '📌'}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate">{event.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {event.venue && <span className="text-xs text-gray-400 flex items-center gap-1"><FiMapPin size={9}/>{event.venue}</span>}
        </div>
      </div>
      <span className={`badge text-xs flex-shrink-0 ${badge.cls}`}>{badge.label}</span>
    </div>
  );
};

// ── Opportunity item ──────────────────────────────────
const OPP_EMOJI  = { Internship:'💼', Hackathon:'💻', Competition:'🏆', Workshop:'🔧', Job:'👔', Scholarship:'🎓' };
const OPP_COLORS = {
  Internship:'bg-blue-50 text-blue-700', Hackathon:'bg-violet-50 text-violet-700',
  Competition:'bg-orange-50 text-orange-700', Workshop:'bg-teal-50 text-teal-700',
  Job:'bg-pink-50 text-pink-700', Scholarship:'bg-yellow-50 text-yellow-700',
};

const OpportunityItem = ({ opp }) => (
  <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
    <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-xl flex-shrink-0">
      {OPP_EMOJI[opp.type] || '💼'}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold text-gray-800 truncate">{opp.title}</p>
      <p className="text-xs text-gray-400">{opp.company || opp.type}</p>
    </div>
    <div className="flex items-center gap-2 flex-shrink-0">
      <span className={`badge text-xs ${OPP_COLORS[opp.type] || 'bg-gray-100 text-gray-600'}`}>{opp.type}</span>
      {opp.externalLink && (
        <a href={opp.externalLink} target="_blank" rel="noreferrer"
          className="p-1.5 text-gray-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors">
          <FiExternalLink size={13}/>
        </a>
      )}
    </div>
  </div>
);

// ── Ticket item ───────────────────────────────────────
const TicketItem = ({ ticket }) => (
  <Link to={`/tickets/${ticket._id}`}
    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-0.5">
        <span className="text-xs font-mono text-gray-400">{ticket.ticketId}</span>
      </div>
      <p className="text-sm font-semibold text-gray-800 truncate">{ticket.title}</p>
      <p className="text-xs text-gray-400">{formatRelative(ticket.createdAt)}</p>
    </div>
    <div className="flex flex-col items-end gap-1">
      <StatusBadge status={ticket.status} />
      <PriorityBadge priority={ticket.priority} />
    </div>
  </Link>
);

// ── Academic Calendar item ────────────────────────────
const CAL_CONFIG = {
  Exam:         { emoji:'📝', bg:'bg-red-50',    text:'text-red-700'    },
  Holiday:      { emoji:'🏖️', bg:'bg-green-50',  text:'text-green-700'  },
  Deadline:     { emoji:'⏰', bg:'bg-orange-50', text:'text-orange-700' },
  Result:       { emoji:'📊', bg:'bg-blue-50',   text:'text-blue-700'   },
  Registration: { emoji:'📋', bg:'bg-violet-50', text:'text-violet-700' },
  Event:        { emoji:'🎯', bg:'bg-pink-50',   text:'text-pink-700'   },
  Other:        { emoji:'📌', bg:'bg-gray-50',   text:'text-gray-700'   },
};

const CalendarItem = ({ item }) => {
  const cfg  = CAL_CONFIG[item.type] || CAL_CONFIG.Other;
  const date = new Date(item.date);
  const days = Math.ceil((date - new Date()) / (1000*60*60*24));
  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
      <div className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center flex-shrink-0 ${cfg.bg}`}>
        <span className="text-base leading-none">{cfg.emoji}</span>
        <span className={`text-xs font-bold leading-none mt-0.5 ${cfg.text}`}>
          {date.toLocaleDateString('en-IN',{day:'numeric',month:'short'}).split(' ')[0]}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate">{item.title}</p>
        <p className="text-xs text-gray-400">
          {date.toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}
        </p>
      </div>
      <span className={`badge text-xs flex-shrink-0 ${
        days <= 3 ? 'bg-red-100 text-red-700' :
        days <= 7 ? 'bg-orange-100 text-orange-700' :
        `${cfg.bg} ${cfg.text}`
      }`}>
        {days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days}d`}
      </span>
    </div>
  );
};

// ── Main Dashboard ────────────────────────────────────
export default function Dashboard() {
  const { user } = useAuth();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const { text: greetText, emoji: greetEmoji } = getGreeting();

  useEffect(() => {
    Promise.all([
      API.get('/stats'),
      API.get('/content?view=feed&limit=5'),
      API.get('/events?filter=upcoming&limit=5'),
      API.get('/opportunities?limit=5'),
      API.get('/opportunities/bookmarked'),
      API.get('/content?view=calendar&limit=5&upcoming=1'),
    ]).then(([stats, ann, events, opps, bookmarked, calendar]) => {
      setData({
        stats:       stats.data.data,
        announcements: ann.data.data || [],
        events:      events.data.data || [],
        opportunities: opps.data.data || [],
        bookmarked:  bookmarked.data.data || [],
        calendar:    calendar.data.data || [],
      });
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <FullPageSpinner />;

  const myTickets = data?.stats?.recentTickets || [];

  return (
    <div className="space-y-5">

      {/* ── Welcome header ── */}
      <div className="rounded-2xl p-5 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg,#0c1654 0%,#1e3a8a 50%,#1e40af 100%)' }}>
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-white/5 -translate-y-24 translate-x-24" />
        <div className="absolute bottom-0 right-1/4 w-32 h-32 rounded-full bg-white/5 translate-y-16" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-blue-300 text-sm font-medium">{greetText} {greetEmoji}</p>
            <h1 className="font-display text-2xl font-black text-white mt-0.5">{user?.name}</h1>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              {[
                { label: `${data?.stats?.openTickets || 0} Open Tickets`,    color: 'bg-blue-500/20 text-blue-200'  },
                { label: `${data?.events?.length || 0} Upcoming Events`,     color: 'bg-pink-500/20 text-pink-200'  },
                { label: `${data?.bookmarked?.length || 0} Saved Opps`,      color: 'bg-green-500/20 text-green-200'},
              ].map(b => (
                <span key={b.label} className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${b.color}`}>{b.label}</span>
              ))}
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Link to="/tickets/new"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm text-blue-900 hover:-translate-y-0.5 transition-all shadow-lg"
              style={{ background:'linear-gradient(135deg,#fcd34d,#f97316)' }}>
              <FiPlusCircle size={15}/> New Ticket
            </Link>
            <Link to="/ai-assistant"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm text-white border border-white/20 hover:bg-white/10 transition-all">
              🤖 Ask AI
            </Link>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-1"
          style={{ background:'linear-gradient(90deg,#f59e0b,#ec4899,#06b6d4,#10b981)' }} />
      </div>

      {/* ── Quick links ── */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {QUICK_LINKS.map(ql => (
          <Link key={ql.label} to={ql.link}
            className={`card flex flex-col items-center gap-2 p-3.5 text-center hover:-translate-y-1 hover:shadow-card-hover transition-all duration-200 border ${ql.border}`}>
            <span className="text-2xl">{ql.icon}</span>
            <span className={`text-xs font-bold ${ql.text}`}>{ql.label}</span>
          </Link>
        ))}
      </div>

      {/* ── Main widget grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">

        {/* Notice Board */}
        <Widget title="Notice Board" icon={FiSpeaker} iconColor="text-amber-500"
          action={{ label:'Open Board', link:'/notice-board' }}>
          {data?.announcements?.length > 0
            ? data.announcements.map(a => <AnnouncementItem key={a._id} a={a} />)
            : <Empty icon="📢" text="No notices yet" />
          }
        </Widget>

        {/* Upcoming events */}
        <Widget title="Upcoming Events" icon={FiCalendar} iconColor="text-pink-500"
          action={{ label:'View all', link:'/events' }}>
          {data?.events?.length > 0
            ? data.events.map(e => <EventItem key={e._id} event={e} />)
            : <Empty icon="🎉" text="No upcoming events" />
          }
        </Widget>

        {/* Academic calendar */}
        <Widget title="Academic Calendar" icon={FiClock} iconColor="text-red-500"
          action={{ label:'Open Calendar', link:'/notice-board?view=calendar' }}>
          {data?.calendar?.length > 0
            ? data.calendar.slice(0,5).map(c => <CalendarItem key={c._id} item={c} />)
            : (
              <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                <div className="text-3xl mb-2">📅</div>
                <p className="text-xs text-gray-400 mb-3">No upcoming dates</p>
                {user?.role === 'admin' && (
                  <Link to="/notice-board?view=calendar" className="text-xs text-blue-600 hover:underline">+ Add dates</Link>
                )}
              </div>
            )
          }
        </Widget>

        {/* My tickets */}
        <Widget title="My Active Tickets" icon={FiList} iconColor="text-blue-500"
          action={{ label:'View all', link:'/tickets' }}>
          {myTickets.length > 0
            ? myTickets.slice(0,4).map(t => <TicketItem key={t._id} ticket={t} />)
            : (
              <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                <div className="text-3xl mb-2">🎫</div>
                <p className="text-xs text-gray-400 mb-3">No tickets yet</p>
                <Link to="/tickets/new" className="btn-primary text-xs py-1.5 px-3">
                  <FiPlusCircle size={12}/> Raise Ticket
                </Link>
              </div>
            )
          }
        </Widget>

        {/* New opportunities */}
        <Widget title="Latest Opportunities" icon={FiBriefcase} iconColor="text-indigo-500"
          action={{ label:'View all', link:'/opportunities' }}>
          {data?.opportunities?.length > 0
            ? data.opportunities.map(o => <OpportunityItem key={o._id} opp={o} />)
            : <Empty icon="💼" text="No opportunities yet" />
          }
        </Widget>

        {/* Bookmarked opportunities */}
        <Widget title="My Saved Opportunities" icon={FiBookmark} iconColor="text-yellow-500"
          action={{ label:'View saved', link:'/opportunities' }}>
          {data?.bookmarked?.length > 0
            ? data.bookmarked.slice(0,5).map(o => <OpportunityItem key={o._id} opp={o} />)
            : (
              <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                <div className="text-3xl mb-2">🔖</div>
                <p className="text-xs text-gray-400 mb-3">No saved opportunities</p>
                <Link to="/opportunities" className="text-xs text-blue-600 hover:underline">Browse opportunities →</Link>
              </div>
            )
          }
        </Widget>

      </div>

      {/* ── Help banner ── */}
      <div className="card p-5 flex flex-col sm:flex-row items-center justify-between gap-4"
        style={{ background:'linear-gradient(135deg,#f0f9ff,#fdf4ff)' }}>
        <div className="flex items-center gap-3">
          <div className="text-3xl">🤖</div>
          <div>
            <p className="font-display font-bold text-gray-900">Need help? Ask the AI Assistant</p>
            <p className="text-sm text-gray-500 mt-0.5">Get instant answers to common questions or raise a support ticket</p>
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Link to="/ai-assistant" className="btn-primary text-sm">
            <FiMessageSquare size={14}/> Ask AI
          </Link>
          <Link to="/faq" className="btn-secondary text-sm">
            <FiHelpCircle size={14}/> Browse FAQ
          </Link>
        </div>
      </div>

    </div>
  );
}
