import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { buildScopeOptions } from '../../utils/academicScope';
import { ADMIN_TIER_DEFINITIONS, getAdminTierLabel, getRoleLabel } from '../../utils/helpers';
import { normalizeUserRole, resolveEffectiveAdminTier } from '../../utils/access';

const getFilterAccessProfile = (user) => {
  const role = normalizeUserRole(user?.role);
  const tier = resolveEffectiveAdminTier(user?.role, user?.adminTier);

  if (tier === 'super_admin' || tier === 'admin') {
    return {
      showVisibilityFilters: true,
      showCollege: true,
      showDepartment: true,
      showProgram: true,
      showCourse: true,
      showLevel: true,
      showSection: true,
    };
  }

  if (tier === 'college_admin') {
    return {
      showVisibilityFilters: true,
      showCollege: true,
      showDepartment: true,
      showProgram: true,
      showCourse: true,
      showLevel: true,
      showSection: true,
    };
  }

  if (tier === 'department_admin') {
    return {
      showVisibilityFilters: true,
      showCollege: false,
      showDepartment: true,
      showProgram: true,
      showCourse: true,
      showLevel: true,
      showSection: true,
    };
  }

  if (tier === 'program_coordinator') {
    return {
      showVisibilityFilters: true,
      showCollege: false,
      showDepartment: false,
      showProgram: true,
      showCourse: true,
      showLevel: true,
      showSection: true,
    };
  }

  if (tier === 'section_moderator') {
    return {
      showVisibilityFilters: true,
      showCollege: false,
      showDepartment: false,
      showProgram: false,
      showCourse: false,
      showLevel: true,
      showSection: true,
    };
  }

  if (role === 'faculty') {
    return {
      showVisibilityFilters: false,
      showCollege: false,
      showDepartment: true,
      showProgram: true,
      showCourse: true,
      showLevel: true,
      showSection: true,
    };
  }

  if (role === 'student') {
    return {
      showVisibilityFilters: false,
      showCollege: false,
      showDepartment: false,
      showProgram: false,
      showCourse: true,
      showLevel: true,
      showSection: true,
    };
  }

  return {
    showVisibilityFilters: false,
    showCollege: true,
    showDepartment: true,
    showProgram: true,
    showCourse: true,
    showLevel: true,
    showSection: true,
  };
};

export default function AcademicScopeFilters({
  filters,
  onChange,
  options,
  departmentCollegeMap,
  showSection = true,
  showLevel = true,
  showRoleFilter = false,
  showTierFilter = false,
  className = '',
  singleLine = true,
}) {
  const { user } = useAuth();
  const scopedOptions = buildScopeOptions(options, filters, departmentCollegeMap);
  const accessProfile = getFilterAccessProfile(user);
  const labelClassName = `label ${singleLine ? 'mb-1 whitespace-nowrap text-[10px]' : ''}`;
  const fieldClassName = singleLine ? 'min-w-[126px] flex-1 md:w-[142px] md:flex-none' : '';

  return (
    <div className={className}>
      <div className={`${singleLine ? 'flex flex-wrap items-end gap-2' : 'grid gap-3 md:grid-cols-2 xl:grid-cols-3'}`}>
      {showTierFilter && accessProfile.showVisibilityFilters ? (
        <div className={fieldClassName}>
          <label className={labelClassName}>Tier</label>
          <select className="input" value={filters.visibilityTier || ''} onChange={(event) => onChange('visibilityTier', event.target.value)}>
            <option value="">All Tiers</option>
            {ADMIN_TIER_DEFINITIONS.map((tier) => (
              <option key={tier.key} value={tier.key}>{getAdminTierLabel(tier.key)}</option>
            ))}
          </select>
        </div>
      ) : null}
      {showRoleFilter && accessProfile.showVisibilityFilters ? (
        <div className={fieldClassName}>
          <label className={labelClassName}>Role</label>
          <select className="input" value={filters.visibilityRole || ''} onChange={(event) => onChange('visibilityRole', event.target.value)}>
            <option value="">All Roles</option>
            {['student', 'faculty', 'staff', 'admin'].map((role) => (
              <option key={role} value={role}>{getRoleLabel(role)}</option>
            ))}
          </select>
        </div>
      ) : null}
      {accessProfile.showCollege ? (
      <div className={fieldClassName}>
        <label className={labelClassName}>College</label>
        <select className="input" value={filters.collegeId} onChange={(event) => onChange('collegeId', event.target.value)}>
          <option value="">All Colleges</option>
          {scopedOptions.colleges.map((college) => (
            <option key={college._id} value={college._id}>{college.name}</option>
          ))}
        </select>
      </div>
      ) : null}
      {accessProfile.showDepartment ? (
      <div className={fieldClassName}>
        <label className={labelClassName}>Department</label>
        <select className="input" value={filters.departmentId} onChange={(event) => onChange('departmentId', event.target.value)}>
          <option value="">All Departments</option>
          {scopedOptions.departments.map((department) => (
            <option key={department._id} value={department._id}>{department.name}</option>
          ))}
        </select>
      </div>
      ) : null}
      {accessProfile.showProgram ? (
      <div className={fieldClassName}>
        <label className={labelClassName}>Program</label>
        <select className="input" value={filters.programId} onChange={(event) => onChange('programId', event.target.value)}>
          <option value="">All Programs</option>
          {scopedOptions.programs.map((program) => (
            <option key={program._id} value={program._id}>{program.name}</option>
          ))}
        </select>
      </div>
      ) : null}
      {accessProfile.showCourse ? (
      <div className={fieldClassName}>
        <label className={labelClassName}>Course</label>
        <select className="input" value={filters.courseId} onChange={(event) => onChange('courseId', event.target.value)}>
          <option value="">All Courses</option>
          {scopedOptions.courses.map((course) => (
            <option key={course._id} value={course._id}>{course.name}</option>
          ))}
        </select>
      </div>
      ) : null}
      {showLevel && accessProfile.showLevel ? (
        <div className={singleLine ? 'min-w-[112px] flex-1 md:w-[120px] md:flex-none' : ''}>
          <label className={labelClassName}>Level / Year</label>
          <select className="input" value={filters.studyYear} onChange={(event) => onChange('studyYear', event.target.value)}>
            <option value="">All Levels</option>
            {[1, 2, 3, 4, 5].map((year) => <option key={year} value={year}>{`Year ${year}`}</option>)}
          </select>
        </div>
      ) : null}
      {showSection && accessProfile.showSection ? (
        <div className={fieldClassName}>
          <label className={labelClassName}>Section</label>
          <select className="input" value={filters.sectionId} onChange={(event) => onChange('sectionId', event.target.value)}>
            <option value="">All Sections</option>
            {scopedOptions.sections.map((section) => (
              <option key={section._id} value={section._id}>
                {section.name} ({section.program?.name || 'Program'})
              </option>
            ))}
          </select>
        </div>
      ) : null}
      </div>
    </div>
  );
}
