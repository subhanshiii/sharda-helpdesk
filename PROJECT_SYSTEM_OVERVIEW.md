# Sharda Helpdesk / University ERP

## Overview

This project is a university operations platform that combines:

- Identity and access management
- Academic setup and academic operations
- Helpdesk and support ticketing
- Notices, events, and opportunities
- Group chat and communication
- Dashboard, notifications, and assistant workflows

It is built as:

- Frontend: React
- Backend: Node.js + Express
- Database: MongoDB + Mongoose
- Auth: JWT + email verification + optional Google sign-in for pre-provisioned users

---

## High-Level Architecture

### Frontend

Main frontend entry:

- [/Users/work/IdeaProjects/sharda-helpdesk/frontend/src/App.js](/Users/work/IdeaProjects/sharda-helpdesk/frontend/src/App.js)

Core frontend layers:

- Pages: [/Users/work/IdeaProjects/sharda-helpdesk/frontend/src/pages](/Users/work/IdeaProjects/sharda-helpdesk/frontend/src/pages)
- Shared UI: [/Users/work/IdeaProjects/sharda-helpdesk/frontend/src/components](/Users/work/IdeaProjects/sharda-helpdesk/frontend/src/components)
- State contexts:
  - [/Users/work/IdeaProjects/sharda-helpdesk/frontend/src/context/AuthContext.js](/Users/work/IdeaProjects/sharda-helpdesk/frontend/src/context/AuthContext.js)
  - [/Users/work/IdeaProjects/sharda-helpdesk/frontend/src/context/PermissionContext.js](/Users/work/IdeaProjects/sharda-helpdesk/frontend/src/context/PermissionContext.js)
  - [/Users/work/IdeaProjects/sharda-helpdesk/frontend/src/context/NotificationContext.js](/Users/work/IdeaProjects/sharda-helpdesk/frontend/src/context/NotificationContext.js)
  - [/Users/work/IdeaProjects/sharda-helpdesk/frontend/src/context/ThemeContext.js](/Users/work/IdeaProjects/sharda-helpdesk/frontend/src/context/ThemeContext.js)

### Backend

Main backend entry:

- [/Users/work/IdeaProjects/sharda-helpdesk/backend/server.js](/Users/work/IdeaProjects/sharda-helpdesk/backend/server.js)

Core backend layers:

- Routes: [/Users/work/IdeaProjects/sharda-helpdesk/backend/routes](/Users/work/IdeaProjects/sharda-helpdesk/backend/routes)
- Controllers: [/Users/work/IdeaProjects/sharda-helpdesk/backend/controllers](/Users/work/IdeaProjects/sharda-helpdesk/backend/controllers)
- Models: [/Users/work/IdeaProjects/sharda-helpdesk/backend/models](/Users/work/IdeaProjects/sharda-helpdesk/backend/models)
- Services: [/Users/work/IdeaProjects/sharda-helpdesk/backend/services](/Users/work/IdeaProjects/sharda-helpdesk/backend/services)
- Utils: [/Users/work/IdeaProjects/sharda-helpdesk/backend/utils](/Users/work/IdeaProjects/sharda-helpdesk/backend/utils)

---

## Main Modules

### 1. Identity & Access

Purpose:

- Provision users
- Manage lifecycle state
- Manage role access
- Handle verification and password readiness
- Support scoped admin governance

Main files:

