const Enrollment = require('../models/Enrollment');
const Section = require('../models/Section');
const TeachingAssignment = require('../models/TeachingAssignment');
const Department = require('../models/Department');
const { normalizeRole } = require('./roleHelpers');

const getFacultyAssignedSectionIds = async (facultyId) => {
  const sectionAssignments = await TeachingAssignment.find({
    isActive: true,
    teacher: facultyId,
  }).distinct('section');

  return [...new Set(sectionAssignments.map((id) => String(id)))];
};

const resolveScopedSectionIds = async ({
  collegeId,
  departmentId,
  programId,
  courseId,
  studyYear,
  sectionId,
}) => {
  if (sectionId) {
    return [String(sectionId)];
  }

  const sectionQuery = {};

  if (collegeId && !departmentId) {
    const departmentIds = await Department.find({ college: collegeId }).distinct('_id');
    sectionQuery.department = { $in: departmentIds };
  }

  if (departmentId) sectionQuery.department = departmentId;
  if (programId) sectionQuery.program = programId;
  if (courseId) sectionQuery.course = courseId;
  if (studyYear) sectionQuery.studyYear = Number(studyYear);

  if (!Object.keys(sectionQuery).length) {
    return null;
  }

  const sectionIds = await Section.find(sectionQuery).distinct('_id');
  return sectionIds.map((id) => String(id));
};

const buildTimetableQuery = async (user, filters = {}) => {
  const role = normalizeRole(user.role);
  const query = { isActive: true, isDeleted: false };

  if (role === 'student') {
    const enrollment = await Enrollment.findOne({ student: user.id, status: 'active' }).select('section').lean();
    if (enrollment?.section) {
      query.sectionId = enrollment.section;
    } else {
      query.department = user.department;
      query.year = user.year;
      query.section = user.section;
    }
  } else if (role === 'faculty') {
    const assignedSectionIds = await getFacultyAssignedSectionIds(user.id);
    query.$or = [{ faculty: user.id }];
    if (assignedSectionIds.length) {
      query.$or.push({ sectionId: { $in: assignedSectionIds } });
    }
  }

  const scopedSectionIds = await resolveScopedSectionIds(filters);
  if (!scopedSectionIds) {
    return query;
  }

  if (!scopedSectionIds.length) {
    return { _id: null };
  }

  if (query.sectionId) {
    return scopedSectionIds.includes(String(query.sectionId)) ? query : { _id: null };
  }

  if (query.$or) {
    return { ...query, $and: [{ $or: query.$or }, { sectionId: { $in: scopedSectionIds } }] };
  }

  return { ...query, sectionId: { $in: scopedSectionIds } };
};

module.exports = {
  buildTimetableQuery,
  getFacultyAssignedSectionIds,
};
