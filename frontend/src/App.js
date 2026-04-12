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
const VerifyEmailPage      = lazy(() => import('./pages/VerifyEmailPage'));
const Dashboard            = lazy(() => import('./pages/Dashboard'));
const TicketList           = lazy(() => import('./pages/TicketList'));
const CreateTicket         = lazy(() => import('./pages/CreateTicket'));
const CreateNoticePage     = lazy(() => import('./pages/CreateNoticePage'));
const CreateAssignmentPage = lazy(() => import('./pages/CreateAssignmentPage'));
const CreateAttendancePage = lazy(() => import('./pages/CreateAttendancePage'));
const TicketDetail         = lazy(() => import('./pages/TicketDetail'));
const AssignmentsPage      = lazy(() => import('./pages/AssignmentsPage'));
const AssignmentDetail     = lazy(() => import('./pages/AssignmentDetail'));
const TimetablePage        = lazy(() => import('./pages/TimetablePage'));
const AttendancePage       = lazy(() => import('./pages/AttendancePage'));
const UsersPage            = lazy(() => import('./pages/UsersPage'));
const UserFormPage         = lazy(() => import('./pages/UserFormPage'));
const UserImportReviewPage = lazy(() => import('./pages/UserImportReviewPage'));
const UserDetailPage       = lazy(() => import('./pages/UserDetailPage'));
const AccountApprovalsPage = lazy(() => import('./pages/AccountApprovalsPage'));
const AcademicStructurePage = lazy(() => import('./pages/AcademicStructurePage'));
const AdvancedAcademicOperationsPage = lazy(() => import('./pages/AdvancedAcademicOperationsPage'));
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
  const { hasPermission, loading, isSuperAdmin } = usePermissions();
  if (!token || !user) return <Navigate to="/login" replace />;
  if (permission && loading) return <FullPageSpinner />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  if (permission && !isSuperAdmin && !hasPermission(permission)) return <Navigate to="/dashboard" replace />;
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
      <Route path="/verify-email"    element={<PublicRoute><Suspense fallback={<FullPageSpinner />}><VerifyEmailPage /></Suspense></PublicRoute>} />

      <Route element={<ProtectedRoute><Suspense fallback={<FullPageSpinner />}><Layout /></Suspense></ProtectedRoute>}>
        <Route path="/dashboard"         element={<Suspense fallback={<FullPageSpinner />}><Dashboard /></Suspense>} />
        <Route path="/tickets"           element={<Suspense fallback={<FullPageSpinner />}><TicketList /></Suspense>} />
        <Route path="/tickets/new"       element={<Suspense fallback={<FullPageSpinner />}><CreateTicket /></Suspense>} />
        <Route path="/tickets/:id"       element={<Suspense fallback={<FullPageSpinner />}><TicketDetail /></Suspense>} />
        <Route path="/assignments"       element={<Suspense fallback={<FullPageSpinner />}><AssignmentsPage /></Suspense>} />
        <Route path="/assignments/new"   element={<Suspense fallback={<FullPageSpinner />}><CreateAssignmentPage /></Suspense>} />
        <Route path="/assignments/:id"   element={<Suspense fallback={<FullPageSpinner />}><AssignmentDetail /></Suspense>} />
        <Route path="/timetable"         element={<ProtectedRoute roles={['student', 'faculty', 'admin']}><Suspense fallback={<FullPageSpinner />}><TimetablePage /></Suspense></ProtectedRoute>} />
        <Route path="/attendance"        element={<ProtectedRoute roles={['student', 'faculty', 'admin']}><Suspense fallback={<FullPageSpinner />}><AttendancePage /></Suspense></ProtectedRoute>} />
        <Route path="/attendance/new"    element={<ProtectedRoute roles={['faculty', 'admin']}><Suspense fallback={<FullPageSpinner />}><CreateAttendancePage /></Suspense></ProtectedRoute>} />
        <Route path="/attendance/:id/edit" element={<ProtectedRoute roles={['faculty', 'admin']}><Suspense fallback={<FullPageSpinner />}><CreateAttendancePage /></Suspense></ProtectedRoute>} />
        <Route path="/profile"           element={<Suspense fallback={<FullPageSpinner />}><ProfilePage /></Suspense>} />
        <Route path="/notice-board"      element={<Suspense fallback={<FullPageSpinner />}><AnnouncementsPage /></Suspense>} />
        <Route path="/notice-board/new"  element={<Suspense fallback={<FullPageSpinner />}><CreateNoticePage /></Suspense>} />
        <Route path="/announcements"     element={<Navigate to="/notice-board" replace />} />
        <Route path="/opportunities"     element={<Suspense fallback={<FullPageSpinner />}><OpportunitiesPage /></Suspense>} />
        <Route path="/events"            element={<Suspense fallback={<FullPageSpinner />}><EventsPage /></Suspense>} />
        <Route path="/ai-assistant"      element={<Suspense fallback={<FullPageSpinner />}><AIAssistant /></Suspense>} />
        <Route path="/faq"               element={<Suspense fallback={<FullPageSpinner />}><FAQPage /></Suspense>} />
        <Route path="/academic-calendar" element={<Navigate to="/notice-board" replace />} />
        <Route path="/group-chat"        element={<Suspense fallback={<FullPageSpinner />}><GroupChatPage /></Suspense>} />
        <Route path="/users"             element={<ProtectedRoute permission="canManageUsers"><Suspense fallback={<FullPageSpinner />}><UsersPage /></Suspense></ProtectedRoute>} />
        <Route path="/users/new"         element={<ProtectedRoute permission="canManageUsers"><Suspense fallback={<FullPageSpinner />}><UserFormPage /></Suspense></ProtectedRoute>} />
        <Route path="/users/import"      element={<ProtectedRoute permission="canManageUsers"><Suspense fallback={<FullPageSpinner />}><UserImportReviewPage /></Suspense></ProtectedRoute>} />
        <Route path="/users/:systemId"   element={<ProtectedRoute permission="canManageUsers"><Suspense fallback={<FullPageSpinner />}><UserDetailPage /></Suspense></ProtectedRoute>} />
        <Route path="/admin/users/:systemId" element={<ProtectedRoute permission="canManageUsers"><Suspense fallback={<FullPageSpinner />}><UserDetailPage /></Suspense></ProtectedRoute>} />
        <Route path="/users/:systemId/edit" element={<ProtectedRoute permission="canManageUsers"><Suspense fallback={<FullPageSpinner />}><UserFormPage /></Suspense></ProtectedRoute>} />
        <Route path="/approvals"         element={<ProtectedRoute permission="canManageUsers"><Suspense fallback={<FullPageSpinner />}><AccountApprovalsPage /></Suspense></ProtectedRoute>} />
        <Route path="/academics"         element={<ProtectedRoute permission="canManageAcademics"><Suspense fallback={<FullPageSpinner />}><AcademicStructurePage /></Suspense></ProtectedRoute>} />
        <Route path="/academics/advanced" element={<ProtectedRoute permission="canManageAcademics"><Suspense fallback={<FullPageSpinner />}><AdvancedAcademicOperationsPage /></Suspense></ProtectedRoute>} />
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
