const Section = require('../models/Section');
const Program = require('../models/Program');
const OrgUnit = require('../models/OrgUnit');
const Enrollment = require('../models/Enrollment');
const User = require('../models/User');
const { normalizeRole } = require('./roleHelpers');

const EMPTY_ACADEMIC_FIELDS = {
  collegeId: null,
  departmentId: null,
  department: '',
  programId: null,
  year: '',
  section: '',
  sectionId: null,
};

const isStudentApprovedForAcademicMapping = (user = {}) => (
  normalizeRole(user.role) === 'student' && String(user.status || '').trim().toLowerCase() === 'approved'
);

const clearStudentAcademicMapping = async (userId) => {
  if (!userId) return { cleared: false };

  await Promise.all([
    User.updateOne({ _id: userId }, { $set: { ...EMPTY_ACADEMIC_FIELDS } }),
    Enrollment.updateMany({ student: userId, status: 'active' }, { $set: { status: 'inactive' } }),
  ]);

  return { cleared: true };
};

const buildProgramAcademicFields = async (programId) => {
  if (!programId) return { ...EMPTY_ACADEMIC_FIELDS };

  const program = await Program.findById(programId)
    .populate({
      path: 'department',
      select: 'name code college',
      populate: { path: 'college', select: 'name code' },
    })
    .lean();

  if (!program) {
    const error = new Error('Selected program was not found');
    error.statusCode = 404;
    throw error;
  }

  return {
    collegeId: program.department?.college?._id || null,
    departmentId: program.department?._id || null,
    department: program.department?.name || '',
    programId: program._id,
    year: '',
    section: '',
    sectionId: null,
  };
};

const buildSectionAcademicFields = async (sectionId) => {
  if (!sectionId) return { ...EMPTY_ACADEMIC_FIELDS };

  const section = await Section.findById(sectionId)
    .populate({
      path: 'department',
      select: 'name code college',
      populate: { path: 'college', select: 'name code' },
    })
    .populate('program', 'name code')
    .populate('course', 'name code')
    .populate('academicSession', 'label yearNumber')
    .lean();

  if (!section) {
    const error = new Error('Selected section was not found');
    error.statusCode = 404;
    throw error;
  }

  return {
    collegeId: section.department?.college?._id || null,
    departmentId: section.department?._id || null,
    department: section.department?.name || '',
    programId: section.program?._id || null,
    year: section.studyYear ? String(section.studyYear) : '',
    section: section.name || '',
    sectionId: section._id,
  };
};

const buildOrgUnitAcademicFields = async (orgUnitId) => {
  if (!orgUnitId) return { ...EMPTY_ACADEMIC_FIELDS };

  const orgUnit = await OrgUnit.findById(orgUnitId)
    .populate('collegeId', 'name code')
    .populate({
      path: 'linkedDepartmentId',
      select: 'name code college',
      populate: { path: 'college', select: 'name code' },
    })
    .lean();

  if (!orgUnit) {
    const error = new Error('Selected organization unit was not found');
    error.statusCode = 404;
    throw error;
  }

  const linkedDepartment = orgUnit.linkedDepartmentId || null;
  const linkedCollege = linkedDepartment?.college || orgUnit.collegeId || null;

  return {
    collegeId: linkedCollege?._id || null,
    departmentId: linkedDepartment?._id || null,
    department: orgUnit.name || linkedDepartment?.name || '',
    programId: null,
    year: '',
    section: '',
    sectionId: null,
  };
};

const deriveAcademicFields = async ({ role, sectionId = null, programId = null, orgUnitId = null }) => {
  const normalizedRole = normalizeRole(role);
  if (normalizedRole === 'student') {
    return buildSectionAcademicFields(sectionId);
  }

  if (orgUnitId && ['faculty', 'staff', 'admin'].includes(normalizedRole)) {
    return buildOrgUnitAcademicFields(orgUnitId);
  }

  if (['faculty', 'staff'].includes(normalizedRole)) {
    return buildProgramAcademicFields(programId);
  }

  return {
    ...EMPTY_ACADEMIC_FIELDS,
    programId: programId || null,
  };
};

