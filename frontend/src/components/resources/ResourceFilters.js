import React from 'react';
import { FiFilter, FiRefreshCw, FiSearch } from 'react-icons/fi';

const SelectField = ({ label, value, onChange, options, placeholder = 'All' }) => (
  <label className="block">
    <span className="theme-text-muted mb-2 block text-xs font-semibold uppercase tracking-[0.24em]">{label}</span>
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="theme-input w-full rounded-2xl px-3.5 py-3 text-sm outline-none transition"
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </label>
);

export default function ResourceFilters({
  filters,
  onChange,
  onReset,
  filterOptions,
  resultsCount = 0,
}) {
  return (
    <aside className="theme-surface rounded-[30px] p-5 backdrop-blur xl:flex xl:h-full xl:flex-col xl:overflow-hidden">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="theme-accent-badge inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em]">
            <FiFilter size={13} />
            Smart filters
          </div>
          <h2 className="theme-text-strong mt-3 font-display text-xl font-bold">Refine resources</h2>
          <p className="theme-text-muted mt-1 text-sm leading-6">
            Combine hierarchy tags, type, date, and search without leaving the page.
          </p>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="theme-ghost-button inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-semibold transition"
        >
          <FiRefreshCw size={14} />
          Reset
        </button>
      </div>

      <div className="xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:pr-2">
        <label className="mt-5 block">
          <span className="theme-text-muted mb-2 block text-xs font-semibold uppercase tracking-[0.24em]">Search</span>
          <div className="relative">
            <FiSearch className="theme-text-muted pointer-events-none absolute left-4 top-1/2 -translate-y-1/2" size={16} />
            <input
              value={filters.search}
              onChange={(event) => onChange('search', event.target.value)}
              placeholder="Search by title or course"
              className="theme-input w-full rounded-2xl py-3 pl-11 pr-4 text-sm outline-none transition"
            />
          </div>
        </label>

        <div className="mt-5 space-y-4">
          <SelectField label="Type" value={filters.resourceType} onChange={(value) => onChange('resourceType', value)} options={filterOptions.resourceTypes} placeholder="All types" />
          <SelectField label="School" value={filters.schoolId} onChange={(value) => onChange('schoolId', value)} options={filterOptions.schools} placeholder="All schools" />
          <SelectField label="Program" value={filters.programId} onChange={(value) => onChange('programId', value)} options={filterOptions.programs} placeholder="All programs" />
          <SelectField label="Department" value={filters.departmentId} onChange={(value) => onChange('departmentId', value)} options={filterOptions.departments} placeholder="All departments" />
          <SelectField label="Course" value={filters.courseId} onChange={(value) => onChange('courseId', value)} options={filterOptions.courses} placeholder="All courses" />
          <SelectField label="Date" value={filters.dateRange} onChange={(value) => onChange('dateRange', value)} options={filterOptions.dateOptions} placeholder="Any time" />
          <SelectField label="Sort" value={filters.sort} onChange={(value) => onChange('sort', value)} options={filterOptions.sortOptions} placeholder="Latest" />
        </div>
      </div>

      <div className="theme-surface-accent mt-6 rounded-2xl px-4 py-4 xl:mt-5">
        <p className="theme-text-muted text-xs font-semibold uppercase tracking-[0.24em]">Live results</p>
        <p className="theme-text-strong mt-2 font-display text-3xl font-black">{resultsCount}</p>
        <p className="theme-text-muted mt-1 text-sm">Resources match the current filter stack.</p>
      </div>
    </aside>
  );
}
