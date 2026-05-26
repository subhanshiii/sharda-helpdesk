const mongoose = require('mongoose');
const College = require('../models/College');
const Department = require('../models/Department');
const Program = require('../models/Program');
const Course = require('../models/Course');
const AcademicSession = require('../models/AcademicSession');
const Section = require('../models/Section');
const Subject = require('../models/Subject');
const OrgUnit = require('../models/OrgUnit');
const CourseSubject = require('../models/CourseSubject');
const SubjectTeacher = require('../models/SubjectTeacher');
const SubjectSectionTeacher = require('../models/SubjectSectionTeacher');
const TeachingAssignment = require('../models/TeachingAssignment');
const Enrollment = require('../models/Enrollment');
const AttendanceSession = require('../models/AttendanceSession');
const User = require('../models/User');
const { normalizeRole } = require('../utils/roleHelpers');
const { getScopeFilter } = require('../utils/scopeGuard');
const { resolveEffectiveTier } = require('../utils/permissionDefaults');
const { buildStructureTree, runQuickAcademicSetup } = require('../utils/academicSetupService');
const {
  buildSubjectCatalog,
  getSubjectDetail,
  getSubjectIdsForCourse,
  getSubjectIdsForSection,
  normalizeObjectIdList,
  syncCourseSubjectMappings,
  syncSubjectSectionTeacherMappings,
  syncSubjectTeacherMappings,
} = require('../utils/subjectManagement');
const {
  syncTeachingAssignmentsForSubject,
  syncTeachingAssignmentsForSection,
  syncTeachingAssignmentsForSubjectSection,
} = require('../utils/teachingAssignments');

const normalizeString = (value) => String(value || '').trim();
const normalizeCode = (value) => normalizeString(value).toUpperCase();
const normalizeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const ensureResourceExists = async (Model, id, label) => {
  const doc = await Model.findById(id).lean();
  if (!doc) {
    const error = new Error(`${label} not found`);
    error.statusCode = 404;
    throw error;
  }
  return doc;
};

const resolveAcademicSessionId = (body = {}) => body.academicSession || body.academicYear || '';

const buildAcademicPayload = async (resource, body = {}) => {
  const payload = { ...body };

  if (resource === 'colleges') {
    payload.name = normalizeString(body.name);
    payload.code = normalizeCode(body.code);
    payload.description = normalizeString(body.description);
    return payload;
  }

  if (resource === 'departments') {
    const college = await ensureResourceExists(College, body.college || body.collegeId, 'College');
    payload.college = college._id;
    payload.name = normalizeString(body.name);
    payload.code = normalizeCode(body.code);
    return payload;
  }

  if (resource === 'programs') {
    const department = await ensureResourceExists(Department, body.department, 'Department');
    payload.name = normalizeString(body.name);
    payload.code = normalizeCode(body.code);
    payload.department = department._id;
    payload.durationYears = normalizeNumber(body.durationYears, 4);
    return payload;
  }

  if (resource === 'courses') {
    const [program, department] = await Promise.all([
      ensureResourceExists(Program, body.program, 'Program'),
      ensureResourceExists(Department, body.department, 'Department'),
    ]);
    if (String(program.department) !== String(department._id)) {
      const error = new Error('Course department must match the selected program department');
      error.statusCode = 400;
      throw error;
    }
    payload.name = normalizeString(body.name);
    payload.code = normalizeCode(body.code);
    payload.program = program._id;
    payload.department = department._id;
    return payload;
  }

  if (resource === 'years' || resource === 'academic-sessions') {
    const program = await ensureResourceExists(Program, body.program, 'Program');
    payload.program = program._id;
    payload.yearNumber = normalizeNumber(body.yearNumber, 1);
    payload.label = normalizeString(body.label);
    return payload;
  }

  if (resource === 'sections') {
    if (!body.course) {
      const error = new Error('Section must be linked to a course');
      error.statusCode = 400;
      throw error;
    }
    const [program, course, academicSession, department] = await Promise.all([
      ensureResourceExists(Program, body.program, 'Program'),
      ensureResourceExists(Course, body.course, 'Course'),
      ensureResourceExists(AcademicSession, resolveAcademicSessionId(body), 'Academic Session'),
      ensureResourceExists(Department, body.department, 'Department'),
    ]);

    if (String(program.department) !== String(department._id)) {
      const error = new Error('Section department must match the selected program department');
      error.statusCode = 400;
      throw error;
    }
    if (String(course.program) !== String(program._id)) {
      const error = new Error('Selected course does not belong to the selected program');
      error.statusCode = 400;
      throw error;
    }
    if (String(academicSession.program) !== String(program._id)) {
      const error = new Error('Academic session must belong to the selected program');
      error.statusCode = 400;
      throw error;
    }

    payload.program = program._id;
    payload.course = course._id;
    payload.academicSession = academicSession._id;
    payload.studyYear = academicSession.yearNumber;
    payload.department = department._id;
    payload.name = normalizeString(body.name);
    payload.capacity = normalizeNumber(body.capacity, 60);
    return payload;
  }

  if (resource === 'subjects') {
    const [department, program, academicSession] = await Promise.all([
      ensureResourceExists(Department, body.department, 'Department'),
      ensureResourceExists(Program, body.program, 'Program'),
      ensureResourceExists(AcademicSession, resolveAcademicSessionId(body), 'Academic Session'),
    ]);
    const courseIds = normalizeObjectIdList(body.courseIds || body.courses || body.course);

    if (String(program.department) !== String(department._id)) {
      const error = new Error('Subject department must match the selected program department');
      error.statusCode = 400;
      throw error;
    }
    if (String(academicSession.program) !== String(program._id)) {
      const error = new Error('Academic session must belong to the selected program');
      error.statusCode = 400;
      throw error;
    }
    if (!courseIds.length) {
      const error = new Error('Select at least one course for this subject');
      error.statusCode = 400;
      throw error;
    }

    payload.code = normalizeCode(body.code);
    payload.name = normalizeString(body.name);
    payload.department = department._id;
    payload.program = program._id;
    payload.academicSession = academicSession._id;
    payload.credits = normalizeNumber(body.credits, 0);
    payload.courseIds = courseIds;
    const termValue = normalizeNumber(body.term, 0);
    if (termValue >= 1 && termValue <= 12) {
      payload.term = termValue;
    } else if (body.term === undefined || body.term === null || body.term === '') {
      payload.term = 1;
    } else {
      const error = new Error('Subject term must be between 1 and 12');
      error.statusCode = 400;
      throw error;
    }
    return payload;
  }

  if (resource === 'enrollments') {
    const [student, section, academicSession] = await Promise.all([
      ensureResourceExists(User, body.student, 'Student user'),
      ensureResourceExists(Section, body.section, 'Section'),
      ensureResourceExists(AcademicSession, resolveAcademicSessionId(body) || body.academicSession, 'Academic Session'),
    ]);

    if (normalizeRole(student.role) !== 'student') {
      const error = new Error('Only student users can be enrolled into sections');
      error.statusCode = 400;
      throw error;
    }
    if (String(student.status || '').trim().toLowerCase() !== 'approved') {
      const error = new Error('Only approved student accounts can be enrolled into sections');
      error.statusCode = 400;
      throw error;
    }
    if (String(section.academicSession) !== String(academicSession._id)) {
      const error = new Error('Enrollment academic session must match the selected section academic session');
      error.statusCode = 400;
      throw error;
    }

    payload.student = student._id;
    payload.section = section._id;
    payload.academicSession = academicSession._id;
    payload.semester = normalizeString(body.semester);
    const termValue = normalizeNumber(body.term, 0);
    if (termValue >= 1 && termValue <= 12) {
      payload.term = termValue;
    }
    payload.status = normalizeString(body.status) || 'active';
    return payload;
  }

  return payload;
};

