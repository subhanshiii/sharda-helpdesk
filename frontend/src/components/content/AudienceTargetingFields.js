import React from 'react';

const FIELD_CONFIG = [
  { key: 'audienceTiers', label: 'Audience Tiers', placeholder: 'college_admin, department_admin' },
  { key: 'audienceRoles', label: 'Audience Roles', placeholder: 'student, faculty' },
  { key: 'audienceDepartments', label: 'Audience Departments', placeholder: 'CSE, IT' },
  { key: 'audienceYears', label: 'Audience Levels / Years', placeholder: '1, 2, 3' },
  { key: 'audienceSections', label: 'Audience Sections', placeholder: 'A, B' },
];

export default function AudienceTargetingFields({ form, onChange, compact = false }) {
  return (
    <div className="space-y-3">
      <div>
        <p className="label">Visibility Targeting</p>
        <p className="mt-1 text-xs text-gray-500">
          Leave fields blank to keep the item visible to everyone who can normally access this module.
        </p>
      </div>
      <div className={`grid gap-4 ${compact ? 'md:grid-cols-2' : 'md:grid-cols-2 xl:grid-cols-3'}`}>
        {FIELD_CONFIG.map((field) => (
          <div key={field.key}>
            <label className="label">{field.label}</label>
            <input
              className="input"
              value={form[field.key] || ''}
              onChange={(event) => onChange(field.key, event.target.value)}
              placeholder={field.placeholder}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
