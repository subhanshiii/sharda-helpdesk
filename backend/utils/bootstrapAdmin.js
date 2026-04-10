const User = require('../models/User');
const bcrypt = require('bcryptjs');
const { createManagedUser, resolveSystemId } = require('../services/userProvisioningService');

const buildAdminPayload = () => {
  const email = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.INITIAL_ADMIN_PASSWORD?.trim();

  if (!email || !password) return null;

  return {
    name: process.env.INITIAL_ADMIN_NAME?.trim() || 'System Administrator',
    email,
    password,
    systemId: process.env.INITIAL_ADMIN_SYSTEM_ID?.trim() || null,
    role: 'admin',
    adminTier: 'super_admin',
    status: 'approved',
    isActive: true,
    emailVerified: true,
    department: process.env.INITIAL_ADMIN_DEPARTMENT?.trim() || 'Administration',
    expiryDate: process.env.INITIAL_ADMIN_EXPIRY_DATE ? new Date(process.env.INITIAL_ADMIN_EXPIRY_DATE) : null,
  };
};

const ensureInitialAdmin = async (logger = console) => {
  const payload = buildAdminPayload();
  if (!payload) {
    logger.warn('Initial admin was not created because INITIAL_ADMIN_EMAIL or INITIAL_ADMIN_PASSWORD is missing');
    return { created: false, reason: 'missing_env' };
  }

  const existingEnvAdmin = await User.findOne({ email: payload.email }).select('+password');

  if (!existingEnvAdmin) {
    const { user } = await createManagedUser(payload);
    logger.info(`Initial admin provisioned: ${user.email}`);
    return { created: true, systemId: user.systemId };
  }

  const updates = {};
  const fieldsToSync = {
    name: payload.name,
    role: 'admin',
    adminTier: 'super_admin',
    status: 'approved',
    isActive: true,
    emailVerified: true,
    department: payload.department,
    expiryDate: payload.expiryDate,
  };

  if (!existingEnvAdmin.systemId) {
    updates.systemId = await resolveSystemId(payload.systemId || undefined);
  }

  Object.entries(fieldsToSync).forEach(([key, value]) => {
    const normalizedExisting = existingEnvAdmin[key] instanceof Date
      ? existingEnvAdmin[key]?.toISOString()
      : existingEnvAdmin[key];
    const normalizedNext = value instanceof Date ? value?.toISOString() : value;
    if (normalizedExisting !== normalizedNext) {
      updates[key] = value;
    }
  });

  if (payload.password) {
    const passwordMatches = await existingEnvAdmin.matchPassword(payload.password);
    if (!passwordMatches) {
      const salt = await bcrypt.genSalt(10);
      updates.password = await bcrypt.hash(payload.password, salt);
    }
  }

  if (Object.keys(updates).length) {
    await User.updateOne({ _id: existingEnvAdmin._id }, { $set: updates }, { runValidators: false });
    logger.info(`Initial admin reconciled: ${existingEnvAdmin.email}`);
  }

  return {
    created: false,
    reason: Object.keys(updates).length ? 'reconciled' : 'already_present',
    systemId: updates.systemId || existingEnvAdmin.systemId,
  };
};

module.exports = { ensureInitialAdmin };