const modelMap = {
  colleges: College,
  departments: Department,
  programs: Program,
  courses: Course,
  years: AcademicSession,
  'academic-sessions': AcademicSession,
  sections: Section,
  subjects: Subject,
  enrollments: Enrollment,
};

const populateMap = {
  departments: 'college',
  programs: 'department',
  courses: 'program department',
  years: 'program',
  'academic-sessions': 'program',
  sections: 'program course academicSession department advisorFaculty',
  subjects: 'department program course academicSession',
  enrollments: [
    { path: 'student', select: 'systemId name email role department section status isActive emailVerified passwordNeedsSetup expiryDate' },
    {
      path: 'section',
      populate: [
        { path: 'program', select: 'name code department' },
        { path: 'course', select: 'name code' },
        { path: 'academicSession', select: 'label yearNumber' },
        { path: 'department', select: 'name code college' },
      ],
    },
    { path: 'academicSession', select: 'label yearNumber' },
  ],
};

const getModel = (resource) => modelMap[resource];
const SCOPED_ADMIN_TIERS = ['college_admin', 'department_admin', 'program_coordinator', 'section_moderator'];

const buildOrgUnitPayload = async (body = {}) => {
  const payload = {
    name: normalizeString(body.name),
    code: normalizeCode(body.code),
    type: normalizeString(body.type) === 'academic' ? 'academic' : 'operational',
    description: normalizeString(body.description),
    collegeId: body.collegeId || null,
    linkedDepartmentId: body.linkedDepartmentId || null,
    isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
  };

  if (!payload.name) {
    const error = new Error('Organization unit name is required');
    error.statusCode = 400;
    throw error;
  }

  if (!payload.code) {
    payload.code = payload.name.slice(0, 4).toUpperCase();
  }

  if (payload.linkedDepartmentId) {
    const linkedDepartment = await ensureResourceExists(Department, payload.linkedDepartmentId, 'Linked department');
    payload.collegeId = linkedDepartment.college || payload.collegeId || null;
  }

  if (payload.collegeId) {
    await ensureResourceExists(College, payload.collegeId, 'College');
  }

  return payload;
};

const getOrganizationWorkspacePayload = async () => {
  const units = await OrgUnit.find({ isActive: true })
    .sort({ type: 1, name: 1 })
    .populate('collegeId', 'name code')
    .populate({
      path: 'linkedDepartmentId',
      select: 'name code college',
      populate: { path: 'college', select: 'name code' },
    })
    .lean();

  const users = await User.find({
    isActive: true,
    role: { $in: ['faculty', 'staff', 'admin'] },
  })
    .select('name email systemId role adminTier status department departmentId orgUnitId')
    .populate('departmentId', 'name code college')
    .lean();

  const unitsWithMembers = units.map((unit) => {
    const linkedDepartmentId = String(unit.linkedDepartmentId?._id || unit.linkedDepartmentId || '');
    const directMembers = users.filter((member) => String(member.orgUnitId || '') === String(unit._id));
    const inferredAcademicMembers = unit.type === 'academic'
      ? users.filter((member) => (
        !member.orgUnitId
        && member.role === 'faculty'
        && linkedDepartmentId
        && String(member.departmentId?._id || member.departmentId || '') === linkedDepartmentId
      ))
      : [];

    const mergedMembers = [...directMembers];
    inferredAcademicMembers.forEach((member) => {
      if (!mergedMembers.some((entry) => String(entry._id) === String(member._id))) {
        mergedMembers.push({ ...member, inferredOrgUnit: true });
      }
    });

    const byRole = {
      faculty: mergedMembers.filter((member) => member.role === 'faculty'),
      staff: mergedMembers.filter((member) => member.role === 'staff'),
      admin: mergedMembers.filter((member) => member.role === 'admin'),
    };

    return {
      ...unit,
      membersByRole: byRole,
      memberCounts: {
        faculty: byRole.faculty.length,
        staff: byRole.staff.length,
        admin: byRole.admin.length,
        total: mergedMembers.length,
      },
    };
  });

  const summary = unitsWithMembers.reduce((accumulator, unit) => {
    accumulator.total += 1;
    accumulator[unit.type] += 1;
    accumulator.faculty += unit.memberCounts.faculty;
    accumulator.staff += unit.memberCounts.staff;
    accumulator.admin += unit.memberCounts.admin;
    return accumulator;
  }, {
    total: 0,
    academic: 0,
    operational: 0,
    faculty: 0,
    staff: 0,
    admin: 0,
  });

  return {
    summary,
    units: unitsWithMembers,
  };
};

const countDocumentsForScope = async (Model, scope = {}, extra = {}) => (
  Model.countDocuments({ ...scope, ...extra })
);

