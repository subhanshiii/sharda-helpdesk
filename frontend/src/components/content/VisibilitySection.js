import React, { useMemo } from 'react';
import useAcademicOptions from '../../hooks/useAcademicOptions';
import { ADMIN_TIER_DEFINITIONS, getAdminTierLabel, getRoleLabel } from '../../utils/helpers';
import { buildScopeOptions, getEntityId } from '../../utils/academicScope';

const ROLE_OPTIONS = ['student', 'faculty', 'staff', 'admin'];

const toggleValue = (values = [], value) => (
  values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value]
);

export default function VisibilitySection({ form, onChange, compact = false }) {
  const { options, departmentCollegeMap, loading } = useAcademicOptions();

  const filters = useMemo(() => ({
    collegeId: form.audienceCollegeId || '',
    departmentId: form.audienceDepartmentId || '',
    programId: form.audienceProgramId || '',
    courseId: form.audienceCourseId || '',
    studyYear: form.audienceStudyYear || '',
    sectionId: form.audienceSectionId || '',
  }), [
    form.audienceCollegeId,
    form.audienceCourseId,
    form.audienceDepartmentId,
    form.audienceProgramId,
    form.audienceSectionId,
    form.audienceStudyYear,
  ]);

  const scopedOptions = useMemo(
    () => buildScopeOptions(options, filters, departmentCollegeMap),
    [departmentCollegeMap, filters, options]
  );

  const handleHierarchyChange = (key, value) => {
    const resets = {
      audienceCollegeId: ['audienceDepartmentId', 'audienceProgramId', 'audienceCourseId', 'audienceStudyYear', 'audienceSectionId'],
      audienceDepartmentId: ['audienceProgramId', 'audienceCourseId', 'audienceStudyYear', 'audienceSectionId'],
      audienceProgramId: ['audienceCourseId', 'audienceStudyYear', 'audienceSectionId'],
      audienceCourseId: ['audienceStudyYear', 'audienceSectionId'],
      audienceStudyYear: ['audienceSectionId'],
    };

    onChange(key, value);
    (resets[key] || []).forEach((resetKey) => onChange(resetKey, ''));

    if (key === 'audienceSectionId') {
      const section = options.sections.find((entry) => getEntityId(entry) === String(value));
      if (section) {
        onChange('audienceCollegeId', departmentCollegeMap.get(getEntityId(section.department)) || '');
        onChange('audienceDepartmentId', getEntityId(section.department));
        onChange('audienceProgramId', getEntityId(section.program));
        onChange('audienceCourseId', getEntityId(section.course));
        onChange('audienceStudyYear', String(section.studyYear || section.academicSession?.yearNumber || ''));
      }
    }
  };

  return (
    <div className="space-y-4 rounded-2xl border border-gray-100 bg-slate-50 p-4">
      <div>
        <p className="label">Visibility & Access</p>
        <p className="mt-1 text-xs text-gray-500">
          Control who can see this item by tier, role, and academic scope. Leave everything blank to keep the item visible to everyone who already has module access.
        </p>
      </div>

      <div className="space-y-2">
        <label className="label">Admin Tiers</label>
        <div className="flex flex-wrap gap-2">
          {ADMIN_TIER_DEFINITIONS.map((tier) => {
            const selected = (form.audienceTiers || []).includes(tier.key);
            return (
              <button
                key={tier.key}
                type="button"
                onClick={() => onChange('audienceTiers', toggleValue(form.audienceTiers || [], tier.key))}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  selected ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                {getAdminTierLabel(tier.key)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <label className="label">Roles</label>
        <div className="flex flex-wrap gap-2">
          {ROLE_OPTIONS.map((role) => {
            const selected = (form.audienceRoles || []).includes(role);
            return (
              <button
                key={role}
                type="button"
                onClick={() => onChange('audienceRoles', toggleValue(form.audienceRoles || [], role))}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold capitalize transition ${
                  selected ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                {getRoleLabel(role)}
              </button>
            );
          })}
        </div>
      </div>

      <div className={`grid gap-4 ${compact ? 'md:grid-cols-2' : 'md:grid-cols-2 xl:grid-cols-3'}`}>
        <div>
          <label className="label">College</label>
          <select className="input" value={form.audienceCollegeId || ''} onChange={(event) => handleHierarchyChange('audienceCollegeId', event.target.value)}>
            <option value="">All Colleges</option>
            {scopedOptions.colleges.map((college) => (
              <option key={college._id} value={college._id}>{college.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Department</label>
          <select className="input" value={form.audienceDepartmentId || ''} onChange={(event) => handleHierarchyChange('audienceDepartmentId', event.target.value)}>
            <option value="">All Departments</option>
            {scopedOptions.departments.map((department) => (
              <option key={department._id} value={department._id}>{department.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Program</label>
          <select className="input" value={form.audienceProgramId || ''} onChange={(event) => handleHierarchyChange('audienceProgramId', event.target.value)}>
            <option value="">All Programs</option>
            {scopedOptions.programs.map((program) => (
              <option key={program._id} value={program._id}>{program.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Course</label>
          <select className="input" value={form.audienceCourseId || ''} onChange={(event) => handleHierarchyChange('audienceCourseId', event.target.value)}>
            <option value="">All Courses</option>
            {scopedOptions.courses.map((course) => (
              <option key={course._id} value={course._id}>{course.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Year</label>
          <select className="input" value={form.audienceStudyYear || ''} onChange={(event) => handleHierarchyChange('audienceStudyYear', event.target.value)}>
            <option value="">All Years</option>
            {[1, 2, 3, 4, 5].map((year) => (
              <option key={year} value={year}>{`Year ${year}`}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Section</label>
          <select className="input" value={form.audienceSectionId || ''} onChange={(event) => handleHierarchyChange('audienceSectionId', event.target.value)} disabled={loading}>
            <option value="">{loading ? 'Loading sections...' : 'All Sections'}</option>
            {scopedOptions.sections.map((section) => (
              <option key={section._id} value={section._id}>
                {section.name} ({section.program?.name || 'Program'})
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
