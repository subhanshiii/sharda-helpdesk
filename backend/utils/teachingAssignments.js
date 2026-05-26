const mongoose = require('mongoose');
const CourseSubject = require('../models/CourseSubject');
const Section = require('../models/Section');
const Subject = require('../models/Subject');
const SubjectTeacher = require('../models/SubjectTeacher');
const SubjectSectionTeacher = require('../models/SubjectSectionTeacher');
const TeachingAssignment = require('../models/TeachingAssignment');

const normalizeId = (value) => String(value || '').trim();

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const getLinkedCourseIdsForSubject = async (subject) => {
  if (!subject?._id) return [];

  const mappedIds = await CourseSubject.find({
    subject: subject._id,
    isActive: true,
  }).distinct('course');

  const legacyCourseId = subject.course ? [subject.course] : [];
  return [...new Set([...mappedIds, ...legacyCourseId].map((id) => normalizeId(id)).filter(Boolean))];
};

const getResolvedTeachingAssignmentRows = async (subjectId, scopedSectionId = null) => {
  if (!isValidObjectId(subjectId)) return [];

  const subject = await Subject.findById(subjectId)
    .select('course academicSession term')
    .lean();

  if (!subject?.academicSession) return [];

  const linkedCourseIds = await getLinkedCourseIdsForSubject(subject);
  if (!linkedCourseIds.length) return [];

  const sectionQuery = {
    course: { $in: linkedCourseIds },
    academicSession: subject.academicSession,
    isActive: true,
  };

  if (scopedSectionId) {
    sectionQuery._id = scopedSectionId;
  }

  const [sections, generalTeacherIds, sectionTeacherMappings] = await Promise.all([
    Section.find(sectionQuery).select('_id academicSession').lean(),
    SubjectTeacher.find({ subject: subjectId, isActive: true }).distinct('teacher'),
    SubjectSectionTeacher.find({
      subject: subjectId,
      isActive: true,
      ...(scopedSectionId ? { section: scopedSectionId } : {}),
    })
      .select('section teacher')
      .lean(),
  ]);

  const sectionTeacherIdsBySection = new Map();
  sectionTeacherMappings.forEach((mapping) => {
    const key = normalizeId(mapping.section);
    const rows = sectionTeacherIdsBySection.get(key) || [];
    rows.push(normalizeId(mapping.teacher));
    sectionTeacherIdsBySection.set(key, rows);
  });

  const subjectTerm = Number.isFinite(subject.term) ? subject.term : null;

  return sections.flatMap((section) => {
    const scopedTeacherIds = [...new Set(sectionTeacherIdsBySection.get(normalizeId(section._id)) || [])];
    const resolvedTeacherIds = scopedTeacherIds.length
      ? scopedTeacherIds
      : [...new Set(generalTeacherIds.map((teacherId) => normalizeId(teacherId)).filter(Boolean))];

    return resolvedTeacherIds.map((teacherId) => ({
      academicSession: section.academicSession,
      section: section._id,
      subject: subjectId,
      teacher: teacherId,
      source: scopedTeacherIds.length ? 'section' : 'subject',
      term: subjectTerm,
    }));
  });
};

const buildAssignmentSetPayload = (row) => {
  const payload = { source: row.source, isActive: true };
  if (Number.isFinite(row.term)) {
    payload.term = row.term;
  }
  return payload;
};

const syncTeachingAssignmentsForSubject = async (subjectId) => {
  const rows = await getResolvedTeachingAssignmentRows(subjectId);

  await TeachingAssignment.updateMany(
    { subject: subjectId },
    { $set: { isActive: false } }
  );

  await Promise.all(rows.map((row) => (
    TeachingAssignment.findOneAndUpdate(
      {
        academicSession: row.academicSession,
        section: row.section,
        subject: row.subject,
        teacher: row.teacher,
      },
      { $set: buildAssignmentSetPayload(row) },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    )
  )));

  return rows;
};

const syncTeachingAssignmentsForSubjectSection = async (subjectId, sectionId) => {
  const rows = await getResolvedTeachingAssignmentRows(subjectId, sectionId);

  await TeachingAssignment.updateMany(
    { subject: subjectId, section: sectionId },
    { $set: { isActive: false } }
  );

  await Promise.all(rows.map((row) => (
    TeachingAssignment.findOneAndUpdate(
      {
        academicSession: row.academicSession,
        section: row.section,
        subject: row.subject,
        teacher: row.teacher,
      },
      { $set: buildAssignmentSetPayload(row) },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    )
  )));

  return rows;
};

const syncTeachingAssignmentsForSection = async (sectionId) => {
  if (!isValidObjectId(sectionId)) return [];

  const section = await Section.findById(sectionId)
    .select('course academicSession')
    .lean();
  if (!section?.course) return [];

  const [mappedSubjectIds, legacySubjectIds] = await Promise.all([
    CourseSubject.find({ course: section.course, isActive: true }).distinct('subject'),
    Subject.find({ course: section.course, isActive: true }).distinct('_id'),
  ]);

  const subjectIds = [...new Set([...mappedSubjectIds, ...legacySubjectIds].map((id) => normalizeId(id)).filter(Boolean))];
  if (!subjectIds.length) {
    await TeachingAssignment.updateMany({ section: sectionId }, { $set: { isActive: false } });
    return [];
  }

  await TeachingAssignment.updateMany({ section: sectionId }, { $set: { isActive: false } });

  const syncedRows = await Promise.all(subjectIds.map((subjectId) => syncTeachingAssignmentsForSubjectSection(subjectId, sectionId)));
  return syncedRows.flat();
};

const getTeachingAssignments = async (filters = {}) => {
  const query = { isActive: true };

  if (filters.teacher) query.teacher = filters.teacher;
  if (filters.section) query.section = filters.section;
  if (filters.subject) query.subject = filters.subject;
  if (filters.academicSession) query.academicSession = filters.academicSession;
  if (Number.isFinite(filters.term)) query.term = filters.term;

  return TeachingAssignment.find(query)
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
    .populate('subject', 'name code academicSession term')
    .populate('teacher', 'name email systemId role')
    .populate('academicSession', 'label yearNumber program')
    .sort({ updatedAt: -1 })
    .lean();
};

const getFacultySectionIds = async (facultyId) => {
  const sectionIds = await TeachingAssignment.find({
    teacher: facultyId,
    isActive: true,
  }).distinct('section');

  return [...new Set(sectionIds.map((id) => normalizeId(id)).filter(Boolean))];
};

const getFacultyTeachingAssignmentIds = async (facultyId) => {
  const teachingAssignmentIds = await TeachingAssignment.find({
    teacher: facultyId,
    isActive: true,
  }).distinct('_id');

  return [...new Set(teachingAssignmentIds.map((id) => normalizeId(id)).filter(Boolean))];
};

module.exports = {
  getFacultySectionIds,
  getFacultyTeachingAssignmentIds,
  getTeachingAssignments,
  getResolvedTeachingAssignmentRows,
  syncTeachingAssignmentsForSection,
  syncTeachingAssignmentsForSubject,
  syncTeachingAssignmentsForSubjectSection,
};
