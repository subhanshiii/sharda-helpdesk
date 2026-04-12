import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiArrowLeft, FiCalendar, FiEdit2, FiMail, FiShield, FiTrash2, FiUser, FiBookOpen, FiClock, FiCheckCircle, FiImage } from 'react-icons/fi';
import API from '../utils/api';
import { Alert, Avatar, ConfirmDialog, EmptyState, FullPageSpinner, HelpTooltip, PageHeader } from '../components/ui';
import { formatDate, formatRelative, getAdminTierDefinition, getAdminTierTone, getRoleColor, getRoleLabel } from '../utils/helpers';
import { fetchAvatarOptions } from '../constants/avatarOptions';
import AvatarPickerPopover from '../components/AvatarPickerPopover';
import { usePermissions } from '../context/PermissionContext';

const MetaItem = ({ icon: Icon, label, value }) => (
  <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 dark-surface-subtle">
    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
      <Icon size={14} />
      {label}
    </div>
    <div className="mt-2 text-sm font-medium text-gray-800 dark-text-primary">{value || '—'}</div>
  </div>
);

const lifecycleTone = {
  active: 'bg-emerald-100 text-emerald-700',
  ready: 'bg-blue-100 text-blue-700',
  pending_verification: 'bg-amber-100 text-amber-700',
  password_setup: 'bg-violet-100 text-violet-700',
  assignment_pending: 'bg-orange-100 text-orange-700',
  pending_approval: 'bg-slate-100 text-slate-700',
  rejected: 'bg-rose-100 text-rose-700',
  suspended: 'bg-red-100 text-red-700',
  inactive: 'bg-slate-200 text-slate-700',
  expired: 'bg-red-100 text-red-700',
};

const getProfilePageCopy = (user) => {
  const roleLabel = getRoleLabel(user?.role || 'user');

  if (user?.role === 'faculty') {
    return {
      title: 'Faculty Profile',
      subtitle: `System ID ${user.systemId}`,
      academicTitle: 'Faculty Academic Scope',
      academicDescription: 'Teaching assignments, subject ownership, and section-linked academic scope for this faculty member.',
      subjectsTitle: 'Assigned Subjects',
      subjectsEmpty: 'No subjects are assigned to this faculty member yet.',
    };
  }

  if (user?.role === 'student') {
    return {
      title: 'Student Profile',
      subtitle: `System ID ${user.systemId}`,
      academicTitle: 'Student Academic Mapping',
      academicDescription: 'Section, course, and subject context used to drive timetable, attendance, and assignments.',
      subjectsTitle: 'Enrolled Subjects',
      subjectsEmpty: 'No subjects are mapped to this student yet.',
    };
  }

  if (user?.role === 'staff') {
    return {
      title: 'Staff Profile',
      subtitle: `System ID ${user.systemId}`,
      academicTitle: 'Operational Context',
      academicDescription: 'Operational context, academic visibility, and support access tied to this staff account.',
      subjectsTitle: 'Academic Visibility',
      subjectsEmpty: 'No direct subject mappings exist for this staff account.',
    };
  }

  if (user?.role === 'admin') {
    return {
      title: user.adminTier === 'super_admin' ? 'Super Admin Profile' : 'Admin Profile',
      subtitle: `System ID ${user.systemId}`,
      academicTitle: 'Governance Context',
      academicDescription: 'Administrative access, academic visibility, and platform governance scope connected to this account.',
      subjectsTitle: 'Academic Visibility',
      subjectsEmpty: 'No direct subject mappings exist for this admin account.',
    };
  }

  return {
    title: `${roleLabel} Profile`,
    subtitle: `System ID ${user?.systemId || '—'}`,
    academicTitle: 'Academic Mapping',
    academicDescription: 'Academic context connected to this identity record.',
    subjectsTitle: 'Subjects',
    subjectsEmpty: 'No subjects mapped to this user yet.',
  };
};

