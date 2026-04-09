const User = require('../models/User');

const buildAdminPayload = () => {
  const email = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.INITIAL_ADMIN_PASSWORD?.trim();

  if (!email || !password) return null;

  return {
    name: process.env.INITIAL_ADMIN_NAME?.trim() || 'System Administrator',
    email,
    password,
    role: 'admin',
    status: 'approved',
    isActive: true,
    emailVerified: true,
    department: process.env.INITIAL_ADMIN_DEPARTMENT?.trim() || 'Administration',
    expiryDate: process.env.INITIAL_ADMIN_EXPIRY_DATE ? new Date(process.env.INITIAL_ADMIN_EXPIRY_DATE) : null,
  };
};

const ensureInitialAdmin = async (logger = console) => {
  const existingAdmin = await User.findOne({ role: 'admin' }).select('_id').lean();
  if (existingAdmin) return { created: false, reason: 'admin_exists' };

  const payload = buildAdminPayload();
  if (!payload) {
    logger.warn('Initial admin was not created because INITIAL_ADMIN_EMAIL or INITIAL_ADMIN_PASSWORD is missing');
    return { created: false, reason: 'missing_env' };
  }

  const user = await User.create(payload);
  logger.info(`Initial admin provisioned: ${user.email}`);
  return { created: true, userId: user._id.toString() };
};

module.exports = { ensureInitialAdmin };
