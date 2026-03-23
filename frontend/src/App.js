import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';

import LoginPage         from './pages/LoginPage';
import RegisterPage      from './pages/RegisterPage';
import ForgotPassword    from './pages/ForgotPassword';
import ResetPassword     from './pages/ResetPassword';
import Dashboard         from './pages/Dashboard';
import TicketList        from './pages/TicketList';
import CreateTicket      from './pages/CreateTicket';
import TicketDetail      from './pages/TicketDetail';
import UsersPage         from './pages/UsersPage';
import ProfilePage       from './pages/ProfilePage';
import AnnouncementsPage from './pages/AnnouncementsPage';
import NotFound          from './pages/NotFound';
import Layout            from './components/Layout';

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
      <Route path="/login"          element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/register"       element={<PublicRoute><RegisterPage /></PublicRoute>} />
      <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
      <Route path="/reset-password"  element={<ResetPassword />} />

      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/dashboard"        element={<Dashboard />} />
        <Route path="/tickets"          element={<TicketList />} />
        <Route path="/tickets/new"      element={<CreateTicket />} />
        <Route path="/tickets/:id"      element={<TicketDetail />} />
        <Route path="/profile"          element={<ProfilePage />} />
        <Route path="/announcements"    element={<AnnouncementsPage />} />
        <Route path="/users" element={
          <ProtectedRoute roles={['admin']}><UsersPage /></ProtectedRoute>
        } />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Toaster position="top-right" toastOptions={{ duration: 3500, style: { fontSize: '14px', fontFamily: 'Plus Jakarta Sans, sans-serif', borderRadius: '12px' } }} />
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}