- [/Users/work/IdeaProjects/sharda-helpdesk/backend/models/User.js](/Users/work/IdeaProjects/sharda-helpdesk/backend/models/User.js)
- [/Users/work/IdeaProjects/sharda-helpdesk/backend/models/AdminScope.js](/Users/work/IdeaProjects/sharda-helpdesk/backend/models/AdminScope.js)
- [/Users/work/IdeaProjects/sharda-helpdesk/backend/controllers/userController.js](/Users/work/IdeaProjects/sharda-helpdesk/backend/controllers/userController.js)
- [/Users/work/IdeaProjects/sharda-helpdesk/backend/controllers/authController.js](/Users/work/IdeaProjects/sharda-helpdesk/backend/controllers/authController.js)
- [/Users/work/IdeaProjects/sharda-helpdesk/backend/controllers/adminScopeController.js](/Users/work/IdeaProjects/sharda-helpdesk/backend/controllers/adminScopeController.js)
- [/Users/work/IdeaProjects/sharda-helpdesk/backend/services/userProvisioningService.js](/Users/work/IdeaProjects/sharda-helpdesk/backend/services/userProvisioningService.js)
- [/Users/work/IdeaProjects/sharda-helpdesk/backend/utils/bootstrapAdmin.js](/Users/work/IdeaProjects/sharda-helpdesk/backend/utils/bootstrapAdmin.js)
- [/Users/work/IdeaProjects/sharda-helpdesk/frontend/src/pages/UsersPage.js](/Users/work/IdeaProjects/sharda-helpdesk/frontend/src/pages/UsersPage.js)
- [/Users/work/IdeaProjects/sharda-helpdesk/frontend/src/pages/UserFormPage.js](/Users/work/IdeaProjects/sharda-helpdesk/frontend/src/pages/UserFormPage.js)
- [/Users/work/IdeaProjects/sharda-helpdesk/frontend/src/pages/UserDetailPage.js](/Users/work/IdeaProjects/sharda-helpdesk/frontend/src/pages/UserDetailPage.js)
- [/Users/work/IdeaProjects/sharda-helpdesk/frontend/src/pages/AccountApprovalsPage.js](/Users/work/IdeaProjects/sharda-helpdesk/frontend/src/pages/AccountApprovalsPage.js)

### 2. Permissions / Access Control

Purpose:

- Control feature access by role and admin tier
- Support super-admin-only governance actions
- Support scoped administration without exposing full-system controls

Main files:

- [/Users/work/IdeaProjects/sharda-helpdesk/backend/models/Permission.js](/Users/work/IdeaProjects/sharda-helpdesk/backend/models/Permission.js)
- [/Users/work/IdeaProjects/sharda-helpdesk/backend/controllers/permissionController.js](/Users/work/IdeaProjects/sharda-helpdesk/backend/controllers/permissionController.js)
- [/Users/work/IdeaProjects/sharda-helpdesk/backend/utils/permissionDefaults.js](/Users/work/IdeaProjects/sharda-helpdesk/backend/utils/permissionDefaults.js)
- [/Users/work/IdeaProjects/sharda-helpdesk/backend/utils/featureRegistry.js](/Users/work/IdeaProjects/sharda-helpdesk/backend/utils/featureRegistry.js)
- [/Users/work/IdeaProjects/sharda-helpdesk/backend/utils/scopeGuard.js](/Users/work/IdeaProjects/sharda-helpdesk/backend/utils/scopeGuard.js)
- [/Users/work/IdeaProjects/sharda-helpdesk/backend/middleware/auth.js](/Users/work/IdeaProjects/sharda-helpdesk/backend/middleware/auth.js)
- [/Users/work/IdeaProjects/sharda-helpdesk/frontend/src/pages/PermissionsPage.js](/Users/work/IdeaProjects/sharda-helpdesk/frontend/src/pages/PermissionsPage.js)

### 3. Academic Structure

Purpose:

- Define the institutional academic hierarchy
- Drive student enrollment, faculty scope, timetable, attendance, and subjects
- Keep sections as the operational academic unit

Main files:

