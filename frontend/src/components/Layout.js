import React, { useState } from 'react';
import NotificationBell from "./NotificationBell";
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../context/PermissionContext';
import { getInitials, getRoleColor, getRoleLabel } from '../utils/helpers';
import { useTheme } from '../context/ThemeContext';
import { FiMessageCircle } from 'react-icons/fi';
import {
  FiHome, FiList, FiPlusCircle, FiUsers, FiUser,
  FiLogOut, FiMenu, FiX, FiChevronRight,
  FiSpeaker, FiMessageSquare, FiHelpCircle, FiShield,
} from 'react-icons/fi';

const NavItem = ({ to, icon: Icon, label, end = false, onClick }) => (
  <NavLink to={to} end={end} onClick={onClick}
    className={({ isActive }) =>
      `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative ${
        isActive
          ? 'bg-white/15 text-white shadow-lg backdrop-blur-sm border border-white/20'
          : 'text-blue-100/70 hover:bg-white/10 hover:text-white'
      }`
    }>
    {({ isActive }) => (
      <>
        {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-yellow-400 rounded-r-full" />}
        <Icon size={17} className={`flex-shrink-0 ${isActive ? 'text-yellow-300' : ''}`} />
        <span className="flex-1">{label}</span>
        {!isActive && <FiChevronRight size={13} className="opacity-0 group-hover:opacity-40 transition-opacity" />}
      </>
    )}
  </NavLink>
);

const SectionLabel = ({ label }) => (
  <p className="text-blue-300/50 text-xs font-semibold uppercase tracking-widest px-3 pt-3 pb-1">{label}</p>
);

export default function Layout() {
  const { user, logout } = useAuth();
  const { hasPermission } = usePermissions();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };
  const closeSidebar = () => setSidebarOpen(false);

  const pageTitles = {
    '/dashboard':     'Dashboard',
    '/tickets':       'Support Tickets',
    '/tickets/new':   'New Ticket',
    '/users':         'User Management',
    '/profile':       'My Profile',
    '/notice-board':  'Notice Board',
    '/announcements': 'Notice Board',
    '/ai-assistant':  'AI Assistant',
    '/faq':           'FAQ',
    '/group-chat':    'Group Chat',
    '/permissions':   'Permissions',
  };
  const pageTitle = pageTitles[location.pathname] || 'Sharda Platform';

  const mainNavItems = [
    { to: '/dashboard', icon: FiHome, label: 'Dashboard', end: true },
    { to: '/notice-board', icon: FiSpeaker, label: 'Notice Board' },
    { to: '/group-chat', icon: FiMessageCircle, label: 'Group Chat', visible: hasPermission('canViewChat') },
  ].filter((item) => item.visible !== false);

  const helpdeskNavItems = [
    { to: '/tickets', icon: FiList, label: 'My Tickets', visible: hasPermission('canCreateTickets') || hasPermission('canHandleTickets') },
    { to: '/tickets/new', icon: FiPlusCircle, label: 'New Ticket', visible: hasPermission('canCreateTickets') },
  ].filter((item) => item.visible !== false);

  const supportNavItems = [
    { to: '/ai-assistant', icon: FiMessageSquare, label: 'AI Assistant' },
    { to: '/faq', icon: FiHelpCircle, label: 'FAQ' },
  ];

  const adminNavItems = [
    { to: '/users', icon: FiUsers, label: 'User Management', visible: hasPermission('canManageUsers') },
    { to: '/permissions', icon: FiShield, label: 'Permissions', visible: hasPermission('canManagePermissions') },
  ].filter((item) => item.visible !== false);

  const SidebarContent = () => (
    <div className="flex flex-col h-full sidebar-bg">
      <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-blue-400/10 -translate-y-1/2 translate-x-1/2 pointer-events-none" />
      <div className="absolute bottom-20 left-0 w-32 h-32 rounded-full bg-cyan-400/10 translate-y-1/2 -translate-x-1/2 pointer-events-none" />

      {/* Logo */}
      <div className="relative px-5 pt-6 pb-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden bg-white p-1 shadow-lg flex-shrink-0">
            <img src="/sharda-logo.png" alt="Sharda University" className="w-full h-full object-contain"
              onError={e => { e.target.style.display='none'; }} />
          </div>
          <div>
            <p className="font-display font-bold text-white text-base leading-none">Sharda</p>
            <p className="font-display font-bold text-white text-base leading-none">University</p>
            <p className="text-blue-300/80 text-xs mt-0.5 font-medium tracking-wide">Student Platform</p>
          </div>
          {sidebarOpen && (
            <button onClick={closeSidebar} className="ml-auto text-white/50 hover:text-white p-1">
              <FiX size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto relative">
        <SectionLabel label="Main" />
        {mainNavItems.map((item) => (
          <NavItem key={item.to} to={item.to} icon={item.icon} label={item.label} end={item.end} onClick={closeSidebar} />
        ))}

        {helpdeskNavItems.length > 0 && (
          <>
            <SectionLabel label="Helpdesk" />
            {helpdeskNavItems.map((item) => (
              <NavItem key={item.to} to={item.to} icon={item.icon} label={item.label} onClick={closeSidebar} />
            ))}
          </>
        )}

        <SectionLabel label="Support" />
        {supportNavItems.map((item) => (
          <NavItem key={item.to} to={item.to} icon={item.icon} label={item.label} onClick={closeSidebar} />
        ))}

        {adminNavItems.length > 0 && (
          <>
            <SectionLabel label="Admin" />
            {adminNavItems.map((item) => (
              <NavItem key={item.to} to={item.to} icon={item.icon} label={item.label} onClick={closeSidebar} />
            ))}
          </>
        )}
      </nav>

      {/* Bottom */}
      <div className="px-3 pb-3 space-y-0.5 relative border-t border-white/10 pt-3">
        <NavItem to="/profile" icon={FiUser} label="My Profile" onClick={closeSidebar} />
        <button onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-blue-100/60 hover:bg-red-500/20 hover:text-red-300 transition-all duration-200">
          <FiLogOut size={17} /><span>Sign Out</span>
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
          <span className={`badge text-xs ${getRoleColor(user?.role)}`}>{getRoleLabel(user?.role)}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="app-shell flex h-screen overflow-hidden">
      <div className="hidden md:flex flex-col w-60 flex-shrink-0 relative overflow-hidden shadow-xl">
        <SidebarContent />
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={closeSidebar} />
          <div className="relative z-50 w-64 animate-slide-left shadow-2xl"><SidebarContent /></div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 glass border-b border-blue-100/60 flex items-center justify-between px-5 flex-shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <button className="md:hidden p-2 text-gray-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
              onClick={() => setSidebarOpen(true)}>
              <FiMenu size={22} />
            </button>
            <div>
              <h2 className="font-display font-bold text-gray-900 text-lg leading-none">{pageTitle}</h2>
              <p className="text-xs text-gray-400 mt-0.5 hidden sm:block">
                {new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white cursor-pointer shadow-md ${
              isDark ? 'bg-gradient-to-br from-slate-700 to-slate-900' : 'bg-gradient-to-br from-blue-600 to-blue-800'
            }`}>
              {getInitials(user?.name)}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 animate-fade-in-up">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
