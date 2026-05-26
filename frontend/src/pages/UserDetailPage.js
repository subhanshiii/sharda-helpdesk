import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiArrowLeft, FiCalendar, FiEdit2, FiShield, FiTrash2, FiUser, FiBookOpen, FiClock, FiCheckCircle, FiImage, FiEye, FiEyeOff } from 'react-icons/fi';
import API from '../utils/api';
import { Alert, Avatar, ConfirmDialog, EmptyState, FullPageSpinner, HelpTooltip, PageHeader } from '../components/ui';
import { formatDate, formatRelative, getAdminTierDefinition, getAdminTierTone, getRoleColor, getRoleLabel } from '../utils/helpers';
import { fetchAvatarOptions } from '../constants/avatarOptions';
import AvatarPickerPopover from '../components/AvatarPickerPopover';
import { usePermissions } from '../context/PermissionContext';
import { isFacultyUser, normalizeUserRole } from '../utils/access';

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

const lifecycleLabel = (overall) => {
  const map = {
    active: 'Access Allowed',
    ready: 'Almost Ready',
    pending_verification: 'Verify Email',
    password_setup: 'Set Password',
    assignment_pending: 'Add Academic Mapping',
    pending_approval: 'Awaiting Approval',
    rejected: 'Rejected',
    suspended: 'Suspended',
    inactive: 'Inactive',
    expired: 'Expired',
  };
  return map[overall] || 'Pending';
};

const buildClientLifecycle = (user) => {
  if (!user) {
    return {
      overall: 'pending',
      stages: [],
      requiresAssignment: false,
      assignmentReady: false,
      credentialReady: false,
      verificationComplete: false,
      operationallyActive: false,
      isExpired: false,
    };
  }

  const normalizedRole = normalizeUserRole(user.role);
  const now = new Date();
  const isExpired = Boolean(user.expiryDate && new Date(user.expiryDate) <= now);
  const verificationComplete = Boolean(user.emailVerified);
  const credentialReady = verificationComplete && !user.passwordNeedsSetup;
  const accessApproved = verificationComplete && credentialReady && user.status === 'approved';
  const requiresAssignment = ['student', 'faculty'].includes(normalizedRole);
  const rawAssignmentReady = requiresAssignment
    ? normalizedRole === 'student'
      ? Boolean(user.enrollment?.id && user.enrollment?.status === 'active' && user.sectionContext?.id)
      : (user.teachingAssignments || []).length > 0
    : true;
  const assignmentReady = accessApproved && rawAssignmentReady;
  const hierarchyComplete = verificationComplete && credentialReady && accessApproved && assignmentReady;
  const operationallyActive = hierarchyComplete && user.isActive !== false && !isExpired;

  const stages = [
    {
      key: 'provisioned',
      label: 'Account Created',
      complete: true,
      description: 'The user record exists in the system.',
    },
    {
      key: 'verified',
      label: 'Email Confirmed',
      complete: verificationComplete,
      description: verificationComplete ? 'Email verification is complete.' : 'Waiting for the user to verify their email.',
    },
    {
      key: 'credentials',
      label: 'Password Set',
      complete: credentialReady,
      description: credentialReady
        ? 'User can authenticate with a managed password.'
        : !verificationComplete
          ? 'Complete email verification before the password step can be finished.'
          : 'Password setup still needs to be completed.',
    },
    {
      key: 'approval',
      label: 'Admin Approved',
      complete: accessApproved,
      description: !verificationComplete
        ? 'Complete email verification before admin approval can be treated as ready.'
        : !credentialReady
          ? 'Complete password setup before admin approval can be treated as ready.'
          : accessApproved
            ? 'The account has been approved for access.'
            : `Account status is ${user.status || 'pending'}.`,
    },
    {
      key: 'assignment',
      label: requiresAssignment ? 'Academic Mapping Complete' : 'Academic Mapping Not Required',
      complete: assignmentReady,
      description: !verificationComplete
        ? 'Complete email verification before academic mapping can be treated as ready.'
        : !credentialReady
          ? 'Complete password setup before academic mapping can be treated as ready.'
          : !accessApproved
            ? 'Complete admin approval before academic mapping can be treated as ready.'
            : requiresAssignment
              ? assignmentReady
                ? 'Academic structure assignment is linked and ready.'
                : `Waiting for ${normalizedRole === 'student' ? 'active section enrollment' : 'teaching assignment'}.`
              : 'This role does not require academic assignment.',
    },
    {
      key: 'active',
      label: 'Account Access',
      complete: operationallyActive,
      description: operationallyActive
        ? 'Account access is allowed.'
        : isExpired
          ? 'Account access has expired.'
          : user.isActive === false
            ? 'Account access is currently denied.'
            : hierarchyComplete
              ? 'Account access can be enabled by marking the account active.'
              : `Account status is ${user.status || 'pending'}.`,
    },
  ];

  const overall = operationallyActive
    ? 'active'
    : !verificationComplete
      ? 'pending_verification'
      : !credentialReady
        ? 'password_setup'
        : !accessApproved
          ? 'pending_approval'
          : !assignmentReady
          ? 'assignment_pending'
          : user.status === 'rejected'
            ? 'rejected'
            : user.status === 'suspended'
              ? 'suspended'
              : isExpired
                ? 'expired'
                : user.isActive === false
                  ? 'inactive'
                  : accessApproved
                    ? 'ready'
                    : 'pending_approval';

  return {
    overall,
    stages,
    requiresAssignment,
    assignmentReady,
    accessApproved,
    hierarchyComplete,
    credentialReady,
    verificationComplete,
    operationallyActive,
    isExpired,
  };
};