const getWorkspaceCollections = async (user) => {
  const [
    treeData,
    summaryPayload,
    collegeScope,
    departmentScope,
    programScope,
    courseScope,
    academicSessionScope,
    sectionScope,
    subjectScope,
    enrollmentScope,
  ] = await Promise.all([
    buildStructureTree(user),
    (async () => {
      const [collegeScopeValue, departmentScopeValue, programScopeValue, courseScopeValue, academicSessionScopeValue, sectionScopeValue, subjectScopeValue, enrollmentScopeValue] = await Promise.all([
        getScopeFilter(user, 'colleges'),
        getScopeFilter(user, 'departments'),
        getScopeFilter(user, 'programs'),
        getScopeFilter(user, 'courses'),
        getScopeFilter(user, 'academic-sessions'),
        getScopeFilter(user, 'sections'),
        getScopeFilter(user, 'subjects'),
        getScopeFilter(user, 'enrollments'),
      ]);

      const [
        colleges,
        departments,
        programs,
        courses,
        academicSessions,
        sections,
        subjects,
        activeEnrollments,
      ] = await Promise.all([
        countDocumentsForScope(College, collegeScopeValue, { isActive: true }),
        countDocumentsForScope(Department, departmentScopeValue, { isActive: true }),
        countDocumentsForScope(Program, programScopeValue, { isActive: true }),
        countDocumentsForScope(Course, courseScopeValue, { isActive: true }),
        countDocumentsForScope(AcademicSession, academicSessionScopeValue, { isActive: true }),
        countDocumentsForScope(Section, sectionScopeValue, { isActive: true }),
        countDocumentsForScope(Subject, subjectScopeValue, { isActive: true }),
        Enrollment.distinct('student', { ...enrollmentScopeValue, status: 'active' }).then((rows) => rows.length),
      ]);

      return {
        summary: {
          colleges,
          departments,
          programs,
          courses,
          academicSessions,
          sections,
          subjects,
          students: activeEnrollments,
        },
      };
    })(),
    getScopeFilter(user, 'colleges'),
    getScopeFilter(user, 'departments'),
    getScopeFilter(user, 'programs'),
    getScopeFilter(user, 'courses'),
    getScopeFilter(user, 'academic-sessions'),
    getScopeFilter(user, 'sections'),
    getScopeFilter(user, 'subjects'),
    getScopeFilter(user, 'enrollments'),
  ]);

  const scopedSubjectIds = await Subject.find({ isActive: true, ...subjectScope }).distinct('_id');
  const scopedSectionIds = await Section.find({ isActive: true, ...sectionScope }).distinct('_id');

  const [colleges, departments, programs, courses, academicSessions, sections, subjects, courseSubjects, subjectTeachers, subjectSectionTeachers, enrollments, faculty, students] = await Promise.all([
    College.find({ isActive: true, ...collegeScope }).sort({ name: 1 }).lean(),
    Department.find({ isActive: true, ...departmentScope }).sort({ name: 1 }).populate('college', 'name code').lean(),
    Program.find({ isActive: true, ...programScope }).sort({ name: 1 }).populate('department', 'name code college').lean(),
    Course.find({ isActive: true, ...courseScope }).sort({ name: 1 }).populate('program department', 'name code').lean(),
    AcademicSession.find({ isActive: true, ...academicSessionScope }).sort({ yearNumber: 1, label: 1 }).populate('program', 'name code department').lean(),
    Section.find({ isActive: true, ...sectionScope })
      .sort({ studyYear: 1, name: 1 })
      .populate('department', 'name code college')
      .populate('program', 'name code department')
      .populate('course', 'name code')
      .populate('academicSession', 'label yearNumber')
      .lean(),
    buildSubjectCatalog({ subjectQuery: { _id: { $in: scopedSubjectIds } }, scopedSectionIds }),
    CourseSubject.find({ isActive: true, subject: { $in: scopedSubjectIds } }).populate('course subject').lean(),
    SubjectTeacher.find({ isActive: true, subject: { $in: scopedSubjectIds } }).populate('subject teacher', 'name code email systemId role').lean(),
    SubjectSectionTeacher.find({ isActive: true, subject: { $in: scopedSubjectIds }, section: { $in: scopedSectionIds } })
      .populate('subject', 'name code')
      .populate({
        path: 'section',
        populate: [
          { path: 'program', select: 'name code department' },
          { path: 'course', select: 'name code' },
          { path: 'academicSession', select: 'label yearNumber' },
          { path: 'department', select: 'name code college' },
        ],
      })
      .populate('teacher', 'name email systemId role')
      .lean(),
    Enrollment.find({ ...enrollmentScope }).populate(populateMap.enrollments).lean(),
    User.find({ role: 'faculty', isActive: true }).select('name email systemId role section sectionId department').sort({ name: 1 }).lean(),
    User.find({ role: 'student', isActive: true, status: 'approved' }).select('name email systemId role section sectionId department year status isActive').sort({ name: 1 }).lean(),
  ]);

  const approvedEnrollments = enrollments.filter((entry) => entry?.student?.status === 'approved');

  return {
    treeData,
    summary: summaryPayload.summary,
    options: {
      colleges,
      departments,
      programs,
      courses,
      academicSessions,
      sections,
      subjects,
      courseSubjects,
      subjectTeachers,
      subjectSectionTeachers,
      enrollments: approvedEnrollments,
      faculty,
      students,
    },
  };
};

const ensureScopedMutationAccess = async (user, resource, source = {}) => {
  const effectiveTier = resolveEffectiveTier(user?.role, user?.adminTier);
  if (!SCOPED_ADMIN_TIERS.includes(effectiveTier)) {
    return;
  }

  const ensureScopedParent = async (resourceKey, query) => {
    const scope = await getScopeFilter(user, resourceKey);
    const exists = await getModel(resourceKey).exists({ ...scope, ...query, isActive: { $ne: false } });
    if (!exists) {
      const error = new Error('This action is outside your assigned academic scope');
      error.statusCode = 403;
      throw error;
    }
  };

  if (resource === 'colleges') {
    const error = new Error('Only system-level admins can manage colleges');
    error.statusCode = 403;
    throw error;
  }

  if (resource === 'departments') {
    await ensureScopedParent('colleges', { _id: source.college });
    return;
  }

  if (resource === 'programs') {
    await ensureScopedParent('departments', { _id: source.department });
    return;
  }

  if (resource === 'courses' || resource === 'academic-sessions' || resource === 'years') {
    await ensureScopedParent('programs', { _id: source.program });
    return;
  }

  if (resource === 'sections') {
    await ensureScopedParent('programs', { _id: source.program });
    return;
  }

  if (resource === 'subjects') {
    await ensureScopedParent('programs', { _id: source.program });
    return;
  }

  if (resource === 'enrollments') {
    await ensureScopedParent('sections', { _id: source.section });
  }
};

