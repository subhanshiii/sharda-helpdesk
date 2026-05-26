const mongoose = require('mongoose');
const Course = require('../models/Course');
const CourseSubject = require('../models/CourseSubject');
const Section = require('../models/Section');
const Subject = require('../models/Subject');
const TeachingAssignment = require('../models/TeachingAssignment');
const {
  syncCourseSubjectMappings,
  syncSubjectSectionTeacherMappings,
  syncSubjectTeacherMappings,
  getSubjectIdsForCourse,
  getSubjectIdsForSection,
} = require('../utils/subjectManagement');
const {
  syncTeachingAssignmentsForSection,
  syncTeachingAssignmentsForSubject,
  syncTeachingAssignmentsForSubjectSection,
  getTeachingAssignments,
} = require('../utils/teachingAssignments');

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const normalizeTerm = (rawValue) => {
  if (rawValue === undefined || rawValue === null || rawValue === '') return null;
  const numeric = Number(rawValue);
  if (!Number.isFinite(numeric)) return null;
  if (numeric < 1 || numeric > 12) return null;
  return Math.trunc(numeric);
};

// Returns subjects linked to a course, ordered by term then code, optionally filtered by term.
// Source-of-truth: CourseSubject. Falls back to legacy Subject.course only when no mapping rows exist.
const listSubjectsForCourse = async (courseId, { term, includeInactive = false } = {}) => {
  if (!isValidObjectId(courseId)) return [];

  const [mappedRows, legacyMatches] = await Promise.all([
    CourseSubject.find({ course: courseId, ...(includeInactive ? {} : { isActive: true }) })
      .select('subject')
      .lean(),
    Subject.find({ course: courseId, ...(includeInactive ? {} : { isActive: true }) })
      .select('_id')
      .lean(),
  ]);

  const subjectIds = [
    ...new Set(
      [
        ...mappedRows.map((row) => String(row.subject)),
        ...legacyMatches.map((row) => String(row._id)),
      ].filter(Boolean)
    ),
  ];

  if (!subjectIds.length) return [];

  const subjectQuery = { _id: { $in: subjectIds } };
  if (!includeInactive) subjectQuery.isActive = true;
  const normalizedTerm = normalizeTerm(term);
  if (normalizedTerm !== null) subjectQuery.term = normalizedTerm;

  return Subject.find(subjectQuery)
    .sort({ term: 1, code: 1, name: 1 })
    .populate('department', 'name code')
    .populate('program', 'name code department')
    .populate('academicSession', 'label yearNumber')
    .lean();
};

// Returns subjects active for a section grouped with their faculty mapping derived from
// canonical TeachingAssignment rows. Subjects linked to the section's course but without a
// faculty mapping are still returned with isUnassigned=true, so the UI can prompt to assign.
const listActiveSubjectsForSection = async (sectionId, { term } = {}) => {
  if (!isValidObjectId(sectionId)) return [];

  const section = await Section.findById(sectionId)
    .select('course academicSession')
    .lean();
  if (!section?.course) return [];

  const normalizedTerm = normalizeTerm(term);
  const subjectsForCourse = await listSubjectsForCourse(section.course, { term: normalizedTerm });
  if (!subjectsForCourse.length) return [];

  const subjectIds = subjectsForCourse.map((subject) => subject._id);

  const teachingAssignmentQuery = {
    section: sectionId,
    subject: { $in: subjectIds },
    isActive: true,
  };
  if (normalizedTerm !== null) teachingAssignmentQuery.term = normalizedTerm;

  const teachingAssignments = await TeachingAssignment.find(teachingAssignmentQuery)
    .populate('teacher', 'name email systemId role')
    .lean();

  const assignmentsBySubjectId = new Map();
  teachingAssignments.forEach((assignment) => {
    const key = String(assignment.subject);
    const rows = assignmentsBySubjectId.get(key) || [];
    rows.push(assignment);
    assignmentsBySubjectId.set(key, rows);
  });

  return subjectsForCourse.map((subject) => {
    const subjectKey = String(subject._id);
    const matchedAssignments = assignmentsBySubjectId.get(subjectKey) || [];
    if (!matchedAssignments.length) {
      return {
        subject,
        teachingAssignments: [],
        isUnassigned: true,
      };
    }
    return {
      subject,
      teachingAssignments: matchedAssignments,
      isUnassigned: false,
    };
  });
};

// Convenience: list canonical teaching assignments scoped to a section and (optional) term.
const listTeachingAssignmentsForSection = async (sectionId, { term, teacherId } = {}) => {
  if (!isValidObjectId(sectionId)) return [];
  return getTeachingAssignments({
    section: sectionId,
    teacher: isValidObjectId(teacherId) ? teacherId : null,
    term: normalizeTerm(term),
  });
};

module.exports = {
  // Subject mapping
  syncCourseSubjectMappings,
  syncSubjectSectionTeacherMappings,
  syncSubjectTeacherMappings,
  // Teaching assignment sync (canonical)
  syncTeachingAssignmentsForSection,
  syncTeachingAssignmentsForSubject,
  syncTeachingAssignmentsForSubjectSection,
  // Lookups
  getSubjectIdsForCourse,
  getSubjectIdsForSection,
  // Higher-level course-centric reads
  listSubjectsForCourse,
  listActiveSubjectsForSection,
  listTeachingAssignmentsForSection,
  // Helpers
  normalizeTerm,
};
