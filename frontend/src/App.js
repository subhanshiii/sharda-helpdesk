import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { FullPageSpinner } from './components/ui';

// Lazy load all pages
const LoginPage            = lazy(() => import('./pages/LoginPage'));
const RegisterPage         = lazy(() => import('./pages/RegisterPage'));
const ForgotPassword       = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword        = lazy(() => import('./pages/ResetPassword'));
const Dashboard            = lazy(() => import('./pages/Dashboard'));
const TicketList           = lazy(() => import('./pages/TicketList'));
const CreateTicket         = lazy(() => import('./pages/CreateTicket'));
const TicketDetail         = lazy(() => import('./pages/TicketDetail'));
const UsersPage            = lazy(() => import('./pages/UsersPage'));
const ProfilePage          = lazy(() => import('./pages/ProfilePage'));
const AnnouncementsPage    = lazy(() => import('./pages/AnnouncementsPage'));
const OpportunitiesPage    = lazy(() => import('./pages/OpportunitiesPage'));
const EventsPage           = lazy(() => import('./pages/EventsPage'));
const AIAssistant          = lazy(() => import('./pages/AIAssistant'));
const FAQPage              = lazy(() => import('./pages/FAQPage'));
const AcademicCalendarPage = lazy(() => import('./pages/AcademicCalendarPage'));
const GroupChatPage        = lazy(() => import('./pages/GroupChatPage'));   // ← NEW
const NotFound             = lazy(() => import('./pages/NotFound'));
const Layout               = lazy(() => import('./components/Layout'));

const ProtectedRoute = ({ children, roles }) => {
  const { user, token } = useAuth();
  if (!token || !user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
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
        <Route path="/profile"           element={<Suspense fallback={<FullPageSpinner />}><ProfilePage /></Suspense>} />
        <Route path="/announcements"     element={<Suspense fallback={<FullPageSpinner />}><AnnouncementsPage /></Suspense>} />
        <Route path="/opportunities"     element={<Suspense fallback={<FullPageSpinner />}><OpportunitiesPage /></Suspense>} />
        <Route path="/events"            element={<Suspense fallback={<FullPageSpinner />}><EventsPage /></Suspense>} />
        <Route path="/ai-assistant"      element={<Suspense fallback={<FullPageSpinner />}><AIAssistant /></Suspense>} />
        <Route path="/faq"               element={<Suspense fallback={<FullPageSpinner />}><FAQPage /></Suspense>} />
        <Route path="/academic-calendar" element={<Suspense fallback={<FullPageSpinner />}><AcademicCalendarPage /></Suspense>} />
        <Route path="/group-chat"        element={<Suspense fallback={<FullPageSpinner />}><GroupChatPage /></Suspense>} />
        <Route path="/users"             element={<ProtectedRoute roles={['admin']}><Suspense fallback={<FullPageSpinner />}><UsersPage /></Suspense></ProtectedRoute>} />
      </Route>

      <Route path="*" element={<Suspense fallback={null}><NotFound /></Suspense>} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <Router>
          <Toaster position="top-right" toastOptions={{
            duration: 3500,
            style: { fontSize: '14px', fontFamily: 'Plus Jakarta Sans, sans-serif', borderRadius: '12px' },
          }} />
          <AppRoutes />
        </Router>
      </NotificationProvider>
    </AuthProvider>
  );
}
