const College = require('../models/College');
const Department = require('../models/Department');
const Program = require('../models/Program');
const Course = require('../models/Course');
const AcademicSession = require('../models/AcademicSession');
const Section = require('../models/Section');
const Subject = require('../models/Subject');
const Enrollment = require('../models/Enrollment');
const { getScopeFilter } = require('./scopeGuard');

// AcademicSession stores the institutional session label like "2025-26".
// Section.studyYear remains the student level number (1, 2, 3, 4) inside that session.
const normalizeString = (value) => String(value || '').trim();
const normalizeCode = (value) => normalizeString(value).toUpperCase();

const ensureCollege = async ({ id, name, code, description = '' }) => {
  if (id) {
    const existing = await College.findById(id);
    if (!existing) {
      const error = new Error('College not found');
      error.statusCode = 404;
      throw error;
    }
    return existing;
  }

  const normalizedName = normalizeString(name);
  const normalizedCode = normalizeCode(code);

  let college = null;
  if (normalizedCode) {
    college = await College.findOne({ code: normalizedCode });
  }
  if (!college && normalizedName) {
    college = await College.findOne({ name: normalizedName });
  }
  if (college) return college;

  return College.create({
    name: normalizedName,
    code: normalizedCode || normalizedName.slice(0, 3).toUpperCase(),
    description: normalizeString(description),
  });
};

const ensureDepartment = async ({ collegeId, name, code }) => {
  const normalizedName = normalizeString(name);
  const normalizedCode = normalizeCode(code);

  let department = null;
  if (normalizedCode) {
    department = await Department.findOne({ college: collegeId, code: normalizedCode });
  }
  if (!department && normalizedName) {
    department = await Department.findOne({ college: collegeId, name: normalizedName });
  }
  if (department) return department;

  return Department.create({
    college: collegeId,
    name: normalizedName,
    code: normalizedCode || normalizedName.slice(0, 3).toUpperCase(),
  });
};

const ensureProgram = async ({ departmentId, name, code, durationYears = 4 }) => {
  const normalizedName = normalizeString(name);
  const normalizedCode = normalizeCode(code);

  let program = null;
  if (normalizedCode) {
    program = await Program.findOne({ department: departmentId, code: normalizedCode });
  }
  if (!program && normalizedName) {
    program = await Program.findOne({ department: departmentId, name: normalizedName });
  }
  if (program) return program;

  return Program.create({
    department: departmentId,
    name: normalizedName,
    code: normalizedCode || normalizedName.slice(0, 4).toUpperCase(),
    durationYears,
  });
};

const ensureCourse = async ({ departmentId, programId, name, code }) => {
  const normalizedName = normalizeString(name);
  const normalizedCode = normalizeCode(code);

  let course = null;
  if (normalizedCode) {
    course = await Course.findOne({ program: programId, code: normalizedCode });
  }
  if (!course && normalizedName) {
    course = await Course.findOne({ program: programId, name: normalizedName });
  }
  if (course) return course;

  return Course.create({
    department: departmentId,
    program: programId,
    name: normalizedName,
    code: normalizedCode || normalizedName.slice(0, 4).toUpperCase(),
  });
};

const ensureAcademicSession = async ({ programId, studyYear, labelPrefix }) => {
  const yearNumber = Number(studyYear);
  const label = normalizeString(labelPrefix);

  const existing = await AcademicSession.findOne({ program: programId, yearNumber });
  if (existing) {
    if (label && existing.label !== label) {
      existing.label = label;
      await existing.save();
    }
    return existing;
  }

  return AcademicSession.create({
    program: programId,
    yearNumber,
    label,
  });
};

const ensureSection = async ({ departmentId, programId, courseId, academicSessionId, studyYear, name, capacity }) => {
  const normalizedName = normalizeString(name).toUpperCase();
  const existing = await Section.findOne({
    program: programId,
    course: courseId || null,
    academicSession: academicSessionId,
    name: normalizedName,
  });

  if (existing) {
    let hasChanges = false;
    if (existing.capacity !== capacity) {
      existing.capacity = capacity;
      hasChanges = true;
    }
    if (existing.studyYear !== Number(studyYear)) {
      existing.studyYear = Number(studyYear);
      hasChanges = true;
    }
    if (hasChanges) {
      await existing.save();
    }
    return existing;
  }

  return Section.create({
    department: departmentId,
    program: programId,
    course: courseId || null,
    academicSession: academicSessionId,
    studyYear: Number(studyYear),
    name: normalizedName,
    capacity,
  });
};

