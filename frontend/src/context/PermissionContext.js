import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import API from '../utils/api';
import { useAuth } from './AuthContext';
import { normalizeUserRole } from '../utils/access';
import {
  ACTION_DEFINITIONS,
  RESOURCE_DEFINITIONS,
  ROLE_SUMMARIES,
  can as canAccess,
  normalizeResourcePermissions,
} from '../utils/rbac';

const PermissionContext = createContext();

const emptyPermissions = {
  canViewChat: false,
  canSendFiles: false,
  canCreateTickets: false,
  canHandleTickets: false,
  canManageSections: false,
  canSubmitAssignments: false,
  canManageAssignments: false,
  canManageAssessments: false,
  canManageAcademics: false,
  canManageTimetable: false,
  canMarkAttendance: false,
  canManageUsers: false,
  canManageAdmins: false,
  canManageGroups: false,
  canPostNotice: false,
  canViewAnalytics: false,
  canViewReports: false,
  canManagePermissions: false,
};

const buildEmptyPermissions = (keys = Object.keys(emptyPermissions)) => keys.reduce((acc, key) => {
  acc[key] = false;
  return acc;
}, {});

export function PermissionProvider({ children }) {
  const { token, user } = useAuth();
  const [permissions, setPermissions] = useState(emptyPermissions);
  const [rolePermissions, setRolePermissions] = useState([]);
  const [availablePermissions, setAvailablePermissions] = useState(Object.keys(emptyPermissions));
  const [permissionDefinitions, setPermissionDefinitions] = useState([]);
  const [adminTierDefinitions, setAdminTierDefinitions] = useState([]);
  const [resourcePermissions, setResourcePermissions] = useState(normalizeResourcePermissions('student'));
  const [resourceDefinitions, setResourceDefinitions] = useState(RESOURCE_DEFINITIONS);
  const [actionDefinitions, setActionDefinitions] = useState(ACTION_DEFINITIONS);
  const [roleSummaries, setRoleSummaries] = useState(ROLE_SUMMARIES);
  const [loading, setLoading] = useState(Boolean(token));

  const loadPermissions = useCallback(async () => {
    if (!token || !user) {
      setPermissions(emptyPermissions);
      setRolePermissions([]);
      setAvailablePermissions(Object.keys(emptyPermissions));
      setPermissionDefinitions([]);
      setAdminTierDefinitions([]);
      setResourcePermissions(normalizeResourcePermissions('student'));
      setResourceDefinitions(RESOURCE_DEFINITIONS);
      setActionDefinitions(ACTION_DEFINITIONS);
      setRoleSummaries(ROLE_SUMMARIES);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await API.get('/permissions');
      const data = res.data?.data || {};
      const nextAvailablePermissions = data.availablePermissions || Object.keys(emptyPermissions);
      const nextEmptyPermissions = buildEmptyPermissions(nextAvailablePermissions);
      setPermissions({ ...nextEmptyPermissions, ...(data.currentPermissions || {}) });
      setRolePermissions(data.roles || []);
      setAvailablePermissions(nextAvailablePermissions);
      setPermissionDefinitions(data.permissionDefinitions || []);
      setAdminTierDefinitions(data.adminTierDefinitions || []);
      setResourcePermissions(normalizeResourcePermissions(user.role, data.currentResourcePermissions || {}, user?.adminTier || ''));
      setResourceDefinitions(data.resourceDefinitions || RESOURCE_DEFINITIONS);
      setActionDefinitions(data.actionDefinitions || ACTION_DEFINITIONS);
      setRoleSummaries(data.roleSummaries || ROLE_SUMMARIES);
    } catch {
      setPermissions(emptyPermissions);
      setRolePermissions([]);
      setPermissionDefinitions([]);
      setAdminTierDefinitions([]);
      setResourcePermissions(normalizeResourcePermissions(user?.role || 'student', {}, user?.adminTier || ''));
      setResourceDefinitions(RESOURCE_DEFINITIONS);
      setActionDefinitions(ACTION_DEFINITIONS);
      setRoleSummaries(ROLE_SUMMARIES);
    } finally {
      setLoading(false);
    }
  }, [token, user]);

  useEffect(() => {
    loadPermissions();
  }, [loadPermissions]);

  const hasPermission = useCallback(
    (permissionKey) => Boolean(permissions[permissionKey]),
    [permissions]
  );

  const updateRolePermissions = useCallback(async (role, nextPermissions) => {
    const res = await API.put(`/permissions/${role}`, {
      resourcePermissions: nextPermissions,
    });

    const updatedRole = res.data?.data;
    if (updatedRole) {
      setRolePermissions((prev) => {
        const next = prev.filter((entry) => entry.role !== role);
        return [...next, updatedRole].sort((a, b) => a.role.localeCompare(b.role));
      });

      if (normalizeUserRole(user?.role) === normalizeUserRole(role)) {
        await loadPermissions();
      }
    }

    return updatedRole;
  }, [loadPermissions, user]);

  const can = useCallback(
    (action, resource) => canAccess(user, action, resource, resourcePermissions),
    [resourcePermissions, user]
  );

  const value = useMemo(() => ({
    permissions,
    rolePermissions,
    availablePermissions,
    permissionDefinitions,
    adminTierDefinitions,
    resourcePermissions,
    resourceDefinitions,
    actionDefinitions,
    roleSummaries,
    loading,
    isSuperAdmin: user?.adminTier === 'super_admin',
    hasPermission,
    can,
    refreshPermissions: loadPermissions,
    updateRolePermissions,
  }), [permissions, rolePermissions, availablePermissions, permissionDefinitions, adminTierDefinitions, resourcePermissions, resourceDefinitions, actionDefinitions, roleSummaries, loading, user, hasPermission, can, loadPermissions, updateRolePermissions]);

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissions() {
  const ctx = useContext(PermissionContext);
  if (!ctx) throw new Error('usePermissions must be used within PermissionProvider');
  return ctx;
}
