const Permission = require('../models/Permission');
const {
  ROLE_ORDER,
  PERMISSION_KEYS,
  DEFAULT_ROLE_PERMISSIONS,
  sanitizePermissions,
} = require('../utils/permissionDefaults');
const { normalizeRole } = require('../utils/roleHelpers');

const getRolePayload = async (role) => {
  const permissionDoc = await Permission.getRolePermissions(role);
  const resolvedRole = normalizeRole(role);

  return {
    role: resolvedRole,
    permissions: sanitizePermissions(resolvedRole, permissionDoc?.permissions || DEFAULT_ROLE_PERMISSIONS[resolvedRole]),
    updatedAt: permissionDoc?.updatedAt || null,
  };
};

// @desc    Get current role permissions, and full matrix for admins
// @route   GET /api/permissions
// @access  Private
exports.getPermissions = async (req, res, next) => {
  try {
    const currentRole = normalizeRole(req.user.role);
    const currentPermissionsDoc = await Permission.getRolePermissions(currentRole);
    const currentPermissions = sanitizePermissions(
      currentRole,
      currentPermissionsDoc?.permissions || DEFAULT_ROLE_PERMISSIONS[currentRole]
    );

    const response = {
      currentRole,
      currentPermissions,
      availablePermissions: PERMISSION_KEYS,
    };

    if (req.user?.adminTier === 'super_admin' || currentPermissions.canManagePermissions) {
      const roles = await Promise.all(ROLE_ORDER.map(getRolePayload));
      response.roles = roles;
    }

    res.status(200).json({ success: true, data: response });
  } catch (error) {
    next(error);
  }
};

// @desc    Update a role's permissions
// @route   PUT /api/permissions/:role
// @access  Private/Admin with permission management access
exports.updateRolePermissions = async (req, res, next) => {
  try {
    if (req.user?.adminTier !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Only the super admin can modify role permissions',
      });
    }

    const role = normalizeRole(req.params.role);

    if (!ROLE_ORDER.includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }

    const permissions = sanitizePermissions(role, req.body.permissions || {});

    // Keep the system recoverable even if an admin edits permissions aggressively.
    if (role === 'admin') {
      permissions.canManagePermissions = true;
      permissions.canManageUsers = true;
    }
    const permissionDoc = await Permission.findOneAndUpdate(
      { role },
      { role, permissions },
      { new: true, upsert: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: {
        role: permissionDoc.role,
        permissions: sanitizePermissions(role, permissionDoc.permissions),
        updatedAt: permissionDoc.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
};