const getProfilePageCopy = (user) => {
  const roleLabel = getRoleLabel(user?.role || 'user');
  const normalizedRole = normalizeUserRole(user?.role);
  const systemIdLabel = user?.systemId || '—';

  if (normalizedRole === 'faculty') {
    return {
      title: 'Faculty Profile',
      subtitle: `System ID ${systemIdLabel}`,
      academicTitle: 'Faculty Academic Scope',
      academicDescription: 'Teaching assignments, subject ownership, and section-linked academic scope for this faculty member.',
      subjectsTitle: 'Assigned Subjects',
      subjectsEmpty: 'No subjects are assigned to this faculty member yet.',
    };
  }

  if (normalizedRole === 'student') {
    return {
      title: 'Student Profile',
      subtitle: `System ID ${systemIdLabel}`,
      academicTitle: 'Student Academic Mapping',
      academicDescription: 'Section, course, and subject context used to drive timetable, attendance, and assignments.',
      subjectsTitle: 'Enrolled Subjects',
      subjectsEmpty: 'No subjects are mapped to this student yet.',
    };
  }

  if (normalizedRole === 'staff') {
    return {
      title: 'Staff Profile',
      subtitle: `System ID ${systemIdLabel}`,
      academicTitle: 'Operational Context',
      academicDescription: 'Operational context, academic visibility, and support access tied to this staff account.',
      subjectsTitle: 'Academic Visibility',
      subjectsEmpty: 'No direct subject mappings exist for this staff account.',
    };
  }

  if (normalizedRole === 'admin') {
    return {
      title: user?.adminTier === 'super_admin' ? 'Super Admin Profile' : 'Admin Profile',
      subtitle: `System ID ${systemIdLabel}`,
      academicTitle: 'Governance Context',
      academicDescription: 'Administrative access, academic visibility, and platform governance scope connected to this account.',
      subjectsTitle: 'Academic Visibility',
      subjectsEmpty: 'No direct subject mappings exist for this admin account.',
    };
  }

  return {
    title: `${roleLabel} Profile`,
    subtitle: `System ID ${systemIdLabel}`,
    academicTitle: 'Academic Mapping',
    academicDescription: 'Academic context connected to this identity record.',
    subjectsTitle: 'Subjects',
    subjectsEmpty: 'No subjects mapped to this user yet.',
  };
};

