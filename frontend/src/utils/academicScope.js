export const emptyAcademicScopeFilters = {
  collegeId: '',
  departmentId: '',
  programId: '',
  courseId: '',
  studyYear: '',
  sectionId: '',
};

export const getEntityId = (value) => String(value?._id || value || '');
export const getSubjectCourseIds = (subject) => {
  const courseIds = Array.isArray(subject?.courses)
    ? subject.courses.map((course) => getEntityId(course)).filter(Boolean)
    : [];
  const primaryCourseId = getEntityId(subject?.course);
  if (primaryCourseId && !courseIds.includes(primaryCourseId)) {
    courseIds.push(primaryCourseId);
  }
  return courseIds;
};

export const subjectMatchesCourse = (subject, courseId) => {
  if (!courseId) return true;
  return getSubjectCourseIds(subject).includes(String(courseId));
};

export const buildDepartmentCollegeMap = (departments = []) => new Map(
  departments.map((department) => [getEntityId(department), getEntityId(department.college)])
);

export const resolveSectionForRecord = (record, sections = []) => {
  if (!record) return null;
  if (record.sectionId) {
    return sections.find((section) => getEntityId(section) === getEntityId(record.sectionId)) || null;
  }

  return sections.find((section) => (
    String(section.name || '') === String(record.section || '')
    && String(section.department?.name || '') === String(record.department || '')
    && String(section.studyYear || section.academicSession?.yearNumber || '') === String(record.year || '')
  )) || null;
};

export const matchesAcademicScope = (section, filters, departmentCollegeMap) => {
  if (!section) return false;
  if (filters.sectionId && getEntityId(section) !== String(filters.sectionId)) return false;
  if (filters.courseId && getEntityId(section.course) !== String(filters.courseId)) return false;
  if (filters.programId && getEntityId(section.program) !== String(filters.programId)) return false;
  if (filters.departmentId && getEntityId(section.department) !== String(filters.departmentId)) return false;
  if (filters.studyYear && String(section.academicSession?.yearNumber || section.studyYear || '') !== String(filters.studyYear)) return false;

  const collegeId = departmentCollegeMap.get(getEntityId(section.department));
  if (filters.collegeId && String(collegeId || '') !== String(filters.collegeId)) return false;

  return true;
};

export const filterSectionsByScope = (sections = [], filters, departmentCollegeMap) => (
  sections.filter((section) => matchesAcademicScope(section, filters, departmentCollegeMap))
);

export const buildScopeOptions = ({ colleges = [], departments = [], programs = [], courses = [], sections = [] }, filters, departmentCollegeMap) => {
  const filteredDepartments = departments.filter((department) => (
    !filters.collegeId || getEntityId(department.college) === String(filters.collegeId)
  ));
  const filteredPrograms = programs.filter((program) => (
    !filters.departmentId || getEntityId(program.department) === String(filters.departmentId)
  ));
  const filteredCourses = courses.filter((course) => (
    !filters.programId || getEntityId(course.program) === String(filters.programId)
  ));
  const filteredSections = filterSectionsByScope(sections, filters, departmentCollegeMap);

  return {
    colleges,
    departments: filteredDepartments,
    programs: filteredPrograms,
    courses: filteredCourses,
    sections: filteredSections,
  };
};
