import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { PermissionProvider, usePermissions } from './context/PermissionContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { EmptyState, FullPageSpinner } from './components/ui';
import ErrorBoundary from './components/ErrorBoundary';
import ThemeToggle from './components/ThemeToggle';
import { hasRole } from './utils/access';

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
const TimetableFormPage    = lazy(() => import('./pages/TimetableFormPage'));
const TimetableSectionPage = lazy(() => import('./pages/TimetableSectionPage'));
const AttendancePage       = lazy(() => import('./pages/AttendancePage'));
const UsersPage            = lazy(() => import('./pages/UsersPage'));
const UserFormPage         = lazy(() => import('./pages/UserFormPage'));
const UserImportReviewPage = lazy(() => import('./pages/UserImportReviewPage'));
const UserDetailPage       = lazy(() => import('./pages/UserDetailPage'));
const AccountApprovalsPage = lazy(() => import('./pages/AccountApprovalsPage'));
const AcademicStructurePage = lazy(() => import('./pages/AcademicStructurePage'));
const SubjectTeacherMappingsPage = lazy(() => import('./pages/SubjectTeacherMappingsPage'));
const SubjectDetailPage = lazy(() => import('./pages/SubjectDetailPage'));
const SectionStudentsPage = lazy(() => import('./pages/SectionStudentsPage'));
const ProfilePage          = lazy(() => import('./pages/ProfilePage'));
const AnnouncementsPage    = lazy(() => import('./pages/AnnouncementsPage'));
const AcademicCalendarPage = lazy(() => import('./pages/AcademicCalendarPage'));
const OpportunitiesPage    = lazy(() => import('./pages/OpportunitiesPage'));
const CreateOpportunityPage = lazy(() => import('./pages/CreateOpportunityPage'));
const EventsPage           = lazy(() => import('./pages/EventsPage'));
const CreateEventPage      = lazy(() => import('./pages/CreateEventPage'));
const ResourcesPage        = lazy(() => import('./pages/ResourcesPage'));
const AIAssistant          = lazy(() => import('./pages/AIAssistant'));
const FAQPage              = lazy(() => import('./pages/FAQPage'));
const GroupChatPage        = lazy(() => import('./pages/GroupChatPage'));   // ← NEW
const PermissionsPage      = lazy(() => import('./pages/PermissionsPage'));
const NotFound             = lazy(() => import('./pages/NotFound'));
const Layout               = lazy(() => import('./components/Layout'));

const ProtectedRoute = ({ children, roles, permission, access }) => {
  const { user, token } = useAuth();
  const { hasPermission, can, loading } = usePermissions();
  if (!token || !user) return <Navigate to="/login" replace />;
  if ((permission || access) && loading) return <FullPageSpinner />;
  const roleAllowed = !roles || hasRole(user, roles);
  const permissionAllowed = !permission || hasPermission(permission);
  const accessAllowed = !access || can(access.action, access.resource);
  if (!roleAllowed || !permissionAllowed || !accessAllowed) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <EmptyState
          icon="🔒"
          title="You don't have permission"
          description="This area is unavailable for your current role. If you think this is incorrect, contact an administrator."
        />
      </div>
    );
  }
  return children;
};

const PublicRoute = ({ children }) => {
  const { token } = useAuth();
  if (token) return <Navigate to="/dashboard" replace />;
  return children;
};

