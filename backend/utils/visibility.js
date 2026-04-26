const mongoose = require('mongoose');
const Section = require('../models/Section');
const { normalizeRole } = require('./roleHelpers');
const { isPlatformAdmin, resolveEffectiveTier } = require('./permissionDefaults');

const parseVisibilityValues = (value) => {
  if (!value) return [];
  const values = Array.isArray(value)
    ? value
    : String(value)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  return [...new Set(values.map((item) => String(item).trim()).filter(Boolean))];
};

const normalizeObjectId = (value) => (mongoose.Types.ObjectId.isValid(value) ? new mongoose.Types.ObjectId(value) : null);

const buildTargetAudiencePayload = (body = {}, legacy = {}) => ({
  tiers: parseVisibilityValues(body.audienceTiers),
  roles: parseVisibilityValues(body.audienceRoles).map((role) => normalizeRole(role)),
  collegeId: normalizeObjectId(body.audienceCollegeId),
  departmentId: normalizeObjectId(body.audienceDepartmentId),
  programId: normalizeObjectId(body.audienceProgramId),
  courseId: normalizeObjectId(body.audienceCourseId),
  studyYear: body.audienceStudyYear ? Number(body.audienceStudyYear) : null,
  sectionId: normalizeObjectId(body.audienceSectionId),
  departments: legacy.departments || parseVisibilityValues(body.audienceDepartments),
  years: legacy.years || parseVisibilityValues(body.audienceYears),
  sections: legacy.sections || parseVisibilityValues(body.audienceSections),
});

const buildRestriction = (field, value, legacyField, legacyValue) => {
  const clauses = [
    { [field]: { $exists: false } },
    { [field]: null },
  ];

  if (value !== null && value !== undefined && value !== '') {
    clauses.push({ [field]: value });
  }

  if (legacyField) {
    clauses.push(
      { [legacyField]: { $exists: false } },
      { [`${legacyField}.0`]: { $exists: false } }
    );
    if (legacyValue) {
      clauses.push({ [legacyField]: legacyValue });
    }
  }

  return { $or: clauses };
};

const resolveUserAcademicContext = async (user) => {
  const context = {
    role: normalizeRole(user?.role),
    tier: resolveEffectiveTier(user?.role, user?.adminTier),
    collegeId: user?.collegeId || null,
    departmentId: user?.departmentId || null,
    departmentName: user?.department || '',
    programId: user?.programId || null,
    courseId: null,
    studyYear: user?.year ? Number(user.year) : null,
    sectionId: user?.sectionId || null,
    sectionName: user?.section || '',
  };

  if (context.sectionId && mongoose.Types.ObjectId.isValid(context.sectionId)) {
    const section = await Section.findById(context.sectionId)
      .populate({
        path: 'department',
        select: 'name college',
      })
      .select('name studyYear course program department')
      .lean();

    if (section) {
      context.sectionId = section._id;
      context.sectionName = section.name || context.sectionName;
      context.studyYear = section.studyYear || context.studyYear;
      context.courseId = section.course || context.courseId;
      context.programId = section.program || context.programId;
      context.departmentId = section.department?._id || context.departmentId;
      context.departmentName = section.department?.name || context.departmentName;
      context.collegeId = section.department?.college || context.collegeId;
    }
  }

  return context;
};

const buildAudienceVisibilityQuery = async (user) => {
  const normalizedRole = normalizeRole(user?.role);
  if (!normalizedRole || isPlatformAdmin(user)) return null;

  const context = await resolveUserAcademicContext(user);

  return {
    $and: [
      {
        $or: [
          { 'targetAudience.tiers': { $exists: false } },
          { 'targetAudience.tiers.0': { $exists: false } },
          ...(context.tier ? [{ 'targetAudience.tiers': context.tier }] : []),
        ],
      },
      {
        $or: [
          { 'targetAudience.roles': { $exists: false } },
          { 'targetAudience.roles.0': { $exists: false } },
          { 'targetAudience.roles': normalizedRole },
        ],
      },
      buildRestriction('targetAudience.collegeId', context.collegeId),
      buildRestriction('targetAudience.departmentId', context.departmentId, 'targetAudience.departments', context.departmentName),
      buildRestriction('targetAudience.programId', context.programId),
      buildRestriction('targetAudience.courseId', context.courseId),
      buildRestriction('targetAudience.studyYear', context.studyYear, 'targetAudience.years', context.studyYear ? String(context.studyYear) : ''),
      buildRestriction('targetAudience.sectionId', context.sectionId, 'targetAudience.sections', context.sectionName),
    ],
  };
};

const buildVisibilityFilterQuery = (params = {}) => {
  const clauses = [];

  if (params.visibilityTier) clauses.push({ 'targetAudience.tiers': params.visibilityTier });
  if (params.visibilityRole) clauses.push({ 'targetAudience.roles': normalizeRole(params.visibilityRole) });
  if (params.collegeId && mongoose.Types.ObjectId.isValid(params.collegeId)) clauses.push({ 'targetAudience.collegeId': params.collegeId });
  if (params.departmentId && mongoose.Types.ObjectId.isValid(params.departmentId)) clauses.push({ 'targetAudience.departmentId': params.departmentId });
  if (params.programId && mongoose.Types.ObjectId.isValid(params.programId)) clauses.push({ 'targetAudience.programId': params.programId });
  if (params.courseId && mongoose.Types.ObjectId.isValid(params.courseId)) clauses.push({ 'targetAudience.courseId': params.courseId });
  if (params.studyYear) clauses.push({ 'targetAudience.studyYear': Number(params.studyYear) });
  if (params.sectionId && mongoose.Types.ObjectId.isValid(params.sectionId)) clauses.push({ 'targetAudience.sectionId': params.sectionId });

  return clauses.length ? { $and: clauses } : null;
};

module.exports = {
  buildAudienceVisibilityQuery,
  buildTargetAudiencePayload,
  buildVisibilityFilterQuery,
  parseVisibilityValues,
  resolveUserAcademicContext,
};