- [/Users/work/IdeaProjects/sharda-helpdesk/backend/models/College.js](/Users/work/IdeaProjects/sharda-helpdesk/backend/models/College.js)
- [/Users/work/IdeaProjects/sharda-helpdesk/backend/models/Department.js](/Users/work/IdeaProjects/sharda-helpdesk/backend/models/Department.js)
- [/Users/work/IdeaProjects/sharda-helpdesk/backend/models/Program.js](/Users/work/IdeaProjects/sharda-helpdesk/backend/models/Program.js)
- [/Users/work/IdeaProjects/sharda-helpdesk/backend/models/Course.js](/Users/work/IdeaProjects/sharda-helpdesk/backend/models/Course.js)
- [/Users/work/IdeaProjects/sharda-helpdesk/backend/models/AcademicSession.js](/Users/work/IdeaProjects/sharda-helpdesk/backend/models/AcademicSession.js)
- [/Users/work/IdeaProjects/sharda-helpdesk/backend/models/AcademicYear.js](/Users/work/IdeaProjects/sharda-helpdesk/backend/models/AcademicYear.js)
- [/Users/work/IdeaProjects/sharda-helpdesk/backend/models/Section.js](/Users/work/IdeaProjects/sharda-helpdesk/backend/models/Section.js)
- [/Users/work/IdeaProjects/sharda-helpdesk/backend/models/Subject.js](/Users/work/IdeaProjects/sharda-helpdesk/backend/models/Subject.js)
- [/Users/work/IdeaProjects/sharda-helpdesk/backend/models/SectionSubject.js](/Users/work/IdeaProjects/sharda-helpdesk/backend/models/SectionSubject.js)
- [/Users/work/IdeaProjects/sharda-helpdesk/backend/models/Enrollment.js](/Users/work/IdeaProjects/sharda-helpdesk/backend/models/Enrollment.js)
- [/Users/work/IdeaProjects/sharda-helpdesk/backend/controllers/academicController.js](/Users/work/IdeaProjects/sharda-helpdesk/backend/controllers/academicController.js)
- [/Users/work/IdeaProjects/sharda-helpdesk/backend/utils/academicSetupService.js](/Users/work/IdeaProjects/sharda-helpdesk/backend/utils/academicSetupService.js)
- [/Users/work/IdeaProjects/sharda-helpdesk/frontend/src/pages/AcademicStructurePage.js](/Users/work/IdeaProjects/sharda-helpdesk/frontend/src/pages/AcademicStructurePage.js)

### 4. Academic Operations

Purpose:

- Timetable
- Attendance
- Student academic overview

Main files:

- [/Users/work/IdeaProjects/sharda-helpdesk/backend/models/TimetableEntry.js](/Users/work/IdeaProjects/sharda-helpdesk/backend/models/TimetableEntry.js)
- [/Users/work/IdeaProjects/sharda-helpdesk/backend/models/AttendanceSession.js](/Users/work/IdeaProjects/sharda-helpdesk/backend/models/AttendanceSession.js)
- [/Users/work/IdeaProjects/sharda-helpdesk/backend/controllers/academicOpsController.js](/Users/work/IdeaProjects/sharda-helpdesk/backend/controllers/academicOpsController.js)
- [/Users/work/IdeaProjects/sharda-helpdesk/frontend/src/pages/TimetablePage.js](/Users/work/IdeaProjects/sharda-helpdesk/frontend/src/pages/TimetablePage.js)
- [/Users/work/IdeaProjects/sharda-helpdesk/frontend/src/pages/AttendancePage.js](/Users/work/IdeaProjects/sharda-helpdesk/frontend/src/pages/AttendancePage.js)
- [/Users/work/IdeaProjects/sharda-helpdesk/frontend/src/pages/CreateAttendancePage.js](/Users/work/IdeaProjects/sharda-helpdesk/frontend/src/pages/CreateAttendancePage.js)

### 5. Assignments

Purpose:

- Assignment publishing
- Student submissions
- Faculty grading

Main files:

- [/Users/work/IdeaProjects/sharda-helpdesk/backend/models/Assignment.js](/Users/work/IdeaProjects/sharda-helpdesk/backend/models/Assignment.js)
- [/Users/work/IdeaProjects/sharda-helpdesk/backend/models/Submission.js](/Users/work/IdeaProjects/sharda-helpdesk/backend/models/Submission.js)
- [/Users/work/IdeaProjects/sharda-helpdesk/backend/controllers/assignmentController.js](/Users/work/IdeaProjects/sharda-helpdesk/backend/controllers/assignmentController.js)
- [/Users/work/IdeaProjects/sharda-helpdesk/backend/services/assignmentService.js](/Users/work/IdeaProjects/sharda-helpdesk/backend/services/assignmentService.js)
- [/Users/work/IdeaProjects/sharda-helpdesk/frontend/src/pages/AssignmentsPage.js](/Users/work/IdeaProjects/sharda-helpdesk/frontend/src/pages/AssignmentsPage.js)
- [/Users/work/IdeaProjects/sharda-helpdesk/frontend/src/pages/AssignmentDetail.js](/Users/work/IdeaProjects/sharda-helpdesk/frontend/src/pages/AssignmentDetail.js)
- [/Users/work/IdeaProjects/sharda-helpdesk/frontend/src/pages/CreateAssignmentPage.js](/Users/work/IdeaProjects/sharda-helpdesk/frontend/src/pages/CreateAssignmentPage.js)

