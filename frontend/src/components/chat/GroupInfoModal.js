import React, { useEffect, useMemo, useState } from 'react';
import API from '../../utils/api';
import toast from 'react-hot-toast';
import {
  FiEdit3,
  FiSearch,
  FiShield,
  FiTrash2,
  FiUserMinus,
  FiUserPlus,
  FiUsers,
  FiX,
} from 'react-icons/fi';
import { getRoleLabel } from '../../utils/helpers';
import { ConfirmDialog } from '../ui';

const initialFilters = {
  role: '',
  departmentId: '',
  sectionId: '',
  search: '',
};

const buildQueryString = (filters, page, excludeUserIds = []) => {
  const params = new URLSearchParams();
  if (filters.search.trim()) params.set('q', filters.search.trim());
  if (filters.role) params.set('role', filters.role);
  if (filters.departmentId) params.set('departmentId', filters.departmentId);
  if (filters.sectionId) params.set('sectionId', filters.sectionId);
  if (excludeUserIds.length) params.set('excludeUserIds', excludeUserIds.join(','));
  params.set('page', String(page));
  params.set('limit', '12');
  return params.toString();
};

const Avatar = ({ name = 'User' }) => (
  <div className="theme-surface flex h-10 w-10 items-center justify-center rounded-2xl text-xs font-bold shadow-sm">
    {name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}
  </div>
);

const formatAudienceSummary = (group) => {
  const roles = group?.selectionRules?.roles?.length ? group.selectionRules.roles.map(getRoleLabel).join(', ') : 'All roles';
  const departments = group?.selectionRules?.departmentIds?.length
    ? group.selectionRules.departmentIds.map((entry) => entry.name).join(', ')
    : 'All departments';
  const sections = group?.selectionRules?.sectionIds?.length
    ? group.selectionRules.sectionIds.map((entry) => entry.name).join(', ')
    : 'All sections';
  return { roles, departments, sections };
};

