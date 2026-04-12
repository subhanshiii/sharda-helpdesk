const AdminScope = require('../models/AdminScope');
const User = require('../models/User');
const { resolveEffectiveTier } = require('../utils/permissionDefaults');

exports.upsertAdminScopes = async (req, res, next) => {
  try {
    const userId = String(req.body?.userId || '').trim();
    const scopes = Array.isArray(req.body?.scopes) ? req.body.scopes : [];

    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required' });
    }

    const user = await User.findById(userId).select('role adminTier');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const scopedTiers = ['college_admin', 'department_admin', 'program_coordinator', 'section_moderator'];
    const effectiveTier = resolveEffectiveTier(user.role, user.adminTier);
    if (!scopedTiers.includes(effectiveTier)) {
      await AdminScope.deleteMany({ userId: user._id });
      return res.status(200).json({ success: true, data: [] });
    }

    const allowedScopeType = {
      college_admin: 'college',
      department_admin: 'department',
      program_coordinator: 'program',
      section_moderator: 'section',
    }[effectiveTier];

    const normalizedScopes = scopes
      .map((scope) => ({
        scopeType: String(scope?.scopeType || '').trim(),
        scopeId: String(scope?.scopeId || '').trim(),
      }))
      .filter((scope) => scope.scopeType === allowedScopeType && scope.scopeId);

    if (!normalizedScopes.length) {
      await AdminScope.deleteMany({ userId: user._id });
      return res.status(400).json({ success: false, message: 'At least one valid scope is required for this admin tier' });
    }

    await AdminScope.deleteMany({ userId: user._id });
    const createdScopes = await AdminScope.insertMany(
      normalizedScopes.map((scope) => ({
        userId: user._id,
        scopeType: scope.scopeType,
        scopeId: scope.scopeId,
      }))
    );

    res.status(200).json({ success: true, data: createdScopes });
  } catch (error) {
    next(error);
  }
};
