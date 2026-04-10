import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiArrowLeft, FiCalendar, FiEdit2, FiMail, FiShield, FiTrash2, FiUser, FiBookOpen, FiClock, FiCheckCircle, FiUpload, FiImage } from 'react-icons/fi';
import API from '../utils/api';
import { Alert, Avatar, ConfirmDialog, EmptyState, FullPageSpinner, PageHeader } from '../components/ui';
import { formatDate, formatRelative, getRoleColor, getRoleLabel, getAvatarPresetUrl } from '../utils/helpers';
import { AVATAR_OPTIONS } from '../constants/avatarOptions';
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

export default function UserDetailPage() {
  const { systemId } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [avatarExpanded, setAvatarExpanded] = useState(false);
  const [deleteState, setDeleteState] = useState({ open: false, loading: false });
  const [error, setError] = useState('');
  const [accountControl, setAccountControl] = useState({ status: 'pending', emailVerified: false, isActive: true, expiryDate: '' });
  const [savingAccess, setSavingAccess] = useState(false);
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

  const academicSummary = useMemo(() => {
    if (!user) return [];
    return [
      user.sectionContext?.program?.name,
      user.sectionContext?.course?.name,
      user.sectionContext?.academicYear?.label,
      user.sectionContext?.name ? `Section ${user.sectionContext.name}` : null,
    ].filter(Boolean);
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

  if (loading) return <FullPageSpinner />;

  if (!user) {
    return <EmptyState icon="👤" title="User not found" description={error || 'This identity is no longer available.'} />;
  }

  return (
    <div className="space-y-6">
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
        title="User Details"
        subtitle={`System ID ${user.systemId}`}
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
                  {user.adminTier === 'super_admin' ? <span className="badge bg-amber-100 text-amber-700">Super Admin</span> : null}
                  <span className={`badge ${user.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : user.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'}`}>{user.status}</span>
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
            <h3 className="font-display text-lg font-bold text-gray-900 dark-text-primary">Academic Mapping</h3>
            <p className="mt-1 text-sm text-gray-500 dark-text-muted">Section, course, and subject context used to drive timetable, attendance, and assignments.</p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <MetaItem icon={FiBookOpen} label="Program" value={user.sectionContext?.program?.name || user.department || '—'} />
              <MetaItem icon={FiBookOpen} label="Course" value={user.sectionContext?.course?.name || '—'} />
              <MetaItem icon={FiBookOpen} label="Academic year" value={user.sectionContext?.academicYear?.label || user.year || '—'} />
              <MetaItem icon={FiUser} label="Section" value={user.sectionContext?.name || user.section || '—'} />
            </div>

            <div className="mt-5">
              <h4 className="text-sm font-semibold text-gray-900 dark-text-primary">Subjects</h4>
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
                  <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-5 text-sm text-gray-400">No subjects mapped to this user yet.</div>
                )}
              </div>
            </div>

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

          {isSuperAdmin ? (
            <div className="card p-6">
              <h3 className="font-display text-lg font-bold text-gray-900 dark-text-primary">Account Controls</h3>
              <p className="mt-1 text-sm text-gray-500 dark-text-muted">Super admin override for lifecycle, verification, and access state.</p>
              <div className="mt-4 space-y-4">
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
                <div>
                  <label className="label">Expiry Date</label>
                  <input
                    type="date"
                    className="input"
                    value={accountControl.expiryDate}
                    onChange={(event) => setAccountControl((current) => ({ ...current, expiryDate: event.target.value }))}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={accountControl.emailVerified}
                    onChange={(event) => setAccountControl((current) => ({ ...current, emailVerified: event.target.checked }))}
                    className="rounded"
                  />
                  Mark email as verified
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={accountControl.isActive}
                    onChange={(event) => setAccountControl((current) => ({ ...current, isActive: event.target.checked }))}
                    className="rounded"
                  />
                  Account active
                </label>
                <button type="button" onClick={handleAccessUpdate} disabled={savingAccess} className="btn-primary w-full justify-center">
                  {savingAccess ? 'Saving…' : 'Update Account Controls'}
                </button>
              </div>
            </div>
          ) : null}

          <div className="card p-6">
            <button
              type="button"
              onClick={() => setAvatarExpanded((current) => !current)}
              className="flex w-full items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-left transition hover:border-gray-200 hover:bg-white dark-surface-subtle"
            >
              <div className="flex items-center gap-3">
                <FiImage size={16} className="text-gray-500" />
                <div>
                  <h3 className="font-display text-base font-bold text-gray-900 dark-text-primary">Avatar & Profile Image</h3>
                  <p className="mt-0.5 text-sm text-gray-500 dark-text-muted">Click to {avatarExpanded ? 'hide' : 'manage'} uploaded and preset avatars.</p>
                </div>
              </div>
              <span className="text-sm font-semibold text-blue-600">{avatarExpanded ? 'Hide' : 'Manage'}</span>
            </button>

            {avatarExpanded ? (
              <>
                <p className="mt-4 text-sm text-gray-500 dark-text-muted">Priority order: uploaded photo, selected in-app avatar, then generated initials.</p>

                <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-blue-200 hover:bg-blue-50">
                  <FiUpload size={14} />
                  {savingAvatar ? 'Uploading...' : 'Upload image'}
                  <input type="file" accept="image/*" className="hidden" onChange={uploadAvatar} disabled={savingAvatar} />
                </label>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  {AVATAR_OPTIONS.map((avatarChoice) => (
                    <button
                      key={avatarChoice}
                      type="button"
                      disabled={savingAvatar}
                      onClick={() => selectAvatar(avatarChoice)}
                      className={`rounded-2xl border p-3 transition ${user.avatarChoice === avatarChoice ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
                    >
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white p-1.5 shadow-sm">
                        <img src={getAvatarPresetUrl(avatarChoice)} alt="Preset avatar" className="h-full w-full rounded-full object-contain" />
                      </div>
                    </button>
                  ))}
                </div>
                <p className="mt-4 text-xs text-gray-400 dark-text-muted">Icons made by Freepik from www.flaticon.com</p>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