### 6. Helpdesk

Purpose:

- Ticket creation
- Ticket handling
- Scope-aware support workflows

Main files:

- [/Users/work/IdeaProjects/sharda-helpdesk/backend/models/Ticket.js](/Users/work/IdeaProjects/sharda-helpdesk/backend/models/Ticket.js)
- [/Users/work/IdeaProjects/sharda-helpdesk/backend/controllers/ticketController.js](/Users/work/IdeaProjects/sharda-helpdesk/backend/controllers/ticketController.js)
- [/Users/work/IdeaProjects/sharda-helpdesk/backend/services/ticketService.js](/Users/work/IdeaProjects/sharda-helpdesk/backend/services/ticketService.js)
- [/Users/work/IdeaProjects/sharda-helpdesk/frontend/src/pages/TicketList.js](/Users/work/IdeaProjects/sharda-helpdesk/frontend/src/pages/TicketList.js)
- [/Users/work/IdeaProjects/sharda-helpdesk/frontend/src/pages/TicketDetail.js](/Users/work/IdeaProjects/sharda-helpdesk/frontend/src/pages/TicketDetail.js)
- [/Users/work/IdeaProjects/sharda-helpdesk/frontend/src/pages/CreateTicket.js](/Users/work/IdeaProjects/sharda-helpdesk/frontend/src/pages/CreateTicket.js)

### 7. Communication

Purpose:

- Group chat
- Notices
- Events
- Opportunities

Main files:

- [/Users/work/IdeaProjects/sharda-helpdesk/backend/models/Group.js](/Users/work/IdeaProjects/sharda-helpdesk/backend/models/Group.js)
- [/Users/work/IdeaProjects/sharda-helpdesk/backend/models/Message.js](/Users/work/IdeaProjects/sharda-helpdesk/backend/models/Message.js)
- [/Users/work/IdeaProjects/sharda-helpdesk/backend/controllers/groupChatController.js](/Users/work/IdeaProjects/sharda-helpdesk/backend/controllers/groupChatController.js)
- [/Users/work/IdeaProjects/sharda-helpdesk/backend/services/groupChatService.js](/Users/work/IdeaProjects/sharda-helpdesk/backend/services/groupChatService.js)
- [/Users/work/IdeaProjects/sharda-helpdesk/backend/controllers/announcementController.js](/Users/work/IdeaProjects/sharda-helpdesk/backend/controllers/announcementController.js)
- [/Users/work/IdeaProjects/sharda-helpdesk/backend/controllers/eventController.js](/Users/work/IdeaProjects/sharda-helpdesk/backend/controllers/eventController.js)
- [/Users/work/IdeaProjects/sharda-helpdesk/backend/controllers/opportunityController.js](/Users/work/IdeaProjects/sharda-helpdesk/backend/controllers/opportunityController.js)

### 8. Dashboard / Notifications

Purpose:

- Personalized dashboard
- Task/reminder board
- Role-sensitive workspace view
- Identity and operational signals

Main files:

- [/Users/work/IdeaProjects/sharda-helpdesk/backend/controllers/dashboardController.js](/Users/work/IdeaProjects/sharda-helpdesk/backend/controllers/dashboardController.js)
- [/Users/work/IdeaProjects/sharda-helpdesk/backend/services/dashboardService.js](/Users/work/IdeaProjects/sharda-helpdesk/backend/services/dashboardService.js)
- [/Users/work/IdeaProjects/sharda-helpdesk/backend/models/DashboardPreference.js](/Users/work/IdeaProjects/sharda-helpdesk/backend/models/DashboardPreference.js)
- [/Users/work/IdeaProjects/sharda-helpdesk/backend/models/Notification.js](/Users/work/IdeaProjects/sharda-helpdesk/backend/models/Notification.js)
- [/Users/work/IdeaProjects/sharda-helpdesk/frontend/src/pages/Dashboard.js](/Users/work/IdeaProjects/sharda-helpdesk/frontend/src/pages/Dashboard.js)

