const mongoose = require('mongoose');
const College = require('../models/College');
const Department = require('../models/Department');
const Program = require('../models/Program');
const Course = require('../models/Course');
const AcademicSession = require('../models/AcademicSession');
const Section = require('../models/Section');
const Subject = require('../models/Subject');
const SectionSubject = require('../models/SectionSubject');
const Enrollment = require('../models/Enrollment');
const AttendanceSession = require('../models/AttendanceSession');
const User = require('../models/User');
const { normalizeRole } = require('../utils/roleHelpers');
const { getScopeFilter } = require('../utils/scopeGuard');
const { resolveEffectiveTier } = require('../utils/permissionDefaults');
const { buildStructureTree, runQuickAcademicSetup } = require('../utils/academicSetupService');

const normalizeString = (value) => String(value || '').trim();
const normalizeCode = (value) => normalizeString(value).toUpperCase();
const normalizeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const normalizeObjectIdList = (value) => {
  if (!value) return [];
  const values = Array.isArray(value)
    ? value
    : String(value).split(',').map((item) => item.trim()).filter(Boolean);

  return [...new Set(
    values
      .map((item) => String(item || '').trim())
      .filter((item) => mongoose.Types.ObjectId.isValid(item))
  )];
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
    const [program, course, academicSession, department] = await Promise.all([
      ensureResourceExists(Program, body.program, 'Program'),
      body.course ? ensureResourceExists(Course, body.course, 'Course') : null,
      ensureResourceExists(AcademicSession, resolveAcademicSessionId(body), 'Academic Session'),
      ensureResourceExists(Department, body.department, 'Department'),
    ]);

    if (String(program.department) !== String(department._id)) {
      const error = new Error('Section department must match the selected program department');
      error.statusCode = 400;
      throw error;
    }
    if (course && String(course.program) !== String(program._id)) {
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
    payload.course = course?._id || null;
    payload.academicSession = academicSession._id;
    payload.studyYear = academicSession.yearNumber;
    payload.department = department._id;
    payload.name = normalizeString(body.name);
    payload.capacity = normalizeNumber(body.capacity, 60);
    return payload;
  }

  if (resource === 'subjects') {
    const [department, program, course, academicSession] = await Promise.all([
      ensureResourceExists(Department, body.department, 'Department'),
      ensureResourceExists(Program, body.program, 'Program'),
      body.course ? ensureResourceExists(Course, body.course, 'Course') : null,
      ensureResourceExists(AcademicSession, resolveAcademicSessionId(body), 'Academic Session'),
    ]);

    if (String(program.department) !== String(department._id)) {
      const error = new Error('Subject department must match the selected program department');
      error.statusCode = 400;
      throw error;
    }
    if (course && String(course.program) !== String(program._id)) {
      const error = new Error('Selected course does not belong to the selected program');
      error.statusCode = 400;
      throw error;
    }
    if (String(academicSession.program) !== String(program._id)) {
      const error = new Error('Academic session must belong to the selected program');
      error.statusCode = 400;
      throw error;
    }

    payload.code = normalizeCode(body.code);
    payload.name = normalizeString(body.name);
    payload.department = department._id;
    payload.program = program._id;
    payload.course = course?._id || null;
    payload.academicSession = academicSession._id;
    payload.credits = normalizeNumber(body.credits, 0);
    return payload;
  }

  if (resource === 'section-subjects') {
    const facultyIds = normalizeObjectIdList(body.facultyIds || body.facultyId || body.faculty);
    const [section, subject, facultyDocs] = await Promise.all([
      ensureResourceExists(Section, body.section, 'Section'),
      ensureResourceExists(Subject, body.subject, 'Subject'),
      facultyIds.length ? User.find({ _id: { $in: facultyIds } }).select('role').lean() : [],
    ]);

    if (facultyDocs.length !== facultyIds.length) {
      const error = new Error('One or more faculty users could not be found');
      error.statusCode = 400;
      throw error;
    }
    if (facultyDocs.some((faculty) => normalizeRole(faculty.role) !== 'faculty' && normalizeRole(faculty.role) !== 'admin')) {
      const error = new Error('Selected user cannot be assigned as faculty');
      error.statusCode = 400;
      throw error;
    }
    if (String(subject.program) !== String(section.program)) {
      const error = new Error('Subject program must match the selected section program');
      error.statusCode = 400;
      throw error;
    }
    if (section.course && subject.course && String(subject.course) !== String(section.course)) {
      const error = new Error('Subject course must match the selected section course');
      error.statusCode = 400;
      throw error;
    }
    if (String(subject.academicSession) !== String(section.academicSession)) {
      const error = new Error('Subject academic session must match the selected section academic session');
      error.statusCode = 400;
      throw error;
    }

    payload.section = section._id;
    payload.subject = subject._id;
    payload.faculty = facultyIds[0] || null;
    payload.facultyMembers = facultyIds;
    payload.semester = normalizeString(body.semester);
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
    if (String(section.academicSession) !== String(academicSession._id)) {
      const error = new Error('Enrollment academic session must match the selected section academic session');
      error.statusCode = 400;
      throw error;
    }

    payload.student = student._id;
    payload.section = section._id;
    payload.academicSession = academicSession._id;
    payload.semester = normalizeString(body.semester);
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
  'section-subjects': SectionSubject,
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
  'section-subjects': [
    {
      path: 'section',
      populate: [
        { path: 'program', select: 'name code department' },
        { path: 'course', select: 'name code' },
        { path: 'academicSession', select: 'label yearNumber' },
        { path: 'department', select: 'name code college' },
      ],
    },
    { path: 'subject', populate: [{ path: 'department', select: 'name code' }, { path: 'program', select: 'name code department' }, { path: 'course', select: 'name code' }, { path: 'academicSession', select: 'label yearNumber' }] },
    { path: 'faculty', select: 'name email systemId role' },
    { path: 'facultyMembers', select: 'name email systemId role' },
  ],
  enrollments: [
    { path: 'student', select: 'systemId name email role department section' },
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
    sectionSubjectScope,
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
    getScopeFilter(user, 'section-subjects'),
    getScopeFilter(user, 'enrollments'),
  ]);

  const [colleges, departments, programs, courses, academicSessions, sections, subjects, sectionSubjects, enrollments, faculty, students] = await Promise.all([
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
    Subject.find({ isActive: true, ...subjectScope }).sort({ code: 1 }).populate('department program course academicSession').lean(),
    SectionSubject.find({ isActive: true, ...sectionSubjectScope }).populate(populateMap['section-subjects']).lean(),
    Enrollment.find({ ...enrollmentScope }).populate(populateMap.enrollments).lean(),
    User.find({ role: 'faculty', isActive: true }).select('name email systemId role section sectionId department').sort({ name: 1 }).lean(),
    User.find({ role: 'student', isActive: true }).select('name email systemId role section sectionId department year').sort({ name: 1 }).lean(),
  ]);

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
      'section-subjects': sectionSubjects,
      enrollments,
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

  if (resource === 'section-subjects' || resource === 'enrollments') {
    await ensureScopedParent('sections', { _id: source.section });
  }
};

