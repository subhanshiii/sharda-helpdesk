const crypto = require('crypto');
const mongoose = require('mongoose');
const User = require('../models/User');
const EmailVerification = require('../models/EmailVerification');
const YearCounter = require('../models/YearCounter');
const logger = require('../utils/logger');
const { sendEmailVerificationEmail } = require('../utils/emailService');
const { buildLifecycleSnapshot } = require('../utils/userLifecycle');

const SYSTEM_ID_REGEX = /^\d{10}$/;
const RESEND_TEST_MODE_ERROR = 'You can only send testing emails to your own email address';
const normalizeTierValue = (value) => {
  const normalized = String(value || '').trim();
  return normalized && normalized !== 'none' ? normalized : null;
};

const formatSystemId = (year, sequence) => `${year}${String(sequence).padStart(6, '0')}`;

const normalizeSystemId = (value) => String(value || '').trim();

const isValidSystemId = (value) => SYSTEM_ID_REGEX.test(normalizeSystemId(value));

const generateTemporaryPassword = () => crypto.randomBytes(12).toString('base64url');

const generateYearBasedSystemId = async () => {
  const year = new Date().getFullYear();
  const counter = await YearCounter.findOneAndUpdate(
    { year },
    { $inc: { currentSequence: 1 }, $setOnInsert: { year } },
    { new: true, upsert: true }
  );

  return formatSystemId(year, counter.currentSequence);
};

const resolveSystemId = async (providedSystemId) => {
  if (providedSystemId !== undefined && providedSystemId !== null && String(providedSystemId).trim() !== '') {
    const systemId = normalizeSystemId(providedSystemId);
    if (!isValidSystemId(systemId)) {
      const error = new Error('systemId must match YYYY followed by 6 digits');
      error.statusCode = 400;
      throw error;
    }

    const exists = await User.exists({ systemId });
    if (exists) {
      const error = new Error('systemId already exists');
      error.statusCode = 409;
      throw error;
    }

    return systemId;
  }

  let attempts = 0;
  while (attempts < 5) {
    attempts += 1;
    const systemId = await generateYearBasedSystemId();
    const exists = await User.exists({ systemId });
    if (!exists) {
      return systemId;
    }
  }

  const error = new Error('Could not generate a unique systemId');
  error.statusCode = 500;
  throw error;
};

const createVerificationToken = async (user, frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000') => {
  await EmailVerification.deleteMany({ user: user._id });
  const token = crypto.randomBytes(32).toString('hex');
  const verificationLink = `${frontendUrl}/verify-email?token=${token}`;
  await EmailVerification.create({ user: user._id, token });
  return { token, verificationLink };
};

const sendVerificationForUser = async (user, frontendUrl) => {
  const { verificationLink } = await createVerificationToken(user, frontendUrl);

  try {
    const result = await sendEmailVerificationEmail({
      toEmail: user.email,
      userName: user.name,
      verificationLink,
    });

    if (!result?.success) {
      throw new Error(result?.error || 'Failed to send verification email');
    }

    logger.info('Managed user verification email delivered', {
      systemId: user.systemId,
      email: user.email,
      provider: result.provider || 'unknown',
    });

    return { deliveryMode: 'email', verificationLink };
  } catch (error) {
    logger.error('Managed user verification email delivery failed', {
      systemId: user.systemId,
      email: user.email,
      error: error.message,
    });

    if (process.env.NODE_ENV !== 'production' && error.message.includes(RESEND_TEST_MODE_ERROR)) {
      return { deliveryMode: 'preview', verificationLink };
    }

    throw error;
  }
};

const buildUserCreatePayload = async ({
  name,
  email,
  password,
  role,
  adminTier,
  collegeId,
  sectionId,
  departmentId,
  orgUnitId,
  programId,
  year,
  section,
  expiryDate,
  systemId,
  status,
  emailVerified,
  isActive,
  profileImage,
  avatarChoice,
  passwordNeedsSetup,
}) => ({
  name: String(name || '').trim(),
  email: String(email || '').trim().toLowerCase(),
  password: password || generateTemporaryPassword(),
  passwordNeedsSetup: passwordNeedsSetup !== undefined ? Boolean(passwordNeedsSetup) : !password,
  role,
  adminTier: normalizeTierValue(adminTier),
  systemId: await resolveSystemId(systemId),
  collegeId: collegeId || null,
  sectionId: sectionId || null,
  department: '',
  departmentId: departmentId || null,
  orgUnitId: orgUnitId || null,
  programId: programId || null,
  year: year || '',
  section: section || '',
  expiryDate: expiryDate || null,
  status,
  emailVerified,
  isActive,
  profileImage: profileImage || null,
  avatarChoice: avatarChoice || null,
});