const buildStructureTree = async (user) => {
  const [collegeScope, departmentScope, programScope, courseScope, sectionScope] = await Promise.all([
    getScopeFilter(user, 'colleges'),
    getScopeFilter(user, 'departments'),
    getScopeFilter(user, 'programs'),
    getScopeFilter(user, 'courses'),
    getScopeFilter(user, 'sections'),
  ]);

  const [colleges, departments, programs, courses, sections] = await Promise.all([
    College.find({ isActive: true, ...collegeScope }).sort({ name: 1 }).lean(),
    Department.find({ isActive: true, ...departmentScope }).sort({ name: 1 }).lean(),
    Program.find({ isActive: true, ...programScope }).sort({ name: 1 }).lean(),
    Course.find({ isActive: true, ...courseScope }).sort({ name: 1 }).lean(),
    Section.find({ isActive: true, ...sectionScope })
      .sort({ studyYear: 1, name: 1 })
      .populate('academicSession', 'label yearNumber')
      .populate('advisorFaculty', 'name systemId')
      .lean(),
  ]);

  return colleges.map((college) => ({
    ...college,
    departments: departments
      .filter((department) => String(department.college) === String(college._id))
      .map((department) => ({
        ...department,
        programs: programs
          .filter((program) => String(program.department) === String(department._id))
          .map((program) => ({
            ...program,
            courses: courses
              .filter((course) => String(course.program) === String(program._id))
              .map((course) => ({
                ...course,
                sections: sections.filter(
                  (section) =>
                    String(section.program) === String(program._id) &&
                    String(section.course || '') === String(course._id)
                ),
              })),
          })),
      })),
  }));
};

const migrateAcademicIndexes = async () => {
  try {
    const indexes = await Section.collection.indexes();
    const legacyIndexes = indexes.filter((index) => index.name.includes('academicYear'));
    for (const legacyIndex of legacyIndexes) {
      await Section.collection.dropIndex(legacyIndex.name);
    }
  } catch (error) {
    if (!String(error.message || '').includes('index not found')) {
      throw error;
    }
  }
};

const backfillAcademicSessionRefs = async () => {
  await Promise.all([
    Section.collection.updateMany(
      { academicSession: { $exists: false }, academicYear: { $exists: true } },
      [{ $set: { academicSession: '$academicYear' } }]
    ),
    Subject.collection.updateMany(
      { academicSession: { $exists: false }, academicYear: { $exists: true } },
      [{ $set: { academicSession: '$academicYear' } }]
    ),
    Enrollment.collection.updateMany(
      { academicSession: { $exists: false }, academicYear: { $exists: true } },
      [{ $set: { academicSession: '$academicYear' } }]
    ),
  ]);
};

const runQuickAcademicSetup = async ({
  collegeId,
  college,
  collegeCode,
  department,
  departmentCode,
  program,
  programCode,
  course,
  courseCode,
  academicSession,
  years = [],
  sectionsPerYear = {},
  capacity = 60,
}) => {
  const collegeDoc = await ensureCollege({ id: collegeId, name: college, code: collegeCode });
  const departmentDoc = await ensureDepartment({ collegeId: collegeDoc._id, name: department, code: departmentCode });
  const programDoc = await ensureProgram({
    departmentId: departmentDoc._id,
    name: program,
    code: programCode,
    durationYears: Math.max(years.length || 1, 1),
  });
  const courseDoc = await ensureCourse({
    departmentId: departmentDoc._id,
    programId: programDoc._id,
    name: course,
    code: courseCode,
  });

  const createdSessions = [];
  const createdSections = [];

  for (const studyYear of years.map(Number).filter(Boolean)) {
    const sessionDoc = await ensureAcademicSession({
      programId: programDoc._id,
      studyYear,
      labelPrefix: academicSession,
    });
    createdSessions.push(sessionDoc);

    const yearSections = Array.isArray(sectionsPerYear?.[studyYear]) ? sectionsPerYear[studyYear] : [];
    for (const sectionName of yearSections) {
      const sectionDoc = await ensureSection({
        departmentId: departmentDoc._id,
        programId: programDoc._id,
        courseId: courseDoc._id,
        academicSessionId: sessionDoc._id,
        studyYear,
        name: sectionName,
        capacity: Number(capacity) || 60,
      });
      createdSections.push(sectionDoc);
    }
  }

  return {
    college: collegeDoc,
    department: departmentDoc,
    program: programDoc,
    course: courseDoc,
    academicSessions: createdSessions,
    sections: createdSections,
  };
};

module.exports = {
  backfillAcademicSessionRefs,
  buildStructureTree,
  migrateAcademicIndexes,
  runQuickAcademicSetup,
};