const populateUserAcademicContext = (query) => query
  .populate({
    path: 'sectionId',
    select: 'name studyYear department program course academicSession',
    populate: [
      { path: 'department', select: 'name code college', populate: { path: 'college', select: 'name code' } },
      { path: 'program', select: 'name code department', populate: { path: 'department', select: 'name code college', populate: { path: 'college', select: 'name code' } } },
      { path: 'course', select: 'name code' },
      { path: 'academicSession', select: 'label yearNumber' },
    ],
  })
  .populate({
    path: 'programId',
    select: 'name code department',
    populate: {
      path: 'department',
      select: 'name code college',
      populate: { path: 'college', select: 'name code' },
    },
  })
  .populate({
    path: 'orgUnitId',
    select: 'name code type collegeId linkedDepartmentId description',
    populate: [
      { path: 'collegeId', select: 'name code' },
      { path: 'linkedDepartmentId', select: 'name code college', populate: { path: 'college', select: 'name code' } },
    ],
  })
  .populate('collegeId', 'name code')
  .populate('departmentId', 'name code college');

const buildDerivedAcademicDisplay = (user = {}) => {
  const normalizedRole = normalizeRole(user.role);
  const liveSection = user.sectionId && typeof user.sectionId === 'object' ? user.sectionId : null;
  const liveProgram = user.programId && typeof user.programId === 'object' ? user.programId : null;
  const liveOrgUnit = user.orgUnitId && typeof user.orgUnitId === 'object' ? user.orgUnitId : null;
  const department = liveSection?.department
    || liveProgram?.department
    || liveOrgUnit?.linkedDepartmentId
    || user.departmentId
    || null;
  const school = department?.college || liveOrgUnit?.collegeId || user.collegeId || null;
  const departmentDisplay = department || (liveOrgUnit
    ? {
        _id: liveOrgUnit._id,
        name: liveOrgUnit.name,
        code: liveOrgUnit.code,
        type: liveOrgUnit.type,
      }
    : null);

  return {
    school,
    department: departmentDisplay,
    program: liveSection?.program || liveProgram || null,
    course: liveSection?.course || null,
    academicSession: liveSection?.academicSession || null,
    year: normalizedRole === 'student' ? (liveSection?.studyYear ? String(liveSection.studyYear) : user.year || '') : '',
    section: normalizedRole === 'student' ? (liveSection?.name || user.section || '') : '',
  };
};

const backfillDerivedAcademicFields = async () => {
  const users = await User.find({})
    .select('_id role status sectionId programId orgUnitId department departmentId collegeId year section')
    .lean();

  let updated = 0;

  for (const user of users) {
    const normalizedRole = normalizeRole(user.role);

    if (normalizedRole === 'student' && !isStudentApprovedForAcademicMapping(user)) {
      const hadMapping = Boolean(user.sectionId || user.section || user.year || user.programId || user.departmentId || user.collegeId);
      if (hadMapping) {
        updated += 1;
      }
      await clearStudentAcademicMapping(user._id);
      continue;
    }

    let resolvedSectionId = user.sectionId || null;

    if (normalizedRole === 'student' && !resolvedSectionId) {
      const enrollment = await Enrollment.findOne({ student: user._id, status: 'active' }).select('section').lean();
      resolvedSectionId = enrollment?.section || null;
    }

    const nextFields = await deriveAcademicFields({
      role: normalizedRole,
      sectionId: resolvedSectionId,
      programId: user.programId || null,
      orgUnitId: user.orgUnitId || null,
    });

    const nextUpdate = {
      ...nextFields,
      sectionId: normalizedRole === 'student' ? (resolvedSectionId || null) : null,
    };

    const hasChanged = [
      'collegeId',
      'departmentId',
      'department',
      'programId',
      'year',
      'section',
      'sectionId',
    ].some((key) => String(user[key] || '') !== String(nextUpdate[key] || ''));

    if (hasChanged) {
      updated += 1;
      await User.updateOne({ _id: user._id }, { $set: nextUpdate });
    }
  }

  return { updated };
};

module.exports = {
  EMPTY_ACADEMIC_FIELDS,
  deriveAcademicFields,
  populateUserAcademicContext,
  buildDerivedAcademicDisplay,
  backfillDerivedAcademicFields,
  isStudentApprovedForAcademicMapping,
  clearStudentAcademicMapping,
  buildOrgUnitAcademicFields,
};