const serializeManagedUser = (user) => {
  const serialized = {
    _id: user._id,
    systemId: user.systemId,
    name: user.name,
    email: user.email,
    role: user.role,
    adminTier: user.adminTier || null,
    collegeId: user.collegeId || null,
    status: user.status,
    emailVerified: user.emailVerified,
    passwordNeedsSetup: Boolean(user.passwordNeedsSetup),
    isActive: user.isActive,
    department: user.department,
    departmentId: user.departmentId || null,
    orgUnitId: user.orgUnitId || null,
    programId: user.programId || null,
    year: user.year || '',
    section: user.section || '',
    sectionId: user.sectionId || null,
    expiryDate: user.expiryDate || null,
    avatar: user.avatar || null,
    profileImage: user.profileImage || null,
    avatarChoice: user.avatarChoice || null,
    lastLogin: user.lastLogin || null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };

  return {
    ...serialized,
    lifecycle: buildLifecycleSnapshot({
      role: serialized.role,
      emailVerified: serialized.emailVerified,
      passwordNeedsSetup: serialized.passwordNeedsSetup,
      status: serialized.status,
      isActive: serialized.isActive,
      expiryDate: serialized.expiryDate,
      isAssigned: serialized.role === 'student'
        ? Boolean(serialized.sectionId || serialized.section)
        : Boolean(serialized.orgUnitId || serialized.department || serialized.departmentId),
    }),
  };
};

const createManagedUser = async (payload, options = {}) => {
  const createPayload = await buildUserCreatePayload(payload);

  let attempts = 0;
  while (attempts < 5) {
    attempts += 1;
    try {
      const user = await User.create(createPayload);

      let verification = null;
      if (!user.emailVerified) {
        verification = await sendVerificationForUser(user, options.frontendUrl);
      }

      return { user, verification };
    } catch (error) {
      if (error?.code === 11000 && error?.keyPattern?.systemId && !payload.systemId) {
        createPayload.systemId = await resolveSystemId();
        continue;
      }
      throw error;
    }
  }

  const error = new Error('Could not provision user safely');
  error.statusCode = 500;
  throw error;
};

const parseCsvImport = (csvText = '') => {
  const sanitizedCsv = String(csvText || '').replace(/^\uFEFF/, '');
  const lines = sanitizedCsv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    const error = new Error('CSV file is empty');
    error.statusCode = 400;
    throw error;
  }

  const [headerLine, ...rowLines] = lines;
  const headers = headerLine.split(',').map((part) => part.trim());
  const expected = ['systemId', 'name', 'email', 'role'];
  if (headers.join(',') !== expected.join(',')) {
    const error = new Error('CSV header must be: systemId,name,email,role');
    error.statusCode = 400;
    throw error;
  }

  return rowLines.map((line, index) => {
    const cols = line.split(',').map((part) => part.trim());
    return {
      rowNumber: index + 2,
      systemId: cols[0] || '',
      name: cols[1] || '',
      email: cols[2] || '',
      role: cols[3] || '',
    };
  });
};

const findUserByIdentifier = async (identifier, projection = null) => {
  const normalized = String(identifier || '').trim();
  if (!normalized) return null;

  const query = mongoose.Types.ObjectId.isValid(normalized)
    ? { $or: [{ _id: normalized }, { systemId: normalized }] }
    : { systemId: normalized };

  return projection ? User.findOne(query).select(projection) : User.findOne(query);
};

const backfillMissingSystemIds = async () => {
  const users = await User.find({
    $or: [{ systemId: { $exists: false } }, { systemId: null }, { systemId: '' }],
  }).select('_id').lean();

  for (const user of users) {
    let attempts = 0;
    while (attempts < 5) {
      attempts += 1;
      try {
        const systemId = await resolveSystemId();
        await User.updateOne(
          { _id: user._id, $or: [{ systemId: { $exists: false } }, { systemId: null }, { systemId: '' }] },
          { $set: { systemId } },
          { runValidators: false }
        );
        break;
      } catch (error) {
        if (!(error?.code === 11000 && error?.keyPattern?.systemId)) {
          throw error;
        }
      }
    }
  }

  return users.length;
};

module.exports = {
  SYSTEM_ID_REGEX,
  isValidSystemId,
  resolveSystemId,
  createVerificationToken,
  sendVerificationForUser,
  createManagedUser,
  serializeManagedUser,
  parseCsvImport,
  findUserByIdentifier,
  generateTemporaryPassword,
  backfillMissingSystemIds,
};
