import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import NotificationBell from "./NotificationBell";
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../context/PermissionContext';
import { getRoleLabel } from '../utils/helpers';
import { useTheme } from '../context/ThemeContext';
import { Avatar } from './ui';
import PreviewBanner from './ui/PreviewBanner';
import ViewAsModal from './ui/ViewAsModal';
import Breadcrumbs from './ui/Breadcrumbs';
import { hasRole, isAdminUser, isFacultyUser, isStaffUser } from '../utils/access';
import { FiMessageCircle } from 'react-icons/fi';
import {
  FiHome, FiList, FiUsers,
  FiLogOut, FiMenu, FiX, FiChevronRight, FiArrowLeft,
  FiSpeaker, FiMessageSquare, FiHelpCircle, FiShield, FiBookOpen, FiCalendar, FiUserCheck, FiLayers, FiUser, FiFolder, FiClipboard, FiTrendingUp,
} from 'react-icons/fi';

const NavItem = ({ to, icon: Icon, label, end = false, onClick }) => (
  <NavLink to={to} end={end} onClick={onClick}
    className={({ isActive }) =>
      `sidebar-nav-item flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative ${
        isActive ? 'is-active shadow-lg backdrop-blur-sm' : ''
      }`
    }>
    {({ isActive }) => (
      <>
        {isActive && <span className="sidebar-nav-accent absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full" />}
        <Icon size={17} className={`flex-shrink-0 ${isActive ? 'sidebar-nav-icon-active' : ''}`} />
        <span className="flex-1">{label}</span>
        {!isActive && <FiChevronRight size={13} className="sidebar-nav-chevron opacity-0 transition-opacity group-hover:opacity-100" />}
      </>
    )}
  </NavLink>
);

const SectionLabel = ({ label }) => (
  <p className="sidebar-section-label px-3 pt-3 pb-1 text-xs font-semibold uppercase tracking-widest">{label}</p>
);