const cascadeDeleteSections = async (sectionIds = []) => {
  if (!sectionIds.length) return;

  await Promise.all([
    SubjectSectionTeacher.deleteMany({ section: { $in: sectionIds } }),
    Enrollment.deleteMany({ section: { $in: sectionIds } }),
    AttendanceSession.deleteMany({ sectionId: { $in: sectionIds } }),
    User.updateMany(
      { sectionId: { $in: sectionIds } },
      {
        $set: {
          collegeId: null,
          departmentId: null,
          department: '',
          programId: null,
          sectionId: null,
          section: '',
          year: '',
        },
      }
    ),
  ]);
};

const cascadeDeletePrograms = async (programIds = []) => {
  if (!programIds.length) return;

  const [courseIds, academicSessionIds, sectionIds, subjectIds] = await Promise.all([
    Course.find({ program: { $in: programIds } }).distinct('_id'),
    AcademicSession.find({ program: { $in: programIds } }).distinct('_id'),
    Section.find({ program: { $in: programIds } }).distinct('_id'),
    Subject.find({ program: { $in: programIds } }).distinct('_id'),
  ]);

  await cascadeDeleteSections(sectionIds);

  await Promise.all([
    CourseSubject.deleteMany({
      $or: [
        { course: { $in: courseIds } },
        { subject: { $in: subjectIds } },
      ],
    }),
    SubjectTeacher.deleteMany({ subject: { $in: subjectIds } }),
    SubjectSectionTeacher.deleteMany({
      $or: [
        { section: { $in: sectionIds } },
        { subject: { $in: subjectIds } },
      ],
    }),
    Enrollment.deleteMany({
      $or: [
        { section: { $in: sectionIds } },
        { academicSession: { $in: academicSessionIds } },
      ],
    }),
    AttendanceSession.deleteMany({
      $or: [
        { sectionId: { $in: sectionIds } },
        { subjectId: { $in: subjectIds } },
      ],
    }),
    Subject.deleteMany({ program: { $in: programIds } }),
    Section.deleteMany({ program: { $in: programIds } }),
    Course.deleteMany({ program: { $in: programIds } }),
    AcademicSession.deleteMany({ program: { $in: programIds } }),
    User.updateMany(
      {
        $or: [
          { programId: { $in: programIds } },
          { sectionId: { $in: sectionIds } },
        ],
      },
      {
        $set: {
          programId: null,
          sectionId: null,
          section: '',
          year: '',
        },
      }
    ),
  ]);
};

const deactivateOtherActiveEnrollments = async (payload, excludeId = null) => {
  if (!payload?.student || payload.status !== 'active') return;

  const query = {
    student: payload.student,
    status: 'active',
  };
  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  await Enrollment.updateMany(query, { $set: { status: 'inactive' } });
};

const buildStudentAcademicFields = (section) => ({
  collegeId: section?.department?.college?._id || section?.department?.college || null,
  departmentId: section?.department?._id || section?.department || null,
  department: section?.department?.name || '',
  programId: section?.program?._id || section?.program || null,
  sectionId: section?._id || null,
  section: section?.name || '',
  year: section?.academicSession?.yearNumber ? String(section.academicSession.yearNumber) : '',
});

const clearStudentAcademicFields = {
  collegeId: null,
  departmentId: null,
  department: '',
  programId: null,
  sectionId: null,
  section: '',
  year: '',
};

const syncStudentPlacementFromEnrollment = async (studentId, enrollment) => {
  if (!studentId) return;

  if (!enrollment?.section) {
    await User.findByIdAndUpdate(studentId, clearStudentAcademicFields);
    return;
  }

  const section = await Section.findById(enrollment.section)
    .populate('department', 'name code college')
    .populate('program', 'name code department')
    .populate('academicSession', 'label yearNumber')
    .lean();

  await User.findByIdAndUpdate(studentId, buildStudentAcademicFields(section));
};

const syncActiveEnrollmentPlacementForStudent = async (studentId, excludeEnrollmentId = null) => {
  if (!studentId) return;

  const query = { student: studentId, status: 'active' };
  if (excludeEnrollmentId) {
    query._id = { $ne: excludeEnrollmentId };
  }

  const activeEnrollment = await Enrollment.findOne(query).sort({ updatedAt: -1, createdAt: -1 }).lean();
  await syncStudentPlacementFromEnrollment(studentId, activeEnrollment);
};

const syncStudentsForSection = async (sectionId) => {
  if (!sectionId) return;

  const activeEnrollments = await Enrollment.find({ section: sectionId, status: 'active' }).select('student').lean();
  if (!activeEnrollments.length) return;

  const section = await Section.findById(sectionId)
    .populate('department', 'name code college')
    .populate('program', 'name code department')
    .populate('academicSession', 'label yearNumber')
    .lean();

  if (!section) return;

  const studentIds = [...new Set(activeEnrollments.map((entry) => String(entry.student)).filter(Boolean))];
  if (!studentIds.length) return;

  await User.updateMany(
    { _id: { $in: studentIds } },
    buildStudentAcademicFields(section)
  );
};

const syncStudentsForSectionQuery = async (query = {}) => {
  const sectionIds = await Section.find(query).distinct('_id');
  await Promise.all(sectionIds.map((sectionId) => syncStudentsForSection(sectionId)));
};

