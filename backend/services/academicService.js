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
const { buildStructureTree } = require('../utils/academicSetupService');
const { buildSubjectCatalog, normalizeObjectIdList } = require('../utils/subjectManagement');

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

const SCOPED_ADMIN_TIERS = ['college_admin', 'department_admin', 'program_coordinator', 'section_moderator'];

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

const getModel = (resource) => modelMap[resource];

class AcademicService {
  static async buildAcademicPayload(resource, body = {}) {
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
  }

  static async buildOrgUnitPayload(body = {}) {
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
  }

  static async getOrganizationWorkspacePayload() {
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
  }

  static async getWorkspaceCollections(user) {
    const countDocumentsForScope = async (Model, scope = {}, extra = {}) => (
      Model.countDocuments({ ...scope, ...extra })
    );

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

    const populateMap = {
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
  }

  static async ensureScopedMutationAccess(user, resource, source = {}) {
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
  }

  static async cascadeDeleteSections(sectionIds = []) {
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
  }

  static async cascadeDeletePrograms(programIds = []) {
    if (!programIds.length) return;

    const [courseIds, academicSessionIds, sectionIds, subjectIds] = await Promise.all([
      Course.find({ program: { $in: programIds } }).distinct('_id'),
      AcademicSession.find({ program: { $in: programIds } }).distinct('_id'),
      Section.find({ program: { $in: programIds } }).distinct('_id'),
      Subject.find({ program: { $in: programIds } }).distinct('_id'),
    ]);

    await this.cascadeDeleteSections(sectionIds);

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
  }

  static async deactivateOtherActiveEnrollments(payload, excludeId = null) {
    if (!payload?.student || payload.status !== 'active') return;

    const query = {
      student: payload.student,
      status: 'active',
    };
    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    await Enrollment.updateMany(query, { $set: { status: 'inactive' } });
  }

  static buildStudentAcademicFields(section) {
    return {
      collegeId: section?.department?.college?._id || section?.department?.college || null,
      departmentId: section?.department?._id || section?.department || null,
      department: section?.department?.name || '',
      programId: section?.program?._id || section?.program || null,
      sectionId: section?._id || null,
      section: section?.name || '',
      year: section?.academicSession?.yearNumber ? String(section.academicSession.yearNumber) : '',
    };
  }

  static async syncStudentPlacementFromEnrollment(studentId, enrollment) {
    if (!studentId) return;

    const clearFields = {
      collegeId: null,
      departmentId: null,
      department: '',
      programId: null,
      sectionId: null,
      section: '',
      year: '',
    };

    if (!enrollment?.section) {
      await User.findByIdAndUpdate(studentId, clearFields);
      return;
    }

    const section = await Section.findById(enrollment.section)
      .populate('department', 'name code college')
      .populate('program', 'name code department')
      .populate('academicSession', 'label yearNumber')
      .lean();

    await User.findByIdAndUpdate(studentId, this.buildStudentAcademicFields(section));
  }

  static async syncActiveEnrollmentPlacementForStudent(studentId, excludeEnrollmentId = null) {
    if (!studentId) return;

    const query = { student: studentId, status: 'active' };
    if (excludeEnrollmentId) {
      query._id = { $ne: excludeEnrollmentId };
    }

    const activeEnrollment = await Enrollment.findOne(query).sort({ updatedAt: -1, createdAt: -1 }).lean();
    await this.syncStudentPlacementFromEnrollment(studentId, activeEnrollment);
  }

  static async syncStudentsForSection(sectionId) {
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
      this.buildStudentAcademicFields(section)
    );
  }

  static async syncStudentsForSectionQuery(query = {}) {
    const sectionIds = await Section.find(query).distinct('_id');
    await Promise.all(sectionIds.map((sectionId) => this.syncStudentsForSection(sectionId)));
  }
}

module.exports = AcademicService;