function AppRoutes() {
  return (
    <ErrorBoundary>
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
        <Route path="/assignments/new"   element={<ProtectedRoute access={{ action: 'create', resource: 'assignments' }}><Suspense fallback={<FullPageSpinner />}><CreateAssignmentPage /></Suspense></ProtectedRoute>} />
        <Route path="/assignments/:id"   element={<Suspense fallback={<FullPageSpinner />}><AssignmentDetail /></Suspense>} />
        <Route path="/timetable"         element={<ProtectedRoute access={{ action: 'view', resource: 'timetable' }}><Suspense fallback={<FullPageSpinner />}><TimetablePage /></Suspense></ProtectedRoute>} />
        <Route path="/timetable/sections/:sectionId" element={<ProtectedRoute access={{ action: 'view', resource: 'timetable' }}><Suspense fallback={<FullPageSpinner />}><TimetableSectionPage /></Suspense></ProtectedRoute>} />
        <Route path="/timetable/new"     element={<ProtectedRoute access={{ action: 'create', resource: 'timetable' }}><Suspense fallback={<FullPageSpinner />}><TimetableFormPage /></Suspense></ProtectedRoute>} />
        <Route path="/timetable/:id/edit" element={<ProtectedRoute access={{ action: 'edit', resource: 'timetable' }}><Suspense fallback={<FullPageSpinner />}><TimetableFormPage /></Suspense></ProtectedRoute>} />
        <Route path="/attendance"        element={<ProtectedRoute roles={['student', 'faculty', 'admin']}><Suspense fallback={<FullPageSpinner />}><AttendancePage /></Suspense></ProtectedRoute>} />
        <Route path="/attendance/new"    element={<ProtectedRoute permission="canMarkAttendance"><Suspense fallback={<FullPageSpinner />}><CreateAttendancePage /></Suspense></ProtectedRoute>} />
        <Route path="/attendance/:id/edit" element={<ProtectedRoute permission="canMarkAttendance"><Suspense fallback={<FullPageSpinner />}><CreateAttendancePage /></Suspense></ProtectedRoute>} />
        <Route path="/profile"           element={<Suspense fallback={<FullPageSpinner />}><ProfilePage /></Suspense>} />
        <Route path="/notice-board"      element={<Suspense fallback={<FullPageSpinner />}><AnnouncementsPage /></Suspense>} />
        <Route path="/notice-board/new"  element={<ProtectedRoute access={{ action: 'create', resource: 'notices' }}><Suspense fallback={<FullPageSpinner />}><CreateNoticePage /></Suspense></ProtectedRoute>} />
        <Route path="/academic-calendar/manage" element={<ProtectedRoute access={{ action: 'create', resource: 'events' }}><Suspense fallback={<FullPageSpinner />}><AcademicCalendarPage /></Suspense></ProtectedRoute>} />
        <Route path="/announcements"     element={<Navigate to="/notice-board" replace />} />
        <Route path="/opportunities"     element={<Suspense fallback={<FullPageSpinner />}><OpportunitiesPage /></Suspense>} />
        <Route path="/opportunities/new" element={<ProtectedRoute access={{ action: 'create', resource: 'opportunities' }}><Suspense fallback={<FullPageSpinner />}><CreateOpportunityPage /></Suspense></ProtectedRoute>} />
        <Route path="/events"            element={<Suspense fallback={<FullPageSpinner />}><EventsPage /></Suspense>} />
        <Route path="/events/new"        element={<ProtectedRoute access={{ action: 'create', resource: 'events' }}><Suspense fallback={<FullPageSpinner />}><CreateEventPage /></Suspense></ProtectedRoute>} />
        <Route path="/resources"         element={<ProtectedRoute access={{ action: 'view', resource: 'resources' }}><Suspense fallback={<FullPageSpinner />}><ResourcesPage /></Suspense></ProtectedRoute>} />
        <Route path="/ai-assistant"      element={<Suspense fallback={<FullPageSpinner />}><AIAssistant /></Suspense>} />
        <Route path="/faq"               element={<ProtectedRoute access={{ action: 'view', resource: 'faq' }}><Suspense fallback={<FullPageSpinner />}><FAQPage /></Suspense></ProtectedRoute>} />
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
        <Route path="/academics/sections/:sectionId/students" element={<ProtectedRoute permission="canManageAcademics"><Suspense fallback={<FullPageSpinner />}><SectionStudentsPage /></Suspense></ProtectedRoute>} />
        <Route path="/academics/subject-management" element={<ProtectedRoute permission="canManageAcademics"><Suspense fallback={<FullPageSpinner />}><SubjectTeacherMappingsPage /></Suspense></ProtectedRoute>} />
        <Route path="/academics/subject-teachers" element={<Navigate to="/academics/subject-management" replace />} />
        <Route path="/academics/subjects/:subjectId" element={<ProtectedRoute permission="canManageAcademics"><Suspense fallback={<FullPageSpinner />}><SubjectDetailPage /></Suspense></ProtectedRoute>} />
        <Route path="/academics/advanced" element={<Navigate to="/academics/subject-management" replace />} />
        <Route path="/permissions"       element={<ProtectedRoute access={{ action: 'manage', resource: 'permissions' }}><Suspense fallback={<FullPageSpinner />}><PermissionsPage /></Suspense></ProtectedRoute>} />
      </Route>

      <Route path="*" element={<Suspense fallback={null}><NotFound /></Suspense>} />
    </Routes>
    </ErrorBoundary>
  );
}

function AppShell() {
  const { resolvedTheme } = useTheme();

  return (
    <>
      <Toaster position="top-right" toastOptions={{
        duration: 3500,
        style: {
          fontSize: '14px',
          fontFamily: 'Plus Jakarta Sans, sans-serif',
          borderRadius: '12px',
          background: 'var(--surface-card)',
          color: 'var(--text-main)',
          border: '1px solid var(--border-strong)',
          boxShadow: 'var(--shadow-card)',
        },
      }} />
      <div className="fixed bottom-4 right-4 z-[60]">
        <ThemeToggle />
      </div>
      <div className="sr-only" aria-live="polite">{resolvedTheme.name} theme active</div>
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
