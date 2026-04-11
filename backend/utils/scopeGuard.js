const mongoose = require('mongoose');
const AdminScope = require('../models/AdminScope');
const Department = require('../models/Department');
const Program = require('../models/Program');
const Course = require('../models/Course');
const Section = require('../models/Section');
const User = require('../models/User');

const toObjectIds = (values = []) => values.map((value) => new mongoose.Types.ObjectId(value));

const getUserScopes = async (user) => {
  if (!user?._id || user.role !== 'admin') return [];
  return AdminScope.find({ userId: user._id }).lean();
};

const mapScopeIds = (scopes = [], scopeType) => scopes.filter((scope) => scope.scopeType === scopeType).map((scope) => String(scope.scopeId));

const getScopedDepartmentIds = async (scopes, adminTier) => {
  if (adminTier === 'college_admin') {
    const collegeIds = mapScopeIds(scopes, 'college');
    const departments = await Department.find({ college: { $in: toObjectIds(collegeIds) } }).select('_id').lean();
    return departments.map((department) => String(department._id));
  }
  if (adminTier === 'department_admin') {
    return mapScopeIds(scopes, 'department');
  }
  if (adminTier === 'program_coordinator') {
    const programIds = mapScopeIds(scopes, 'program');
    const programs = await Program.find({ _id: { $in: toObjectIds(programIds) } }).select('department').lean();
    return [...new Set(programs.map((program) => String(program.department)).filter(Boolean))];
  }
  if (adminTier === 'section_moderator') {
    const sectionIds = mapScopeIds(scopes, 'section');
    const sections = await Section.find({ _id: { $in: toObjectIds(sectionIds) } }).select('department').lean();
    return [...new Set(sections.map((section) => String(section.department)).filter(Boolean))];
  }
  return [];
};

const getScopedProgramIds = async (scopes, adminTier) => {
  if (adminTier === 'program_coordinator') {
    return mapScopeIds(scopes, 'program');
  }
  if (adminTier === 'section_moderator') {
    const sectionIds = mapScopeIds(scopes, 'section');
    const sections = await Section.find({ _id: { $in: toObjectIds(sectionIds) } }).select('program').lean();
    return [...new Set(sections.map((section) => String(section.program)).filter(Boolean))];
  }
  const departmentIds = await getScopedDepartmentIds(scopes, adminTier);
  if (!departmentIds.length) return [];
  const programs = await Program.find({ department: { $in: toObjectIds(departmentIds) } }).select('_id').lean();
  return programs.map((program) => String(program._id));
};

const getScopedSectionIds = async (scopes, adminTier) => {
  if (adminTier === 'section_moderator') {
    return mapScopeIds(scopes, 'section');
  }
  if (adminTier === 'program_coordinator') {
    const programIds = await getScopedProgramIds(scopes, adminTier);
    const sections = await Section.find({ program: { $in: toObjectIds(programIds) } }).select('_id').lean();
    return sections.map((section) => String(section._id));
  }
  const departmentIds = await getScopedDepartmentIds(scopes, adminTier);
  if (!departmentIds.length) return [];
  const sections = await Section.find({ department: { $in: toObjectIds(departmentIds) } }).select('_id').lean();
  return sections.map((section) => String(section._id));
};

const getScopeFilter = async (user, resource = 'departments') => {
  if (!user || user.role !== 'admin' || ['super_admin', 'admin', null, undefined].includes(user.adminTier)) {
    return {};
  }

  const scopes = await getUserScopes(user);
  if (!scopes.length) {
    return { _id: null };
  }

  if (resource === 'colleges') {
    if (user.adminTier === 'college_admin') {
      return { _id: { $in: toObjectIds(mapScopeIds(scopes, 'college')) } };
    }
    const departmentIds = await getScopedDepartmentIds(scopes, user.adminTier);
    const departments = await Department.find({ _id: { $in: toObjectIds(departmentIds) } }).select('college').lean();
    return { _id: { $in: toObjectIds([...new Set(departments.map((department) => String(department.college)).filter(Boolean))]) } };
  }

  if (resource === 'departments') {
    const departmentIds = await getScopedDepartmentIds(scopes, user.adminTier);
    return { _id: { $in: toObjectIds(departmentIds) } };
  }

  if (resource === 'programs') {
    const programIds = await getScopedProgramIds(scopes, user.adminTier);
    return { _id: { $in: toObjectIds(programIds) } };
  }

  if (resource === 'courses') {
    const programIds = await getScopedProgramIds(scopes, user.adminTier);
    return { program: { $in: toObjectIds(programIds) } };
  }

  if (resource === 'sections') {
    const sectionIds = await getScopedSectionIds(scopes, user.adminTier);
    return { _id: { $in: toObjectIds(sectionIds) } };
  }

  if (resource === 'subjects') {
    const programIds = await getScopedProgramIds(scopes, user.adminTier);
    return { program: { $in: toObjectIds(programIds) } };
  }

  if (resource === 'section-subjects' || resource === 'enrollments') {
    const sectionIds = await getScopedSectionIds(scopes, user.adminTier);
    return { section: { $in: toObjectIds(sectionIds) } };
  }

  return {};
};

const getScopedUserIdsForTickets = async (user) => {
  if (!user || user.role !== 'admin' || ['super_admin', 'admin', null, undefined].includes(user.adminTier)) {
    return null;
  }

  const scopes = await getUserScopes(user);
  if (!scopes.length) return [];

  if (user.adminTier === 'college_admin') {
    const collegeIds = mapScopeIds(scopes, 'college');
    const users = await User.find({ collegeId: { $in: toObjectIds(collegeIds) } }).select('_id').lean();
    return users.map((entry) => entry._id);
  }

  if (user.adminTier === 'department_admin') {
    const departmentIds = mapScopeIds(scopes, 'department');
    const users = await User.find({ departmentId: { $in: toObjectIds(departmentIds) } }).select('_id').lean();
    return users.map((entry) => entry._id);
  }

  if (user.adminTier === 'program_coordinator') {
    const programIds = mapScopeIds(scopes, 'program');
    const users = await User.find({ programId: { $in: toObjectIds(programIds) } }).select('_id').lean();
    return users.map((entry) => entry._id);
  }

  const sectionIds = mapScopeIds(scopes, 'section');
  const users = await User.find({ sectionId: { $in: toObjectIds(sectionIds) } }).select('_id').lean();
  return users.map((entry) => entry._id);
};

module.exports = {
  getScopeFilter,
  getUserScopes,
  getScopedUserIdsForTickets,
};
