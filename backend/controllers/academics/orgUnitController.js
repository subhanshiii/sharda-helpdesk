const OrgUnit = require('../../models/OrgUnit');
const User = require('../../models/User');
const AcademicService = require('../../services/academicService');

exports.createOrgUnit = async (req, res, next) => {
  try {
    const payload = await AcademicService.buildOrgUnitPayload(req.body);
    const orgUnit = await OrgUnit.create(payload);
    require('../../config/cache').delPattern('academic:workspace:*');
    res.status(201).json({ success: true, data: orgUnit });
  } catch (error) {
    next(error);
  }
};

exports.updateOrgUnit = async (req, res, next) => {
  try {
    const existing = await OrgUnit.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Organization unit not found' });
    }

    const payload = await AcademicService.buildOrgUnitPayload({ ...existing.toObject(), ...req.body });
    Object.assign(existing, payload);
    await existing.save();

    require('../../config/cache').delPattern('academic:workspace:*');
    res.status(200).json({ success: true, data: existing });
  } catch (error) {
    next(error);
  }
};

exports.deleteOrgUnit = async (req, res, next) => {
  try {
    const orgUnit = await OrgUnit.findById(req.params.id);
    if (!orgUnit) {
      return res.status(404).json({ success: false, message: 'Organization unit not found' });
    }

    const activeMembers = await User.countDocuments({ orgUnitId: orgUnit._id, isActive: true });
    if (activeMembers > 0) {
      return res.status(400).json({
        success: false,
        message: 'Move or remove members from this organization unit before deleting it',
      });
    }

    orgUnit.isActive = false;
    await orgUnit.save();

    require('../../config/cache').delPattern('academic:workspace:*');
    res.status(200).json({ success: true, message: 'Organization unit archived successfully' });
  } catch (error) {
    next(error);
  }
};
