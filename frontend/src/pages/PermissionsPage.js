import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { FiSave, FiShield } from 'react-icons/fi';
import { PageHeader, Alert, EmptyState, FullPageSpinner } from '../components/ui';
import { usePermissions } from '../context/PermissionContext';

const ROLE_LABELS = {
  student: 'Student',
  faculty: 'Faculty',
  staff: 'Staff',
  admin: 'Admin',
};

const PERMISSION_LABELS = {
  canViewChat: 'Chat',
  canSendFiles: 'Files',
  canCreateTickets: 'Create Tickets',
  canHandleTickets: 'Handle Tickets',
  canManageUsers: 'Users',
  canManageGroups: 'Groups',
  canPostNotice: 'Notice Board',
  canViewAnalytics: 'Analytics',
  canManagePermissions: 'Permissions',
};

const isLockedPermission = (role, permissionKey) => (
  role === 'admin' && ['canManagePermissions', 'canManageUsers'].includes(permissionKey)
);

export default function PermissionsPage() {
  const { rolePermissions, availablePermissions, loading, updateRolePermissions } = usePermissions();
  const [drafts, setDrafts] = useState({});
  const [savingRole, setSavingRole] = useState('');

  const orderedPermissions = useMemo(
    () => availablePermissions.filter((key) => PERMISSION_LABELS[key]),
    [availablePermissions]
  );

  const getDraft = (role, basePermissions) => drafts[role] || basePermissions;

  const handleToggle = (role, permissionKey, basePermissions) => {
    const current = getDraft(role, basePermissions);
    setDrafts((prev) => ({
      ...prev,
      [role]: {
        ...current,
        [permissionKey]: !current[permissionKey],
      },
    }));
  };

  const handleSave = async (role, basePermissions) => {
    setSavingRole(role);
    try {
      await updateRolePermissions(role, getDraft(role, basePermissions));
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[role];
        return next;
      });
      toast.success(`${ROLE_LABELS[role] || role} permissions updated`);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save permissions');
    } finally {
      setSavingRole('');
    }
  };

  if (loading) return <FullPageSpinner />;

  if (!rolePermissions.length) {
    return (
      <EmptyState
        icon="🛡️"
        title="Permissions unavailable"
        description="Permission settings could not be loaded for this account."
      />
    );
  }

  return (
    <div>
      <PageHeader
        title="Permissions"
        subtitle="Control feature access for each role without changing code."
      />

      <Alert
        type="info"
        message="These permissions are enforced on the backend, so route guards and buttons stay aligned with actual access."
      />

      <div className="card overflow-hidden mt-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</th>
                {orderedPermissions.map((permissionKey) => (
                  <th key={permissionKey} className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {PERMISSION_LABELS[permissionKey]}
                  </th>
                ))}
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Save</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rolePermissions.map(({ role, permissions }) => {
                const draft = getDraft(role, permissions);
                const isDirty = JSON.stringify(draft) !== JSON.stringify(permissions);
                const isSaving = savingRole === role;

                return (
                  <tr key={role} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
                          <FiShield size={16} />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{ROLE_LABELS[role] || role}</p>
                          <p className="text-xs text-gray-400">{role}</p>
                        </div>
                      </div>
                    </td>
                    {orderedPermissions.map((permissionKey) => (
                      <td key={permissionKey} className="px-4 py-4 text-center">
                        <label className="inline-flex items-center justify-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={Boolean(draft[permissionKey])}
                            disabled={isLockedPermission(role, permissionKey)}
                            onChange={() => handleToggle(role, permissionKey, permissions)}
                          />
                          <span
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                              draft[permissionKey] ? 'bg-blue-600' : 'bg-gray-300'
                            }`}
                            title={isLockedPermission(role, permissionKey) ? 'System admin access is always kept enabled.' : ''}
                          >
                            <span
                              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                                draft[permissionKey] ? 'translate-x-5' : 'translate-x-1'
                              }`}
                            />
                          </span>
                        </label>
                      </td>
                    ))}
                    <td className="px-4 py-4 text-right">
                      <button
                        onClick={() => handleSave(role, permissions)}
                        disabled={!isDirty || isSaving}
                        className="btn-primary"
                      >
                        <FiSave size={14} />
                        {isSaving ? 'Saving...' : 'Save'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
