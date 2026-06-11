import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { FiCheck, FiEdit2, FiInfo, FiRefreshCcw, FiSave, FiShield } from 'react-icons/fi';
import { Alert, EmptyState, FullPageSpinner, PageHeader } from '../components/ui';
import { usePermissions } from '../context/PermissionContext';

const ROLE_ORDER = ['student', 'faculty', 'staff', 'admin'];

const toneClasses = {
  minimal: 'border-slate-200 bg-slate-50 text-slate-700',
  academic: 'border-violet-200 bg-violet-50 text-violet-700',
  operations: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  highlight: 'border-amber-200 bg-amber-50 text-amber-800',
};

const matrixCellClass = (enabled, editable) => {
  if (enabled) {
    return editable
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : 'border-emerald-100 bg-emerald-50 text-emerald-700';
  }

  return editable
    ? 'border-slate-200 bg-slate-50 text-slate-400'
    : 'border-slate-100 bg-slate-50 text-slate-300';
};

export default function PermissionsPage() {
  const {
    rolePermissions,
    resourceDefinitions,
    actionDefinitions,
    roleSummaries,
    loading,
    updateRolePermissions,
    isSuperAdmin,
  } = usePermissions();
  const [drafts, setDrafts] = useState({});
  const [savingRole, setSavingRole] = useState('');

  const roles = useMemo(
    () => ROLE_ORDER.map((role) => rolePermissions.find((entry) => entry.role === role)).filter(Boolean),
    [rolePermissions]
  );

  const groupedResources = useMemo(
    () => resourceDefinitions.reduce((acc, resource) => {
      acc[resource.group] = [...(acc[resource.group] || []), resource];
      return acc;
    }, {}),
    [resourceDefinitions]
  );

  const getDraft = (role, base) => drafts[role] || base;

  const setRoleDraft = (role, nextPermissions) => {
    setDrafts((current) => ({ ...current, [role]: nextPermissions }));
  };

  const toggleCell = (role, resourceKey, actionKey, base) => {
    const current = getDraft(role, base);
    setRoleDraft(role, {
      ...current,
      [resourceKey]: {
        ...current[resourceKey],
        [actionKey]: !current?.[resourceKey]?.[actionKey],
      },
    });
  };

  const allowAllViews = (role, base) => {
    const next = { ...getDraft(role, base) };
    resourceDefinitions.forEach((resource) => {
      if (!resource.actions.includes('view')) return;
      next[resource.key] = {
        ...(next[resource.key] || {}),
        view: true,
      };
    });
    setRoleDraft(role, next);
  };

  const allowAllEditable = (role, base) => {
    const next = { ...getDraft(role, base) };
    resourceDefinitions.forEach((resource) => {
      if (!resource.actions.includes('view')) return;
      next[resource.key] = {
        ...(next[resource.key] || {}),
        view: true,
      };
      if (resource.actions.includes('edit')) {
        next[resource.key].edit = true;
      }
    });
    setRoleDraft(role, next);
  };

  const resetRole = (role) => {
    setDrafts((current) => {
      const next = { ...current };
      delete next[role];
      return next;
    });
  };

  const saveRole = async (role, base) => {
    setSavingRole(role);
    try {
      await updateRolePermissions(role, getDraft(role, base));
      resetRole(role);
      toast.success(`${roleSummaries?.[role]?.label || role} permissions updated`);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update role permissions');
    } finally {
      setSavingRole('');
    }
  };

  if (loading) return <FullPageSpinner />;

  if (!roles.length) {
    return <EmptyState icon="🛡️" title="Permissions unavailable" description="Role policies could not be loaded right now." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Permission Matrix"
        description="Resource-first RBAC with clear role summaries, grouped matrices, and bulk actions so access stays understandable as the app grows."
      />

      <Alert
        type="info"
        message="Backend route enforcement and frontend visibility now follow the same resource/action model. Faculty assignment edits still depend on ownership checks in addition to this matrix."
      />

      <div className="grid gap-4 xl:grid-cols-4">
        {roles.map(({ role, resourcePermissions }) => {
          const summary = roleSummaries?.[role];
          const enabledViewCount = Object.values(resourcePermissions || {}).reduce(
            (count, resource) => count + (resource?.view ? 1 : 0),
            0
          );
          const enabledEditCount = Object.values(resourcePermissions || {}).reduce(
            (count, resource) => count + (resource?.edit ? 1 : 0),
            0
          );
          const enabledCount = Object.values(resourcePermissions || {}).reduce(
            (count, resource) => count + Object.values(resource || {}).filter(Boolean).length,
            0
          );
          return (
            <div key={role} className={`rounded-3xl border p-5 ${toneClasses[summary?.tone || 'minimal']}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-xl font-bold">{summary?.label || role}</p>
                  <p className="mt-2 text-sm leading-6 opacity-90">{summary?.description}</p>
                </div>
                <div className="rounded-2xl bg-white/70 px-3 py-2 text-center shadow-sm">
                  <div className="text-[11px] uppercase tracking-[0.14em] opacity-70">Allowed</div>
                  <div className="font-display text-2xl font-black">{enabledCount}</div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                <div className="rounded-2xl bg-white/70 px-3 py-2 shadow-sm">
                  <div className="text-[10px] uppercase tracking-[0.14em] opacity-70">View</div>
                  <div className="mt-1 font-display text-lg font-black">{enabledViewCount}</div>
                </div>
                <div className="rounded-2xl bg-white/70 px-3 py-2 shadow-sm">
                  <div className="text-[10px] uppercase tracking-[0.14em] opacity-70">Edit</div>
                  <div className="mt-1 font-display text-lg font-black">{enabledEditCount}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {!isSuperAdmin ? (
        <Alert type="warning" message="Only super admins can edit this matrix. Other admins can review the policy here." />
      ) : null}

      {Object.entries(groupedResources).map(([group, resources]) => (
        <div key={group} className="card overflow-hidden">
          <div className="border-b border-gray-100 px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-xl font-bold text-gray-900">{group}</h2>
                <p className="mt-1 text-sm text-gray-500">Each section groups permissions by actual resource instead of generic toggle lists.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <div className="flex items-center gap-2 font-semibold"><FiInfo size={15} /> Bulk action</div>
                <div className="mt-1 text-xs">Use “Allow all view” for read-only access or “Allow view + edit” for editable resources with one click.</div>
              </div>
            </div>
          </div>

          <div className="space-y-6 p-6">
            {resources.map((resource) => {
              const visibleActions = actionDefinitions.filter((action) => resource.actions.includes(action.key));

              return (
                <div key={resource.key} className="overflow-x-auto rounded-3xl border border-slate-200 bg-white">
                  <div className="border-b border-slate-100 px-5 py-4">
                    <h3 className="font-display text-lg font-bold text-gray-900">{resource.label}</h3>
                    <p className="mt-1 text-sm text-gray-500">{resource.description || 'Configure access for this resource by role.'}</p>
                  </div>

                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50">
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Role</th>
                        {visibleActions.map((action) => (
                          <th key={action.key} className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.14em] text-slate-500" title={action.description}>
                            {action.label}
                          </th>
                        ))}
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {roles.map(({ role, resourcePermissions }) => {
                        const summary = roleSummaries?.[role];
                        const draft = getDraft(role, resourcePermissions);
                        const isDirty = JSON.stringify(draft) !== JSON.stringify(resourcePermissions);
                        const isSaving = savingRole === role;
                        const editable = isSuperAdmin && role !== 'admin';

                        return (
                          <tr key={`${resource.key}-${role}`} className="hover:bg-slate-50/70">
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-3">
                                <div className={`flex h-10 w-10 items-center justify-center rounded-2xl border ${toneClasses[summary?.tone || 'minimal']}`}>
                                  <FiShield size={16} />
                                </div>
                                <div>
                                  <div className="font-semibold text-gray-900">{summary?.label || role}</div>
                                  <div className="text-xs text-gray-400">{role}</div>
                                </div>
                              </div>
                            </td>
                            {visibleActions.map((action) => {
                              const enabled = Boolean(draft?.[resource.key]?.[action.key]);
                              return (
                                <td key={action.key} className="px-4 py-4 text-center">
                                  <button
                                    type="button"
                                    disabled={!editable}
                                    onClick={() => toggleCell(role, resource.key, action.key, resourcePermissions)}
                                    className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl border transition ${matrixCellClass(enabled, editable)} ${editable ? 'hover:-translate-y-0.5' : 'cursor-default'}`}
                                    title={editable ? `${enabled ? 'Remove' : 'Allow'} ${action.label.toLowerCase()} access` : 'This role is read-only in the matrix'}
                                  >
                                    {enabled ? <FiCheck size={16} /> : <span className="text-lg">-</span>}
                                  </button>
                                </td>
                              );
                            })}
                            <td className="px-4 py-4">
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  className="btn-secondary text-xs"
                                  disabled={!editable}
                                  onClick={() => allowAllViews(role, resourcePermissions)}
                                >
                                  <FiCheck size={13} /> Allow all view
                                </button>
                                <button
                                  type="button"
                                  className="btn-secondary text-xs"
                                  disabled={!editable}
                                  onClick={() => allowAllEditable(role, resourcePermissions)}
                                >
                                  <FiEdit2 size={13} /> Allow view + edit
                                </button>
                                <button
                                  type="button"
                                  className="btn-secondary text-xs"
                                  disabled={!editable || !drafts[role]}
                                  onClick={() => resetRole(role)}
                                >
                                  <FiRefreshCcw size={13} /> Reset
                                </button>
                                <button
                                  type="button"
                                  className="btn-primary text-xs"
                                  disabled={!editable || !isDirty || isSaving}
                                  onClick={() => saveRole(role, resourcePermissions)}
                                >
                                  <FiSave size={13} /> {isSaving ? 'Saving...' : 'Save'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
