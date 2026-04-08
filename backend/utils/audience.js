const { normalizeRole, isAdminRole } = require('./roleHelpers');

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
  if (!normalizedRole || isAdminRole(normalizedRole)) return null;

  return {
    $and: [
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
