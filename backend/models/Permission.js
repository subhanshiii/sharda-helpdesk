const mongoose = require('mongoose');
const {
  ROLE_ORDER,
  PERMISSION_KEYS,
  DEFAULT_ROLE_PERMISSIONS,
  sanitizePermissions,
} = require('../utils/permissionDefaults');
const { getDefaultResourcePermissions, normalizeResourcePermissions } = require('../utils/rbacPolicy');
const { normalizeRole } = require('../utils/roleHelpers');

const permissionsSchemaDefinition = PERMISSION_KEYS.reduce((schema, key) => {
  schema[key] = { type: Boolean, default: false };
  return schema;
}, {});

const permissionSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ROLE_ORDER,
      required: true,
      unique: true,
      trim: true,
    },
    permissions: permissionsSchemaDefinition,
    resourcePermissions: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

permissionSchema.statics.getRolePermissions = async function (role) {
  const resolvedRole = normalizeRole(role);
  const defaults = DEFAULT_ROLE_PERMISSIONS[resolvedRole];
  if (!defaults) return null;

  const doc = await this.findOneAndUpdate(
    { role: resolvedRole },
    {
      $setOnInsert: {
        role: resolvedRole,
        permissions: sanitizePermissions(resolvedRole, defaults),
        resourcePermissions: getDefaultResourcePermissions(resolvedRole),
      },
    },
    { new: true, upsert: true }
  );

  doc.permissions = sanitizePermissions(resolvedRole, doc.permissions || defaults);

  if (!doc.resourcePermissions || typeof doc.resourcePermissions !== 'object') {
    doc.resourcePermissions = getDefaultResourcePermissions(resolvedRole);
  } else {
    doc.resourcePermissions = normalizeResourcePermissions(resolvedRole, doc.resourcePermissions);
  }

  await doc.save();

  return doc;
};

module.exports = mongoose.model('Permission', permissionSchema);
