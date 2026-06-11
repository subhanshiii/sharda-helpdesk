import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiClock, FiMapPin, FiUsers } from 'react-icons/fi';
import API from '../utils/api';
import { Alert, ConfirmDialog, EmptyState, FullPageSpinner, PageHeader } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import AcademicScopeFilters from '../components/academics/AcademicScopeFilters';
import {
  buildDepartmentCollegeMap,
  emptyAcademicScopeFilters,
  filterSectionsByScope,
} from '../utils/academicScope';
import { isStudentUser } from '../utils/access';
import useAcademicOptions from '../hooks/useAcademicOptions';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const formatLongDate = (date) => date.toLocaleDateString('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const formatShortDate = (date) => date.toLocaleDateString('en-IN', {
  day: 'numeric',
  month: 'short',
});

const toDateInputValue = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseLocalDate = (value) => {
  const [yearValue, monthValue, dayValue] = String(value).split('-').map(Number);
  if (!yearValue || !monthValue || !dayValue) return null;
  return new Date(yearValue, monthValue - 1, dayValue);
};

const startOfWeek = (date) => {
  const next = new Date(date);
  next.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return next;
};

const endOfWeek = (date) => {
  const next = startOfWeek(date);
  next.setDate(next.getDate() + 6);
  return next;
};

