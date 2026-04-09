import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { FiCheck, FiClock, FiRefreshCw, FiUserX } from 'react-icons/fi';
import API from '../utils/api';
import { Alert, EmptyState, FullPageSpinner, PageHeader } from '../components/ui';
import { formatDate, getRoleColor, getRoleLabel } from '../utils/helpers';

const ApprovalCard = ({ user, onApprove, onReject, loadingId }) => (
  <div className="card p-5 space-y-4">
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-semibold text-gray-900">{user.name}</h3>
          <span className={`badge ${getRoleColor(user.role)}`}>{getRoleLabel(user.role)}</span>
        </div>
        <p className="text-sm text-gray-500">{user.email}</p>
        <p className="text-xs text-gray-400 mt-1">
          Submitted {formatDate(user.createdAt)}
        </p>
      </div>
      <span className="badge bg-amber-100 text-amber-700">
        <FiClock size={12} /> Pending
      </span>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
      <div className="rounded-xl bg-gray-50 px-3 py-2">
        <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">Department</p>
        <p className="font-medium text-gray-700">{user.department || 'Not set'}</p>
      </div>
      <div className="rounded-xl bg-gray-50 px-3 py-2">
        <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">Year</p>
        <p className="font-medium text-gray-700">{user.year || 'Not set'}</p>
      </div>
      <div className="rounded-xl bg-gray-50 px-3 py-2">
        <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">Section</p>
        <p className="font-medium text-gray-700">{user.section || 'Not set'}</p>
      </div>
    </div>

    <div className="flex flex-col sm:flex-row gap-3">
      <button
        onClick={() => onApprove(user._id)}
        disabled={loadingId === user._id}
        className="btn-primary justify-center flex-1"
      >
        <FiCheck size={15} />
        {loadingId === user._id ? 'Approving...' : 'Approve'}
      </button>
      <button
        onClick={() => onReject(user._id)}
        disabled={loadingId === user._id}
        className="btn-secondary justify-center flex-1 text-red-600 hover:bg-red-50"
      >
        <FiUserX size={15} />
        {loadingId === user._id ? 'Updating...' : 'Reject'}
      </button>
    </div>
  </div>
);

export default function AccountApprovalsPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actingId, setActingId] = useState('');

  const loadPendingUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await API.get('/auth/pending-users');
      setUsers(res.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load pending approvals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPendingUsers();
  }, [loadPendingUsers]);

  const updateApproval = async (userId, action) => {
    setActingId(userId);
    try {
      await API.patch(`/auth/${action}/${userId}`);
      toast.success(action === 'approve' ? 'Account approved' : 'Account rejected');
      setUsers((prev) => prev.filter((user) => user._id !== userId));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update account status');
    } finally {
      setActingId('');
    }
  };

  return (
    <div>
      <PageHeader
        title="Account Approvals"
        subtitle="Review and approve new student registrations"
        action={(
          <button onClick={loadPendingUsers} className="btn-secondary">
            <FiRefreshCw size={15} />
            Refresh
          </button>
        )}
      />

      {error ? <Alert type="error" message={error} className="mb-4" /> : null}

      {loading ? <FullPageSpinner /> : users.length === 0 ? (
        <EmptyState
          icon="✅"
          title="No pending approvals"
          description="New signups waiting for approval will appear here."
        />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {users.map((user) => (
            <ApprovalCard
              key={user._id}
              user={user}
              loadingId={actingId}
              onApprove={(id) => updateApproval(id, 'approve')}
              onReject={(id) => updateApproval(id, 'reject')}
            />
          ))}
        </div>
      )}
    </div>
  );
}