export default function GroupInfoModal({
  group,
  isOpen,
  onClose,
  canManageGroup,
  isSystemAdmin,
  currentUserId,
  onGroupUpdated,
  onGroupDeleted,
}) {
  const canManageMembers = canManageGroup || isSystemAdmin;
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({ title: '', description: '' });
  const [options, setOptions] = useState({ roles: [], departments: [], sections: [] });
  const [filters, setFilters] = useState(initialFilters);
  const [results, setResults] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, hasMore: false });
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [confirmState, setConfirmState] = useState({ open: false, mode: '', userId: '', loading: false });

  const safeMembers = useMemo(() => (group?.members || []).filter((member) => member?.user), [group?.members]);
  const memberIds = useMemo(() => safeMembers.map((member) => member.user._id), [safeMembers]);
  const audienceSummary = useMemo(() => formatAudienceSummary(group), [group]);

  useEffect(() => {
    if (!group || !isOpen) return;
    setForm({ title: group.name || '', description: group.description || '' });
    setIsEditing(false);
    setFilters({
      role: '',
      departmentId: '',
      sectionId: '',
      search: '',
    });
    setPagination({ page: 1, total: 0, hasMore: false });
  }, [group, isOpen]);

  useEffect(() => {
    if (!isOpen || !canManageMembers) return undefined;
    let cancelled = false;

    const loadOptions = async () => {
      try {
        const res = await API.get('/chat-groups/users/options');
        if (!cancelled) setOptions(res.data?.data || { roles: [], departments: [], sections: [] });
      } catch {
        if (!cancelled) toast.error('Failed to load user filters');
      }
    };

    loadOptions();
    return () => {
      cancelled = true;
    };
  }, [canManageMembers, isOpen]);

  useEffect(() => {
    if (!isOpen || !canManageMembers) return undefined;

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setLoadingUsers(true);
      try {
        const query = buildQueryString(filters, pagination.page, memberIds);
        const res = await API.get(`/chat-groups/users/search?${query}`, { signal: controller.signal });
        setResults(res.data?.data || []);
        setPagination((current) => ({
          ...current,
          total: res.data?.pagination?.total || 0,
          hasMore: Boolean(res.data?.pagination?.hasMore),
        }));
      } catch (err) {
        if (err.name !== 'CanceledError' && err.code !== 'ERR_CANCELED') {
          toast.error('Failed to load eligible members');
        }
      } finally {
        setLoadingUsers(false);
      }
    }, 220);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [canManageMembers, filters, isOpen, memberIds, pagination.page]);

  if (!isOpen || !group) return null;

  const filteredSections = filters.departmentId
    ? options.sections.filter((section) => section.departmentId === filters.departmentId)
    : options.sections;

  const handleFilterChange = (key, value) => {
    setPagination((current) => ({ ...current, page: 1 }));
    setFilters((current) => {
      if (key === 'role' && value !== 'student') {
        return { ...current, role: value, sectionId: '' };
      }
      if (key === 'departmentId' && current.sectionId) {
        const validSection = options.sections.some((section) => section._id === current.sectionId && (!value || section.departmentId === value));
        return { ...current, departmentId: value, sectionId: validSection ? current.sectionId : '' };
      }
      return { ...current, [key]: value };
    });
  };

  const refreshGroup = async () => {
    const res = await API.get(`/chat-groups/${group._id}`);
    onGroupUpdated(res.data.data);
    return res.data.data;
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error('Group title is required');
      return;
    }

    setLoading(true);
    try {
      const res = await API.put(`/chat-groups/${group._id}`, {
        title: form.title.trim(),
        description: form.description.trim(),
      });
      onGroupUpdated(res.data.data);
      setIsEditing(false);
      toast.success('Group updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update group');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async (userId) => {
    if (memberIds.includes(userId)) {
      toast('This user is already in the group.');
      return;
    }

    setLoading(true);
    try {
      const res = await API.post(`/chat-groups/${group._id}/members`, {
        userIds: [userId],
        roles: ['member'],
      });

      const addedUsers = res.data?.data?.addedUsers || [];
      const skippedUsers = res.data?.data?.skippedUsers || [];
      const nextGroup = res.data?.data?.group || await refreshGroup();

      if (nextGroup) {
        onGroupUpdated(nextGroup);
      }

      if (addedUsers.length) {
        toast.success('Member added');
      } else if (skippedUsers.length) {
        toast('This user is already in the group.');
      } else {
        toast('No member was added.');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add member');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId, role) => {
    setLoading(true);
    try {
      const res = await API.put(`/chat-groups/${group._id}/members/${userId}`, { role });
      onGroupUpdated(res.data.data);
      toast.success(role === 'admin' ? 'Promoted to group admin' : 'Admin access removed');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update admin access');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = (userId) => {
    setConfirmState({ open: true, mode: 'remove-member', userId, loading: false });
  };

  const confirmRemoveMember = async () => {
    setConfirmState((current) => ({ ...current, loading: true }));
    setLoading(true);
    try {
      await API.delete(`/chat-groups/${group._id}/members/${confirmState.userId}`);
      if (confirmState.userId === currentUserId) {
        onGroupDeleted(group._id);
        onClose();
      } else {
        await refreshGroup();
      }
      toast.success('Member removed');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove member');
    } finally {
      setLoading(false);
      setConfirmState({ open: false, mode: '', userId: '', loading: false });
    }
  };

  const handleDelete = () => {
    setConfirmState({ open: true, mode: 'delete-group', userId: '', loading: false });
  };

  const confirmDeleteGroup = async () => {
    setConfirmState((current) => ({ ...current, loading: true }));
    setLoading(true);
    try {
      await API.delete(`/chat-groups/${group._id}`);
      onGroupDeleted(group._id);
      onClose();
      toast.success('Group deleted');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete group');
    } finally {
      setLoading(false);
      setConfirmState({ open: false, mode: '', userId: '', loading: false });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/8 p-4 backdrop-blur-md">
      <ConfirmDialog
        open={confirmState.open}
        title={confirmState.mode === 'delete-group' ? 'Delete group' : 'Remove member'}
        description={confirmState.mode === 'delete-group'
          ? `Are you sure you want to delete "${group.name}"?`
          : 'Are you sure you want to remove this member from the group?'}
        confirmLabel={confirmState.mode === 'delete-group' ? 'Delete Group' : 'Remove Member'}
        loading={confirmState.loading}
        onConfirm={confirmState.mode === 'delete-group' ? confirmDeleteGroup : confirmRemoveMember}
        onClose={() => setConfirmState({ open: false, mode: '', userId: '', loading: false })}
      />

      <div className="theme-surface flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[32px] shadow-2xl">
        <div className="theme-surface-soft flex items-start justify-between border-b px-6 py-5">
          <div>
            <p className="theme-accent-badge inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em]">
              Group administration
            </p>
            <h2 className="mt-3 text-2xl font-bold text-[var(--theme-text)]">{group.name}</h2>
            <p className="mt-1 text-sm text-[var(--theme-text-muted)]">
              {safeMembers.length} members · creator controls and membership governance live here.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="theme-ghost-button inline-flex h-11 w-11 items-center justify-center rounded-2xl transition"
          >
            <FiX size={18} />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-5 overflow-hidden px-6 py-6 xl:grid-cols-[360px,minmax(0,1fr)]">
          <aside className="min-h-0 space-y-5 overflow-y-auto">
            <div className="theme-surface rounded-[28px] p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--theme-text-muted)]">Details</p>
                  <h3 className="mt-2 text-lg font-semibold text-[var(--theme-text)]">Group settings</h3>
                </div>
                {canManageMembers ? (
                  <button
                    type="button"
                    onClick={() => setIsEditing((current) => !current)}
                    className="theme-ghost-button inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold transition"
                  >
                    <FiEdit3 size={14} />
                    {isEditing ? 'Close' : 'Edit'}
                  </button>
                ) : null}
              </div>

              <div className="mt-4 space-y-4">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--theme-text-muted)]">Title</label>
                  {isEditing ? (
                    <input
                      value={form.title}
                      onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                      className="theme-input w-full rounded-2xl px-4 py-3 text-sm outline-none transition"
                    />
                  ) : (
                    <div className="theme-surface-soft rounded-2xl px-4 py-3 text-sm text-[var(--theme-text)]">{group.name}</div>
                  )}
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--theme-text-muted)]">Description</label>
                  {isEditing ? (
                    <textarea
                      value={form.description}
                      onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                      className="theme-input min-h-[120px] w-full rounded-2xl px-4 py-3 text-sm outline-none transition"
                    />
                  ) : (
                    <div className="theme-surface-soft rounded-2xl px-4 py-3 text-sm text-[var(--theme-text-muted)]">
                      {group.description || 'No description yet.'}
                    </div>
                  )}
                </div>

                {isEditing && canManageMembers ? (
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={loading}
                    className="btn-primary w-full justify-center rounded-2xl px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Save changes
                  </button>
                ) : null}
              </div>
            </div>

            <div className="theme-surface rounded-[28px] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--theme-text-muted)]">Audience summary</p>
              <div className="mt-4 space-y-3 text-sm text-[var(--theme-text-muted)]">
                <div className="theme-surface-soft rounded-2xl px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em]">Roles</p>
                  <p className="mt-1 font-semibold text-[var(--theme-text)]">{audienceSummary.roles}</p>
                </div>
                <div className="theme-surface-soft rounded-2xl px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em]">Departments</p>
                  <p className="mt-1 font-semibold text-[var(--theme-text)]">{audienceSummary.departments}</p>
                </div>
                <div className="theme-surface-soft rounded-2xl px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em]">Sections</p>
                  <p className="mt-1 font-semibold text-[var(--theme-text)]">{audienceSummary.sections}</p>
                </div>
              </div>
            </div>

            {canManageMembers ? (
              <div className="theme-surface rounded-[28px] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--theme-text-muted)]">Danger zone</p>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="theme-danger-button mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition"
                >
                  <FiTrash2 size={14} />
                  Delete group
                </button>
              </div>
            ) : null}
          </aside>

          <section className="min-h-0 overflow-y-auto">
            <div className="space-y-5">
              {canManageMembers ? (
                <div className="theme-surface rounded-[28px] p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="theme-accent-badge inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em]">
                        Add members
                      </p>
                      <h3 className="mt-3 text-lg font-semibold text-[var(--theme-text)]">Find approved users</h3>
                    </div>
                    <div className="relative w-full max-w-md">
                      <FiSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--theme-text-muted)]" size={15} />
                      <input
                        value={filters.search}
                        onChange={(event) => handleFilterChange('search', event.target.value)}
                        className="theme-input w-full rounded-2xl py-3 pl-11 pr-4 text-sm outline-none transition"
                        placeholder="Search by name, email, or enrollment ID"
                      />
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 lg:grid-cols-4">
                    <select
                      value={filters.role}
                      onChange={(event) => handleFilterChange('role', event.target.value)}
                      className="theme-input rounded-2xl px-4 py-3 text-sm outline-none transition"
                    >
                      <option value="">All roles</option>
                      {options.roles.map((role) => (
                        <option key={role.value} value={role.value}>{role.label}</option>
                      ))}
                    </select>
                    <select
                      value={filters.departmentId}
                      onChange={(event) => handleFilterChange('departmentId', event.target.value)}
                      className="theme-input rounded-2xl px-4 py-3 text-sm outline-none transition"
                    >
                      <option value="">All departments</option>
                      {options.departments.map((department) => (
                        <option key={department._id} value={department._id}>{department.name}</option>
                      ))}
                    </select>
                    <select
                      value={filters.sectionId}
                      onChange={(event) => handleFilterChange('sectionId', event.target.value)}
                      className="theme-input rounded-2xl px-4 py-3 text-sm outline-none transition"
                      disabled={filters.role && filters.role !== 'student'}
                    >
                      <option value="">All sections</option>
                      {filteredSections.map((section) => (
                        <option key={section._id} value={section._id}>{section.label}</option>
                      ))}
                    </select>
                    <div className="theme-surface-soft rounded-2xl px-4 py-3 text-sm text-[var(--theme-text-muted)]">
                      {pagination.total} eligible
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    {results.map((user) => (
                      <div key={user._id} className="theme-surface-soft flex items-center gap-3 rounded-2xl px-3 py-3">
                        <Avatar name={user.name} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-semibold text-[var(--theme-text)]">{user.name}</p>
                            <span className="theme-chip rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em]">
                              {getRoleLabel(user.role)}
                            </span>
                          </div>
                          <p className="truncate text-xs text-[var(--theme-text-muted)]">
                            {user.email}
                            {user.department ? ` · ${user.department}` : ''}
                            {user.section ? ` · ${user.section}` : ''}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAddMember(user._id)}
                          disabled={loading}
                          className="btn-primary rounded-2xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <FiUserPlus className="inline" /> Add
                        </button>
                      </div>
                    ))}
                    {!loadingUsers && !results.length ? (
                      <div className="theme-surface-soft rounded-[28px] border border-dashed px-6 py-10 text-center">
                        <FiUsers className="mx-auto text-[var(--theme-text-muted)]" size={28} />
                        <p className="mt-3 text-sm font-semibold text-[var(--theme-text)]">No eligible users match this filter</p>
                        <p className="mt-1 text-sm text-[var(--theme-text-muted)]">Try widening the role, department, or section selection.</p>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div className="theme-surface rounded-[28px] p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="theme-accent-badge inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em]">
                      Members
                    </p>
                    <h3 className="mt-3 text-lg font-semibold text-[var(--theme-text)]">Current roster</h3>
                  </div>
                  <span className="theme-chip rounded-full px-3 py-1 text-xs font-medium">
                    {safeMembers.length} total
                  </span>
                </div>

                <div className="mt-5 space-y-3">
                  {safeMembers.map((member) => {
                    const isGroupAdmin = member.role === 'admin';
                    const isSelf = member.user._id === currentUserId;

                    return (
                      <div key={member.user._id} className="theme-surface-soft flex items-center gap-3 rounded-2xl px-3 py-3">
                        <Avatar name={member.user.name} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-semibold text-[var(--theme-text)]">{member.user.name}</p>
                            <span className="theme-chip rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em]">
                              {getRoleLabel(member.user.role)}
                            </span>
                            {isGroupAdmin ? (
                              <span className="theme-accent-badge rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em]">
                                <FiShield className="inline" /> Admin
                              </span>
                            ) : null}
                          </div>
                          <p className="truncate text-xs text-[var(--theme-text-muted)]">
                            {member.user.email}
                            {member.user.department ? ` · ${member.user.department}` : ''}
                            {member.user.section ? ` · ${member.user.section}` : ''}
                          </p>
                        </div>

                        {canManageMembers ? (
                          <div className="flex items-center gap-2">
                            <select
                              value={isGroupAdmin ? 'admin' : 'member'}
                              onChange={(event) => handleRoleChange(member.user._id, event.target.value)}
                              className="theme-input rounded-2xl px-3 py-2 text-sm outline-none transition"
                              disabled={loading}
                            >
                              <option value="member">Member</option>
                              <option value="admin">Admin</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => handleRemoveMember(member.user._id)}
                              disabled={loading}
                              className="theme-ghost-button inline-flex h-10 w-10 items-center justify-center rounded-2xl transition disabled:cursor-not-allowed disabled:opacity-50"
                              title={isSelf ? 'Leave group' : 'Remove member'}
                            >
                              {isSelf ? <FiUserMinus size={15} /> : <FiTrash2 size={15} />}
                            </button>
                          </div>
                        ) : isSelf ? (
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(member.user._id)}
                            disabled={loading}
                            className="theme-ghost-button rounded-2xl px-4 py-2 text-sm font-semibold transition"
                          >
                            Leave group
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