const getAccessSummary = (user, lifecycle) => {
  const roleLabel = getRoleLabel(user?.role || 'user');

  if (!user) {
    return 'Loading account readiness...';
  }

  if (lifecycle?.operationallyActive) {
    return `${roleLabel} has account access and can use assigned modules.`;
  }

  if (!lifecycle?.verificationComplete) {
    return 'This user cannot sign in yet because email verification is still pending.';
  }

  if (!lifecycle?.credentialReady) {
    return 'This user cannot sign in yet because password setup is still incomplete.';
  }

  if (user.status !== 'approved') {
    if (user.status === 'pending') {
      return 'This user cannot sign in yet because the account is still waiting for admin approval.';
    }
    if (user.status === 'rejected') {
      return 'This user cannot sign in because the account has been rejected.';
    }
    if (user.status === 'suspended') {
      return 'This user cannot sign in because the account is suspended.';
    }
  }

  if (user.isActive === false) {
    return 'This user cannot access the app because account access is currently denied.';
  }

  if (lifecycle?.isExpired) {
    return 'This user cannot sign in because the account access has expired.';
  }

  if (lifecycle?.requiresAssignment && !lifecycle?.assignmentReady) {
    return `This ${roleLabel.toLowerCase()} cannot fully use academic modules yet because the required academic assignment is still missing.`;
  }

  return 'This user still has account readiness checks pending.';
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
  const [mappingState, setMappingState] = useState({ open: false, loading: false });
  const [error, setError] = useState('');
  const [accountControl, setAccountControl] = useState({ status: 'pending', emailVerified: false, isActive: true, expiryDate: '' });
  const [savingAccess, setSavingAccess] = useState(false);
  const [passwordControl, setPasswordControl] = useState({ password: '', confirmPassword: '' });
  const [showPasswordOverride, setShowPasswordOverride] = useState(false);
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
  const effectiveLifecycle = useMemo(() => buildClientLifecycle(user), [user]);
  const accessSummary = useMemo(() => getAccessSummary(user, effectiveLifecycle), [user, effectiveLifecycle]);
  const adminTierDefinition = useMemo(() => getAdminTierDefinition(user?.adminTier), [user?.adminTier]);
  const facultySubjectSummary = useMemo(() => {
    if (!isFacultyUser(user)) return [];
    return (user.teachingAssignments || []).map((assignment) => ({
      id: assignment.id,
      name: assignment.subject?.name || 'Subject',
      code: assignment.subject?.code || '—',
      semester: assignment.semester || '',
      section: assignment.section?.name || '—',
    }));
  }, [user]);

  const uploadAvatar = async (file) => {
    if (!file) return;
    const data = new FormData();
    data.append('profileImage', file);
    setSavingAvatar(true);
    try {
      await API.post(`/users/${systemId}/avatar`, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setAvatarPickerOpen(false);
      toast.success('Profile image updated');
      await loadUser();
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || 'Failed to upload profile image');
    } finally {
      setSavingAvatar(false);
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

  const handleRemoveAcademicMapping = async () => {
    setMappingState({ open: true, loading: true });
    try {
      await API.put(`/users/${systemId}`, { sectionId: '' });
      toast.success('Academic mapping removed');
      await loadUser();
      setMappingState({ open: false, loading: false });
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || 'Failed to remove academic mapping');
      setMappingState({ open: true, loading: false });
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
      const response = await API.post(`/users/${systemId}/password`, {
        password: passwordControl.password,
      });
      setPasswordControl({ password: '', confirmPassword: '' });
      toast.success(response.data?.message || 'Password updated');
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

      <ConfirmDialog
        open={mappingState.open}
        title="Remove academic mapping"
        description={`Remove ${user.name}'s current section mapping? This will also remove the active section enrollment for this student.`}
        confirmLabel="Remove Mapping"
        loading={mappingState.loading}
        onConfirm={handleRemoveAcademicMapping}
        onClose={() => setMappingState({ open: false, loading: false })}
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

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_360px]">
        <div className="space-y-6">
          <div className="card p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
              <div className="flex items-start gap-4">
                <Avatar user={user} size="xl" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h2 className="font-display text-2xl font-bold text-gray-900 dark-text-primary">{user.name}</h2>
                    <span className={`badge ${getRoleColor(user.role)}`}>{getRoleLabel(user.role)}</span>
                    {user.adminTier ? (
                      <span className={`badge ${getAdminTierTone(user.adminTier)}`}>
                        {adminTierDefinition?.label || user.adminTier}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm text-gray-500 dark-text-muted">{user.email}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className={`badge ${user.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : user.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'}`}>
                      {user.status}
                    </span>
                    <span className={`badge ${lifecycleTone[effectiveLifecycle.overall] || 'bg-slate-100 text-slate-700'}`}>
                      {lifecycleLabel(effectiveLifecycle.overall)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="grid flex-1 gap-3 sm:grid-cols-2">
                <MetaItem icon={FiShield} label="Verification" value={user.emailVerified ? 'Verified' : 'Not verified'} />
                <MetaItem icon={FiUser} label="System ID" value={user.systemId} />
                <MetaItem icon={FiCalendar} label="Last login" value={user.lastLogin ? formatDate(user.lastLogin) : 'No successful login yet'} />
                <MetaItem icon={FiClock} label="Created" value={formatDate(user.createdAt)} />
              </div>
            </div>
            <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-4 text-sm text-blue-900">
              {accessSummary}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
            <div className="card p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-lg font-bold text-gray-900 dark-text-primary">Access & Lifecycle</h3>
                  <p className="mt-1 text-sm text-gray-500 dark-text-muted">Prioritized account readiness, onboarding state, and access health.</p>
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
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {effectiveLifecycle.stages.map((stage) => (
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
              <h3 className="font-display text-lg font-bold text-gray-900 dark-text-primary">Identity Snapshot</h3>
              <div className="mt-4 space-y-3">
                <MetaItem icon={FiShield} label="Status" value={`${user.status} · ${user.emailVerified ? 'Verified' : 'Unverified'}`} />
                <MetaItem icon={FiCheckCircle} label="Academic context" value={academicSummary.join(' · ') || 'No academic mapping'} />
                <MetaItem icon={FiCalendar} label="Expiry" value={user.expiryDate ? formatDate(user.expiryDate) : 'No expiry set'} />
              </div>
              {user.adminScopes?.length ? (
                <div className="mt-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">Admin Scopes</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {user.adminScopes.map((scope) => (
                      <span key={scope._id} className="badge bg-slate-100 text-slate-700">
                        {scope.scopeType} · {scope.scopeName || scope.scopeValue || 'Scoped'}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="card p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-lg font-bold text-gray-900 dark-text-primary">{pageCopy.academicTitle}</h3>
                <p className="mt-1 text-sm text-gray-500 dark-text-muted">{pageCopy.academicDescription}</p>
              </div>
              {normalizeUserRole(user?.role) === 'student' && effectiveLifecycle.accessApproved && (user.sectionContext?.id || user.sectionId || user.section) ? (
                <button
                  type="button"
                  onClick={() => setMappingState({ open: true, loading: false })}
                  className="btn-secondary text-red-600 hover:text-red-700"
                >
                  Remove Mapping
                </button>
              ) : null}
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetaItem icon={FiBookOpen} label="Program" value={user.sectionContext?.program?.name || user.department || '—'} />
              <MetaItem icon={FiBookOpen} label="Course" value={user.sectionContext?.course?.name || '—'} />
              <MetaItem icon={FiBookOpen} label="Academic session" value={user.sectionContext?.academicSession?.label || user.year || '—'} />
              <MetaItem icon={FiUser} label="Section" value={user.sectionContext?.name || user.section || '—'} />
            </div>

            <div className="mt-6">
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

            {isFacultyUser(user) ? (
              <div className="mt-6">
                <h4 className="text-sm font-semibold text-gray-900 dark-text-primary">Teaching Summary</h4>
                <p className="mt-1 text-sm text-gray-500 dark-text-muted">Live teaching scope derived from section-subject assignments.</p>
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
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="card p-6">
              <h3 className="font-display text-lg font-bold text-gray-900 dark-text-primary">Recent Notifications</h3>
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
              <h3 className="font-display text-lg font-bold text-gray-900 dark-text-primary">Recent Ticket Activity</h3>
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
            <h3 className="font-display text-lg font-bold text-gray-900 dark-text-primary">Quick Actions</h3>
            <p className="mt-1 text-sm text-gray-500 dark-text-muted">Move to the most relevant operational workspace from this identity record.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link to="/users" className="btn-secondary">All Users</Link>
              <Link to="/approvals" className="btn-secondary">Approvals</Link>
              <Link to="/academics" className="btn-secondary">Academic Planning</Link>
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
                      <label className="label">Account Access</label>
                      <select
                        className="input"
                        value={String(accountControl.isActive)}
                        onChange={(event) => setAccountControl((current) => ({ ...current, isActive: event.target.value === 'true' }))}
                      >
                        <option value="true">Allowed</option>
                        <option value="false">Denied</option>
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
                <p className="mt-1 text-sm text-gray-500 dark-text-muted">Super-admin-only override for testing and controlled support access. This also completes email verification; the account still needs Approved status and active access to sign in.</p>
                <div className="mt-5 space-y-4">
                  <div>
                    <label className="label">New Password</label>
                    <div className="relative">
                      <input
                        type={showPasswordOverride ? 'text' : 'password'}
                        className="input pr-11"
                        value={passwordControl.password}
                        onChange={(event) => setPasswordControl((current) => ({ ...current, password: event.target.value }))}
                        placeholder="Minimum 6 characters"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswordOverride((current) => !current)}
                        className="absolute inset-y-0 right-3 inline-flex items-center text-gray-400 transition hover:text-gray-600"
                        aria-label={showPasswordOverride ? 'Hide password' : 'Show password'}
                      >
                        {showPasswordOverride ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="label">Confirm Password</label>
                    <div className="relative">
                      <input
                        type={showPasswordOverride ? 'text' : 'password'}
                        className="input pr-11"
                        value={passwordControl.confirmPassword}
                        onChange={(event) => setPasswordControl((current) => ({ ...current, confirmPassword: event.target.value }))}
                        placeholder="Re-enter the password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswordOverride((current) => !current)}
                        className="absolute inset-y-0 right-3 inline-flex items-center text-gray-400 transition hover:text-gray-600"
                        aria-label={showPasswordOverride ? 'Hide password' : 'Show password'}
                      >
                        {showPasswordOverride ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                      </button>
                    </div>
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
