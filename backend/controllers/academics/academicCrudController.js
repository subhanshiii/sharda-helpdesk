const mongoose = require('mongoose');
const College = require('../../models/College');
const Department = require('../../models/Department');
const Program = require('../../models/Program');
const Course = require('../../models/Course');
const AcademicSession = require('../../models/AcademicSession');
const Section = require('../../models/Section');
const Subject = require('../../models/Subject');
const CourseSubject = require('../../models/CourseSubject');
const SubjectTeacher = require('../../models/SubjectTeacher');
const SubjectSectionTeacher = require('../../models/SubjectSectionTeacher');
const TeachingAssignment = require('../../models/TeachingAssignment');
const Enrollment = require('../../models/Enrollment');
const AttendanceSession = require('../../models/AttendanceSession');
const User = require('../../models/User');
const AcademicService = require('../../services/academicService');
const { getScopeFilter } = require('../../utils/scopeGuard');
const { syncTeachingAssignmentsForSubject, syncTeachingAssignmentsForSection } = require('../../utils/teachingAssignments');
const { syncCourseSubjectMappings } = require('../../utils/subjectManagement');

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

exports.list = async (req, res, next) => {
  try {
    const resource = req.params.resource || req.resourceName;
    const model = getModel(resource);
    if (!model) return res.status(404).json({ success: false, message: 'Academic resource not found' });

    const query = {};
    Object.assign(query, await getScopeFilter(req.user, resource));
    if (req.query.department) query.department = req.query.department;
    if (req.query.program) query.program = req.query.program;
    if (req.query.academicSession || req.query.academicYear) query.academicSession = req.query.academicSession || req.query.academicYear;
    if (req.query.section) query.section = req.query.section;
    if (req.query.student) query.student = req.query.student;
    if (req.query.subject) query.subject = req.query.subject;
    if (req.query.faculty) query.faculty = req.query.faculty;
    if (req.query.status) query.status = req.query.status;
    if (resource === 'subjects' && req.query.course) {
      const subjectIds = await CourseSubject.find({ course: req.query.course, isActive: true }).distinct('subject');
      query._id = { $in: subjectIds };
    }

    let cursor = model.find(query).sort({ createdAt: -1 });
    if (populateMap[resource]) {
      cursor = cursor.populate(populateMap[resource]);
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
    const resource = req.params.resource || req.resourceName;
    const model = getModel(resource);
    if (!model) return res.status(404).json({ success: false, message: 'Academic resource not found' });

    const payload = await AcademicService.buildAcademicPayload(resource, req.body);
    await AcademicService.ensureScopedMutationAccess(req.user, resource, payload);

    if (resource === 'enrollments') {
      await AcademicService.deactivateOtherActiveEnrollments(payload);

      if (payload.section) {
        await AcademicService.syncStudentPlacementFromEnrollment(payload.student, payload.status === 'active' ? { section: payload.section } : null);
      }
    }

    const createPayload = { ...payload };
    delete createPayload.courseIds;

    const doc = await model.create(createPayload);
    if (resource === 'subjects') {
      await syncCourseSubjectMappings(doc, payload.courseIds || []);
      await syncTeachingAssignmentsForSubject(doc._id);
    }
    if (resource === 'sections') {
      await AcademicService.syncStudentsForSection(doc._id);
      await syncTeachingAssignmentsForSection(doc._id);
    }
    const data = populateMap[resource]
      ? await model.findById(doc._id).populate(populateMap[resource]).lean()
      : doc;

    require('../../config/cache').delPattern('academic:workspace:*');
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const resource = req.params.resource || req.resourceName;
    const model = getModel(resource);
    if (!model) return res.status(404).json({ success: false, message: 'Academic resource not found' });

    const existingDoc = await model.findById(req.params.id).lean();
    if (!existingDoc) return res.status(404).json({ success: false, message: 'Academic record not found' });

    const payload = await AcademicService.buildAcademicPayload(resource, req.body);
    await AcademicService.ensureScopedMutationAccess(req.user, resource, {
      ...existingDoc,
      ...payload,
    });
    const updatePayload = { ...payload };
    delete updatePayload.courseIds;

    const doc = await model.findByIdAndUpdate(req.params.id, updatePayload, { new: true, runValidators: true });
    if (resource === 'subjects') {
      await syncCourseSubjectMappings(doc, payload.courseIds || []);
      await syncTeachingAssignmentsForSubject(doc._id);
    }

    if (resource === 'enrollments' && payload.section && payload.student) {
      await AcademicService.deactivateOtherActiveEnrollments(payload, req.params.id);
      if (payload.status === 'active') {
        await AcademicService.syncStudentPlacementFromEnrollment(payload.student, { section: payload.section });
      } else {
        await AcademicService.syncActiveEnrollmentPlacementForStudent(payload.student, req.params.id);
      }

      const studentChanged = String(existingDoc.student) !== String(payload.student);
      const previouslyActive = existingDoc.status === 'active';
      if (previouslyActive && studentChanged) {
        await AcademicService.syncActiveEnrollmentPlacementForStudent(existingDoc.student, req.params.id);
      }
    }

    if (resource === 'sections') {
      await AcademicService.syncStudentsForSection(doc._id);
      await syncTeachingAssignmentsForSection(doc._id);
    }
    if (resource === 'departments') {
      await AcademicService.syncStudentsForSectionQuery({ department: doc._id });
    }
    if (resource === 'academic-sessions' || resource === 'years') {
      await AcademicService.syncStudentsForSectionQuery({ academicSession: doc._id });
    }

    const data = populateMap[resource]
      ? await model.findById(doc._id).populate(populateMap[resource]).lean()
      : doc;

    require('../../config/cache').delPattern('academic:workspace:*');
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const resource = req.params.resource || req.resourceName;
    const model = getModel(resource);
    if (!model) return res.status(404).json({ success: false, message: 'Academic resource not found' });

    const existingDoc = await model.findById(req.params.id).lean();
    if (!existingDoc) return res.status(404).json({ success: false, message: 'Academic record not found' });

    await AcademicService.ensureScopedMutationAccess(req.user, resource, existingDoc);

    if (resource === 'colleges') {
      const departmentIds = await Department.find({ college: req.params.id }).distinct('_id');
      const programIds = await Program.find({ department: { $in: departmentIds } }).distinct('_id');

      await AcademicService.cascadeDeletePrograms(programIds);
      await Promise.all([
        Department.deleteMany({ college: req.params.id }),
        Program.deleteMany({ _id: { $in: programIds } }),
      ]);
    }

    if (resource === 'departments') {
      const programIds = await Program.find({ department: req.params.id }).distinct('_id');
      await AcademicService.cascadeDeletePrograms(programIds);
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

    if (resource === 'programs') {
      await AcademicService.cascadeDeletePrograms([existingDoc._id]);
    }

    if (resource === 'courses') {
      const sectionIds = await Section.find({ course: req.params.id }).distinct('_id');
      const subjectIds = await CourseSubject.find({ course: req.params.id, isActive: true }).distinct('subject');
      await AcademicService.cascadeDeleteSections(sectionIds);
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

    if (resource === 'academic-sessions' || resource === 'years') {
      const sectionIds = await Section.find({ academicSession: req.params.id }).distinct('_id');
      const subjectIds = await Subject.find({ academicSession: req.params.id }).distinct('_id');
      await AcademicService.cascadeDeleteSections(sectionIds);
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

    if (resource === 'sections') {
      await AcademicService.cascadeDeleteSections([existingDoc._id]);
    }

    if (resource === 'subjects') {
      await Promise.all([
        CourseSubject.deleteMany({ subject: req.params.id }),
        SubjectTeacher.deleteMany({ subject: req.params.id }),
        SubjectSectionTeacher.deleteMany({ subject: req.params.id }),
        TeachingAssignment.deleteMany({ subject: req.params.id }),
        AttendanceSession.deleteMany({ subjectId: req.params.id }),
      ]);
    }

    if (resource === 'enrollments' && existingDoc.student) {
      await AcademicService.syncActiveEnrollmentPlacementForStudent(existingDoc.student, existingDoc._id);
    }

    const doc = await model.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Academic record not found' });

    require('../../config/cache').delPattern('academic:workspace:*');
    res.status(200).json({ success: true, message: 'Academic record deleted' });
  } catch (error) {
    next(error);
  }
};

exports.rolloverSession = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { newSessionLabel, newYearNumber } = req.body;

    if (!newSessionLabel || !newYearNumber) {
      return res.status(400).json({ success: false, message: 'newSessionLabel and newYearNumber are required' });
    }

    const existingSession = await AcademicSession.findById(id).lean();
    if (!existingSession) {
      return res.status(404).json({ success: false, message: 'Academic session not found' });
    }

    await AcademicService.ensureScopedMutationAccess(req.user, 'academic-sessions', existingSession);

    // 1. Create new Session
    const newSession = await AcademicSession.create({
      label: newSessionLabel,
      yearNumber: Number(newYearNumber),
      program: existingSession.program,
      isActive: true
    });

    // 2. Clone Subjects
    const oldSubjects = await Subject.find({ academicSession: id }).lean();
    const subjectIdMap = {};

    if (oldSubjects.length > 0) {
      const newSubjectDocs = oldSubjects.map(sub => {
        const { _id, createdAt, updatedAt, ...rest } = sub;
        return { ...rest, academicSession: newSession._id };
      });
      const insertedSubjects = await Subject.insertMany(newSubjectDocs);
      oldSubjects.forEach((sub, idx) => {
        subjectIdMap[sub._id] = insertedSubjects[idx]._id;
      });

      // Clone CourseSubject mappings
      const oldMappings = await CourseSubject.find({ subject: { $in: oldSubjects.map(s => s._id) } }).lean();
      if (oldMappings.length > 0) {
        const newMappings = oldMappings.map(mapping => {
          const { _id, createdAt, updatedAt, ...rest } = mapping;
          return { ...rest, subject: subjectIdMap[mapping.subject] };
        });
        await CourseSubject.insertMany(newMappings);
      }
    }

    // 3. Clone Sections
    const oldSections = await Section.find({ academicSession: id }).lean();
    if (oldSections.length > 0) {
      const newSectionDocs = oldSections.map(sec => {
        const { _id, createdAt, updatedAt, ...rest } = sec;
        return { ...rest, academicSession: newSession._id };
      });
      await Section.insertMany(newSectionDocs);
    }

    // 4. Promote Students
    const promotionService = require('../../services/academicPromotionService');
    const promotionResult = await promotionService.runAutomaticStudentPromotions();

    require('../../config/cache').delPattern('academic:workspace:*');

    res.status(201).json({
      success: true,
      message: 'Session rollover complete',
      data: {
        session: newSession,
        subjectsCloned: oldSubjects.length,
        sectionsCloned: oldSections.length,
        promotions: promotionResult
      }
    });

  } catch (error) {
    next(error);
  }
};