---

## Identity Model

### User

Main model:

- [/Users/work/IdeaProjects/sharda-helpdesk/backend/models/User.js](/Users/work/IdeaProjects/sharda-helpdesk/backend/models/User.js)

Key fields:

- `systemId`: public-facing stable identity for users
- `name`
- `email`
- `password`
- `role`
- `adminTier`
- `emailVerified`
- `passwordNeedsSetup`
- `status`
- `isActive`
- `expiryDate`
- `collegeId`
- `departmentId`
- `programId`
- `sectionId`
- `avatarChoice`
- `profileImage`

### Role Model

Supported roles:

- `student`
- `faculty`
- `staff`
- `admin`

### Admin Tier Model

The admin role is split into authority tiers without removing the existing values:

- `super_admin`
- `admin`
- `college_admin`
- `department_admin`
- `program_coordinator`
- `section_moderator`

Authority order:

- `super_admin` → `admin` → `college_admin` → `department_admin` → `program_coordinator` → `section_moderator`

Meaning:

- role = what kind of institutional user they are
- tier = authority level inside the admin role
- scope = where that admin authority applies

### AdminScope

Main model:

- [/Users/work/IdeaProjects/sharda-helpdesk/backend/models/AdminScope.js](/Users/work/IdeaProjects/sharda-helpdesk/backend/models/AdminScope.js)

Purpose:

- store scoped admin access outside the `User` document
- allow one admin to hold one or many section scopes
- keep existing `admin` and `super_admin` records working without migration

Scope types:

- `college`
- `department`
- `program`
- `section`

### Permission Model

Permissions are backend-enforced and feature-registry-driven.

Current centralized registry:

- [/Users/work/IdeaProjects/sharda-helpdesk/backend/utils/featureRegistry.js](/Users/work/IdeaProjects/sharda-helpdesk/backend/utils/featureRegistry.js)

Current permission defaults:

- [/Users/work/IdeaProjects/sharda-helpdesk/backend/utils/permissionDefaults.js](/Users/work/IdeaProjects/sharda-helpdesk/backend/utils/permissionDefaults.js)

Important admin-tier-sensitive permissions:

- `canManagePermissions`
- `canManageAdmins`
- `canManageUsers`
- `canManageAcademics`
- `canManageSections`
- `canViewReports`
- `canPostNotice`
- `canHandleTickets`
- `canManageAssignments`
- `canMarkAttendance`

---

## Academic Core

The academic system is section-driven.

### Hierarchy

The current hierarchy is:

- College
  - Department
    - Program
      - Course
        - Section

Sections also carry academic session context.

### AcademicSession vs StudyYear

This distinction is important:

- `AcademicSession.label`
  - institutional session string like `2025-26`
- `Section.studyYear`
  - the student level number like `1`, `2`, `3`, `4`

So:

- Academic session = when the structure belongs
- Study year = which level the students are in

### Core Meaning of Section

`Section` is the main operational academic unit.

A section represents the actual student group, for example:

- College of Engineering
- Department of CSE
- BTech CSE
- Academic Session `2025-26`
- Study Year `2`
- Section `A`

Once a student is linked to a section, the system can derive:

- subjects
- faculty assignments
- timetable scope
- attendance scope

### Important Models

#### College

- [/Users/work/IdeaProjects/sharda-helpdesk/backend/models/College.js](/Users/work/IdeaProjects/sharda-helpdesk/backend/models/College.js)

#### Department

- [/Users/work/IdeaProjects/sharda-helpdesk/backend/models/Department.js](/Users/work/IdeaProjects/sharda-helpdesk/backend/models/Department.js)

#### Program

- [/Users/work/IdeaProjects/sharda-helpdesk/backend/models/Program.js](/Users/work/IdeaProjects/sharda-helpdesk/backend/models/Program.js)

#### Course

- [/Users/work/IdeaProjects/sharda-helpdesk/backend/models/Course.js](/Users/work/IdeaProjects/sharda-helpdesk/backend/models/Course.js)

