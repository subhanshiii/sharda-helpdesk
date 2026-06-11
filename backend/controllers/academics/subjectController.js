const crud = require('./academicCrudController');
const AcademicService = require('../../services/academicService');
const Subject = require('../../models/Subject');
const Section = require('../../models/Section');
const CourseSubject = require('../../models/CourseSubject');
const { getScopeFilter } = require('../../utils/scopeGuard');
const { getSubjectDetail, syncCourseSubjectMappings, syncSubjectTeacherMappings, syncSubjectSectionTeacherMappings, getSubjectIdsForSection, normalizeObjectIdList } = require('../../utils/subjectManagement');
const { syncTeachingAssignmentsForSubject, syncTeachingAssignmentsForSubjectSection } = require('../../utils/teachingAssignments');

exports.list = (req, res, next) => { req.resourceName = 'subjects'; return crud.list(req, res, next); };
exports.create = (req, res, next) => { req.resourceName = 'subjects'; return crud.create(req, res, next); };
exports.update = (req, res, next) => { req.resourceName = 'subjects'; return crud.update(req, res, next); };
exports.remove = (req, res, next) => { req.resourceName = 'subjects'; return crud.remove(req, res, next); };

exports.getSubjectManagementWorkspace = async (req, res, next) => {
  try {
    const data = await AcademicService.getWorkspaceCollections(req.user);
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
  } catch (error) { next(error); }
};

exports.getSubjectRecord = async (req, res, next) => {
  try {
    const detail = await getSubjectDetail(req.params.id);
    if (!detail) return res.status(404).json({ success: false, message: 'Subject not found' });
    const subjectScope = await getScopeFilter(req.user, 'subjects');
    const scopedSubject = await Subject.findOne({ _id: detail._id, isActive: true, ...subjectScope }).select('_id').lean();
    if (!scopedSubject) return res.status(403).json({ success: false, message: 'This subject is outside your assigned academic scope' });
    res.status(200).json({ success: true, data: detail });
  } catch (error) { next(error); }
};

exports.linkCourseToSubject = async (req, res, next) => {
  try {
    const subject = await Subject.findById(req.body?.subjectId || req.params.id);
    if (!subject) return res.status(404).json({ success: false, message: 'Subject not found' });
    await AcademicService.ensureScopedMutationAccess(req.user, 'subjects', subject);
    const existingCourseIds = await CourseSubject.find({ subject: subject._id, isActive: true }).distinct('course');
    const nextCourseIds = normalizeObjectIdList([...(Array.isArray(req.body?.courseIds) ? req.body.courseIds : []), req.body?.courseId, ...existingCourseIds]);
    await syncCourseSubjectMappings(subject, nextCourseIds);
    await syncTeachingAssignmentsForSubject(subject._id);
    const data = await getSubjectDetail(subject._id);
    res.status(200).json({ success: true, data });
  } catch (error) { next(error); }
};

exports.unlinkCourseFromSubject = async (req, res, next) => {
  try {
    const subject = await Subject.findById(req.params.id);
    if (!subject) return res.status(404).json({ success: false, message: 'Subject not found' });
    await AcademicService.ensureScopedMutationAccess(req.user, 'subjects', subject);
    await CourseSubject.findOneAndUpdate({ subject: subject._id, course: req.params.courseId }, { $set: { isActive: false } });
    await syncTeachingAssignmentsForSubject(subject._id);
    const data = await getSubjectDetail(subject._id);
    res.status(200).json({ success: true, data });
  } catch (error) { next(error); }
};

exports.updateSubjectTeachers = async (req, res, next) => {
  try {
    const subject = await Subject.findById(req.params.id);
    if (!subject) return res.status(404).json({ success: false, message: 'Subject not found' });
    await AcademicService.ensureScopedMutationAccess(req.user, 'subjects', subject);
    await syncSubjectTeacherMappings(subject._id, req.body?.teacherIds || req.body?.teachers || []);
    await syncTeachingAssignmentsForSubject(subject._id);
    const data = await getSubjectDetail(subject._id);
    res.status(200).json({ success: true, data });
  } catch (error) { next(error); }
};

exports.updateSubjectSectionTeachers = async (req, res, next) => {
  try {
    const [subject, section] = await Promise.all([Subject.findById(req.params.id).lean(), Section.findById(req.params.sectionId).lean()]);
    if (!subject) return res.status(404).json({ success: false, message: 'Subject not found' });
    if (!section) return res.status(404).json({ success: false, message: 'Section not found' });
    if (String(subject.program) !== String(section.program)) return res.status(400).json({ success: false, message: 'Subject and section must belong to the same program' });
    const subjectIdsForSection = await getSubjectIdsForSection(section._id);
    if (!subjectIdsForSection.includes(String(subject._id))) return res.status(400).json({ success: false, message: 'This section does not inherit the selected subject from its course' });
    await AcademicService.ensureScopedMutationAccess(req.user, 'sections', section);
    await syncSubjectSectionTeacherMappings(subject._id, section._id, req.body?.teacherIds || req.body?.teachers || []);
    await syncTeachingAssignmentsForSubjectSection(subject._id, section._id);
    const data = await getSubjectDetail(subject._id);
    res.status(200).json({ success: true, data });
  } catch (error) { next(error); }
};
