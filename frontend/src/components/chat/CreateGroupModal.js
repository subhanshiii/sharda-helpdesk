import React, { useEffect, useMemo, useState } from 'react';
import API from '../../utils/api';
import toast from 'react-hot-toast';
import {
  FiArrowLeft,
  FiArrowRight,
  FiCheck,
  FiFilter,
  FiSearch,
  FiUsers,
  FiUserPlus,
  FiX,
} from 'react-icons/fi';
import { getRoleLabel } from '../../utils/helpers';

const initialFilters = {
  role: '',
  departmentId: '',
  sectionId: '',
  search: '',
  selectAllFiltered: false,
};

const buildQueryString = (filters, page, excludeUserIds = []) => {
  const params = new URLSearchParams();
  if (filters.search.trim()) params.set('q', filters.search.trim());
  if (filters.role) params.set('role', filters.role);
  if (filters.departmentId) params.set('departmentId', filters.departmentId);
  if (filters.sectionId) params.set('sectionId', filters.sectionId);
  if (excludeUserIds.length) params.set('excludeUserIds', excludeUserIds.join(','));
  params.set('page', String(page));
  params.set('limit', '18');
  return params.toString();
};

const Avatar = ({ name = 'User' }) => (
  <div className="theme-surface flex h-10 w-10 items-center justify-center rounded-2xl text-xs font-bold shadow-sm">
    {name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}
  </div>
);

const SelectedUserRow = ({ user, onRemove }) => (
  <div className="theme-surface-soft flex items-center gap-3 rounded-2xl px-3 py-3">
    <Avatar name={user.name} />
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-semibold text-[var(--theme-text)]">{user.name}</p>
      <p className="truncate text-xs text-[var(--theme-text-muted)]">
        {user.email} · {getRoleLabel(user.role)}
      </p>
    </div>
    <button
      type="button"
      onClick={() => onRemove(user._id)}
      className="theme-ghost-button inline-flex h-10 w-10 items-center justify-center rounded-2xl transition"
      title="Remove"
    >
      <FiX size={16} />
    </button>
  </div>
);