#### AcademicSession

- [/Users/work/IdeaProjects/sharda-helpdesk/backend/models/AcademicSession.js](/Users/work/IdeaProjects/sharda-helpdesk/backend/models/AcademicSession.js)

#### Section

- [/Users/work/IdeaProjects/sharda-helpdesk/backend/models/Section.js](/Users/work/IdeaProjects/sharda-helpdesk/backend/models/Section.js)

Important section fields:

- `program`
- `course`
- `academicSession`
- `studyYear`
- `department`
- `name`
- `capacity`

#### Subject

- [/Users/work/IdeaProjects/sharda-helpdesk/backend/models/Subject.js](/Users/work/IdeaProjects/sharda-helpdesk/backend/models/Subject.js)

#### SectionSubject

- [/Users/work/IdeaProjects/sharda-helpdesk/backend/models/SectionSubject.js](/Users/work/IdeaProjects/sharda-helpdesk/backend/models/SectionSubject.js)

Purpose:

- link a section to a subject
- assign the responsible faculty
- allow inline faculty reassignment from Academic Structure

#### Enrollment

- [/Users/work/IdeaProjects/sharda-helpdesk/backend/models/Enrollment.js](/Users/work/IdeaProjects/sharda-helpdesk/backend/models/Enrollment.js)

Purpose:

- link a student to a section
- keep active/inactive enrollment history when section changes

This is the real academic link:

- student -> enrollment -> section

---

## Current Key Flows

## 1. Admin-Provisioned User Flow

Current flow:

1. Admin creates user from Identity & Access
2. Backend creates user record
3. `systemId` is accepted or auto-generated
4. Verification email is sent
5. User verifies email
6. If password is not set yet, user is routed to password setup
7. User becomes ready to sign in
8. If the user is a student and `sectionId` is set, enrollment is created automatically

Main files:

- [/Users/work/IdeaProjects/sharda-helpdesk/backend/controllers/userController.js](/Users/work/IdeaProjects/sharda-helpdesk/backend/controllers/userController.js)
- [/Users/work/IdeaProjects/sharda-helpdesk/backend/services/userProvisioningService.js](/Users/work/IdeaProjects/sharda-helpdesk/backend/services/userProvisioningService.js)
- [/Users/work/IdeaProjects/sharda-helpdesk/backend/controllers/authController.js](/Users/work/IdeaProjects/sharda-helpdesk/backend/controllers/authController.js)

## 2. Email Verification Flow

1. Verification token is created
2. Email is sent
3. User opens `/verify-email?token=...`
4. Backend validates token
5. `emailVerified = true`
6. If password setup is needed, reset/setup token is issued

Main files:

- [/Users/work/IdeaProjects/sharda-helpdesk/backend/models/EmailVerification.js](/Users/work/IdeaProjects/sharda-helpdesk/backend/models/EmailVerification.js)
- [/Users/work/IdeaProjects/sharda-helpdesk/backend/controllers/authController.js](/Users/work/IdeaProjects/sharda-helpdesk/backend/controllers/authController.js)
- [/Users/work/IdeaProjects/sharda-helpdesk/frontend/src/pages/VerifyEmailPage.js](/Users/work/IdeaProjects/sharda-helpdesk/frontend/src/pages/VerifyEmailPage.js)

## 3. Password Setup / Reset Flow

1. User receives password setup or reset link
2. Opens `/reset-password?token=...`
3. Sets password
4. `passwordNeedsSetup = false`
5. Login works

Main files:

- [/Users/work/IdeaProjects/sharda-helpdesk/backend/models/PasswordReset.js](/Users/work/IdeaProjects/sharda-helpdesk/backend/models/PasswordReset.js)
- [/Users/work/IdeaProjects/sharda-helpdesk/backend/controllers/passwordResetController.js](/Users/work/IdeaProjects/sharda-helpdesk/backend/controllers/passwordResetController.js)
- [/Users/work/IdeaProjects/sharda-helpdesk/frontend/src/pages/ResetPassword.js](/Users/work/IdeaProjects/sharda-helpdesk/frontend/src/pages/ResetPassword.js)

