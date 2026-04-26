const { normalizeRole } = require('./roleHelpers');
const { isPlatformAdmin, resolveEffectiveTier } = require('./permissionDefaults');

const parseAudienceValues = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const buildAudienceVisibilityQuery = (user) => {
  const normalizedRole = normalizeRole(user?.role);
  if (!normalizedRole || isPlatformAdmin(user)) return null;
  const effectiveTier = resolveEffectiveTier(user?.role, user?.adminTier);

  return {
    $and: [
      {
        $or: [
          { 'targetAudience.tiers': { $exists: false } },
          { 'targetAudience.tiers.0': { $exists: false } },
          ...(effectiveTier ? [{ 'targetAudience.tiers': effectiveTier }] : []),
        ],
      },
      {
        $or: [
          { 'targetAudience.roles': { $exists: false } },
          { 'targetAudience.roles.0': { $exists: false } },
          { 'targetAudience.roles': normalizedRole },
        ],
      },
      {
        $or: [
          { 'targetAudience.departments': { $exists: false } },
          { 'targetAudience.departments.0': { $exists: false } },
          ...(user?.department ? [{ 'targetAudience.departments': user.department }] : []),
        ],
      },
      {
        $or: [
          { 'targetAudience.years': { $exists: false } },
          { 'targetAudience.years.0': { $exists: false } },
          ...(user?.year ? [{ 'targetAudience.years': user.year }] : []),
        ],
      },
      {
        $or: [
          { 'targetAudience.sections': { $exists: false } },
          { 'targetAudience.sections.0': { $exists: false } },
          ...(user?.section ? [{ 'targetAudience.sections': user.section }] : []),
        ],
      },
    ],
  };
};

module.exports = {
  parseAudienceValues,
  buildAudienceVisibilityQuery,
};
