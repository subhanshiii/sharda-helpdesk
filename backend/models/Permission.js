const mongoose = require('mongoose');
const {
  ROLE_ORDER,
  PERMISSION_KEYS,
  DEFAULT_ROLE_PERMISSIONS,
  sanitizePermissions,
} = require('../utils/permissionDefaults');
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
      },
    },
    { new: true, upsert: true }
  );

  if (!doc.permissions) {
    doc.permissions = sanitizePermissions(resolvedRole, defaults);
    await doc.save();
  }

  return doc;
};

module.exports = mongoose.model('Permission', permissionSchema);
