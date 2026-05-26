const mongoose = require('mongoose');
const Course = require('../models/Course');
const CourseSubject = require('../models/CourseSubject');
const Section = require('../models/Section');
const Subject = require('../models/Subject');
const SubjectTeacher = require('../models/SubjectTeacher');
const SubjectSectionTeacher = require('../models/SubjectSectionTeacher');
const User = require('../models/User');
const { normalizeRole } = require('./roleHelpers');

const normalizeObjectIdList = (value) => {
  if (!value) return [];
  const values = Array.isArray(value)
    ? value
    : String(value)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

  return [...new Set(
    values
      .map((item) => String(item || '').trim())
      .filter((item) => mongoose.Types.ObjectId.isValid(item))
  )];
};

const ensureValidTeacherIds = async (teacherIds = []) => {
  if (!teacherIds.length) return [];
  const teachers = await User.find({ _id: { $in: teacherIds } }).select('role').lean();
  if (teachers.length !== teacherIds.length) {
    const error = new Error('One or more teachers could not be found');
    error.statusCode = 400;
    throw error;
  }

  if (teachers.some((teacher) => !['faculty', 'admin'].includes(normalizeRole(teacher.role)))) {
    const error = new Error('Selected user cannot be assigned as a teacher');
    error.statusCode = 400;
    throw error;
  }

  return teacherIds;
};

const ensureSubjectCourseAlignment = async (subject, courseIds = []) => {
  if (!courseIds.length) return [];
  const courses = await Course.find({ _id: { $in: courseIds }, isActive: true }).select('department program').lean();
  if (courses.length !== courseIds.length) {
    const error = new Error('One or more courses could not be found');
    error.statusCode = 400;
    throw error;
  }

  const invalidCourse = courses.find((course) => (
    String(course.program) !== String(subject.program) || String(course.department) !== String(subject.department)
  ));
  if (invalidCourse) {
    const error = new Error('All linked courses must belong to the same department and program as the subject');
    error.statusCode = 400;
    throw error;
  }

  return courses;
};

