import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import API from '../utils/api';
import { useAuth } from './AuthContext';

const PermissionContext = createContext();

const emptyPermissions = {
  canViewChat: false,
  canSendFiles: false,
  canCreateTickets: false,
  canHandleTickets: false,
  canSubmitAssignments: false,
  canManageAssignments: false,
  canManageAcademics: false,
  canManageTimetable: false,
  canMarkAttendance: false,
  canManageUsers: false,
  canManageGroups: false,
  canPostNotice: false,
  canViewAnalytics: false,
  canManagePermissions: false,
};

export function PermissionProvider({ children }) {
  const { token, user } = useAuth();
  const [permissions, setPermissions] = useState(emptyPermissions);
  const [rolePermissions, setRolePermissions] = useState([]);
  const [availablePermissions, setAvailablePermissions] = useState(Object.keys(emptyPermissions));
  const [loading, setLoading] = useState(Boolean(token));

  const loadPermissions = useCallback(async () => {
    if (!token || !user) {
      setPermissions(emptyPermissions);
      setRolePermissions([]);
      setAvailablePermissions(Object.keys(emptyPermissions));
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await API.get('/permissions');
      const data = res.data?.data || {};
      setPermissions({ ...emptyPermissions, ...(data.currentPermissions || {}) });
      setRolePermissions(data.roles || []);
      setAvailablePermissions(data.availablePermissions || Object.keys(emptyPermissions));
    } catch {
      setPermissions(emptyPermissions);
      setRolePermissions([]);
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
        setPermissions({ ...emptyPermissions, ...updatedRole.permissions });
      }
    }

    return updatedRole;
  }, [user]);

  const value = useMemo(() => ({
    permissions,
    rolePermissions,
    availablePermissions,
    loading,
    hasPermission,
    refreshPermissions: loadPermissions,
    updateRolePermissions,
  }), [permissions, rolePermissions, availablePermissions, loading, hasPermission, loadPermissions, updateRolePermissions]);

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
