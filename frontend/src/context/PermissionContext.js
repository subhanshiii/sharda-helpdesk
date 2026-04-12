import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import API from '../utils/api';
import { useAuth } from './AuthContext';

const PermissionContext = createContext();

const emptyPermissions = {
  canViewChat: false,
  canSendFiles: false,
  canCreateTickets: false,
  canHandleTickets: false,
  canManageSections: false,
  canSubmitAssignments: false,
  canManageAssignments: false,
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
  const [loading, setLoading] = useState(Boolean(token));

  const loadPermissions = useCallback(async () => {
    if (!token || !user) {
      setPermissions(emptyPermissions);
      setRolePermissions([]);
      setAvailablePermissions(Object.keys(emptyPermissions));
      setPermissionDefinitions([]);
      setAdminTierDefinitions([]);
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
    } catch {
      setPermissions(emptyPermissions);
      setRolePermissions([]);
      setPermissionDefinitions([]);
      setAdminTierDefinitions([]);
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
      permissions: nextPermissions,
    });

    const updatedRole = res.data?.data;
    if (updatedRole) {
      setRolePermissions((prev) => {
        const next = prev.filter((entry) => entry.role !== role);
        return [...next, updatedRole].sort((a, b) => a.role.localeCompare(b.role));
      });

      if (user?.role === role) {
        setPermissions({ ...buildEmptyPermissions(availablePermissions), ...updatedRole.permissions });
      }
    }

    return updatedRole;
  }, [availablePermissions, user]);

  const value = useMemo(() => ({
    permissions,
    rolePermissions,
    availablePermissions,
    permissionDefinitions,
    adminTierDefinitions,
    loading,
    isSuperAdmin: user?.adminTier === 'super_admin',
    hasPermission,
    refreshPermissions: loadPermissions,
    updateRolePermissions,
  }), [permissions, rolePermissions, availablePermissions, permissionDefinitions, adminTierDefinitions, loading, user, hasPermission, loadPermissions, updateRolePermissions]);

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