const cascadeDeleteSections = async (sectionIds = []) => {
  if (!sectionIds.length) return;

  await Promise.all([
    SectionSubject.deleteMany({ section: { $in: sectionIds } }),
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
    SectionSubject.deleteMany({
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
      Subject.aggregate([
        { $match: { program: { $in: programIds }, isActive: true } },
        { $group: { _id: '$course', subjectCount: { $sum: 1 } } },
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
    const sectionObjectIds = sectionIds.map((id) => new mongoose.Types.ObjectId(id));
    const subjectsBySection = await SectionSubject.aggregate([
      { $match: { section: { $in: sectionObjectIds }, isActive: true } },
      { $group: { _id: '$section', subjectCount: { $sum: 1 } } },
    ]);
    const subjectCountMap = new Map(subjectsBySection.map((entry) => [String(entry._id), entry.subjectCount]));

    const data = enrollments.map((entry) => ({
      ...entry,
      subjectCount: subjectCountMap.get(String(entry.section?._id)) || 0,
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

    const [subjects, attendanceRows] = await Promise.all([
      SectionSubject.find({ section: sectionId, isActive: true })
        .populate('subject', 'name code credits')
        .populate('faculty', 'name email')
        .populate('facultyMembers', 'name email systemId')
        .sort({ createdAt: 1 })
        .lean(),
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
      subjects: subjects.map((entry) => ({
        ...entry,
        attendance: attendanceMap.get(String(entry.subject?._id)) || {
          totalSessions: 0,
          attendedSessions: 0,
          percentage: 0,
          lastMarkedAt: null,
        },
      })),
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

    const doc = await model.create(payload);
    if (req.params.resource === 'sections') {
      await syncStudentsForSection(doc._id);
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
    const doc = await model.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });

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
      const subjectIds = await Subject.find({ course: req.params.id }).distinct('_id');
      await cascadeDeleteSections(sectionIds);
      await Promise.all([
        SectionSubject.deleteMany({
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
        Subject.deleteMany({ course: req.params.id }),
        Section.deleteMany({ course: req.params.id }),
      ]);
    }

    if (req.params.resource === 'academic-sessions' || req.params.resource === 'years') {
      const sectionIds = await Section.find({ academicSession: req.params.id }).distinct('_id');
      const subjectIds = await Subject.find({ academicSession: req.params.id }).distinct('_id');
      await cascadeDeleteSections(sectionIds);
      await Promise.all([
        SectionSubject.deleteMany({
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
        SectionSubject.deleteMany({ subject: req.params.id }),
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

exports.updateSectionSubjectFaculty = async (req, res, next) => {
  try {
    const facultyIds = normalizeObjectIdList(req.body?.facultyIds || req.body?.facultyId || []);
    const sectionSubject = await SectionSubject.findById(req.params.id);
    if (!sectionSubject) {
      return res.status(404).json({ success: false, message: 'Teaching assignment not found' });
    }

    if (facultyIds.length) {
      const facultyDocs = await User.find({ _id: { $in: facultyIds } }).select('role').lean();
      if (facultyDocs.length !== facultyIds.length || facultyDocs.some((faculty) => !['faculty', 'admin'].includes(normalizeRole(faculty.role)))) {
        return res.status(400).json({ success: false, message: 'Selected user cannot be assigned as faculty' });
      }
    }
    sectionSubject.faculty = facultyIds[0] || null;
    sectionSubject.facultyMembers = facultyIds;

    await sectionSubject.save();
    const data = await SectionSubject.findById(sectionSubject._id).populate(populateMap['section-subjects']).lean();
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};