export default function Layout() {
  const { user, trueUser, logout } = useAuth();
  const { hasPermission, can, isSuperAdmin } = usePermissions();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [viewAsModalOpen, setViewAsModalOpen] = useState(false);
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
  const canAccessAssignments = can('view', 'assignments') || hasPermission('canSubmitAssignments');
  const canAccessTimetable = can('view', 'timetable');
  const canAccessAttendance = can('view', 'attendance') || hasPermission('canMarkAttendance') || hasRole(user, ['student', 'faculty', 'admin']);
  const footerDisplayName = user?.name || 'Unknown user';
  const footerRoleTagStyle = user?.adminTier === 'super_admin'
    ? { backgroundColor: '#fef3c7', color: '#b45309' }
    : isAdminUser(user)
      ? { backgroundColor: '#dbeafe', color: '#1d4ed8' }
      : isFacultyUser(user)
        ? { backgroundColor: '#ede9fe', color: '#6d28d9' }
        : isStaffUser(user)
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
    '/assessments':   'Assessments & Marks',
    '/performance':   'Student Performance',
    '/users':         'User Management',
    '/approvals':     'Identity Alerts',
    '/academics':     'Academic Planning',
    '/academics/subject-management': 'Subject Management',
    '/academics/subject-teachers': 'Subject Management',
    '/users/new':     'Provision User',
    '/users/import':  'Import Users',
    '/profile':       'My Profile',
    '/notice-board':  'Notice Board',
    '/announcements': 'Notice Board',
    '/ai-assistant':  'AI Assistant',
    '/copilot':       'AI Assistant',
    '/faq':           'FAQ',
    '/group-chat':    'Group Chat',
    '/permissions':   'Permissions',
    '/events':        'Events & Calendar',
    '/opportunities': 'Opportunities',
    '/resources':     'Shared Resources',
  };
  const pageTitle = (() => {
    if (location.pathname.startsWith('/tickets/')) return 'Ticket Details';
    if (location.pathname.startsWith('/assignments/')) return 'Assignment Details';
    if (location.pathname.startsWith('/timetable/sections/')) return 'Section Timetable';
    if (location.pathname.startsWith('/timetable/') && location.pathname.endsWith('/edit')) return 'Edit Timetable Slot';
    if (location.pathname.startsWith('/admin/users/')) return 'User Details';
    if (location.pathname.startsWith('/users/') && !location.pathname.endsWith('/edit')) return 'User Details';
    if (location.pathname.startsWith('/users/') && location.pathname.endsWith('/edit')) return 'Edit User';
    if (location.pathname.startsWith('/assessments/') && location.pathname.endsWith('/edit')) return 'Edit Mark Sheet';
    if (location.pathname.startsWith('/academics/sections/') && location.pathname.endsWith('/students')) return 'Enrolled Students';
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
        { to: '/group-chat', icon: FiMessageCircle, label: 'Group Chat', visible: can('view', 'chat') || hasPermission('canViewChat') },
      ],
    },
    {
      label: 'Academic Operations',
      items: [
        { to: '/assignments', icon: FiBookOpen, label: can('create', 'assignments') || can('edit', 'assignments') ? 'Assignments' : 'My Work', visible: canAccessAssignments },
        { to: '/resources', icon: FiFolder, label: 'Shared Resources', visible: can('view', 'resources') },
        { to: '/timetable', icon: FiCalendar, label: 'Timetable', visible: canAccessTimetable },
        { to: '/attendance', icon: FiUserCheck, label: 'Attendance', visible: canAccessAttendance },
        { to: '/assessments', icon: FiClipboard, label: 'Assessments & Marks', visible: can('view', 'assessments') },
        { to: '/performance', icon: FiTrendingUp, label: 'Student Performance', visible: can('view', 'performance') || can('view', 'assessments') },
        { to: '/academics', icon: FiLayers, label: 'Academic Planning', visible: can('view', 'academics') || hasPermission('canManageAcademics') },
      ],
    },
    {
      label: 'Support & Services',
      items: [
        { to: '/tickets', icon: FiList, label: can('view', 'tickets') ? 'Support Tickets' : 'My Tickets', visible: can('view', 'tickets') || hasPermission('canCreateTickets') },
        { to: '/ai-assistant', icon: FiMessageSquare, label: 'AI Assistant' },
        { to: '/faq', icon: FiHelpCircle, label: 'FAQ', visible: can('view', 'faq') },
      ],
    },
    {
      label: 'Administration',
      items: [
        { to: '/users', icon: FiUsers, label: 'Identity & Access', visible: can('view', 'users') || hasPermission('canManageUsers') },
        { to: '/approvals', icon: FiUserCheck, label: 'Identity Alerts', visible: can('view', 'approvals') || hasPermission('canManageUsers') },
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
            <p className="sidebar-title font-display text-base font-bold leading-none">Sharda</p>
            <p className="sidebar-title font-display text-base font-bold leading-none">University</p>
            <p className="sidebar-subtitle mt-0.5 text-xs font-medium tracking-wide">Student Platform</p>
          </div>
          {sidebarOpen && (
            <button onClick={closeSidebar} className="sidebar-close ml-auto p-1">
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
        className="sidebar-user-card mx-3 mb-2 h-[76px] overflow-hidden rounded-2xl border px-3 py-3 text-left backdrop-blur-sm transition"
      >
        <div className="flex items-center gap-2.5">
          <Avatar user={user} size="md" className="shadow-lg flex-shrink-0" />
          <div className="min-w-0 flex-1 overflow-hidden">
            <p
              ref={footerNameRef}
              className="sidebar-user-name block w-full min-w-0 overflow-hidden text-ellipsis whitespace-nowrap font-semibold"
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
      <p className="sidebar-footer-note px-4 pb-4 text-[11px] leading-4">
        Icons made by Freepik from www.flaticon.com
      </p>
    </div>
  );

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden">
      <PreviewBanner />
      <ViewAsModal isOpen={viewAsModalOpen} onClose={() => setViewAsModalOpen(false)} />
      <div className="app-shell flex flex-1 overflow-hidden">
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
        <header className="relative z-40 h-16 border-b flex items-center justify-between px-5 flex-shrink-0 shadow-sm" style={{ background: 'var(--surface-card)', borderColor: 'var(--border-main)' }}>
          <div className="flex items-center gap-3">
            <button className="md:hidden p-2 rounded-lg transition-colors" style={{ color: 'var(--text-muted)' }}
              onClick={() => setSidebarOpen(true)}>
              <FiMenu size={22} />
            </button>
            {location.pathname !== '/dashboard' ? (
              <button
                type="button"
                onClick={handleBackNavigation}
                className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition"
                style={{ borderColor: 'var(--border-main)', background: 'var(--surface-card)', color: 'var(--text-muted)' }}
              >
                <FiArrowLeft size={16} />
                Back
              </button>
            ) : null}
            <div>
              <h2 className="font-display font-bold text-lg leading-none" style={{ color: 'var(--text-main)' }}>{pageTitle}</h2>
              <p className="text-xs mt-0.5 hidden sm:block" style={{ color: 'var(--text-muted)' }}>
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
                <div className="absolute right-0 top-12 z-50 w-52 rounded-2xl border shadow-xl" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-card)' }}>
                  <button
                    type="button"
                    onClick={openProfilePage}
                    className="flex w-full items-center gap-3 px-4 py-3 text-sm transition rounded-t-2xl hover:opacity-80"
                    style={{ color: 'var(--text-main)' }}
                  >
                    <FiUser size={15} />
                    My Profile
                  </button>
                  <div style={{ borderTop: '1px solid var(--border-main)' }} />
                  {trueUser?.adminTier === 'super_admin' && (
                    <>
                      <button
                        type="button"
                        onClick={() => { setProfileMenuOpen(false); setViewAsModalOpen(true); }}
                        className="flex w-full items-center gap-3 px-4 py-3 text-sm transition hover:opacity-80"
                        style={{ color: 'var(--text-main)' }}
                      >
                        <FiUserCheck size={15} />
                        View As...
                      </button>
                      <div style={{ borderTop: '1px solid var(--border-main)' }} />
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => { setProfileMenuOpen(false); handleLogout(); }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-sm transition rounded-b-2xl hover:opacity-80"
                    style={{ color: 'var(--accent-danger, #dc2626)' }}
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
            <Breadcrumbs />
            <Outlet />
          </div>
        </main>
      </div>
    </div>
    </div>
  );
}
