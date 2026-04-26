import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiClock, FiEdit2, FiMapPin, FiPlus, FiTrash2 } from 'react-icons/fi';
import API from '../utils/api';
import { Alert, ConfirmDialog, EmptyState, FullPageSpinner, PageHeader } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../context/PermissionContext';
import AcademicScopeFilters from '../components/academics/AcademicScopeFilters';
import {
  buildDepartmentCollegeMap,
  buildScopeOptions,
  emptyAcademicScopeFilters,
} from '../utils/academicScope';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function TimetablePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const [entries, setEntries] = useState([]);
  const [sections, setSections] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [courses, setCourses] = useState([]);
  const [filters, setFilters] = useState(emptyAcademicScopeFilters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteState, setDeleteState] = useState({ open: false, entryId: '', loading: false });

  const canManage = hasPermission('canManageTimetable');

  const loadTimetable = useCallback(async (activeFilters) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      Object.entries(activeFilters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      const res = await API.get(`/academics/timetable${params.toString() ? `?${params}` : ''}`);
      setEntries(res.data?.data || []);
    } catch (requestError) {
      setEntries([]);
      setError(requestError.response?.data?.message || 'Failed to load timetable.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const loadAcademicData = async () => {
      try {
        const [collegesRes, departmentsRes, programsRes, coursesRes, sectionsRes] = await Promise.all([
          API.get('/academics/colleges?paginate=false'),
          API.get('/academics/departments?paginate=false'),
          API.get('/academics/programs?paginate=false'),
          API.get('/academics/courses?paginate=false'),
          API.get('/academics/sections'),
        ]);
        setColleges(Array.isArray(collegesRes.data?.data) ? collegesRes.data.data : []);
        setDepartments(Array.isArray(departmentsRes.data?.data) ? departmentsRes.data.data : []);
        setPrograms(Array.isArray(programsRes.data?.data) ? programsRes.data.data : []);
        setCourses(Array.isArray(coursesRes.data?.data) ? coursesRes.data.data : []);
        setSections(Array.isArray(sectionsRes.data?.data) ? sectionsRes.data.data : []);
      } catch {
        setColleges([]);
        setDepartments([]);
        setPrograms([]);
        setCourses([]);
        setSections([]);
      }
    };

    loadAcademicData();
  }, []);

  useEffect(() => {
    loadTimetable(filters);
  }, [filters, loadTimetable]);

  const departmentCollegeMap = useMemo(() => buildDepartmentCollegeMap(departments), [departments]);
  const scopedOptions = useMemo(
    () => buildScopeOptions({ colleges, departments, programs, courses, sections }, filters, departmentCollegeMap),
    [colleges, departments, programs, courses, sections, filters, departmentCollegeMap]
  );

  const handleScopeChange = (key, value) => {
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

  const groupedEntries = useMemo(() => DAYS.map((day) => ({
    day,
    items: entries.filter((entry) => entry.dayOfWeek === day),
  })), [entries]);

  const handleDelete = async () => {
    if (!deleteState.entryId) return;
    setDeleteState((current) => ({ ...current, loading: true }));
    try {
      await API.delete(`/academics/timetable/${deleteState.entryId}`);
      toast.success('Timetable entry deleted');
      setDeleteState({ open: false, entryId: '', loading: false });
      await loadTimetable(filters);
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || 'Delete failed');
      setDeleteState((current) => ({ ...current, loading: false }));
    }
  };

  if (loading) return <FullPageSpinner />;

  return (
    <div className="space-y-5">
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
        description={canManage ? 'Manage weekly class slots and filter them across the full academic hierarchy.' : 'View your scheduled classes with college-to-section filtering.'}
        action={canManage ? (
          <button type="button" onClick={() => navigate('/timetable/new')} className="btn-primary">
            <FiPlus size={15} />
            Add Slot
          </button>
        ) : null}
      />

      {error ? <Alert type="error" message={error} /> : null}

      <div className="card p-4">
        <AcademicScopeFilters
          filters={filters}
          onChange={handleScopeChange}
          options={scopedOptions}
          departmentCollegeMap={departmentCollegeMap}
        />
      </div>

      {entries.length === 0 ? (
        <EmptyState
          icon="🗓️"
          title="No timetable entries yet"
          description={canManage ? 'Create the first class slot from the dedicated timetable page.' : 'Your class schedule will appear here once it is published.'}
          action={canManage ? (
            <button type="button" onClick={() => navigate('/timetable/new')} className="btn-primary">
              <FiPlus size={15} />
              Add Slot
            </button>
          ) : null}
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {groupedEntries.map(({ day, items }) => (
            <section key={day} className="card overflow-hidden">
              <div className="border-b border-gray-100 px-4 py-3.5">
                <h2 className="font-display text-base font-bold text-gray-900">{day}</h2>
              </div>
              <div className="min-h-[140px] space-y-3 p-4">
                {items.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-gray-200 p-4 text-center text-sm text-gray-400">No classes scheduled.</div>
                ) : items.map((entry) => (
                  <div key={entry._id} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-gray-900">{entry.title}</p>
                        <p className="mt-1 text-sm text-gray-500">
                          {entry.subject || 'General'} · {entry.sectionId?.department?.name || entry.department}
                          {entry.sectionId?.studyYear || entry.year ? ` · Year ${entry.sectionId?.studyYear || entry.year}` : ''}
                          {' · '}
                          Section {entry.sectionId?.name || entry.section}
                        </p>
                      </div>
                      {canManage ? (
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => navigate(`/timetable/${entry._id}/edit`)} className="rounded-lg p-2 text-gray-400 hover:bg-white hover:text-blue-700">
                            <FiEdit2 size={15} />
                          </button>
                          <button type="button" onClick={() => setDeleteState({ open: true, entryId: entry._id, loading: false })} className="rounded-lg p-2 text-gray-400 hover:bg-white hover:text-red-600">
                            <FiTrash2 size={15} />
                          </button>
                        </div>
                      ) : null}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                      <span className="inline-flex items-center gap-1"><FiClock size={12} /> {entry.startTime} - {entry.endTime}</span>
                      {entry.room ? <span className="inline-flex items-center gap-1"><FiMapPin size={12} /> {entry.room}</span> : null}
                      {entry.faculty?.name ? <span>{entry.faculty.name}</span> : null}
                    </div>
                    {entry.notes ? <p className="mt-3 text-sm text-gray-600">{entry.notes}</p> : null}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
