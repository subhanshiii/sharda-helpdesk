import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getInitials, getRoleColor } from '../utils/helpers';
import {
  FiHome, FiList, FiPlusCircle, FiUsers, FiUser,
  FiLogOut, FiMenu, FiX, FiBell, FiChevronRight, FiSpeaker,
} from 'react-icons/fi';

const ShardaLogo = ({ size = 32 }) => (
  <svg width={size} height={size} viewBox="0 0 80 95" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="80" height="95" rx="10" fill="#1e3a8a"/>
    <polygon points="40,12 44,30 36,30" fill="white"/>
    <ellipse cx="40" cy="55" rx="8" ry="20" fill="#f59e0b" transform="rotate(0,40,55)"/>
    <ellipse cx="40" cy="55" rx="7" ry="18" fill="#ec4899" transform="rotate(35,40,55)"/>
    <ellipse cx="40" cy="55" rx="7" ry="18" fill="#06b6d4" transform="rotate(-35,40,55)"/>
    <ellipse cx="40" cy="55" rx="6" ry="16" fill="#10b981" transform="rotate(65,40,55)"/>
    <ellipse cx="40" cy="55" rx="6" ry="16" fill="#10b981" transform="rotate(-65,40,55)"/>
    <ellipse cx="40" cy="55" rx="5" ry="14" fill="#f97316" transform="rotate(90,40,55)"/>
  </svg>
);

const NavItem = ({ to, icon: Icon, label, end = false, onClick, badge }) => (
  <NavLink
    to={to}
    end={end}
    onClick={onClick}
    className={({ isActive }) =>
      `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative ${
        isActive
          ? 'bg-white/15 text-white shadow-lg backdrop-blur-sm border border-white/20'
          : 'text-blue-100/70 hover:bg-white/10 hover:text-white'
      }`
    }
  >
    {({ isActive }) => (
      <>
        {isActive && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-yellow-400 rounded-r-full" />
        )}
        <Icon size={17} className={`flex-shrink-0 ${isActive ? 'text-yellow-300' : ''}`} />
        <span className="flex-1">{label}</span>
        {badge && (
          <span className="ml-auto w-5 h-5 rounded-full bg-yellow-400 text-blue-900 text-xs font-bold flex items-center justify-center">
            {badge}
          </span>
        )}
        {!isActive && <FiChevronRight size={13} className="opacity-0 group-hover:opacity-40 transition-opacity" />}
      </>
    )}
  </NavLink>
);

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };
  const closeSidebar = () => setSidebarOpen(false);

  const pageTitle = {
    '/dashboard':   'Dashboard',
    '/tickets':     'Support Tickets',
    '/tickets/new': 'New Ticket',
    '/users':       'User Management',
    '/profile':     'My Profile',
  }[location.pathname] || 'Helpdesk';

  const SidebarContent = () => (
    <div className="flex flex-col h-full sidebar-bg">
      {/* Decorative orbs */}
      <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-blue-400/10 -translate-y-1/2 translate-x-1/2 pointer-events-none" />
      <div className="absolute bottom-20 left-0 w-32 h-32 rounded-full bg-cyan-400/10 translate-y-1/2 -translate-x-1/2 pointer-events-none" />

      {/* Logo */}
      <div className="relative px-5 pt-6 pb-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 drop-shadow-lg">
            <ShardaLogo size={40} />
          </div>
          <div>
            <p className="font-display font-bold text-white text-base leading-none">Sharda</p>
            <p className="font-display font-bold text-white text-base leading-none">University</p>
            <p className="text-blue-300/80 text-xs mt-0.5 font-medium tracking-wide">Helpdesk Portal</p>
          </div>
          {sidebarOpen && (
            <button onClick={closeSidebar} className="ml-auto text-white/50 hover:text-white p-1">
              <FiX size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto relative">
        <p className="text-blue-300/50 text-xs font-semibold uppercase tracking-widest px-3 mb-3">Menu</p>
        <NavItem to="/dashboard" icon={FiHome}      label="Dashboard"  end onClick={closeSidebar} />
        <NavItem to="/tickets"   icon={FiList}       label="Tickets"        onClick={closeSidebar} />
        <NavItem to="/tickets/new" icon={FiPlusCircle} label="New Ticket"   onClick={closeSidebar} />
        <NavItem to="/announcements" icon={FiSpeaker}    label="Announcements"     onClick={closeSidebar} />
        {user?.role === 'admin' && (
          <>
            <div className="pt-3 pb-1">
              <p className="text-blue-300/50 text-xs font-semibold uppercase tracking-widest px-3">Admin</p>
            </div>
            <NavItem to="/users" icon={FiUsers} label="User Management" onClick={closeSidebar} />
          </>
        )}
      </nav>

      {/* Bottom */}
      <div className="px-3 pb-3 space-y-1 relative border-t border-white/10 pt-3">
        <NavItem to="/profile" icon={FiUser} label="My Profile" onClick={closeSidebar} />
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-blue-100/60 hover:bg-red-500/20 hover:text-red-300 transition-all duration-200"
        >
          <FiLogOut size={17} />
          <span>Sign Out</span>
        </button>
      </div>

      {/* User card */}
      <div className="mx-3 mb-4 p-3 rounded-xl bg-white/10 border border-white/15 backdrop-blur-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-xs font-bold text-white flex-shrink-0 shadow-lg">
            {getInitials(user?.name)}
          </div>
          <div className="overflow-hidden flex-1">
            <p className="text-xs font-semibold text-white truncate">{user?.name}</p>
            <p className="text-xs text-blue-300/70 truncate">{user?.email}</p>
          </div>
          <span className={`badge text-xs ${getRoleColor(user?.role)}`}>{user?.role}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#f0f4ff' }}>
      {/* Desktop sidebar */}
      <div className="hidden md:flex flex-col w-60 flex-shrink-0 relative overflow-hidden shadow-xl">
        <SidebarContent />
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={closeSidebar} />
          <div className="relative z-50 w-64 animate-slide-left shadow-2xl">
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="h-16 glass border-b border-blue-100/60 flex items-center justify-between px-5 flex-shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              className="md:hidden p-2 text-gray-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
              onClick={() => setSidebarOpen(true)}
            >
              <FiMenu size={22} />
            </button>
            <div>
              <h2 className="font-display font-bold text-gray-900 text-lg leading-none">{pageTitle}</h2>
              <p className="text-xs text-gray-400 mt-0.5 hidden sm:block">
                {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button className="relative p-2.5 text-gray-400 hover:text-blue-700 hover:bg-blue-50 rounded-xl transition-colors">
              <FiBell size={19} />
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-yellow-400 border-2 border-white" />
            </button>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center text-xs font-bold text-white cursor-pointer shadow-md hover:shadow-lg transition-shadow">
              {getInitials(user?.name)}
            </div>
          </div>
        </header>

        {/* Page */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 animate-fade-in-up">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
