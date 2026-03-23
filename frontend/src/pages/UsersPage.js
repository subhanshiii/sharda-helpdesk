import React, { useState, useEffect } from 'react';
import API from '../utils/api';
import toast from 'react-hot-toast';
import { PageHeader, FullPageSpinner, EmptyState, Avatar, Alert } from '../components/ui';
import { getRoleColor, formatDate } from '../utils/helpers';
import { FiPlus, FiEdit2, FiTrash2, FiX, FiCheck, FiSearch } from 'react-icons/fi';

const ROLES = ['student', 'agent', 'admin'];

function UserModal({ user, onClose, onSaved }) {
  const [form, setForm] = useState(
    user
      ? { name: user.name, email: user.email, role: user.role, department: user.department || '', isActive: user.isActive }
      : { name: '', email: '', password: '', role: 'agent', department: '' }
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (user) {
        await API.put(`/users/${user._id}`, form);
        toast.success('User updated');
      } else {
        await API.post('/users', form);
        toast.success('User created');
      }
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md animate-fade-in">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{user ? 'Edit User' : 'Add New User'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><FiX size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && <Alert type="error" message={error} />}
          <div>
            <label className="label">Full Name</label>
            <input className="input" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="Full name" required />
          </div>
          <div>
            <label className="label">Email</label>
            <input type="email" className="input" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} placeholder="Email address" required />
          </div>
          {!user && (
            <div>
              <label className="label">Password</label>
              <input type="password" className="input" value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value}))} placeholder="Minimum 6 characters" required minLength={6} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Role</label>
              <select className="input" value={form.role} onChange={e => setForm(f => ({...f, role: e.target.value}))}>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Department</label>
              <input className="input" value={form.department} onChange={e => setForm(f => ({...f, department: e.target.value}))} placeholder="e.g. IT Dept" />
            </div>
          </div>
          {user && (
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({...f, isActive: e.target.checked}))} className="rounded" />
              Account Active
            </label>
          )}
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">
              {loading ? 'Saving...' : <><FiCheck size={14} /> Save</>}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null); // null | 'create' | user object
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1, currentPage: 1 });

  const fetchUsers = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 15 });
      if (roleFilter) params.append('role', roleFilter);
      if (search)     params.append('search', search);
      const res = await API.get(`/users?${params}`);
      setUsers(res.data.data);
      setPagination({ total: res.data.total, totalPages: res.data.totalPages, currentPage: res.data.currentPage });
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchUsers(); }, [roleFilter, search]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this user?')) return;
    try {
      await API.delete(`/users/${id}`);
      toast.success('User deleted');
      fetchUsers();
    } catch (err) { toast.error(err.response?.data?.message || 'Delete failed'); }
  };

  return (
    <div>
      {modal && (
        <UserModal
          user={modal === 'create' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); fetchUsers(); }}
        />
      )}

      <PageHeader
        title="User Management"
        subtitle={`${pagination.total} users total`}
        action={
          <button onClick={() => setModal('create')} className="btn-primary">
            <FiPlus size={16} /> Add User
          </button>
        }
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
          <input
            className="input pl-9"
            placeholder="Search by name, email, or ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="input w-auto" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
          <option value="">All Roles</option>
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {loading ? <FullPageSpinner /> : users.length === 0 ? (
        <EmptyState icon="👤" title="No users found" description="Try adjusting your filters" />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['User', 'Role', 'Department', 'Status', 'Joined', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map(u => (
                  <tr key={u._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={u.name} size="sm" />
                        <div>
                          <p className="font-medium text-gray-900">{u.name}</p>
                          <p className="text-xs text-gray-400">{u.email}</p>
                          {u.enrollmentId && <p className="text-xs text-gray-400 font-mono">{u.enrollmentId}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${getRoleColor(u.role)}`}>{u.role}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{u.department || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(u.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => setModal(u)} className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors">
                          <FiEdit2 size={14} />
                        </button>
                        <button onClick={() => handleDelete(u._id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                          <FiTrash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pagination.totalPages > 1 && (
            <div className="flex justify-center gap-2 p-4 border-t border-gray-100">
              <button onClick={() => fetchUsers(pagination.currentPage - 1)} disabled={pagination.currentPage === 1} className="btn-secondary text-xs">Previous</button>
              <span className="text-xs text-gray-500 self-center">Page {pagination.currentPage} of {pagination.totalPages}</span>
              <button onClick={() => fetchUsers(pagination.currentPage + 1)} disabled={pagination.currentPage === pagination.totalPages} className="btn-secondary text-xs">Next</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
