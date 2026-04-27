const Section = require('../models/Section');
const Program = require('../models/Program');
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

const deriveAcademicFields = async ({ role, sectionId = null, programId = null }) => {
  const normalizedRole = normalizeRole(role);
  if (normalizedRole === 'student') {
    return buildSectionAcademicFields(sectionId);
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
  .populate('collegeId', 'name code')
  .populate('departmentId', 'name code college');

const buildDerivedAcademicDisplay = (user = {}) => {
  const normalizedRole = normalizeRole(user.role);
  const liveSection = user.sectionId && typeof user.sectionId === 'object' ? user.sectionId : null;
  const liveProgram = user.programId && typeof user.programId === 'object' ? user.programId : null;
  const department = liveSection?.department || liveProgram?.department || user.departmentId || null;
  const school = department?.college || user.collegeId || null;

  return {
    school,
    department,
    program: liveSection?.program || liveProgram || null,
    course: liveSection?.course || null,
    academicSession: liveSection?.academicSession || null,
    year: normalizedRole === 'student' ? (liveSection?.studyYear ? String(liveSection.studyYear) : user.year || '') : '',
    section: normalizedRole === 'student' ? (liveSection?.name || user.section || '') : '',
  };
};

const backfillDerivedAcademicFields = async () => {
  const users = await User.find({})
    .select('_id role sectionId programId department departmentId collegeId year section')
    .lean();

  let updated = 0;

  for (const user of users) {
    const normalizedRole = normalizeRole(user.role);
    let resolvedSectionId = user.sectionId || null;

    if (normalizedRole === 'student' && !resolvedSectionId) {
      const enrollment = await Enrollment.findOne({ student: user._id, status: 'active' }).select('section').lean();
      resolvedSectionId = enrollment?.section || null;
    }

    const nextFields = await deriveAcademicFields({
      role: normalizedRole,
      sectionId: resolvedSectionId,
      programId: user.programId || null,
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
};
