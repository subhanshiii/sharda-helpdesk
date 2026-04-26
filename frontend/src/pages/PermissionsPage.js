import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { FiCheckCircle, FiLock, FiSave, FiShield, FiX } from 'react-icons/fi';
import { PageHeader, Alert, EmptyState, FullPageSpinner, HelpTooltip, Modal } from '../components/ui';
import { usePermissions } from '../context/PermissionContext';
import { getAdminTierTone } from '../utils/helpers';

const ROLE_LABELS = {
  student: 'Student',
  faculty: 'Faculty',
  staff: 'Staff',
  admin: 'Admin',
};

const SYSTEM_MANAGED_PERMISSIONS = new Set(['canManagePermissions', 'canManageUsers']);

export default function PermissionsPage() {
  const {
    rolePermissions,
    availablePermissions,
    permissionDefinitions,
    adminTierDefinitions,
    loading,
    updateRolePermissions,
    isSuperAdmin,
  } = usePermissions();
  const [drafts, setDrafts] = useState({});
  const [savingRole, setSavingRole] = useState('');
  const [showReference, setShowReference] = useState(false);

  const permissionMetaMap = useMemo(
    () => permissionDefinitions.reduce((acc, definition) => {
      acc[definition.key] = definition;
      return acc;
    }, {}),
    [permissionDefinitions]
  );

  const orderedPermissions = useMemo(() => {
    const fallbackDefinitions = availablePermissions.map((key) => ({
      key,
      label: key.replace(/^can/, '').replace(/([A-Z])/g, ' $1').trim(),
      description: '',
      group: 'Other',
    }));
    const source = permissionDefinitions.length ? permissionDefinitions : fallbackDefinitions;
    const visibleKeys = new Set(availablePermissions);
    return source.filter((definition) => visibleKeys.has(definition.key));
  }, [availablePermissions, permissionDefinitions]);

  const nonAdminRolePermissions = useMemo(
    () => rolePermissions.filter((entry) => entry.role !== 'admin'),
    [rolePermissions]
  );

  const groupedTierDefinitions = useMemo(() => {
    const source = adminTierDefinitions.length ? adminTierDefinitions : [];
    return source.reduce((acc, tier) => {
      const key = tier.group || 'Other';
      acc[key] = [...(acc[key] || []), tier];
      return acc;
    }, {});
  }, [adminTierDefinitions]);

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

  if (!rolePermissions.length && !adminTierDefinitions.length) {
    return (
      <EmptyState
        icon="🛡️"
        title="Permissions unavailable"
        description="Permission settings could not be loaded for this account."
      />
    );
  }

  return (
    <div className="space-y-6">
      <Modal open={showReference} onClose={() => setShowReference(false)} panelClassName="max-w-6xl">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl font-bold text-gray-900">Permissions Reference</h2>
              <p className="mt-1 text-sm text-gray-500">Full tier details and the permission catalog live here so the main page can stay focused on the editable policy matrix.</p>
            </div>
            <button type="button" onClick={() => setShowReference(false)} className="rounded-2xl border border-gray-200 p-2 text-gray-400 transition hover:bg-gray-50 hover:text-gray-600">
              <FiX size={18} />
            </button>
          </div>

          <div className="mt-6 space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-xl font-bold text-gray-900">Tier Access Model</h3>
                  <p className="mt-1 text-sm text-gray-500">Each tier maps to a predefined elevated access level. Higher tiers inherit the permissions of lower tiers automatically.</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                  Authority order: Section Moderator → Program Coordinator → Department Admin → College Admin → Admin → Super Admin
                </div>
              </div>

              <div className="mt-5 space-y-5">
                {Object.entries(groupedTierDefinitions).map(([group, tiers]) => (
                  <div key={group}>
                    <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">{group}</div>
                    <div className="grid gap-4 xl:grid-cols-2">
                      {tiers.map((tier) => {
                        const includedPermissions = orderedPermissions.filter((permission) => tier.permissions?.[permission.key]);
                        return (
                          <div key={tier.key} className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className={`badge ${getAdminTierTone(tier.key)}`}>{tier.label}</span>
                                  <span className="badge bg-slate-100 text-slate-600">Tier {tier.level}</span>
                                  <span className="badge bg-white text-slate-600 border border-slate-200">{tier.scopeLabel}</span>
                                </div>
                                <p className="mt-3 text-sm text-gray-600">{tier.description}</p>
                              </div>
                              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                                {includedPermissions.length} inherited permissions
                              </div>
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2">
                              {includedPermissions.map((permission) => (
                                <span key={permission.key} className="badge bg-slate-100 text-slate-700" title={permission.description}>
                                  {permission.label}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
              {orderedPermissions.map((permission) => (
                <div key={permission.key} className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-display text-base font-bold text-gray-900">{permission.label}</p>
                      <p className="mt-1 text-sm text-gray-500">{permission.description}</p>
                    </div>
                    <FiCheckCircle size={16} className="text-emerald-500" />
                  </div>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">{permission.group}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      <PageHeader
        title="Permissions"
        description={isSuperAdmin
          ? 'Understand and govern the ERP access model from one place. Role permissions provide the base access, and optional tiers add inherited elevated authority.'
          : 'Understand how access is granted across the ERP. Role permissions provide the base access, and optional tiers add inherited elevated authority.'}
        action={<HelpTooltip title="Tier-based access model" items={[
          { label: 'Roles define the base layer', description: 'Student, faculty, staff, and admin roles still define the default functional access for each identity.' },
          { label: 'Tiers add inherited authority', description: 'Any user can optionally carry a tier. Higher tiers inherit the access of lower tiers automatically.' },
          { label: 'Super Admin governs the model', description: 'Only the super admin can edit role policies or grant privileged admin governance access.' },
        ]} />}
      />

      <Alert
        type="info"
        message={isSuperAdmin
          ? 'Tier permissions are fixed and inherited by level. Role policies remain editable for the base access layer.'
          : 'Tier permissions are fixed by authority level. Role-policy editing is restricted to the super admin.'}
      />

      <div className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold text-gray-900">Permission Overview</h2>
            <p className="mt-1 text-sm text-gray-500">Keep the page focused on editable role access. Open the reference view only when you need the full tier map or permission dictionary.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => setShowReference(true)} className="btn-secondary">
              Read Full Access Model
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Roles</p>
            <p className="mt-2 font-display text-3xl font-black text-slate-900">{nonAdminRolePermissions.length}</p>
            <p className="mt-2 text-sm text-slate-500">Editable base role policies.</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Permission Keys</p>
            <p className="mt-2 font-display text-3xl font-black text-slate-900">{orderedPermissions.length}</p>
            <p className="mt-2 text-sm text-slate-500">Available capability switches in the model.</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Admin Tiers</p>
            <p className="mt-2 font-display text-3xl font-black text-slate-900">{adminTierDefinitions.length}</p>
            <p className="mt-2 text-sm text-slate-500">Inherited authority layers above role access.</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">System Managed</p>
            <p className="mt-2 font-display text-3xl font-black text-slate-900">{SYSTEM_MANAGED_PERMISSIONS.size}</p>
            <p className="mt-2 text-sm text-slate-500">Reserved permissions controlled outside the role matrix.</p>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-gray-100 px-6 py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-bold text-gray-900">Role Policy Matrix</h2>
              <p className="mt-1 text-sm text-gray-500">Role permissions define the baseline access for every account. A tier, when assigned, adds inherited elevated access on top.</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              <div className="flex items-center gap-2 font-semibold">
                <FiLock size={15} />
                Tier access is system-managed and inherited
              </div>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</th>
                {orderedPermissions.map((permission) => (
                  <th key={permission.key} className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {permission.label}
                  </th>
                ))}
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Save</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {nonAdminRolePermissions.map(({ role, permissions }) => {
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
                    {orderedPermissions.map((permission) => (
                      <td key={permission.key} className="px-4 py-4 text-center">
                        <label className="inline-flex items-center justify-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={Boolean(draft[permission.key])}
                            disabled={SYSTEM_MANAGED_PERMISSIONS.has(permission.key) || !isSuperAdmin}
                            onChange={() => handleToggle(role, permission.key, permissions)}
                          />
                          <span
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                              draft[permission.key] ? 'bg-blue-600' : 'bg-gray-300'
                            }`}
                            title={SYSTEM_MANAGED_PERMISSIONS.has(permission.key)
                              ? 'This permission is reserved for the tier-based admin model.'
                              : permissionMetaMap[permission.key]?.description || ''}
                          >
                            <span
                              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                                draft[permission.key] ? 'translate-x-5' : 'translate-x-1'
                              }`}
                            />
                          </span>
                        </label>
                      </td>
                    ))}
                    <td className="px-4 py-4 text-right">
                      {isSuperAdmin ? (
                        <button
                          onClick={() => handleSave(role, permissions)}
                          disabled={!isDirty || isSaving}
                          className="btn-primary"
                        >
                          <FiSave size={14} />
                          {isSaving ? 'Saving...' : 'Save'}
                        </button>
                      ) : (
                        <span className="text-xs font-medium text-gray-400">Super admin only</span>
                      )}
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
