import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import API from '../utils/api';
import toast from 'react-hot-toast';
import { PageHeader, FullPageSpinner, EmptyState, Avatar, ConfirmDialog, HelpTooltip } from '../components/ui';
import { getRoleColor, getRoleLabel, getAdminTierDefinition, getAdminTierLabel, getAdminTierTone, formatDate } from '../utils/helpers';
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiUpload, FiChevronRight } from 'react-icons/fi';

const initialFilters = {
  role: '',
  department: '',
  status: '',
  emailVerified: '',
  isActive: '',
  expiryState: '',
  joinedFrom: '',
  joinedTo: '',
};

const FILTER_STORAGE_KEY = 'identity-access-filters-v1';

const lifecycleTone = (overall) => {
  const map = {
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
  return map[overall] || 'bg-slate-100 text-slate-700';
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

export default function UsersPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const persistedState = useMemo(() => {
    try {
      const raw = sessionStorage.getItem(FILTER_STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }, []);
  const [search, setSearch] = useState(persistedState?.search || '');
  const [filters, setFilters] = useState(() => ({ ...initialFilters, ...(persistedState?.filters || {}) }));
  const [filterMeta, setFilterMeta] = useState({ roles: [], departments: [] });
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1, currentPage: persistedState?.currentPage || 1 });
  const [confirmState, setConfirmState] = useState({ open: false, user: null, loading: false });
  const [showFilters, setShowFilters] = useState(Boolean(persistedState?.showFilters));

  const fetchUsers = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 8 });
      if (search) params.append('search', search);
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== '' && value !== null && value !== undefined) {
          params.append(key, value);
        }
      });
      const res = await API.get(`/users?${params}`);
      setUsers(res.data.data || []);
      setPagination({ total: res.data.total, totalPages: res.data.totalPages, currentPage: res.data.currentPage });
      setFilterMeta({
        roles: res.data?.meta?.roles || [],
        departments: res.data?.meta?.departments || [],
      });
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [filters, search]);

  useEffect(() => { fetchUsers(pagination.currentPage); }, [fetchUsers, pagination.currentPage]);

  useEffect(() => {
    sessionStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify({
      search,
      filters,
      currentPage: pagination.currentPage,
      showFilters,
    }));
  }, [filters, pagination.currentPage, search, showFilters]);

  const requestDelete = (user) => setConfirmState({ open: true, user, loading: false });

  const handleDelete = async () => {
    if (!confirmState.user) return;
    setConfirmState((current) => ({ ...current, loading: true }));
    try {
      await API.delete(`/users/${confirmState.user.systemId}`);
      toast.success('User deleted');
      setConfirmState({ open: false, user: null, loading: false });
      await fetchUsers(pagination.currentPage);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Delete failed');
      setConfirmState((current) => ({ ...current, loading: false }));
    }
  };

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPagination((current) => ({ ...current, currentPage: 1 }));
  };

  const resetFilters = () => {
    setFilters(initialFilters);
    setSearch('');
    setShowFilters(false);
    setPagination((current) => ({ ...current, currentPage: 1 }));
    sessionStorage.removeItem(FILTER_STORAGE_KEY);
  };

  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={confirmState.open}
        title="Delete user"
        description={`Are you sure you want to delete ${confirmState.user?.name || 'this user'}? This will permanently remove the user from the database.`}
        confirmLabel="Delete User"
        loading={confirmState.loading}
        onConfirm={handleDelete}
        onClose={() => setConfirmState({ open: false, user: null, loading: false })}
      />

      <PageHeader
        title="Identity & Access"
        description="Manage verified identities, lifecycle controls, and access-ready user records across the ERP."
        meta={`${pagination.total} managed identit${pagination.total === 1 ? 'y' : 'ies'}`}
        action={
          <div className="flex flex-wrap gap-3">
            <HelpTooltip
              title="Tier-based access"
              items={[
                { label: 'Roles define the base function', description: 'A user stays student, faculty, staff, or admin for their main workflow identity.' },
                { label: 'Tiers add elevated authority', description: 'Any user can optionally inherit extra access from a selected tier.' },
                { label: 'Scoped tiers stay limited', description: 'College, department, program, and section tiers only operate within their assigned scope.' },
              ]}
            />
            <Link to="/users/new" className="btn-primary">
              <FiPlus size={16} /> Provision User
            </Link>
            <Link to="/users/import" className="btn-secondary">
              <FiUpload size={16} /> Import CSV
            </Link>
          </div>
        }
      />

      <div className="space-y-4">
        <div className="card p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
              <input className="input pl-9" placeholder="Search by system ID, name, or email..." value={search} onChange={e => { setSearch(e.target.value); setPagination((current) => ({ ...current, currentPage: 1 })); }} />
            </div>
            <select className="input lg:w-44" value={filters.role} onChange={e => updateFilter('role', e.target.value)}>
              <option value="">All Roles</option>
              {filterMeta.roles.map((role) => <option key={role} value={role}>{getRoleLabel(role)}</option>)}
            </select>
            <select className="input lg:w-48" value={filters.department} onChange={e => updateFilter('department', e.target.value)}>
              <option value="">All Departments</option>
              {filterMeta.departments.map((department) => <option key={department} value={department}>{department}</option>)}
            </select>
            <select className="input lg:w-40" value={filters.status} onChange={e => updateFilter('status', e.target.value)}>
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="suspended">Suspended</option>
            </select>
            <div className="flex gap-2 lg:ml-auto">
              <button type="button" onClick={() => setShowFilters((current) => !current)} className="btn-secondary text-xs">
                {showFilters ? 'Hide Filters' : 'More Filters'}
              </button>
              <button type="button" onClick={resetFilters} className="btn-secondary text-xs">
                Reset
              </button>
            </div>
          </div>
          {showFilters ? (
            <div className="mt-4 grid gap-3 border-t border-gray-100 pt-4 md:grid-cols-2 xl:grid-cols-4">
              <select className="input" value={filters.emailVerified} onChange={e => updateFilter('emailVerified', e.target.value)}>
                <option value="">Verification</option>
                <option value="true">Verified</option>
                <option value="false">Unverified</option>
              </select>
              <select className="input" value={filters.isActive} onChange={e => updateFilter('isActive', e.target.value)}>
                <option value="">Activity</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
              <select className="input" value={filters.expiryState} onChange={e => updateFilter('expiryState', e.target.value)}>
                <option value="">Expiry</option>
                <option value="none">No expiry</option>
                <option value="expired">Expired</option>
                <option value="expiring">Expiring soon</option>
                <option value="active">Long-term access</option>
              </select>
              <div className="text-xs text-gray-500 flex items-center">Joined between</div>
              <input className="input" type="date" value={filters.joinedFrom} onChange={e => updateFilter('joinedFrom', e.target.value)} />
              <input className="input" type="date" value={filters.joinedTo} onChange={e => updateFilter('joinedTo', e.target.value)} />
            </div>
          ) : null}
        </div>

        {loading ? <FullPageSpinner /> : users.length === 0 ? (
          <EmptyState icon="👤" title="No users found" description="Provision identities or import them with CSV." />
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {users.map((u) => {
                const tierDefinition = getAdminTierDefinition(u.adminTier);
                return (
                <div
                  key={u.systemId}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/admin/users/${u.systemId}`)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') navigate(`/admin/users/${u.systemId}`);
                  }}
                  className="card flex min-h-[220px] cursor-pointer flex-col justify-between p-5 transition hover:-translate-y-0.5 hover:shadow-card-hover"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar user={u} size="md" />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-gray-900">{u.name}</p>
                          <p className="truncate text-xs text-gray-400">{u.email}</p>
                          <p className="mt-1 text-xs font-mono text-gray-500">{u.systemId}</p>
                        </div>
                      </div>
                      <FiChevronRight size={16} className="mt-1 flex-shrink-0 text-gray-300" />
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className={`badge ${getRoleColor(u.role)}`}>{getRoleLabel(u.role)}</span>
                      {u.adminTier ? (
                        <span
                          className={`badge ${getAdminTierTone(u.adminTier)}`}
                          title={tierDefinition ? `${tierDefinition.label} · Tier ${tierDefinition.level} · ${tierDefinition.scopeLabel}` : ''}
                        >
                          {getAdminTierLabel(u.adminTier)}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-4 space-y-2 text-sm text-gray-500">
                      <p>
                        {[
                          u.academicDisplay?.department,
                          u.academicDisplay?.year && `Year ${u.academicDisplay.year}`,
                          u.academicDisplay?.section && `Section ${u.academicDisplay.section}`,
                        ].filter(Boolean).join(' · ') || 'No academic mapping'}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <span className={`badge ${u.emailVerified ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>{u.emailVerified ? 'Verified' : 'Unverified'}</span>
                        <span className={`badge ${u.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : u.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'}`}>{u.status}</span>
                        <span className={`badge ${lifecycleTone(u.lifecycle?.overall)}`}>{lifecycleLabel(u.lifecycle?.overall)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-3 border-t border-gray-100 pt-4">
                    <div className="text-xs text-gray-400">
                      <div>{formatDate(u.createdAt)}</div>
                      {u.expiryDate ? <div className="mt-1">Expires {formatDate(u.expiryDate)}</div> : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <Link to={`/users/${u.systemId}/edit`} onClick={(event) => event.stopPropagation()} className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors">
                        <FiEdit2 size={14} />
                      </Link>
                      <button onClick={(event) => { event.stopPropagation(); requestDelete(u); }} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                        <FiTrash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>

            {pagination.totalPages > 1 ? (
              <div className="flex items-center justify-end gap-3">
                <button onClick={() => fetchUsers(pagination.currentPage - 1)} disabled={pagination.currentPage === 1} className="btn-secondary text-xs">Previous</button>
                <span className="text-xs text-gray-500">Page {pagination.currentPage} of {pagination.totalPages}</span>
                <button onClick={() => fetchUsers(pagination.currentPage + 1)} disabled={pagination.currentPage === pagination.totalPages} className="btn-secondary text-xs">Next Page</button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