## 4. Student Academic Flow

Current supported flow:

1. Student user exists
2. Student is assigned to a section
3. Enrollment links student to that section
4. If the section changes, the old active enrollment becomes `inactive`
5. A new active enrollment is created for the new section
6. SectionSubject links section to subjects and faculty
7. Timetable and attendance use that context

Meaning:

- student does not need subjects assigned one-by-one
- section becomes the student’s academic home

## 5. Faculty Academic Flow

1. Faculty user exists
2. Faculty is assigned through `SectionSubject`
3. Faculty scope is derived from those assignments
4. Timetable and attendance are filtered to assigned teaching scope
5. Faculty assignment can be updated from the Academic Structure page when a section is selected

## 6. Scoped Admin Flow

1. Admin user is created with an `adminTier`
2. If that tier is scoped, the admin gets one or more `AdminScope` records
3. Academic lists are filtered through `getScopeFilter(...)`
4. Ticket visibility is filtered by the ticket creator’s college, department, program, or section context
5. `super_admin` and `admin` remain unscoped and see the full platform

## 7. Helpdesk Flow

1. User creates ticket
2. Staff/admin handle support queue
3. Scoped admin tiers only see tickets within their assigned scope
4. Ticket updates and activity appear in related views
5. Recent support activity can be shown on dashboard and user detail

## 8. Group Chat Flow

1. User with access enters group chat
2. Group creation/management requires permission
3. Messaging runs via socket + REST support

---

## Academic Setup & Structure

This module is now a unified setup page.

Main frontend page:

- [/Users/work/IdeaProjects/sharda-helpdesk/frontend/src/pages/AcademicStructurePage.js](/Users/work/IdeaProjects/sharda-helpdesk/frontend/src/pages/AcademicStructurePage.js)

### What it now includes

- Tree view:
  - College
  - Department
  - Program
  - Course
  - Sections

- Quick Setup:
  - select college
  - create department
  - create program
  - create course
  - create academic session labels
  - create sections across multiple study years

- Section subject assignment:
  - select a section in the tree
  - view its section-subject rows
  - assign or change faculty inline

- Advanced Academic Operations:
  - subjects
  - teaching assignments
  - enrollments

### Main backend APIs

- `GET /api/academics/structure-tree`
- `POST /api/academics/setup`
- `GET /api/academics/colleges`
- `PATCH /api/academics/section-subjects/:id`

Main backend implementation:

- [/Users/work/IdeaProjects/sharda-helpdesk/backend/controllers/academicController.js](/Users/work/IdeaProjects/sharda-helpdesk/backend/controllers/academicController.js)
- [/Users/work/IdeaProjects/sharda-helpdesk/backend/utils/academicSetupService.js](/Users/work/IdeaProjects/sharda-helpdesk/backend/utils/academicSetupService.js)

---

## System Navigation Concept

Current structure is organized around these domains:

- Daily Workspace
- Academic Operations
- Support & Services
- Governance

Main navigation implementation:

- [/Users/work/IdeaProjects/sharda-helpdesk/frontend/src/components/Layout.js](/Users/work/IdeaProjects/sharda-helpdesk/frontend/src/components/Layout.js)

---

## Current Strengths

- Controlled onboarding
- Role-based and tier-sensitive backend authorization
- Super admin support with no migration break for existing admins
- Dynamic feature registry for permissions
- College-rooted academic hierarchy
- Section-driven academic model
- Automatic student enrollment lifecycle on section change
- Scoped admin filtering for academic data and tickets
- Unified academic structure page with tree + quick setup + section assignment panel
- Connected identity, tickets, and academic detail pages

---

## Current Platform Mental Model

The system works best when understood in four layers:

1. Identity
- who the user is

2. Role + Tier + Permissions
- what they are allowed to do

3. Academic Placement or Admin Scope
- which academic or governance slice they belong to

4. Operational Modules
- dashboard, helpdesk, attendance, timetable, assignments, notices, and chat

That means:

- students are driven by section enrollment
- faculty are driven by section-subject assignment
- scoped admins are driven by `AdminScope`
- system-wide admins remain fully global

This is the current foundation for the Sharda Helpdesk / University ERP.