export default function UserDetailPage() {
  const { systemId } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [avatarOptions, setAvatarOptions] = useState([]);
  const [deleteState, setDeleteState] = useState({ open: false, loading: false });
  const [error, setError] = useState('');
  const [accountControl, setAccountControl] = useState({ status: 'pending', emailVerified: false, isActive: true, expiryDate: '' });
  const [savingAccess, setSavingAccess] = useState(false);
  const [passwordControl, setPasswordControl] = useState({ password: '', confirmPassword: '' });
  const [savingPassword, setSavingPassword] = useState(false);
  const { isSuperAdmin } = usePermissions();

  const loadUser = async () => {
    setLoading(true);
    setError('');
    try {
      const normalizedId = String(systemId || '').trim();
      let detailResponse = null;

      if (/^\d{10}$/.test(normalizedId)) {
        try {
          detailResponse = await API.get(`/users/by-system-id/${encodeURIComponent(normalizedId)}`);
        } catch (primaryError) {
          if (primaryError.response?.status !== 404) {
            throw primaryError;
          }
        }
      }

      if (!detailResponse) {
        try {
          detailResponse = await API.get(`/users/${encodeURIComponent(normalizedId)}`);
        } catch (secondaryError) {
          if (secondaryError.response?.status !== 404) {
            throw secondaryError;
          }
        }
      }

      if (!detailResponse && normalizedId) {
        const searchRes = await API.get(`/users?search=${encodeURIComponent(normalizedId)}&limit=50`);
        const matchedUser = (searchRes.data?.data || []).find((entry) => String(entry.systemId) === normalizedId);
        if (matchedUser?.systemId) {
          detailResponse = await API.get(`/users/by-system-id/${encodeURIComponent(matchedUser.systemId)}`);
        }
      }

      if (!detailResponse?.data?.data) {
        throw new Error('User not found');
      }

      setUser(detailResponse.data.data);
      setAccountControl({
        status: detailResponse.data.data.status || 'pending',
        emailVerified: Boolean(detailResponse.data.data.emailVerified),
        isActive: detailResponse.data.data.isActive !== false,
        expiryDate: detailResponse.data.data.expiryDate ? new Date(detailResponse.data.data.expiryDate).toISOString().slice(0, 10) : '',
      });
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to load user details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [systemId]);

  useEffect(() => {
    let active = true;
    fetchAvatarOptions()
      .then((avatars) => {
        if (active) setAvatarOptions(avatars);
      })
      .catch(() => {
        if (active) setAvatarOptions([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const academicSummary = useMemo(() => {
    if (!user) return [];
    return [
      user.sectionContext?.program?.name,
      user.sectionContext?.course?.name,
      user.sectionContext?.academicSession?.label,
      user.sectionContext?.name ? `Section ${user.sectionContext.name}` : null,
    ].filter(Boolean);
  }, [user]);

  const pageCopy = useMemo(() => getProfilePageCopy(user), [user]);
  const adminTierDefinition = useMemo(() => getAdminTierDefinition(user?.adminTier), [user?.adminTier]);
  const facultySubjectSummary = useMemo(() => {
    if (user?.role !== 'faculty') return [];
    return (user.teachingAssignments || []).map((assignment) => ({
      id: assignment.id,
      name: assignment.subject?.name || 'Subject',
      code: assignment.subject?.code || '—',
      semester: assignment.semester || '',
      section: assignment.section?.name || '—',
    }));
  }, [user]);

  const uploadAvatar = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const data = new FormData();
    data.append('profileImage', file);
    setSavingAvatar(true);
    try {
      await API.post(`/users/${systemId}/avatar`, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Profile image updated');
      await loadUser();
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || 'Failed to upload profile image');
    } finally {
      setSavingAvatar(false);
      event.target.value = '';
    }
  };

  const selectAvatar = async (avatarChoice) => {
    setSavingAvatar(true);
    try {
      await API.put(`/users/${systemId}`, { avatarChoice, removeProfileImage: true });
      toast.success('Avatar updated');
      await loadUser();
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || 'Failed to update avatar');
    } finally {
      setSavingAvatar(false);
    }
  };

  const handleDelete = async () => {
    setDeleteState({ open: true, loading: true });
    try {
      await API.delete(`/users/${systemId}`);
      toast.success('User removed');
      navigate('/users');
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || 'Failed to delete user');
      setDeleteState({ open: true, loading: false });
    }
  };

  const handleAccessUpdate = async () => {
    setSavingAccess(true);
    try {
      await API.put(`/users/${systemId}`, {
        status: accountControl.status,
        emailVerified: accountControl.emailVerified,
        isActive: accountControl.isActive,
        expiryDate: accountControl.expiryDate || null,
      });
      toast.success('Account controls updated');
      await loadUser();
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || 'Failed to update account controls');
    } finally {
      setSavingAccess(false);
    }
  };

  const handlePasswordOverride = async () => {
    if (!passwordControl.password || !passwordControl.confirmPassword) {
      toast.error('Enter and confirm the new password');
      return;
    }
    if (passwordControl.password !== passwordControl.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setSavingPassword(true);
    try {
      await API.post(`/users/${systemId}/password`, {
        password: passwordControl.password,
      });
      setPasswordControl({ password: '', confirmPassword: '' });
      toast.success('Password updated');
      await loadUser();
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || 'Failed to update password');
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) return <FullPageSpinner />;

  if (!user) {
    return <EmptyState icon="👤" title="User not found" description={error || 'This identity is no longer available.'} />;
  }

  return (
    <div className="space-y-6">
      <AvatarPickerPopover
        open={avatarPickerOpen}
        title="Avatar & Profile Image"
        subtitle="Assign a preset avatar or upload a custom image without shifting the page layout."
        avatars={avatarOptions}
        selectedAvatar={user?.avatarChoice || ''}
        loading={savingAvatar}
        onClose={() => setAvatarPickerOpen(false)}
        onSelect={selectAvatar}
        onUpload={uploadAvatar}
      />

      <ConfirmDialog
        open={deleteState.open}
        title="Delete user"
        description={`Delete ${user.name} from the system? This action cannot be undone.`}
        confirmLabel="Delete User"
        loading={deleteState.loading}
        onConfirm={handleDelete}
        onClose={() => setDeleteState({ open: false, loading: false })}
      />

      <PageHeader
        title={pageCopy.title}
        subtitle={pageCopy.subtitle}
        action={(
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => navigate('/users')} className="btn-secondary">
              <FiArrowLeft size={15} />
              Back
            </button>
            <Link to={`/users/${user.systemId}/edit`} className="btn-secondary">
              <FiEdit2 size={15} />
              Edit User
            </Link>
            <button type="button" onClick={() => setDeleteState({ open: true, loading: false })} className="btn-secondary text-red-600 hover:text-red-700">
              <FiTrash2 size={15} />
              Delete
            </button>
          </div>
        )}
      />

      {error ? <Alert type="error" message={error} /> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_380px]">
        <div className="space-y-6">
          <div className="card p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              <Avatar user={user} size="xl" />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="font-display text-2xl font-bold text-gray-900 dark-text-primary">{user.name}</h2>
                  <span className={`badge ${getRoleColor(user.role)}`}>{getRoleLabel(user.role)}</span>
                  {user.adminTier ? (
                    <span className={`badge ${getAdminTierTone(user.adminTier)}`}>
                      {adminTierDefinition?.label || user.adminTier}
                    </span>
                  ) : null}
                  <span className={`badge ${user.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : user.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'}`}>{user.status}</span>
                  <span className={`badge ${lifecycleTone[user.lifecycle?.overall] || 'bg-slate-100 text-slate-700'}`}>{String(user.lifecycle?.overall || 'pending').replace(/_/g, ' ')}</span>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <MetaItem icon={FiMail} label="Email" value={user.email} />
                  <MetaItem icon={FiShield} label="Verification" value={user.emailVerified ? 'Verified' : 'Not verified'} />
                  <MetaItem icon={FiCalendar} label="Last login" value={user.lastLogin ? formatDate(user.lastLogin) : 'No successful login yet'} />
                  <MetaItem icon={FiClock} label="Created" value={formatDate(user.createdAt)} />
                </div>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-lg font-bold text-gray-900 dark-text-primary">Lifecycle</h3>
                <p className="mt-1 text-sm text-gray-500 dark-text-muted">Track exactly where this identity is in onboarding and operational readiness.</p>
              </div>
              {adminTierDefinition ? (
                <HelpTooltip
                  title={`${adminTierDefinition.label} access`}
                  items={[
                    { label: `Tier ${adminTierDefinition.level}`, description: `${adminTierDefinition.scopeLabel}. ${adminTierDefinition.description}` },
                    { label: 'Inherited access', description: 'Higher admin tiers automatically inherit the permissions granted to lower tiers.' },
                  ]}
                />
              ) : null}
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              {(user.lifecycle?.stages || []).map((stage) => (
                <div key={stage.key} className={`rounded-2xl border px-4 py-4 ${stage.complete ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-gray-900">{stage.label}</p>
                    <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${stage.complete ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-600'}`}>
                      <FiCheckCircle size={14} />
                    </span>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-gray-500">{stage.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-6">
            <h3 className="font-display text-lg font-bold text-gray-900 dark-text-primary">{pageCopy.academicTitle}</h3>
            <p className="mt-1 text-sm text-gray-500 dark-text-muted">{pageCopy.academicDescription}</p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <MetaItem icon={FiBookOpen} label="Program" value={user.sectionContext?.program?.name || user.department || '—'} />
              <MetaItem icon={FiBookOpen} label="Course" value={user.sectionContext?.course?.name || '—'} />
              <MetaItem icon={FiBookOpen} label="Academic session" value={user.sectionContext?.academicSession?.label || user.year || '—'} />
              <MetaItem icon={FiUser} label="Section" value={user.sectionContext?.name || user.section || '—'} />
            </div>

            <div className="mt-5">
              <h4 className="text-sm font-semibold text-gray-900 dark-text-primary">{pageCopy.subjectsTitle}</h4>
              <div className="mt-3 space-y-3">
                {user.subjects?.length ? user.subjects.map((subject) => (
                  <div key={subject.id || `${subject.code}-${subject.semester}`} className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4 dark-surface-subtle">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-gray-900 dark-text-primary">{subject.name}</p>
                      <span className="badge bg-slate-100 text-slate-700">{subject.code}</span>
                      {subject.semester ? <span className="badge bg-blue-100 text-blue-700">{subject.semester}</span> : null}
                    </div>
                    {subject.faculty?.name ? (
                      <p className="mt-2 text-sm text-gray-500 dark-text-muted">Assigned faculty: {subject.faculty.name}</p>
                    ) : null}
                  </div>
                )) : (
                  <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-5 text-sm text-gray-400">{pageCopy.subjectsEmpty}</div>
                )}
              </div>
            </div>

            {user.role === 'faculty' ? (
              <div className="mt-5">
                <h4 className="text-sm font-semibold text-gray-900 dark-text-primary">Teaching Summary</h4>
                <p className="mt-1 text-sm text-gray-500 dark-text-muted">This faculty member’s live teaching scope is derived from section-subject assignments in the academic structure.</p>
                <div className="mt-3 space-y-3">
                  {facultySubjectSummary.length ? facultySubjectSummary.map((assignment) => (
                    <div key={assignment.id} className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4 dark-surface-subtle">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-gray-900 dark-text-primary">{assignment.name}</p>
                        <span className="badge bg-slate-100 text-slate-700">{assignment.code}</span>
                        {assignment.semester ? <span className="badge bg-blue-100 text-blue-700">{assignment.semester}</span> : null}
                      </div>
                      <p className="mt-2 text-sm text-gray-500 dark-text-muted">Assigned section: {assignment.section}</p>
                    </div>
                  )) : (
                    <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-5 text-sm text-gray-400">No teaching assignments are connected to this faculty account yet.</div>
                  )}
                </div>
              </div>
            ) : null}

            {user.teachingAssignments?.length ? (
              <div className="mt-5">
                <h4 className="text-sm font-semibold text-gray-900 dark-text-primary">Teaching Assignments</h4>
                <div className="mt-3 space-y-3">
                  {user.teachingAssignments.map((assignment) => (
                    <div key={assignment.id} className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4 dark-surface-subtle">
                      <p className="font-semibold text-gray-900 dark-text-primary">{assignment.subject?.name || 'Subject'}</p>
                      <p className="mt-1 text-sm text-gray-500 dark-text-muted">{assignment.subject?.code || '—'} · Section {assignment.section?.name || '—'} · {assignment.semester}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="card p-6">
              <h3 className="font-display text-lg font-bold text-gray-900 dark-text-primary">Recent Activity</h3>
              <div className="mt-4 space-y-3">
                {user.recentNotifications?.length ? user.recentNotifications.map((item) => (
                  <div key={`${item.type}-${item.createdAt}`} className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 dark-surface-subtle">
                    <p className="font-medium text-gray-900 dark-text-primary">{item.title}</p>
                    <p className="mt-1 text-sm text-gray-500 dark-text-muted">{item.message}</p>
                    <p className="mt-2 text-xs text-gray-400">{formatRelative(item.createdAt)}</p>
                  </div>
                )) : (
                  <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-5 text-sm text-gray-400">No recent notifications available.</div>
                )}
              </div>
            </div>

            <div className="card p-6">
              <h3 className="font-display text-lg font-bold text-gray-900 dark-text-primary">Ticket Activity</h3>
              <div className="mt-4 space-y-3">
                {user.recentTickets?.length ? user.recentTickets.map((ticket) => (
                  <div key={ticket._id} className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 dark-surface-subtle">
                    <p className="font-medium text-gray-900 dark-text-primary">{ticket.title}</p>
                    <p className="mt-1 text-sm text-gray-500 dark-text-muted">{ticket.ticketId} · {ticket.status} · {ticket.priority}</p>
                    <p className="mt-2 text-xs text-gray-400">Updated {formatRelative(ticket.updatedAt)}</p>
                  </div>
                )) : (
                  <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-5 text-sm text-gray-400">No recent ticket activity found.</div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-6">
            <h3 className="font-display text-lg font-bold text-gray-900 dark-text-primary">Identity Summary</h3>
            <div className="mt-4 space-y-3">
              <MetaItem icon={FiUser} label="System ID" value={user.systemId} />
              <MetaItem icon={FiShield} label="Status" value={`${user.status} · ${user.isActive ? 'Active' : 'Inactive'} · ${user.emailVerified ? 'Verified' : 'Unverified'}`} />
              <MetaItem icon={FiCheckCircle} label="Academic context" value={academicSummary.join(' · ') || 'No academic mapping'} />
            </div>
          </div>

          <div className="card p-6">
            <h3 className="font-display text-lg font-bold text-gray-900 dark-text-primary">Connected Modules</h3>
            <p className="mt-1 text-sm text-gray-500 dark-text-muted">This identity record connects access, academics, and support activity across the ERP.</p>
            <div className="mt-4 grid gap-3">
              <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 dark-surface-subtle">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">Identity</p>
                <p className="mt-2 text-sm text-gray-700 dark-text-primary">Lifecycle, verification, password readiness, and access state are managed from this profile.</p>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 dark-surface-subtle">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">Academics</p>
                <p className="mt-2 text-sm text-gray-700 dark-text-primary">
                  {user.role === 'student'
                    ? 'Student access is derived from section enrollment, which unlocks subjects, timetable, and attendance.'
                    : user.role === 'faculty'
                      ? 'Faculty access is derived from teaching assignments, which scope timetable and attendance control.'
                      : 'Operational roles can support academic workflows without requiring section enrollment.'}
                </p>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 dark-surface-subtle">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">Support</p>
                <p className="mt-2 text-sm text-gray-700 dark-text-primary">Recent tickets and notifications show the user’s connected helpdesk and platform activity.</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link to="/users" className="btn-secondary">Identity & Access</Link>
              <Link to="/approvals" className="btn-secondary">Identity Alerts</Link>
              <Link to="/academics" className="btn-secondary">Academic Structure</Link>
              <Link to="/tickets" className="btn-secondary">Tickets</Link>
            </div>
          </div>

          {isSuperAdmin ? (
            <>
              <div className="card p-6">
                <h3 className="font-display text-lg font-bold text-gray-900 dark-text-primary">Account Controls</h3>
                <p className="mt-1 text-sm text-gray-500 dark-text-muted">Lifecycle, verification, and sign-in access for this identity.</p>
                <div className="mt-5 grid gap-4">
                  <div>
                    <label className="label">Account Status</label>
                    <select
                      className="input"
                      value={accountControl.status}
                      onChange={(event) => setAccountControl((current) => ({ ...current, status: event.target.value }))}
                    >
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="label">Verification</label>
                      <select
                        className="input"
                        value={String(accountControl.emailVerified)}
                        onChange={(event) => setAccountControl((current) => ({ ...current, emailVerified: event.target.value === 'true' }))}
                      >
                        <option value="false">Not Verified</option>
                        <option value="true">Verified</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">Access</label>
                      <select
                        className="input"
                        value={String(accountControl.isActive)}
                        onChange={(event) => setAccountControl((current) => ({ ...current, isActive: event.target.value === 'true' }))}
                      >
                        <option value="true">Active</option>
                        <option value="false">Inactive</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="label">Expiry Date</label>
                    <input
                      type="date"
                      className="input"
                      value={accountControl.expiryDate}
                      onChange={(event) => setAccountControl((current) => ({ ...current, expiryDate: event.target.value }))}
                    />
                  </div>
                  <button type="button" onClick={handleAccessUpdate} disabled={savingAccess} className="btn-primary w-full justify-center">
                    {savingAccess ? 'Saving…' : 'Update Account Controls'}
                  </button>
                </div>
              </div>

              <div className="card p-6">
                <h3 className="font-display text-lg font-bold text-gray-900 dark-text-primary">Manual Password Assignment</h3>
                <p className="mt-1 text-sm text-gray-500 dark-text-muted">Super-admin-only override for testing and controlled support access.</p>
                <div className="mt-5 space-y-4">
                  <div>
                    <label className="label">New Password</label>
                    <input
                      type="password"
                      className="input"
                      value={passwordControl.password}
                      onChange={(event) => setPasswordControl((current) => ({ ...current, password: event.target.value }))}
                      placeholder="Minimum 6 characters"
                    />
                  </div>
                  <div>
                    <label className="label">Confirm Password</label>
                    <input
                      type="password"
                      className="input"
                      value={passwordControl.confirmPassword}
                      onChange={(event) => setPasswordControl((current) => ({ ...current, confirmPassword: event.target.value }))}
                      placeholder="Re-enter the password"
                    />
                  </div>
                  <button type="button" onClick={handlePasswordOverride} disabled={savingPassword} className="btn-secondary w-full justify-center">
                    {savingPassword ? 'Updating Password…' : 'Set Password Manually'}
                  </button>
                </div>
              </div>
            </>
          ) : null}

          <div className="card p-6">
            <button
              type="button"
              onClick={() => setAvatarPickerOpen(true)}
              className="flex w-full items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-left transition hover:border-gray-200 hover:bg-white dark-surface-subtle"
            >
              <div className="flex items-center gap-3">
                <FiImage size={16} className="text-gray-500" />
                <div>
                  <h3 className="font-display text-base font-bold text-gray-900 dark-text-primary">Avatar & Profile Image</h3>
                  <p className="mt-0.5 text-sm text-gray-500 dark-text-muted">Open the floating picker to upload or choose an avatar.</p>
                </div>
              </div>
              <span className="text-sm font-semibold text-blue-600">Manage</span>
            </button>
            <p className="mt-4 text-sm text-gray-500 dark-text-muted">Priority order: uploaded photo, selected local avatar, then generated initials.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