exports.getProgramReport = async (req, res, next) => {
  try {
    const programs = await Program.find({ isActive: true })
      .populate('department', 'name code')
      .sort({ createdAt: -1 })
      .lean();

    const programIds = programs.map((program) => program._id);
    const [coursesByProgram, subjectsByCourse, sectionsByProgram, enrollmentsBySection] = await Promise.all([
      Course.aggregate([
        { $match: { program: { $in: programIds }, isActive: true } },
        { $group: { _id: '$program', courseIds: { $addToSet: '$_id' }, courseCount: { $sum: 1 } } },
      ]),
      CourseSubject.aggregate([
        { $match: { isActive: true } },
        {
          $lookup: {
            from: 'courses',
            localField: 'course',
            foreignField: '_id',
            as: 'course',
          },
        },
        { $unwind: '$course' },
        { $match: { 'course.program': { $in: programIds }, 'course.isActive': true } },
        { $group: { _id: '$course._id', subjectCount: { $sum: 1 } } },
      ]),
      Section.aggregate([
        { $match: { program: { $in: programIds }, isActive: true } },
        { $group: { _id: '$program', sectionIds: { $addToSet: '$_id' }, sectionCount: { $sum: 1 } } },
      ]),
      Enrollment.aggregate([
        { $match: { status: 'active' } },
        { $group: { _id: '$section', activeStudents: { $sum: 1 } } },
      ]),
    ]);

    const courseMap = new Map(coursesByProgram.map((entry) => [String(entry._id), entry]));
    const subjectMap = new Map(subjectsByCourse.map((entry) => [String(entry._id), entry.subjectCount]));
    const enrollmentMap = new Map(enrollmentsBySection.map((entry) => [String(entry._id), entry.activeStudents]));

    const data = programs.map((program) => {
      const sectionEntry = sectionsByProgram.find((entry) => String(entry._id) === String(program._id));
      const courseEntry = courseMap.get(String(program._id));
      const enrolledStudents = (sectionEntry?.sectionIds || []).reduce(
        (total, sectionId) => total + (enrollmentMap.get(String(sectionId)) || 0),
        0
      );
      const subjectCount = (courseEntry?.courseIds || []).reduce((total, courseId) => total + (subjectMap.get(String(courseId)) || 0), 0);

      return {
        ...program,
        subjectCount,
        courseCount: courseEntry?.courseCount || 0,
        sectionCount: sectionEntry?.sectionCount || 0,
        enrolledStudents,
      };
    });

    res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    next(error);
  }
};

exports.getStructureTree = async (req, res, next) => {
  try {
    const data = await buildStructureTree(req.user);
    res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    next(error);
  }
};