const syncCourseSubjectMappings = async (subject, courseIds = []) => {
  const normalizedCourseIds = normalizeObjectIdList(courseIds);
  await ensureSubjectCourseAlignment(subject, normalizedCourseIds);

  await CourseSubject.updateMany(
    { subject: subject._id, course: { $nin: normalizedCourseIds } },
    { $set: { isActive: false } }
  );

  await Promise.all(normalizedCourseIds.map((courseId) => (
    CourseSubject.findOneAndUpdate(
      { subject: subject._id, course: courseId },
      { $set: { isActive: true } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    )
  )));

  return normalizedCourseIds;
};

const syncSubjectTeacherMappings = async (subjectId, teacherIds = []) => {
  const normalizedTeacherIds = await ensureValidTeacherIds(normalizeObjectIdList(teacherIds));

  await SubjectTeacher.updateMany(
    { subject: subjectId, teacher: { $nin: normalizedTeacherIds } },
    { $set: { isActive: false } }
  );

  await Promise.all(normalizedTeacherIds.map((teacherId) => (
    SubjectTeacher.findOneAndUpdate(
      { subject: subjectId, teacher: teacherId },
      { $set: { isActive: true } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    )
  )));

  return normalizedTeacherIds;
};

const syncSubjectSectionTeacherMappings = async (subjectId, sectionId, teacherIds = []) => {
  const normalizedTeacherIds = await ensureValidTeacherIds(normalizeObjectIdList(teacherIds));

  await SubjectSectionTeacher.updateMany(
    { subject: subjectId, section: sectionId, teacher: { $nin: normalizedTeacherIds } },
    { $set: { isActive: false } }
  );

  await Promise.all(normalizedTeacherIds.map((teacherId) => (
    SubjectSectionTeacher.findOneAndUpdate(
      { subject: subjectId, section: sectionId, teacher: teacherId },
      { $set: { isActive: true } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    )
  )));

  return normalizedTeacherIds;
};

const getSubjectIdsForCourse = async (courseId) => {
  if (!courseId) return [];
  const [mappedIds, legacyIds] = await Promise.all([
    CourseSubject.find({ course: courseId, isActive: true }).distinct('subject'),
    Subject.find({ course: courseId, isActive: true }).distinct('_id'),
  ]);
  return [...new Set([...mappedIds, ...legacyIds].map((id) => String(id)))];
};

const getSubjectIdsForSection = async (sectionId) => {
  if (!sectionId) return [];
  const section = await Section.findById(sectionId).select('course').lean();
  if (!section?.course) return [];
  return getSubjectIdsForCourse(section.course);
};

const buildSubjectCatalog = async ({ subjectQuery = {}, scopedSectionIds = null } = {}) => {
  const [subjects, courseMappings, teacherMappings, sectionTeacherMappings] = await Promise.all([
    Subject.find({ isActive: true, ...subjectQuery })
      .sort({ code: 1, name: 1 })
      .populate('department', 'name code college')
      .populate('program', 'name code department')
      .populate('course', 'name code department program yearNumber')
      .populate('academicSession', 'label yearNumber program')
      .lean(),
    CourseSubject.find({ isActive: true }).populate({
      path: 'course',
      select: 'name code department program yearNumber',
      populate: [
        { path: 'department', select: 'name code college' },
        { path: 'program', select: 'name code department' },
      ],
    }).lean(),
    SubjectTeacher.find({ isActive: true }).populate('teacher', 'name email systemId role').lean(),
    SubjectSectionTeacher.find({
      isActive: true,
      ...(Array.isArray(scopedSectionIds) ? { section: { $in: scopedSectionIds } } : {}),
    })
      .populate({
        path: 'section',
        select: 'name studyYear course program department academicSession',
        populate: [
          { path: 'course', select: 'name code' },
          { path: 'program', select: 'name code department' },
          { path: 'department', select: 'name code college' },
          { path: 'academicSession', select: 'label yearNumber' },
        ],
      })
      .populate('teacher', 'name email systemId role')
      .lean(),
  ]);

  const coursesBySubjectId = new Map();
  courseMappings.forEach((mapping) => {
    const key = String(mapping.subject);
    const rows = coursesBySubjectId.get(key) || [];
    if (mapping.course) rows.push(mapping.course);
    coursesBySubjectId.set(key, rows);
  });

  const teachersBySubjectId = new Map();
  teacherMappings.forEach((mapping) => {
    const key = String(mapping.subject);
    const rows = teachersBySubjectId.get(key) || [];
    if (mapping.teacher) rows.push(mapping.teacher);
    teachersBySubjectId.set(key, rows);
  });

  const sectionTeachersBySubjectId = new Map();
  sectionTeacherMappings.forEach((mapping) => {
    const key = String(mapping.subject);
    const rows = sectionTeachersBySubjectId.get(key) || [];
    rows.push({
      _id: mapping._id,
      section: mapping.section,
      teacher: mapping.teacher,
    });
    sectionTeachersBySubjectId.set(key, rows);
  });

  return subjects.map((subject) => {
    const mappedCourses = coursesBySubjectId.get(String(subject._id)) || [];
    const linkedCourses = [...mappedCourses];
    if (subject.course?._id && !linkedCourses.some((course) => String(course._id) === String(subject.course._id))) {
      linkedCourses.push(subject.course);
    }
    return {
      ...subject,
      course: linkedCourses[0] || null,
      courses: linkedCourses,
      teachers: teachersBySubjectId.get(String(subject._id)) || [],
      sectionTeachers: sectionTeachersBySubjectId.get(String(subject._id)) || [],
    };
  });
};

const getSubjectDetail = async (subjectId) => {
  const [subject] = await buildSubjectCatalog({ subjectQuery: { _id: subjectId } });
  if (!subject) return null;

  const sectionIds = [...new Set((subject.sectionTeachers || []).map((entry) => String(entry.section?._id || entry.section)).filter(Boolean))];
  const linkedSections = sectionIds.length
    ? await Section.find({ _id: { $in: sectionIds }, isActive: true })
      .select('name studyYear course program department academicSession')
      .populate('course', 'name code')
      .populate('program', 'name code department')
      .populate('department', 'name code college')
      .populate('academicSession', 'label yearNumber')
      .sort({ name: 1 })
      .lean()
    : [];

  return {
    ...subject,
    linkedSections,
  };
};

module.exports = {
  buildSubjectCatalog,
  ensureSubjectCourseAlignment,
  ensureValidTeacherIds,
  getSubjectDetail,
  getSubjectIdsForCourse,
  getSubjectIdsForSection,
  normalizeObjectIdList,
  syncCourseSubjectMappings,
  syncSubjectSectionTeacherMappings,
  syncSubjectTeacherMappings,
};