const enumerateDates = (startDate, endDate) => {
  if (!startDate || !endDate || startDate > endDate) return [];
  const dates = [];
  const cursor = new Date(startDate);
  while (cursor <= endDate) {
    const value = new Date(cursor);
    const weekdayIndex = value.getDay() === 0 ? 6 : value.getDay() - 1;
    dates.push({
      key: toDateInputValue(value),
      label: formatShortDate(value),
      longLabel: formatLongDate(value),
      weekday: DAYS[weekdayIndex],
      date: value,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
};

const SummaryChip = ({ label, value, accent = 'default' }) => {
  const accentClass = accent === 'primary'
    ? 'border-[var(--accent-primary)]/20 bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]'
    : accent === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : 'border-[var(--border-strong)] bg-[var(--surface-card)] text-[var(--text-strong)]';

  return (
    <div className={`rounded-2xl border px-3.5 py-3 ${accentClass}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] opacity-70">{label}</p>
      <p className="mt-1.5 break-words text-lg font-black leading-5">{value}</p>
    </div>
  );
};

const SectionCard = ({ section, onClick, slotCount }) => (
  <button
    type="button"
    onClick={onClick}
    className="rounded-3xl border border-[var(--border-strong)] bg-[var(--surface-card)] p-5 text-left transition hover:-translate-y-0.5 hover:shadow-md"
  >
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Section</p>
        <h3 className="mt-2 break-words font-display text-xl font-bold text-[var(--text-strong)]">{section.name}</h3>
        <p className="mt-2 break-words text-sm leading-6 text-[var(--text-muted)]">
          {[section.department?.name, section.program?.name, section.course?.name].filter(Boolean).join(' · ')}
        </p>
      </div>
      <div className="rounded-2xl bg-[var(--surface-soft)] px-3 py-2 text-xs font-semibold text-[var(--text-main)]">
        Year {section.studyYear || section.academicSession?.yearNumber || '—'}
      </div>
    </div>
    <div className="mt-5 flex items-center justify-between gap-3">
      <div className="rounded-2xl bg-[var(--surface-soft)] px-3 py-3 text-sm text-[var(--text-main)]">
        <p className="text-xs uppercase tracking-wide opacity-70">Template Slots</p>
        <p className="mt-2 text-lg font-bold">{slotCount}</p>
      </div>
      <div className="rounded-full bg-[var(--accent-primary-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--accent-primary)]">
        Open Range View
      </div>
    </div>
  </button>
);

export default function TimetablePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [entries, setEntries] = useState([]);
  const { options, departmentCollegeMap, loading: optionsLoading } = useAcademicOptions();
  const { colleges, departments, programs, courses, sections } = options;
  const [filters, setFilters] = useState(emptyAcademicScopeFilters);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const initialStartDate = startOfWeek(new Date());
  const initialEndDate = endOfWeek(new Date());
  const [rangeStart, setRangeStart] = useState(toDateInputValue(initialStartDate));
  const [rangeEnd, setRangeEnd] = useState(toDateInputValue(initialEndDate));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteState, setDeleteState] = useState({ open: false, entryId: '', loading: false });

  const studentView = isStudentUser(user);

  const loadTimetable = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const entriesRes = await API.get('/academics/timetable');
      setEntries(entriesRes.data?.data || []);
    } catch (requestError) {
      setEntries([]);
      setError(requestError.response?.data?.message || 'Failed to load timetable.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTimetable();
  }, [loadTimetable]);

  const scopedSections = useMemo(
    () => filterSectionsByScope(sections, filters, departmentCollegeMap),
    [sections, filters, departmentCollegeMap]
  );

  const subjectOptions = useMemo(() => {
    const unique = new Map();
    entries.forEach((entry) => {
      const subject = entry.subjectId;
      if (subject?._id && !unique.has(String(subject._id))) {
        unique.set(String(subject._id), subject);
      }
    });
    return [...unique.values()];
  }, [entries]);

  const teacherOptions = useMemo(() => {
    const unique = new Map();
    entries.forEach((entry) => {
      const teacher = entry.faculty;
      if (teacher?._id && !unique.has(String(teacher._id))) {
        unique.set(String(teacher._id), teacher);
      }
    });
    return [...unique.values()];
  }, [entries]);

  const filteredEntries = useMemo(() => entries.filter((entry) => {
    if (filters.sectionId && String(entry.sectionId?._id || entry.sectionId) !== String(filters.sectionId)) return false;
    if (selectedSubjectId && String(entry.subjectId?._id || entry.subjectId) !== String(selectedSubjectId)) return false;
    if (selectedTeacherId && String(entry.faculty?._id || entry.faculty) !== String(selectedTeacherId)) return false;
    return true;
  }), [entries, filters.sectionId, selectedSubjectId, selectedTeacherId]);

  const startDate = parseLocalDate(rangeStart);
  const endDate = parseLocalDate(rangeEnd);
  const effectiveStartDate = startDate && endDate && startDate <= endDate ? startDate : null;
  const effectiveEndDate = startDate && endDate && startDate <= endDate ? endDate : null;
  const rangeDates = useMemo(() => enumerateDates(effectiveStartDate, effectiveEndDate), [effectiveEndDate, effectiveStartDate]);
  const rangeLabel = effectiveStartDate && effectiveEndDate
    ? `${formatLongDate(effectiveStartDate)} - ${formatLongDate(effectiveEndDate)}`
    : 'Choose a valid date range';

  const studentDateGroups = useMemo(() => rangeDates.map((dateInfo) => ({
    ...dateInfo,
    items: filteredEntries
      .filter((entry) => entry.dayOfWeek === dateInfo.weekday)
      .sort((left, right) => String(left.startTime).localeCompare(String(right.startTime))),
  })), [filteredEntries, rangeDates]);

  const timetableStats = useMemo(() => {
    const activeDates = studentDateGroups.filter(({ items }) => items.length).length;
    const uniqueSubjects = new Set(filteredEntries.map((entry) => String(entry.subjectId?._id || entry.subjectId || '')).filter(Boolean)).size;
    return {
      activeDates,
      totalSlots: filteredEntries.length,
      uniqueSubjects,
      scopedSections: scopedSections.length,
      rangeDays: rangeDates.length,
    };
  }, [filteredEntries, rangeDates.length, scopedSections.length, studentDateGroups]);

  const handleScopeChange = (key, value) => {
    if (key === 'sectionId') {
      const selectedSection = sections.find((section) => String(section._id) === String(value));
      setFilters((current) => ({
        ...current,
        sectionId: value,
        collegeId: selectedSection
          ? (departmentCollegeMap.get(String(selectedSection.department?._id || selectedSection.department || '')) || '')
          : current.collegeId,
        departmentId: selectedSection ? String(selectedSection.department?._id || selectedSection.department || '') : current.departmentId,
        programId: selectedSection ? String(selectedSection.program?._id || selectedSection.program || '') : current.programId,
        courseId: selectedSection ? String(selectedSection.course?._id || selectedSection.course || '') : current.courseId,
        studyYear: selectedSection
          ? String(selectedSection.studyYear || selectedSection.academicSession?.yearNumber || '')
          : current.studyYear,
      }));
      return;
    }

    setFilters((current) => {
      const next = { ...current, [key]: value };
      if (key === 'collegeId') {
        next.departmentId = '';
        next.programId = '';
        next.courseId = '';
        next.sectionId = '';
      }
      if (key === 'departmentId') {
        next.programId = '';
        next.courseId = '';
        next.sectionId = '';
      }
      if (key === 'programId') {
        next.courseId = '';
        next.sectionId = '';
      }
      if (key === 'courseId' || key === 'studyYear') {
        next.sectionId = '';
      }
      return next;
    });
  };

  const handleDelete = async () => {
    if (!deleteState.entryId) return;
    setDeleteState((current) => ({ ...current, loading: true }));
    try {
      await API.delete(`/academics/timetable/${deleteState.entryId}`);
      toast.success('Timetable entry deleted');
      setDeleteState({ open: false, entryId: '', loading: false });
      await loadTimetable();
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || 'Delete failed');
      setDeleteState((current) => ({ ...current, loading: false }));
    }
  };

  if (loading || optionsLoading) return <FullPageSpinner />;

  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={deleteState.open}
        title="Delete timetable slot"
        description="Are you sure you want to delete this timetable slot?"
        confirmLabel="Delete"
        loading={deleteState.loading}
        onConfirm={handleDelete}
        onClose={() => setDeleteState({ open: false, entryId: '', loading: false })}
      />

      <PageHeader
        title="Timetable"
        subtitle={studentView
          ? 'Review your timetable across a selected start and end date range.'
          : 'Choose a date range, then open a section to build the recurring timetable within that calendar window.'}
      />

      {error ? <Alert type="error" message={error} /> : null}

      {!studentView ? (
        <>
          <div className="rounded-[28px] border border-[var(--border-strong)] bg-[var(--surface-card)] px-4 py-4 shadow-sm">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap gap-2">
                  <SummaryChip label="Sections" value={timetableStats.scopedSections} accent="primary" />
                  <SummaryChip label="Range Days" value={timetableStats.rangeDays} />
                  <SummaryChip label="Template Slots" value={entries.length} accent="success" />
                  <SummaryChip label="Week Window" value={rangeLabel} />
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 xl:min-w-[320px] xl:max-w-[360px] xl:flex-none">
                <div className="rounded-[22px] border border-[var(--border-strong)] bg-[var(--surface-soft)] px-3 py-2.5">
                  <label className="label mb-1 whitespace-nowrap text-[10px]">Start Date</label>
                  <input type="date" className="input h-9 min-h-9 rounded-2xl px-3 py-1.5 text-sm" value={rangeStart} onChange={(event) => setRangeStart(event.target.value)} />
                </div>
                <div className="rounded-[22px] border border-[var(--border-strong)] bg-[var(--surface-soft)] px-3 py-2.5">
                  <label className="label mb-1 whitespace-nowrap text-[10px]">End Date</label>
                  <input type="date" className="input h-9 min-h-9 rounded-2xl px-3 py-1.5 text-sm" value={rangeEnd} onChange={(event) => setRangeEnd(event.target.value)} />
                </div>
              </div>
            </div>
          </div>
          <div className="card p-3.5">
            <AcademicScopeFilters
              filters={filters}
              onChange={handleScopeChange}
              options={{ colleges, departments, programs, courses, sections }}
              departmentCollegeMap={departmentCollegeMap}
              singleLine
              compact
              className="min-w-0"
            />
          </div>
        </>
      ) : (
        <>
          <div className="rounded-[28px] border border-[var(--border-strong)] bg-[var(--surface-card)] px-4 py-4 shadow-sm">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap gap-2">
                  <SummaryChip label="Visible Slots" value={timetableStats.totalSlots} accent="primary" />
                  <SummaryChip label="Subjects" value={timetableStats.uniqueSubjects} />
                  <SummaryChip label="Range Days" value={timetableStats.rangeDays} accent="success" />
                  <SummaryChip label="Week Window" value={rangeLabel} />
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 xl:min-w-[320px] xl:max-w-[360px] xl:flex-none">
                <div className="rounded-[22px] border border-[var(--border-strong)] bg-[var(--surface-soft)] px-3 py-2.5">
                  <label className="label mb-1 whitespace-nowrap text-[10px]">Start Date</label>
                  <input type="date" className="input h-9 min-h-9 rounded-2xl px-3 py-1.5 text-sm" value={rangeStart} onChange={(event) => setRangeStart(event.target.value)} />
                </div>
                <div className="rounded-[22px] border border-[var(--border-strong)] bg-[var(--surface-soft)] px-3 py-2.5">
                  <label className="label mb-1 whitespace-nowrap text-[10px]">End Date</label>
                  <input type="date" className="input h-9 min-h-9 rounded-2xl px-3 py-1.5 text-sm" value={rangeEnd} onChange={(event) => setRangeEnd(event.target.value)} />
                </div>
              </div>
            </div>
          </div>
          <div className="card p-3.5">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
              <div className="grid flex-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="label mb-1 text-[10px]">Subject</label>
                  <select className="input h-10 min-h-10 rounded-2xl px-3 py-2 text-sm" value={selectedSubjectId} onChange={(event) => setSelectedSubjectId(event.target.value)}>
                    <option value="">All subjects</option>
                    {subjectOptions.map((subject) => (
                      <option key={subject._id} value={subject._id}>{subject.name} ({subject.code || '—'})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label mb-1 text-[10px]">Faculty</label>
                  <select className="input h-10 min-h-10 rounded-2xl px-3 py-2 text-sm" value={selectedTeacherId} onChange={(event) => setSelectedTeacherId(event.target.value)}>
                    <option value="">All faculty</option>
                    {teacherOptions.map((teacher) => (
                      <option key={teacher._id} value={teacher._id}>{teacher.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {!studentView && scopedSections.length ? (
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {scopedSections.map((section) => {
            const count = entries.filter((entry) => String(entry.sectionId?._id || entry.sectionId) === String(section._id)).length;
            const params = new URLSearchParams({ startDate: rangeStart, endDate: rangeEnd });
            return (
              <SectionCard
                key={section._id}
                section={section}
                slotCount={count}
                onClick={() => navigate(`/timetable/sections/${section._id}?${params.toString()}`)}
              />
            );
          })}
        </div>
      ) : null}

      {studentView && !rangeDates.length ? (
        <EmptyState
          icon="🗓️"
          title="Choose a valid date range"
          description="Set a start and end date to map your recurring timetable onto calendar dates."
        />
      ) : studentView && studentDateGroups.every(({ items }) => items.length === 0) ? (
        <EmptyState
          icon="🗓️"
          title="No timetable entries match this range"
          description="Your schedule will appear here once it is published for the selected filters and date range."
        />
      ) : studentView ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {studentDateGroups.map(({ key, weekday, label, items }) => (
            <section key={key} className="card overflow-hidden rounded-[28px]">
              <div className="border-b border-[var(--border-strong)] bg-[var(--surface-soft)] px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-display text-base font-bold text-[var(--text-strong)]">{weekday}</h2>
                    <p className="mt-1 text-xs font-medium text-[var(--text-muted)]">{label}</p>
                  </div>
                  <span className="rounded-full bg-[var(--surface-card)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">{items.length} slot{items.length === 1 ? '' : 's'}</span>
                </div>
              </div>
              <div className="min-h-[180px] space-y-3 p-4">
                {items.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[var(--border-strong)] p-4 text-center text-sm text-[var(--text-muted)]">No classes scheduled.</div>
                ) : items.map((entry) => (
                  <div key={`${key}-${entry._id}`} className="rounded-3xl border border-[var(--border-strong)] bg-[var(--surface-soft)] p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="break-words font-semibold text-[var(--text-strong)]">{entry.subjectId?.name || entry.title}</p>
                          {entry.subjectId?.code ? <span className="rounded-full bg-[var(--surface-card)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">{entry.subjectId.code}</span> : null}
                        </div>
                        <p className="mt-1 break-words text-sm text-[var(--text-muted)]">
                          {[entry.sectionId?.name ? `Section ${entry.sectionId.name}` : null, entry.faculty?.name || null].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[var(--text-muted)]">
                      <span className="inline-flex items-center gap-1"><FiClock size={12} /> {entry.startTime} - {entry.endTime}</span>
                      {entry.room ? <span className="inline-flex items-center gap-1"><FiMapPin size={12} /> {entry.room}</span> : null}
                      {entry.sectionId?.course?.name ? <span className="inline-flex items-center gap-1"><FiUsers size={12} /> {entry.sectionId.course.name}</span> : null}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}