exports.getWorkspaceSummary = async (req, res, next) => {
  try {
    const [collegeScope, departmentScope, programScope, courseScope, academicSessionScope, sectionScope, subjectScope, enrollmentScope] = await Promise.all([
      getScopeFilter(req.user, 'colleges'),
      getScopeFilter(req.user, 'departments'),
      getScopeFilter(req.user, 'programs'),
      getScopeFilter(req.user, 'courses'),
      getScopeFilter(req.user, 'academic-sessions'),
      getScopeFilter(req.user, 'sections'),
      getScopeFilter(req.user, 'subjects'),
      getScopeFilter(req.user, 'enrollments'),
    ]);

    const [
      colleges,
      departments,
      programs,
      courses,
      academicSessions,
      sections,
      subjects,
      activeEnrollments,
    ] = await Promise.all([
      countDocumentsForScope(College, collegeScope, { isActive: true }),
      countDocumentsForScope(Department, departmentScope, { isActive: true }),
      countDocumentsForScope(Program, programScope, { isActive: true }),
      countDocumentsForScope(Course, courseScope, { isActive: true }),
      countDocumentsForScope(AcademicSession, academicSessionScope, { isActive: true }),
      countDocumentsForScope(Section, sectionScope, { isActive: true }),
      countDocumentsForScope(Subject, subjectScope, { isActive: true }),
      Enrollment.distinct('student', { ...enrollmentScope, status: 'active' }).then((rows) => rows.length),
    ]);

    res.status(200).json({
      success: true,
      data: {
        colleges,
        departments,
        programs,
        courses,
        academicSessions,
        sections,
        subjects,
        students: activeEnrollments,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.getWorkspaceData = async (req, res, next) => {
  try {
    const data = await getWorkspaceCollections(req.user);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

exports.getOrganizationWorkspace = async (req, res, next) => {
  try {
    const data = await getOrganizationWorkspacePayload();
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

exports.createOrgUnit = async (req, res, next) => {
  try {
    const payload = await buildOrgUnitPayload(req.body);
    const orgUnit = await OrgUnit.create(payload);
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

    const payload = await buildOrgUnitPayload({ ...existing.toObject(), ...req.body });
    Object.assign(existing, payload);
    await existing.save();

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

    res.status(200).json({ success: true, message: 'Organization unit archived successfully' });
  } catch (error) {
    next(error);
  }
};

exports.getSubjectManagementWorkspace = async (req, res, next) => {
  try {
    const data = await getWorkspaceCollections(req.user);
    res.status(200).json({
      success: true,
      data: {
        subjects: data.options.subjects || [],
        courses: data.options.courses || [],
        sections: data.options.sections || [],
        faculty: data.options.faculty || [],
        courseSubjects: data.options.courseSubjects || [],
        subjectTeachers: data.options.subjectTeachers || [],
        subjectSectionTeachers: data.options.subjectSectionTeachers || [],
        departments: data.options.departments || [],
        programs: data.options.programs || [],
        academicSessions: data.options.academicSessions || [],
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.getSubjectRecord = async (req, res, next) => {
  try {
    const detail = await getSubjectDetail(req.params.id);
    if (!detail) {
      return res.status(404).json({ success: false, message: 'Subject not found' });
    }

    const subjectScope = await getScopeFilter(req.user, 'subjects');
    const scopedSubject = await Subject.findOne({ _id: detail._id, isActive: true, ...subjectScope }).select('_id').lean();
    if (!scopedSubject) {
      return res.status(403).json({ success: false, message: 'This subject is outside your assigned academic scope' });
    }

    res.status(200).json({ success: true, data: detail });
  } catch (error) {
    next(error);
  }
};

exports.linkCourseToSubject = async (req, res, next) => {
  try {
    const subject = await Subject.findById(req.body?.subjectId || req.params.id);
    if (!subject) {
      return res.status(404).json({ success: false, message: 'Subject not found' });
    }

    await ensureScopedMutationAccess(req.user, 'subjects', subject);

    const existingCourseIds = await CourseSubject.find({ subject: subject._id, isActive: true }).distinct('course');
    const nextCourseIds = normalizeObjectIdList([
      ...(Array.isArray(req.body?.courseIds) ? req.body.courseIds : []),
      req.body?.courseId,
      ...existingCourseIds,
    ]);
    await syncCourseSubjectMappings(subject, nextCourseIds);
    await syncTeachingAssignmentsForSubject(subject._id);

    const data = await getSubjectDetail(subject._id);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

exports.unlinkCourseFromSubject = async (req, res, next) => {
  try {
    const subject = await Subject.findById(req.params.id);
    if (!subject) {
      return res.status(404).json({ success: false, message: 'Subject not found' });
    }

    await ensureScopedMutationAccess(req.user, 'subjects', subject);

    await CourseSubject.findOneAndUpdate(
      { subject: subject._id, course: req.params.courseId },
      { $set: { isActive: false } }
    );
    await syncTeachingAssignmentsForSubject(subject._id);

    const data = await getSubjectDetail(subject._id);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

exports.updateSubjectTeachers = async (req, res, next) => {
  try {
    const subject = await Subject.findById(req.params.id);
    if (!subject) {
      return res.status(404).json({ success: false, message: 'Subject not found' });
    }

    await ensureScopedMutationAccess(req.user, 'subjects', subject);
    await syncSubjectTeacherMappings(subject._id, req.body?.teacherIds || req.body?.teachers || []);
    await syncTeachingAssignmentsForSubject(subject._id);

    const data = await getSubjectDetail(subject._id);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

exports.updateSubjectSectionTeachers = async (req, res, next) => {
  try {
    const [subject, section] = await Promise.all([
      Subject.findById(req.params.id).lean(),
      Section.findById(req.params.sectionId).lean(),
    ]);

    if (!subject) {
      return res.status(404).json({ success: false, message: 'Subject not found' });
    }
    if (!section) {
      return res.status(404).json({ success: false, message: 'Section not found' });
    }

    if (String(subject.program) !== String(section.program)) {
      return res.status(400).json({ success: false, message: 'Subject and section must belong to the same program' });
    }

    const subjectIdsForSection = await getSubjectIdsForSection(section._id);
    if (!subjectIdsForSection.includes(String(subject._id))) {
      return res.status(400).json({ success: false, message: 'This section does not inherit the selected subject from its course' });
    }

    await ensureScopedMutationAccess(req.user, 'sections', section);
    await syncSubjectSectionTeacherMappings(subject._id, section._id, req.body?.teacherIds || req.body?.teachers || []);
    await syncTeachingAssignmentsForSubjectSection(subject._id, section._id);

    const data = await getSubjectDetail(subject._id);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

exports.getWorkspaceOptions = async (req, res, next) => {
  try {
    const data = await getWorkspaceCollections(req.user);
    res.status(200).json({
      success: true,
      data: {
        colleges: data.options.colleges,
        departments: data.options.departments,
        programs: data.options.programs,
        courses: data.options.courses,
        academicSessions: data.options.academicSessions,
        sections: data.options.sections,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.quickSetup = async (req, res, next) => {
  try {
    const payload = req.body || {};
    const years = Array.isArray(payload.years) ? payload.years : [];
    if (!payload.collegeId || !payload.department || !payload.program || !payload.course || !(payload.academicSession || payload.academicYear) || !years.length) {
      return res.status(400).json({
        success: false,
        message: 'College, department, program, course, academic session, and study years are required',
      });
    }

    const result = await runQuickAcademicSetup({
      collegeId: payload.collegeId,
      department: payload.department,
      departmentCode: payload.departmentCode,
      program: payload.program,
      programCode: payload.programCode,
      course: payload.course,
      courseCode: payload.courseCode,
      academicSession: payload.academicSession || payload.academicYear,
      years,
      sectionsPerYear: payload.sectionsPerYear || {},
      capacity: payload.capacity,
    });

    res.status(201).json({
      success: true,
      message: 'Academic structure created successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

exports.getEnrollmentReport = async (req, res, next) => {
  try {
    const status = req.query.status || 'active';
    const query = {};
    if (status) query.status = status;
    if (req.query.program) query.program = req.query.program;
    if (req.query.section) query.section = req.query.section;
    if (req.query.student) query.student = req.query.student;

    const enrollments = await Enrollment.find(query)
      .populate('student', 'systemId name email role department section')
      .populate({
        path: 'section',
        populate: [
          { path: 'program', select: 'name code department' },
          { path: 'course', select: 'name code' },
          { path: 'academicSession', select: 'label yearNumber' },
          { path: 'department', select: 'name code' },
        ],
      })
      .populate('academicSession', 'label yearNumber')
      .sort({ createdAt: -1 })
      .lean();

    const sectionIds = [...new Set(enrollments.map((entry) => entry.section?._id).filter(Boolean).map(String))];
    const sections = await Section.find({ _id: { $in: sectionIds } }).select('course').lean();
    const courseIds = [...new Set(sections.map((section) => String(section.course || '')).filter(Boolean))];
    const courseSubjectRows = await CourseSubject.aggregate([
      { $match: { course: { $in: courseIds.map((id) => new mongoose.Types.ObjectId(id)) }, isActive: true } },
      { $group: { _id: '$course', subjectCount: { $sum: 1 } } },
    ]);
    const courseSubjectCountMap = new Map(courseSubjectRows.map((entry) => [String(entry._id), entry.subjectCount]));
    const sectionCourseMap = new Map(sections.map((section) => [String(section._id), String(section.course || '')]));

    const data = enrollments.map((entry) => ({
      ...entry,
      subjectCount: courseSubjectCountMap.get(sectionCourseMap.get(String(entry.section?._id))) || 0,
    }));

    res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    next(error);
  }
};

exports.getStudentAcademicOverview = async (req, res, next) => {
  try {
    const studentId = req.params.studentId || req.user.id;
    const requesterRole = normalizeRole(req.user.role);

    // Viewing another student's data requires canManageAcademics permission (checked by route middleware)
    // Additionally enforce role-based access: other roles cannot bypass role restrictions
    if (req.params.studentId && req.params.studentId !== String(req.user.id) && !['faculty', 'staff', 'admin'].includes(requesterRole)) {
      return res.status(403).json({ success: false, message: 'You are not allowed to view this student overview' });
    }

    // For academic admins viewing other students, enforce assignment-based scope
    if (req.params.studentId && req.params.studentId !== String(req.user.id)) {
      const scope = await getScopeFilter(req.user, 'sections');
      if (Object.keys(scope).length) {
        const activeEnrollment = await Enrollment.findOne({ student: studentId, status: 'active' }).select('section').lean();
        const allowedSection = activeEnrollment?.section
          ? await Section.exists({ ...scope, _id: activeEnrollment.section })
          : false;
        if (!allowedSection) {
          return res.status(403).json({ success: false, message: 'This student is outside your assigned academic scope' });
        }
      }
    }

    const enrollment = await Enrollment.findOne({ student: studentId, status: 'active' })
      .populate({
        path: 'section',
        populate: [
          { path: 'program', select: 'name code department' },
          { path: 'course', select: 'name code' },
          { path: 'academicSession', select: 'label yearNumber' },
          { path: 'department', select: 'name code' },
        ],
      })
      .populate('student', 'systemId name email department section')
      .lean();

    if (!enrollment?.section?._id) {
      return res.status(404).json({ success: false, message: 'No active enrollment found for this student' });
    }

    const sectionId = enrollment.section._id;

    const [subjectIds, attendanceRows] = await Promise.all([
      getSubjectIdsForSection(sectionId),
      AttendanceSession.aggregate([
        { $match: { sectionId, 'records.student': enrollment.student._id } },
        { $unwind: '$records' },
        { $match: { 'records.student': enrollment.student._id } },
        {
          $group: {
            _id: '$subjectId',
            totalSessions: { $sum: 1 },
            attendedSessions: {
              $sum: {
                $cond: [{ $eq: ['$records.status', 'present'] }, 1, 0],
              },
            },
            lastMarkedAt: { $max: '$date' },
          },
        },
      ]),
    ]);

    const subjects = await buildSubjectCatalog({
      subjectQuery: { _id: { $in: subjectIds } },
      scopedSectionIds: [sectionId],
    });

    const attendanceMap = new Map(
      attendanceRows.map((entry) => [
        String(entry._id || 'general'),
        {
          totalSessions: entry.totalSessions,
          attendedSessions: entry.attendedSessions,
          percentage: entry.totalSessions ? Number(((entry.attendedSessions / entry.totalSessions) * 100).toFixed(2)) : 0,
          lastMarkedAt: entry.lastMarkedAt,
        },
      ])
    );

    const data = {
      enrollment,
      subjects: subjects.map((entry) => {
        const sectionTeachers = (entry.sectionTeachers || [])
          .filter((mapping) => String(mapping.section?._id || mapping.section) === String(sectionId))
          .map((mapping) => mapping.teacher)
          .filter(Boolean);
        const assignedTeachers = sectionTeachers.length ? sectionTeachers : (entry.teachers || []);

        return {
          id: entry._id,
          code: entry.code,
          name: entry.name,
          credits: entry.credits,
          semester: enrollment.semester,
          facultyMembers: assignedTeachers.map((teacher) => ({
            id: teacher._id,
            systemId: teacher.systemId,
            name: teacher.name,
            email: teacher.email,
          })),
          faculty: assignedTeachers[0]
            ? {
                id: assignedTeachers[0]._id,
                systemId: assignedTeachers[0].systemId,
                name: assignedTeachers[0].name,
                email: assignedTeachers[0].email,
              }
            : null,
          attendance: attendanceMap.get(String(entry._id)) || {
          totalSessions: 0,
          attendedSessions: 0,
          percentage: 0,
          lastMarkedAt: null,
          },
        };
      }),
    };

    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

exports.list = async (req, res, next) => {
  try {
    const model = getModel(req.params.resource);
    if (!model) return res.status(404).json({ success: false, message: 'Academic resource not found' });

    const query = {};
    Object.assign(query, await getScopeFilter(req.user, req.params.resource));
    if (req.query.department) query.department = req.query.department;
    if (req.query.program) query.program = req.query.program;
    if (req.query.academicSession || req.query.academicYear) query.academicSession = req.query.academicSession || req.query.academicYear;
    if (req.query.section) query.section = req.query.section;
    if (req.query.student) query.student = req.query.student;
    if (req.query.subject) query.subject = req.query.subject;
    if (req.query.faculty) query.faculty = req.query.faculty;
    if (req.query.status) query.status = req.query.status;
    if (req.params.resource === 'subjects' && req.query.course) {
      const subjectIds = await CourseSubject.find({ course: req.query.course, isActive: true }).distinct('subject');
      query._id = { $in: subjectIds };
    }

    let cursor = model.find(query).sort({ createdAt: -1 });
    if (populateMap[req.params.resource]) {
      cursor = cursor.populate(populateMap[req.params.resource]);
    }
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 250, 1), 500);
    if (req.query.paginate !== 'false') {
      cursor = cursor.skip((page - 1) * limit).limit(limit);
    }
    const [data, total] = await Promise.all([
      cursor.lean(),
      model.countDocuments(query),
    ]);
    res.status(200).json({
      success: true,
      count: data.length,
      total,
      page,
      limit: req.query.paginate === 'false' ? total : limit,
      data,
    });
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const model = getModel(req.params.resource);
    if (!model) return res.status(404).json({ success: false, message: 'Academic resource not found' });

    const payload = await buildAcademicPayload(req.params.resource, req.body);
    await ensureScopedMutationAccess(req.user, req.params.resource, payload);

    if (req.params.resource === 'enrollments') {
      await deactivateOtherActiveEnrollments(payload);

      if (payload.section) {
        await syncStudentPlacementFromEnrollment(payload.student, payload.status === 'active' ? { section: payload.section } : null);
      }
    }

    const createPayload = { ...payload };
    delete createPayload.courseIds;

    const doc = await model.create(createPayload);
    if (req.params.resource === 'subjects') {
      await syncCourseSubjectMappings(doc, payload.courseIds || []);
      await syncTeachingAssignmentsForSubject(doc._id);
    }
    if (req.params.resource === 'sections') {
      await syncStudentsForSection(doc._id);
      await syncTeachingAssignmentsForSection(doc._id);
    }
    const data = populateMap[req.params.resource]
      ? await model.findById(doc._id).populate(populateMap[req.params.resource]).lean()
      : doc;

    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const model = getModel(req.params.resource);
    if (!model) return res.status(404).json({ success: false, message: 'Academic resource not found' });

    const existingDoc = await model.findById(req.params.id).lean();
    if (!existingDoc) return res.status(404).json({ success: false, message: 'Academic record not found' });

    const payload = await buildAcademicPayload(req.params.resource, req.body);
    await ensureScopedMutationAccess(req.user, req.params.resource, {
      ...existingDoc,
      ...payload,
    });
    const updatePayload = { ...payload };
    delete updatePayload.courseIds;

    const doc = await model.findByIdAndUpdate(req.params.id, updatePayload, { new: true, runValidators: true });
    if (req.params.resource === 'subjects') {
      await syncCourseSubjectMappings(doc, payload.courseIds || []);
      await syncTeachingAssignmentsForSubject(doc._id);
    }

    if (req.params.resource === 'enrollments' && payload.section && payload.student) {
      await deactivateOtherActiveEnrollments(payload, req.params.id);
      if (payload.status === 'active') {
        await syncStudentPlacementFromEnrollment(payload.student, { section: payload.section });
      } else {
        await syncActiveEnrollmentPlacementForStudent(payload.student, req.params.id);
      }

      const studentChanged = String(existingDoc.student) !== String(payload.student);
      const previouslyActive = existingDoc.status === 'active';
      if (previouslyActive && studentChanged) {
        await syncActiveEnrollmentPlacementForStudent(existingDoc.student, req.params.id);
      }
    }

    if (req.params.resource === 'sections') {
      await syncStudentsForSection(doc._id);
      await syncTeachingAssignmentsForSection(doc._id);
    }
    if (req.params.resource === 'departments') {
      await syncStudentsForSectionQuery({ department: doc._id });
    }
    if (req.params.resource === 'academic-sessions' || req.params.resource === 'years') {
      await syncStudentsForSectionQuery({ academicSession: doc._id });
    }

    const data = populateMap[req.params.resource]
      ? await model.findById(doc._id).populate(populateMap[req.params.resource]).lean()
      : doc;

    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const model = getModel(req.params.resource);
    if (!model) return res.status(404).json({ success: false, message: 'Academic resource not found' });

    const existingDoc = await model.findById(req.params.id).lean();
    if (!existingDoc) return res.status(404).json({ success: false, message: 'Academic record not found' });

    await ensureScopedMutationAccess(req.user, req.params.resource, existingDoc);

    if (req.params.resource === 'colleges') {
      const departmentIds = await Department.find({ college: req.params.id }).distinct('_id');
      const programIds = await Program.find({ department: { $in: departmentIds } }).distinct('_id');

      await cascadeDeletePrograms(programIds);
      await Promise.all([
        Department.deleteMany({ college: req.params.id }),
        Program.deleteMany({ _id: { $in: programIds } }),
      ]);
    }

    if (req.params.resource === 'departments') {
      const programIds = await Program.find({ department: req.params.id }).distinct('_id');
      await cascadeDeletePrograms(programIds);
      await Promise.all([
        Program.deleteMany({ department: req.params.id }),
        User.updateMany(
          { departmentId: req.params.id },
          {
            $set: {
              departmentId: null,
              department: '',
              programId: null,
              sectionId: null,
              section: '',
              year: '',
            },
          }
        ),
      ]);
    }

    if (req.params.resource === 'programs') {
      await cascadeDeletePrograms([existingDoc._id]);
    }

    if (req.params.resource === 'courses') {
      const sectionIds = await Section.find({ course: req.params.id }).distinct('_id');
      const subjectIds = await CourseSubject.find({ course: req.params.id, isActive: true }).distinct('subject');
      await cascadeDeleteSections(sectionIds);
      await Promise.all([
        CourseSubject.deleteMany({ course: req.params.id }),
        SubjectSectionTeacher.deleteMany({ section: { $in: sectionIds } }),
        TeachingAssignment.deleteMany({
          $or: [
            { section: { $in: sectionIds } },
            { subject: { $in: subjectIds } },
          ],
        }),
        AttendanceSession.deleteMany({
          $or: [
            { sectionId: { $in: sectionIds } },
            { subjectId: { $in: subjectIds } },
          ],
        }),
        Section.deleteMany({ course: req.params.id }),
      ]);
    }

    if (req.params.resource === 'academic-sessions' || req.params.resource === 'years') {
      const sectionIds = await Section.find({ academicSession: req.params.id }).distinct('_id');
      const subjectIds = await Subject.find({ academicSession: req.params.id }).distinct('_id');
      await cascadeDeleteSections(sectionIds);
      await Promise.all([
        CourseSubject.deleteMany({ subject: { $in: subjectIds } }),
        SubjectTeacher.deleteMany({ subject: { $in: subjectIds } }),
        SubjectSectionTeacher.deleteMany({
          $or: [
            { section: { $in: sectionIds } },
            { subject: { $in: subjectIds } },
          ],
        }),
        TeachingAssignment.deleteMany({
          $or: [
            { section: { $in: sectionIds } },
            { subject: { $in: subjectIds } },
          ],
        }),
        AttendanceSession.deleteMany({
          $or: [
            { sectionId: { $in: sectionIds } },
            { subjectId: { $in: subjectIds } },
          ],
        }),
        Subject.deleteMany({ academicSession: req.params.id }),
        Section.deleteMany({ academicSession: req.params.id }),
        Enrollment.deleteMany({ academicSession: req.params.id }),
      ]);
    }

    if (req.params.resource === 'sections') {
      await cascadeDeleteSections([existingDoc._id]);
    }

    if (req.params.resource === 'subjects') {
      await Promise.all([
        CourseSubject.deleteMany({ subject: req.params.id }),
        SubjectTeacher.deleteMany({ subject: req.params.id }),
        SubjectSectionTeacher.deleteMany({ subject: req.params.id }),
        TeachingAssignment.deleteMany({ subject: req.params.id }),
        AttendanceSession.deleteMany({ subjectId: req.params.id }),
      ]);
    }

    if (req.params.resource === 'enrollments' && existingDoc.student) {
      await syncActiveEnrollmentPlacementForStudent(existingDoc.student, existingDoc._id);
    }

    const doc = await model.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Academic record not found' });

    res.status(200).json({ success: true, message: 'Academic record deleted' });
  } catch (error) {
    next(error);
  }
};