const SearchResultRow = ({ user, selected, onToggle, disabled = false }) => (
  <button
    type="button"
    onClick={() => onToggle(user)}
    disabled={disabled}
    className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${
      selected ? 'theme-surface-accent shadow-sm' : 'theme-surface theme-surface-interactive'
    } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
  >
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
    <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${selected ? 'bg-[var(--theme-primary)] text-white' : 'theme-surface-soft text-[var(--theme-text-muted)]'}`}>
      {selected ? <FiCheck size={15} /> : <FiUserPlus size={15} />}
    </span>
  </button>
);

export default function CreateGroupModal({ onClose, onCreated }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ title: '', description: '' });
  const [filters, setFilters] = useState(initialFilters);
  const [manualSelectionEnabled, setManualSelectionEnabled] = useState(false);
  const [options, setOptions] = useState({ roles: [], departments: [], sections: [] });
  const [results, setResults] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, hasMore: false });
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const selectedUserIds = useMemo(() => selectedUsers.map((user) => user._id), [selectedUsers]);

  const filteredSections = useMemo(() => {
    if (!filters.departmentId) return options.sections;
    return options.sections.filter((section) => section.departmentId === filters.departmentId);
  }, [filters.departmentId, options.sections]);

  const activeFilterCount = useMemo(() => (
    [filters.role, filters.departmentId, filters.sectionId].filter(Boolean).length + (filters.search.trim() ? 1 : 0)
  ), [filters]);

  useEffect(() => {
    let cancelled = false;

    const loadOptions = async () => {
      setLoadingOptions(true);
      try {
        const res = await API.get('/chat-groups/users/options');
        if (!cancelled) {
          setOptions(res.data?.data || { roles: [], departments: [], sections: [] });
        }
      } catch {
        if (!cancelled) {
          toast.error('Failed to load user filters');
        }
      } finally {
        if (!cancelled) setLoadingOptions(false);
      }
    };

    loadOptions();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (step !== 2) return undefined;

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setLoadingUsers(true);
      try {
        const query = buildQueryString(filters, pagination.page, []);
        const res = await API.get(`/chat-groups/users/search?${query}`, { signal: controller.signal });
        setResults(res.data?.data || []);
        setPagination((current) => ({
          ...current,
          total: res.data?.pagination?.total || 0,
          hasMore: Boolean(res.data?.pagination?.hasMore),
        }));
      } catch (err) {
        if (err.name !== 'CanceledError' && err.code !== 'ERR_CANCELED') {
          toast.error('Failed to load users');
        }
      } finally {
        setLoadingUsers(false);
      }
    }, 220);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [filters, pagination.page, step]);

  const handleFilterChange = (key, value) => {
    setPagination((current) => ({ ...current, page: 1 }));
    setFilters((current) => {
      if (key === 'role' && value !== 'student') {
        return { ...current, role: value, sectionId: '', search: current.search };
      }
      if (key === 'departmentId' && current.sectionId) {
        const nextSections = options.sections.filter((section) => !value || section.departmentId === value);
        const stillValidSection = nextSections.some((section) => section._id === current.sectionId);
        return { ...current, [key]: value, sectionId: stillValidSection ? current.sectionId : '' };
      }
      return { ...current, [key]: value };
    });
  };

  const handleToggleUser = (user) => {
    if (!manualSelectionEnabled) return;
    setSelectedUsers((current) => (
      current.some((entry) => entry._id === user._id)
        ? current.filter((entry) => entry._id !== user._id)
        : [...current, user]
    ));
  };

  const handleNext = () => {
    if (!form.title.trim()) {
      setError('Group title is required');
      return;
    }
    setError('');
    setStep(2);
  };

  const handleCreate = async () => {
    if (!form.title.trim()) {
      setStep(1);
      setError('Group title is required');
      return;
    }

    setCreating(true);
    setError('');

    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        filters: {
          roles: filters.role ? [filters.role] : [],
          departmentId: filters.departmentId || '',
          sectionId: filters.role === 'student' ? filters.sectionId || '' : '',
          autoIncludeFiltered: filters.selectAllFiltered,
        },
        memberIds: selectedUserIds,
        adminIds: [],
      };

      const res = await API.post('/chat-groups', payload);
      toast.success(`Group "${form.title.trim()}" created`);
      onCreated(res.data.data);
      onClose();
    } catch (err) {
      const message = err.response?.data?.message || '';
      setError(message || 'Failed to create group');
    } finally {
      setCreating(false);
    }
  };

  const selectedDepartmentName = options.departments.find((entry) => entry._id === filters.departmentId)?.name || '';
  const selectedSectionName = options.sections.find((entry) => entry._id === filters.sectionId)?.label || '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/5 p-4 backdrop-blur-md">
      <div className="theme-surface flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-[32px] shadow-2xl">
        <div className="theme-surface-soft flex items-start justify-between border-b px-6 py-5">
          <div>
            <p className="theme-accent-badge inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em]">
              Structured group creation
            </p>
            <h2 className="mt-3 text-2xl font-bold text-[var(--theme-text)]">Create chat group</h2>
            <p className="mt-1 text-sm text-[var(--theme-text-muted)]">
              Build the audience by role, department, and section, then fine-tune membership before launch.
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

        {error ? (
          <div className="mx-6 mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[320px,minmax(0,1fr)]">
          <aside className="theme-surface-soft border-r px-6 py-6">
            <div className="space-y-4">
              <div className={`rounded-3xl border px-4 py-4 ${step === 1 ? 'border-[var(--theme-primary)] bg-[var(--theme-primary-soft)]' : 'border-[var(--theme-border)]'}`}>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--theme-text-muted)]">Step 1</p>
                <p className="mt-2 text-base font-semibold text-[var(--theme-text)]">Group details</p>
                <p className="mt-1 text-sm text-[var(--theme-text-muted)]">Title and purpose of the conversation.</p>
              </div>
              <div className={`rounded-3xl border px-4 py-4 ${step === 2 ? 'border-[var(--theme-primary)] bg-[var(--theme-primary-soft)]' : 'border-[var(--theme-border)]'}`}>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--theme-text-muted)]">Step 2</p>
                <p className="mt-2 text-base font-semibold text-[var(--theme-text)]">Audience builder</p>
                <p className="mt-1 text-sm text-[var(--theme-text-muted)]">Filter, auto-select, and hand-pick members.</p>
              </div>
              <div className="theme-surface rounded-[28px] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--theme-text-muted)]">What happens</p>
                <ul className="mt-3 space-y-2 text-sm text-[var(--theme-text-muted)]">
                  <li>The creator becomes the first group admin.</li>
                  <li>Only approved and active users appear in the member pool.</li>
                  <li>Section filtering is available when you target students.</li>
                </ul>
              </div>
            </div>
          </aside>

          <div className="min-h-0 overflow-y-auto px-6 py-6">
            {step === 1 ? (
              <div className="mx-auto max-w-3xl space-y-6">
                <div className="theme-surface rounded-[28px] p-5">
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-[var(--theme-text-muted)]">
                    Group title
                  </label>
                  <input
                    value={form.title}
                    onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                    className="theme-input w-full rounded-2xl px-4 py-3 text-sm outline-none transition"
                    placeholder="e.g. CSE Year 1 Mentorship Circle"
                  />
                </div>
                <div className="theme-surface rounded-[28px] p-5">
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-[var(--theme-text-muted)]">
                    Description
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                    className="theme-input min-h-[160px] w-full rounded-2xl px-4 py-3 text-sm outline-none transition"
                    placeholder="Add context for members. Mention what this group is for and who should use it."
                  />
                </div>
              </div>
            ) : (
              <div className="grid min-h-0 gap-5 xl:grid-cols-[380px,minmax(0,1fr)]">
                <section className="space-y-5">
                  <div className="theme-surface rounded-[28px] p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="theme-accent-badge inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em]">
                          Filters
                        </p>
                        <h3 className="mt-3 text-lg font-semibold text-[var(--theme-text)]">Audience rules</h3>
                      </div>
                      <span className="theme-chip inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium">
                        <FiFilter size={12} />
                        {activeFilterCount} active
                      </span>
                    </div>

                    <div className="mt-5 space-y-4">
                      <div>
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--theme-text-muted)]">
                          Role
                        </label>
                        <select
                          value={filters.role}
                          onChange={(event) => handleFilterChange('role', event.target.value)}
                          className="theme-input w-full rounded-2xl px-4 py-3 text-sm outline-none transition"
                          disabled={loadingOptions}
                        >
                          <option value="">All roles</option>
                          {options.roles.map((role) => (
                            <option key={role.value} value={role.value}>{role.label}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--theme-text-muted)]">
                          Department
                        </label>
                        <select
                          value={filters.departmentId}
                          onChange={(event) => handleFilterChange('departmentId', event.target.value)}
                          className="theme-input w-full rounded-2xl px-4 py-3 text-sm outline-none transition"
                          disabled={loadingOptions}
                        >
                          <option value="">All departments</option>
                          {options.departments.map((department) => (
                            <option key={department._id} value={department._id}>{department.name}</option>
                          ))}
                        </select>
                      </div>

                      {filters.role === 'student' ? (
                        <div>
                          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--theme-text-muted)]">
                            Section
                          </label>
                          <select
                            value={filters.sectionId}
                            onChange={(event) => handleFilterChange('sectionId', event.target.value)}
                            className="theme-input w-full rounded-2xl px-4 py-3 text-sm outline-none transition"
                            disabled={loadingOptions}
                          >
                            <option value="">All sections</option>
                            {filteredSections.map((section) => (
                              <option key={section._id} value={section._id}>{section.label}</option>
                            ))}
                          </select>
                        </div>
                      ) : null}

                      <label className="theme-surface-soft flex items-start gap-3 rounded-2xl px-4 py-3">
                        <input
                          type="checkbox"
                          checked={filters.selectAllFiltered}
                          onChange={(event) => handleFilterChange('selectAllFiltered', event.target.checked)}
                          className="mt-1 h-4 w-4 rounded border-[var(--theme-border)] text-[var(--theme-primary)] focus:ring-[var(--theme-primary)]"
                        />
                        <span>
                          <span className="block text-sm font-semibold text-[var(--theme-text)]">Select all filtered users</span>
                          <span className="mt-1 block text-xs text-[var(--theme-text-muted)]">
                            Use the current filters to add the full audience automatically when the group is created.
                          </span>
                        </span>
                      </label>
                    </div>
                  </div>

                  <div className="theme-surface rounded-[28px] p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--theme-text-muted)]">Selected summary</p>
                    <div className="mt-3 space-y-2 text-sm text-[var(--theme-text-muted)]">
                      <p>Role: <span className="font-semibold text-[var(--theme-text)]">{filters.role ? getRoleLabel(filters.role) : 'All roles'}</span></p>
                      <p>Department: <span className="font-semibold text-[var(--theme-text)]">{selectedDepartmentName || 'All departments'}</span></p>
                      {filters.role === 'student' ? (
                        <p>Section: <span className="font-semibold text-[var(--theme-text)]">{selectedSectionName || 'All sections'}</span></p>
                      ) : null}
                      <p>Manual picks: <span className="font-semibold text-[var(--theme-text)]">{manualSelectionEnabled ? selectedUsers.length : 0}</span></p>
                    </div>
                  </div>
                </section>

                <section className="space-y-5">
                  <div className="theme-surface rounded-[28px] p-5 xl:flex xl:h-[calc(100vh-19rem)] xl:flex-col">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="theme-accent-badge inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em]">
                          Member pool
                        </p>
                        <h3 className="mt-3 text-lg font-semibold text-[var(--theme-text)]">Search and fine-tune</h3>
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

                    <div className="mt-5 space-y-4 xl:flex xl:min-h-0 xl:flex-1 xl:flex-col">
                      <label className="theme-surface-soft flex items-start gap-3 rounded-2xl px-4 py-3">
                        <input
                          type="checkbox"
                          checked={manualSelectionEnabled}
                          onChange={(event) => {
                            const enabled = event.target.checked;
                            setManualSelectionEnabled(enabled);
                            if (!enabled) {
                              setSelectedUsers([]);
                            }
                          }}
                          className="mt-1 h-4 w-4 rounded border-[var(--theme-border)] text-[var(--theme-primary)] focus:ring-[var(--theme-primary)]"
                        />
                        <span>
                          <span className="block text-sm font-semibold text-[var(--theme-text)]">Manually add specific members</span>
                          <span className="mt-1 block text-xs text-[var(--theme-text-muted)]">
                            Turn this on only when you want exceptions beyond the selected filters.
                          </span>
                        </span>
                      </label>

                      <div className="space-y-3 xl:flex xl:min-h-0 xl:flex-1 xl:flex-col">
                        <div className="flex items-center justify-between text-xs text-[var(--theme-text-muted)]">
                          <span>{pagination.total} eligible users found</span>
                          <span>{loadingUsers ? 'Updating list…' : 'Live results'}</span>
                        </div>
                        <div className="space-y-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:pr-1">
                          {results.map((user) => (
                            <SearchResultRow
                              key={user._id}
                              user={user}
                              selected={manualSelectionEnabled && selectedUserIds.includes(user._id)}
                              onToggle={handleToggleUser}
                              disabled={!manualSelectionEnabled}
                            />
                          ))}
                          {!loadingUsers && results.length === 0 ? (
                            <div className="theme-surface-soft rounded-[28px] border border-dashed px-6 py-12 text-center">
                              <FiUsers className="mx-auto text-[var(--theme-text-muted)]" size={28} />
                              <p className="mt-3 text-sm font-semibold text-[var(--theme-text)]">No users match this audience</p>
                              <p className="mt-1 text-sm text-[var(--theme-text-muted)]">Try widening the role or department filters.</p>
                            </div>
                          ) : null}
                        </div>
                        <div className="flex items-center justify-between pt-2 xl:border-t xl:border-[var(--theme-border)] xl:pt-4">
                          <button
                            type="button"
                            onClick={() => setPagination((current) => ({ ...current, page: Math.max(current.page - 1, 1) }))}
                            disabled={pagination.page === 1 || loadingUsers}
                            className="theme-ghost-button rounded-2xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Previous
                          </button>
                          <span className="text-xs text-[var(--theme-text-muted)]">Page {pagination.page}</span>
                          <button
                            type="button"
                            onClick={() => setPagination((current) => ({ ...current, page: current.page + 1 }))}
                            disabled={!pagination.hasMore || loadingUsers}
                            className="theme-ghost-button rounded-2xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Next
                          </button>
                        </div>
                      </div>

                      {manualSelectionEnabled ? (
                        <div className="theme-surface-soft rounded-[28px] p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--theme-text-muted)]">Manual selection</p>
                              <h4 className="mt-2 text-base font-semibold text-[var(--theme-text)]">{selectedUsers.length} queued</h4>
                            </div>
                            <span className="theme-chip rounded-full px-3 py-1 text-xs font-medium">
                              <FiUsers size={12} className="inline" /> Members
                            </span>
                          </div>

                          <div className="mt-4 space-y-3">
                            {selectedUsers.length ? selectedUsers.map((user) => (
                              <SelectedUserRow key={user._id} user={user} onRemove={(userId) => {
                                setSelectedUsers((current) => current.filter((entry) => entry._id !== userId));
                              }} />
                            )) : (
                              <div className="rounded-2xl border border-dashed border-[var(--theme-border)] px-4 py-8 text-center text-sm text-[var(--theme-text-muted)]">
                                Choose users from the list above to add one-off members.
                              </div>
                            )}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </section>
              </div>
            )}
          </div>
        </div>

        <div className="theme-surface-soft flex items-center justify-between border-t px-6 py-5">
          <div className="text-sm text-[var(--theme-text-muted)]">
            {step === 2 ? `${manualSelectionEnabled ? selectedUsers.length : 0} manual member${manualSelectionEnabled && selectedUsers.length === 1 ? '' : 's'} selected` : 'Start with the basics, then build the audience.'}
          </div>
          <div className="flex gap-3">
            {step === 2 ? (
              <button type="button" onClick={() => setStep(1)} className="theme-ghost-button rounded-2xl px-5 py-3 text-sm font-semibold transition">
                <FiArrowLeft className="inline" /> Back
              </button>
            ) : (
              <button type="button" onClick={onClose} className="theme-ghost-button rounded-2xl px-5 py-3 text-sm font-semibold transition">
                Cancel
              </button>
            )}
            {step === 1 ? (
              <button type="button" onClick={handleNext} className="btn-primary rounded-2xl px-5 py-3 text-sm font-semibold">
                Continue <FiArrowRight className="inline" />
              </button>
            ) : (
              <button type="button" onClick={handleCreate} disabled={creating} className="btn-primary rounded-2xl px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60">
                {creating ? 'Creating…' : 'Create group'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
