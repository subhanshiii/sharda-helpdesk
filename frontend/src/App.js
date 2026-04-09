import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { PermissionProvider, usePermissions } from './context/PermissionContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { FullPageSpinner } from './components/ui';
import ThemeToggle from './components/ThemeToggle';

// Lazy load all pages
const LoginPage            = lazy(() => import('./pages/LoginPage'));
const RegisterPage         = lazy(() => import('./pages/RegisterPage'));
const ForgotPassword       = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword        = lazy(() => import('./pages/ResetPassword'));
const Dashboard            = lazy(() => import('./pages/Dashboard'));
const TicketList           = lazy(() => import('./pages/TicketList'));
const CreateTicket         = lazy(() => import('./pages/CreateTicket'));
const TicketDetail         = lazy(() => import('./pages/TicketDetail'));
const AssignmentsPage      = lazy(() => import('./pages/AssignmentsPage'));
const AssignmentDetail     = lazy(() => import('./pages/AssignmentDetail'));
const UsersPage            = lazy(() => import('./pages/UsersPage'));
const ProfilePage          = lazy(() => import('./pages/ProfilePage'));
const AnnouncementsPage    = lazy(() => import('./pages/AnnouncementsPage'));
const OpportunitiesPage    = lazy(() => import('./pages/OpportunitiesPage'));
const EventsPage           = lazy(() => import('./pages/EventsPage'));
const AIAssistant          = lazy(() => import('./pages/AIAssistant'));
const FAQPage              = lazy(() => import('./pages/FAQPage'));
const GroupChatPage        = lazy(() => import('./pages/GroupChatPage'));   // ← NEW
const PermissionsPage      = lazy(() => import('./pages/PermissionsPage'));
const NotFound             = lazy(() => import('./pages/NotFound'));
const Layout               = lazy(() => import('./components/Layout'));

const ProtectedRoute = ({ children, roles, permission }) => {
  const { user, token } = useAuth();
  const { hasPermission, loading } = usePermissions();
  if (!token || !user) return <Navigate to="/login" replace />;
  if (permission && loading) return <FullPageSpinner />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  if (permission && !hasPermission(permission)) return <Navigate to="/dashboard" replace />;
  return children;
};

const PublicRoute = ({ children }) => {
  const { token } = useAuth();
  if (token) return <Navigate to="/dashboard" replace />;
  return children;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/login"           element={<PublicRoute><Suspense fallback={<FullPageSpinner />}><LoginPage /></Suspense></PublicRoute>} />
      <Route path="/register"        element={<PublicRoute><Suspense fallback={<FullPageSpinner />}><RegisterPage /></Suspense></PublicRoute>} />
      <Route path="/forgot-password" element={<PublicRoute><Suspense fallback={<FullPageSpinner />}><ForgotPassword /></Suspense></PublicRoute>} />
      <Route path="/reset-password"  element={<Suspense fallback={<FullPageSpinner />}><ResetPassword /></Suspense>} />

      <Route element={<ProtectedRoute><Suspense fallback={<FullPageSpinner />}><Layout /></Suspense></ProtectedRoute>}>
        <Route path="/dashboard"         element={<Suspense fallback={<FullPageSpinner />}><Dashboard /></Suspense>} />
        <Route path="/tickets"           element={<Suspense fallback={<FullPageSpinner />}><TicketList /></Suspense>} />
        <Route path="/tickets/new"       element={<Suspense fallback={<FullPageSpinner />}><CreateTicket /></Suspense>} />
        <Route path="/tickets/:id"       element={<Suspense fallback={<FullPageSpinner />}><TicketDetail /></Suspense>} />
        <Route path="/assignments"       element={<Suspense fallback={<FullPageSpinner />}><AssignmentsPage /></Suspense>} />
        <Route path="/assignments/:id"   element={<Suspense fallback={<FullPageSpinner />}><AssignmentDetail /></Suspense>} />
        <Route path="/profile"           element={<Suspense fallback={<FullPageSpinner />}><ProfilePage /></Suspense>} />
        <Route path="/notice-board"      element={<Suspense fallback={<FullPageSpinner />}><AnnouncementsPage /></Suspense>} />
        <Route path="/announcements"     element={<Navigate to="/notice-board" replace />} />
        <Route path="/opportunities"     element={<Suspense fallback={<FullPageSpinner />}><OpportunitiesPage /></Suspense>} />
        <Route path="/events"            element={<Suspense fallback={<FullPageSpinner />}><EventsPage /></Suspense>} />
        <Route path="/ai-assistant"      element={<Suspense fallback={<FullPageSpinner />}><AIAssistant /></Suspense>} />
        <Route path="/faq"               element={<Suspense fallback={<FullPageSpinner />}><FAQPage /></Suspense>} />
        <Route path="/academic-calendar" element={<Navigate to="/notice-board" replace />} />
        <Route path="/group-chat"        element={<Suspense fallback={<FullPageSpinner />}><GroupChatPage /></Suspense>} />
        <Route path="/users"             element={<ProtectedRoute permission="canManageUsers"><Suspense fallback={<FullPageSpinner />}><UsersPage /></Suspense></ProtectedRoute>} />
        <Route path="/permissions"       element={<ProtectedRoute permission="canManagePermissions"><Suspense fallback={<FullPageSpinner />}><PermissionsPage /></Suspense></ProtectedRoute>} />
      </Route>

      <Route path="*" element={<Suspense fallback={null}><NotFound /></Suspense>} />
    </Routes>
  );
}

function AppShell() {
  const { isDark } = useTheme();

  return (
    <>
      <Toaster position="top-right" toastOptions={{
        duration: 3500,
        style: {
          fontSize: '14px',
          fontFamily: 'Plus Jakarta Sans, sans-serif',
          borderRadius: '12px',
          background: isDark ? '#111827' : '#ffffff',
          color: isDark ? '#e5eefb' : '#1f2937',
          border: isDark ? '1px solid rgba(148, 163, 184, 0.22)' : '1px solid rgba(209, 213, 219, 0.65)',
        },
      }} />
      <div className="fixed bottom-4 right-4 z-[60]">
        <ThemeToggle />
      </div>
      <AppRoutes />
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <PermissionProvider>
          <NotificationProvider>
            <Router>
              <AppShell />
            </Router>
          </NotificationProvider>
        </PermissionProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
