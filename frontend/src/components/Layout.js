import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import NotificationBell from "./NotificationBell";
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../context/PermissionContext';
import { getRoleLabel } from '../utils/helpers';
import { useTheme } from '../context/ThemeContext';
import { Avatar } from './ui';
import { FiMessageCircle } from 'react-icons/fi';
import {
  FiHome, FiList, FiUsers,
  FiLogOut, FiMenu, FiX, FiChevronRight, FiArrowLeft,
  FiSpeaker, FiMessageSquare, FiHelpCircle, FiShield, FiBookOpen, FiCalendar, FiUserCheck, FiLayers, FiUser,
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
  const { hasPermission, isSuperAdmin } = usePermissions();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef(null);
  const footerNameRef = useRef(null);
  const [footerNameStyle, setFooterNameStyle] = useState({
    fontSize: '14px',
    lineHeight: 1.1,
    letterSpacing: '-0.01em',
  });

  const handleLogout = () => { logout(); navigate('/login'); };
  const closeSidebar = () => setSidebarOpen(false);
  const openProfilePage = () => { setProfileMenuOpen(false); navigate('/profile'); };
  const handleBackNavigation = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate('/dashboard');
  };
  const canAccessAssignments = ['student', 'faculty', 'admin'].includes(user?.role)
    || hasPermission('canManageAssignments')
    || hasPermission('canSubmitAssignments');
  const canAccessTimetable = ['student', 'faculty', 'admin'].includes(user?.role) || hasPermission('canManageTimetable');
  const canAccessAttendance = ['student', 'faculty', 'admin'].includes(user?.role) || hasPermission('canMarkAttendance');
  const footerDisplayName = user?.name || 'Unknown user';
  const footerRoleTagStyle = user?.adminTier === 'super_admin'
    ? { backgroundColor: '#fef3c7', color: '#b45309' }
    : user?.role === 'admin'
      ? { backgroundColor: '#dbeafe', color: '#1d4ed8' }
      : user?.role === 'faculty'
        ? { backgroundColor: '#ede9fe', color: '#6d28d9' }
        : user?.role === 'staff'
          ? { backgroundColor: '#dcfce7', color: '#15803d' }
          : { backgroundColor: '#f1f5f9', color: '#475569' };

  const pageTitles = {
    '/dashboard':     'Dashboard',
    '/tickets':       'Support Tickets',
    '/tickets/new':   'New Ticket',
    '/assignments':   'Assignments',
    '/timetable':     'Timetable',
    '/timetable/new': 'Create Timetable Slot',
    '/attendance':    'Attendance',
    '/users':         'User Management',
    '/approvals':     'Identity Alerts',
    '/academics':     'Academic Structure',
    '/academics/advanced': 'Advanced Academic Operations',
    '/users/new':     'Provision User',
    '/users/import':  'Import Users',
    '/profile':       'My Profile',
    '/notice-board':  'Notice Board',
    '/announcements': 'Notice Board',
    '/ai-assistant':  'AI Assistant',
    '/faq':           'FAQ',
    '/group-chat':    'Group Chat',
    '/permissions':   'Permissions',
    '/events':        'Events & Calendar',
    '/opportunities': 'Opportunities',
  };
  const pageTitle = (() => {
    if (location.pathname.startsWith('/tickets/')) return 'Ticket Details';
    if (location.pathname.startsWith('/assignments/')) return 'Assignment Details';
    if (location.pathname.startsWith('/timetable/') && location.pathname.endsWith('/edit')) return 'Edit Timetable Slot';
    if (location.pathname.startsWith('/admin/users/')) return 'User Details';
    if (location.pathname.startsWith('/users/') && !location.pathname.endsWith('/edit')) return 'User Details';
    if (location.pathname.startsWith('/users/') && location.pathname.endsWith('/edit')) return 'Edit User';
    return pageTitles[location.pathname] || 'Sharda Platform';
  })();

  const navSections = [
    {
      label: 'Daily Workspace',
      items: [
        { to: '/dashboard', icon: FiHome, label: 'Dashboard', end: true },
        { to: '/notice-board', icon: FiSpeaker, label: 'Notice Board' },
        { to: '/events', icon: FiCalendar, label: 'Events' },
        { to: '/opportunities', icon: FiLayers, label: 'Opportunities' },
        { to: '/group-chat', icon: FiMessageCircle, label: 'Group Chat', visible: hasPermission('canViewChat') },
      ],
    },
    {
      label: 'Academic Operations',
      items: [
        { to: '/assignments', icon: FiBookOpen, label: hasPermission('canManageAssignments') || ['faculty', 'admin'].includes(user?.role) ? 'Assignments' : 'My Work', visible: canAccessAssignments },
        { to: '/timetable', icon: FiCalendar, label: 'Timetable', visible: canAccessTimetable },
        { to: '/attendance', icon: FiUserCheck, label: 'Attendance', visible: canAccessAttendance },
        { to: '/academics', icon: FiLayers, label: 'Academic Structure', visible: hasPermission('canManageAcademics') },
      ],
    },
    {
      label: 'Support & Services',
      items: [
        { to: '/tickets', icon: FiList, label: hasPermission('canHandleTickets') ? 'Support Queue' : 'My Tickets', visible: hasPermission('canCreateTickets') || hasPermission('canHandleTickets') },
        { to: '/ai-assistant', icon: FiMessageSquare, label: 'AI Assistant' },
        { to: '/faq', icon: FiHelpCircle, label: 'FAQ' },
      ],
    },
    {
      label: 'Governance',
      items: [
        { to: '/users', icon: FiUsers, label: 'Identity & Access', visible: hasPermission('canManageUsers') },
        { to: '/approvals', icon: FiUserCheck, label: 'Identity Alerts', visible: hasPermission('canManageUsers') },
        { to: '/permissions', icon: FiShield, label: 'Permissions', visible: isSuperAdmin },
      ],
    },
  ].map((section) => ({ ...section, items: section.items.filter((item) => item.visible !== false) }))
    .filter((section) => section.items.length > 0);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setProfileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useLayoutEffect(() => {
    const nameElement = footerNameRef.current;
    if (!nameElement) return undefined;

    const fitFooterName = () => {
      let fontSize = 14;
      let letterSpacing = -0.01;

      nameElement.style.fontSize = `${fontSize}px`;
      nameElement.style.letterSpacing = `${letterSpacing}em`;

      while (fontSize > 8 && nameElement.scrollWidth > nameElement.clientWidth) {
        fontSize -= 0.5;
        letterSpacing = fontSize <= 9 ? -0.05 : fontSize <= 10.5 ? -0.04 : fontSize <= 12 ? -0.03 : -0.01;
        nameElement.style.fontSize = `${fontSize}px`;
        nameElement.style.letterSpacing = `${letterSpacing}em`;
      }

      setFooterNameStyle({
        fontSize: `${fontSize}px`,
        lineHeight: 1.1,
        letterSpacing: `${letterSpacing}em`,
      });
    };

    fitFooterName();
    window.addEventListener('resize', fitFooterName);
    return () => window.removeEventListener('resize', fitFooterName);
  }, [footerDisplayName, sidebarOpen]);

  const SidebarContent = () => (
    <div className="flex flex-col h-full sidebar-bg">
      <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-blue-400/10 -translate-y-1/2 translate-x-1/2 pointer-events-none" />
      <div className="absolute bottom-20 left-0 w-32 h-32 rounded-full bg-cyan-400/10 translate-y-1/2 -translate-x-1/2 pointer-events-none" />

      {/* Logo */}
      <div className="relative px-5 pt-6 pb-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="sidebar-logo-tile w-10 h-10 rounded-xl overflow-hidden p-1 shadow-lg flex-shrink-0">
            {/* FIXED: restore the original Sharda logo in the sidebar header */}
            <img src="/sharda-logo.png" alt="Sharda University" className="sidebar-logo-image w-full h-full object-contain"
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
        {navSections.map((section) => (
          <React.Fragment key={section.label}>
            <SectionLabel label={section.label} />
            {section.items.map((item) => (
              <NavItem key={item.to} to={item.to} icon={item.icon} label={item.label} end={item.end} onClick={closeSidebar} />
            ))}
          </React.Fragment>
        ))}
      </nav>

      {/* User card */}
      <button
        type="button"
        onClick={() => { closeSidebar(); navigate('/profile'); }}
        className="mx-3 mb-2 h-[76px] overflow-hidden rounded-2xl border border-white/15 bg-white/10 px-3 py-3 text-left backdrop-blur-sm transition hover:bg-white/15"
      >
        <div className="flex items-center gap-2.5">
          <Avatar user={user} size="md" className="shadow-lg flex-shrink-0" />
          <div className="min-w-0 flex-1 overflow-hidden">
            <p
              ref={footerNameRef}
              className="block w-full min-w-0 overflow-hidden text-ellipsis whitespace-nowrap font-semibold text-white"
              style={footerNameStyle}
              title={footerDisplayName}
            >
              {footerDisplayName}
            </p>
            <div className="mt-1">
              <span
                className="inline-flex max-w-full items-center truncate rounded-full px-2.5 py-1 text-[11px] font-bold leading-none"
                style={footerRoleTagStyle}
              >
                {user?.adminTier === 'super_admin' ? 'Super Admin' : getRoleLabel(user?.role)}
              </span>
            </div>
          </div>
        </div>
      </button>
      <p className="px-4 pb-4 text-[11px] leading-4 text-blue-200/55">
        Icons made by Freepik from www.flaticon.com
      </p>
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

      <div className="flex-1 flex flex-col min-w-0">
        <header className="relative z-40 h-16 glass border-b border-blue-100/60 flex items-center justify-between px-5 flex-shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <button className="md:hidden p-2 text-gray-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
              onClick={() => setSidebarOpen(true)}>
              <FiMenu size={22} />
            </button>
            {location.pathname !== '/dashboard' ? (
              <button
                type="button"
                onClick={handleBackNavigation}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
              >
                <FiArrowLeft size={16} />
                Back
              </button>
            ) : null}
            <div>
              <h2 className="font-display font-bold text-gray-900 text-lg leading-none">{pageTitle}</h2>
              <p className="text-xs text-gray-400 mt-0.5 hidden sm:block">
                {new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <div className="relative" ref={profileMenuRef}>
              <button
                type="button"
                onClick={() => setProfileMenuOpen((current) => !current)}
                className="rounded-full"
              >
                <Avatar user={user} size="md" className={`cursor-pointer shadow-md ${isDark ? 'ring-1 ring-slate-700/80' : 'ring-1 ring-slate-200'}`} />
              </button>
              {profileMenuOpen ? (
                <div className={`absolute right-0 top-12 z-50 w-52 rounded-2xl border shadow-xl ${isDark ? 'border-slate-700 bg-slate-900' : 'border-gray-200 bg-white'}`}>
                  <button
                    type="button"
                    onClick={openProfilePage}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-sm transition ${isDark ? 'text-slate-100 hover:bg-slate-800' : 'text-gray-700 hover:bg-gray-50'}`}
                  >
                    <FiUser size={15} />
                    My Profile
                  </button>
                  <div className={isDark ? 'border-t border-slate-700' : 'border-t border-gray-100'} />
                  <button
                    type="button"
                    onClick={() => { setProfileMenuOpen(false); handleLogout(); }}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-sm transition ${isDark ? 'text-red-300 hover:bg-slate-800' : 'text-red-600 hover:bg-red-50'}`}
                  >
                    <FiLogOut size={15} />
                    Logout
                  </button>
                </div>
              ) : null}
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
