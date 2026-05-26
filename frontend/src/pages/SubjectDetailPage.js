import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { FiArrowLeft, FiChevronDown, FiRefreshCw, FiUsers, FiX } from 'react-icons/fi';
import { useNavigate, useParams } from 'react-router-dom';
import API from '../utils/api';
import { Alert, EmptyState, FullPageSpinner, PageHeader } from '../components/ui';
import { getSubjectCourseIds, subjectMatchesCourse } from '../utils/academicScope';

const getSectionTeacherIds = (subject, sectionId) => (
  (subject?.sectionTeachers || [])
    .filter((mapping) => String(mapping.section?._id || mapping.section) === String(sectionId))
    .map((mapping) => String(mapping.teacher?._id || mapping.teacher))
);

const toggleTeacherSelection = (teacherId, selectedTeacherIds = []) => (
  selectedTeacherIds.includes(teacherId)
    ? selectedTeacherIds.filter((currentId) => currentId !== teacherId)
    : [...selectedTeacherIds, teacherId]
);

const getTeacherSelectionLabel = (teacherIds = [], teachers = []) => {
  if (!teacherIds.length) return 'No override teachers selected';
  const selectedTeachers = teachers.filter((teacher) => teacherIds.includes(String(teacher._id)));
  if (selectedTeachers.length === 1) return selectedTeachers[0].name;
  if (selectedTeachers.length === 2) return selectedTeachers.map((teacher) => teacher.name).join(', ');
  return `${selectedTeachers.length} teachers selected`;
};

export default function SubjectDetailPage() {
  const navigate = useNavigate();
  const { subjectId } = useParams();
  const [workspace, setWorkspace] = useState({
    faculty: [],
    courses: [],
    sections: [],
  });
  const [subject, setSubject] = useState(null);
  const [generalTeacherIds, setGeneralTeacherIds] = useState([]);
  const [sectionTeacherSelections, setSectionTeacherSelections] = useState({});
  const [openSectionPickerId, setOpenSectionPickerId] = useState(null);
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [savingSections, setSavingSections] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [detailRes, workspaceRes] = await Promise.all([
        API.get(`/academics/subjects/${subjectId}/detail`),
        API.get('/academics/subject-management'),
      ]);
      const nextSubject = detailRes.data?.data || null;
      const nextWorkspace = workspaceRes.data?.data || {};

      setSubject(nextSubject);
      setWorkspace(nextWorkspace);
      setGeneralTeacherIds((nextSubject?.teachers || []).map((teacher) => String(teacher._id)));

      const nextSelections = {};
      (nextWorkspace.sections || []).forEach((section) => {
        if (nextSubject && subjectMatchesCourse(nextSubject, section.course?._id || section.course)) {
          nextSelections[section._id] = getSectionTeacherIds(nextSubject, section._id);
        }
      });
      setSectionTeacherSelections(nextSelections);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to load subject detail');
    } finally {
      setLoading(false);
    }
  }, [subjectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const availableCourses = useMemo(() => {
    if (!subject) return [];
    return (workspace.courses || []).filter((course) => (
      String(course.program?._id || course.program) === String(subject.program?._id || subject.program)
      && String(course.department?._id || course.department) === String(subject.department?._id || subject.department)
    ));
  }, [subject, workspace.courses]);

  const availableSections = useMemo(() => {
    if (!subject) return [];
    const courseIds = getSubjectCourseIds(subject);
    return (workspace.sections || []).filter((section) => (
      courseIds.includes(String(section.course?._id || section.course))
      && String(section.program?._id || section.program) === String(subject.program?._id || subject.program)
      && String(section.academicSession?._id || section.academicSession) === String(subject.academicSession?._id || subject.academicSession)
    ));
  }, [subject, workspace.sections]);

  const eligibleSectionTeachers = useMemo(() => {
    const teacherIds = new Set((subject?.teachers || []).map((teacher) => String(teacher._id)));
    return (workspace.faculty || []).filter((teacher) => teacherIds.has(String(teacher._id)));
  }, [subject?.teachers, workspace.faculty]);

  const activeSectionPicker = useMemo(
    () => availableSections.find((section) => String(section._id) === String(openSectionPickerId)) || null,
    [availableSections, openSectionPickerId],
  );

  const handleSaveGeneralTeachers = async () => {
    if (!subject) return;
    setSavingGeneral(true);
    try {
      const response = await API.put(`/academics/subjects/${subject._id}/teachers`, {
        teacherIds: generalTeacherIds,
      });
      setSubject(response.data?.data || subject);
      toast.success('General teacher assignments updated');
      await loadData();
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || 'Failed to update teacher assignments');
    } finally {
      setSavingGeneral(false);
    }
  };

  const handleGeneralTeacherToggle = (teacherId) => {
    setGeneralTeacherIds((current) => toggleTeacherSelection(String(teacherId), current));
  };

  const handleSectionTeacherToggle = (sectionId, teacherId) => {
    setSectionTeacherSelections((current) => ({
      ...current,
      [sectionId]: toggleTeacherSelection(String(teacherId), current[sectionId] || []),
    }));
  };

  const toggleSectionPicker = (sectionId) => {
    setOpenSectionPickerId((current) => (current === sectionId ? null : sectionId));
  };

  const handleSaveSectionTeachers = async (sectionId) => {
    if (!subject) return;
    setSavingSections((current) => ({ ...current, [sectionId]: true }));
    try {
      const response = await API.put(`/academics/subjects/${subject._id}/sections/${sectionId}/teachers`, {
        teacherIds: sectionTeacherSelections[sectionId] || [],
      });
      setSubject(response.data?.data || subject);
      setOpenSectionPickerId(null);
      toast.success('Section teacher override updated');
      await loadData();
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || 'Failed to update section teacher override');
    } finally {
      setSavingSections((current) => ({ ...current, [sectionId]: false }));
    }
  };

  if (loading) return <FullPageSpinner />;
  if (!subject) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Subject Detail"
          description="The requested subject could not be found."
          action={(
            <button type="button" onClick={() => navigate('/academics/subject-management')} className="btn-secondary">
              <FiArrowLeft size={15} />
              Back to Subject Management
            </button>
          )}
        />
        <EmptyState icon="📘" title="Subject not found" description="Refresh the workspace or open a different subject from the management list." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={subject.name}
        description="This is the single source of truth for course links, general teacher ownership, and optional section-specific teaching context."
        meta={[
          subject.code,
          subject.program?.name || 'Program',
          subject.academicSession?.label || 'Academic Session',
        ]}
        action={(
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => navigate('/academics/subject-management')} className="btn-secondary">
              <FiArrowLeft size={15} />
              Back to Subject Management
            </button>
            <button type="button" onClick={loadData} className="btn-secondary">
              <FiRefreshCw size={15} />
              Refresh
            </button>
          </div>
        )}
      />

      {error ? <Alert type="error" message={error} /> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <div className="card p-6">
          <div>
            <h2 className="font-display text-lg font-bold text-gray-900">Subject Context</h2>
            <p className="mt-1 text-sm text-gray-500">This page is for teacher assignment. Subject definition and lifecycle stay in Subject Management.</p>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Department</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{subject.department?.name || '—'}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Program</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{subject.program?.name || '—'}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Session</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{subject.academicSession?.label || '—'}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Credits</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{subject.credits ?? 0}</p>
            </div>
          </div>

          <div className="mt-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Linked Courses</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {availableCourses.length ? availableCourses
                .filter((course) => getSubjectCourseIds(subject).includes(String(course._id)))
                .map((course) => (
                  <span key={course._id} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
                    {course.name} ({course.code})
                  </span>
                )) : <span className="text-sm text-gray-400">No linked courses.</span>}
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold text-gray-900">General Teachers</h2>
              <p className="mt-1 text-sm text-gray-500">Assign the eligible teachers for this subject here first. Section assignments below are chosen from this teacher pool.</p>
            </div>
            <button type="button" onClick={handleSaveGeneralTeachers} disabled={savingGeneral} className="btn-primary">
              <FiUsers size={15} />
              {savingGeneral ? 'Saving...' : 'Save Teachers'}
            </button>
          </div>

          <div className="mt-5 max-h-80 overflow-y-auto pr-1">
            <div className="grid gap-3 sm:grid-cols-2">
              {(workspace.faculty || []).map((teacher) => {
                const isSelected = generalTeacherIds.includes(String(teacher._id));
                return (
                  <label
                    key={teacher._id}
                    className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition ${
                      isSelected
                        ? 'border-emerald-300 bg-emerald-50'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      checked={isSelected}
                      onChange={() => handleGeneralTeacherToggle(teacher._id)}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{teacher.name}</p>
                      <p className="text-xs text-slate-500">{teacher.systemId || teacher.email}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {(subject.teachers || []).length ? subject.teachers.map((teacher) => (
              <span key={teacher._id} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700">
                {teacher.name}
              </span>
            )) : <span className="text-sm text-gray-400">No general teachers assigned yet.</span>}
          </div>
        </div>
      </div>

      <div className="card p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-gray-900">Section-Specific Teacher Overrides</h2>
            <p className="mt-1 text-sm text-gray-500">These are the sections that currently have this subject. You can assign the same subject teacher to multiple sections or split sections across different teachers.</p>
          </div>
          <div className="rounded-2xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
            {availableSections.length} section{availableSections.length === 1 ? '' : 's'}
          </div>
        </div>

        {availableSections.length ? (
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  <th className="pb-3 pr-4">Section</th>
                  <th className="pb-3 pr-4">Course</th>
                  <th className="pb-3 pr-4">Override Teachers</th>
                  <th className="pb-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {availableSections.map((section) => (
                  <tr key={section._id}>
                    <td className="py-4 pr-4 align-top">
                      <p className="font-semibold text-gray-900">{section.name}</p>
                      <p className="mt-1 text-xs text-gray-500">{section.academicSession?.label || 'Academic Session'} · Year {section.studyYear || section.academicSession?.yearNumber || '—'}</p>
                    </td>
                    <td className="py-4 pr-4 align-top text-sm text-gray-600">{section.course?.name || '—'}</td>
                    <td className="py-4 pr-4 align-top">
                      <div className="min-w-[18rem]">
                        <button
                          type="button"
                          onClick={() => toggleSectionPicker(section._id)}
                          disabled={!eligibleSectionTeachers.length}
                          className={`flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm shadow-sm transition hover:border-slate-300 ${
                            !eligibleSectionTeachers.length ? 'cursor-not-allowed opacity-60' : ''
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900">Choose Teachers</p>
                            <p className="truncate text-xs text-slate-500">
                              {getTeacherSelectionLabel(sectionTeacherSelections[section._id] || [], eligibleSectionTeachers)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                              {eligibleSectionTeachers.length}
                            </span>
                            <FiChevronDown size={15} className={`text-slate-500 transition ${openSectionPickerId === section._id ? 'rotate-180' : ''}`} />
                          </div>
                        </button>
                      </div>
                    </td>
                    <td className="py-4 text-right align-top">
                      <button type="button" onClick={() => handleSaveSectionTeachers(section._id)} disabled={Boolean(savingSections[section._id]) || !eligibleSectionTeachers.length} className="btn-secondary text-xs">
                        {savingSections[section._id] ? 'Saving...' : 'Save Override'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-5">
            <EmptyState
              icon="🏫"
              title="No sections available"
              description="Link this subject to one or more courses first. Sections from those courses will appear here automatically."
            />
          </div>
        )}

        {availableSections.length && !eligibleSectionTeachers.length ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Assign teachers at subject level first. Section-level assignment becomes available from that eligible teacher list.
          </div>
        ) : null}
      </div>

      {activeSectionPicker ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-white/20 backdrop-blur-sm px-4 py-8">
          <button
            type="button"
            aria-label="Close teacher picker"
            className="absolute inset-0 cursor-default"
            onClick={() => setOpenSectionPickerId(null)}
          />

          <div className="relative z-10 w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-bold text-slate-900">Choose Teachers</p>
                <p className="mt-1 text-sm text-slate-500">{activeSectionPicker.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpenSectionPickerId(null)}
                className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close teacher picker"
              >
                <FiX size={16} />
              </button>
            </div>

            <div className="grid max-h-80 gap-2 overflow-y-auto pr-1">
              {eligibleSectionTeachers.map((teacher) => {
                const isSelected = (sectionTeacherSelections[activeSectionPicker._id] || []).includes(String(teacher._id));
                return (
                  <label
                    key={teacher._id}
                    className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-3 py-2 transition ${
                      isSelected
                        ? 'border-emerald-300 bg-emerald-50'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      checked={isSelected}
                      onChange={() => handleSectionTeacherToggle(activeSectionPicker._id, teacher._id)}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{teacher.name}</p>
                      <p className="text-xs text-slate-500">{teacher.systemId || teacher.email}</p>
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="mt-4 flex justify-end gap-3">
              <button type="button" onClick={() => setOpenSectionPickerId(null)} className="btn-secondary">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSaveSectionTeachers(activeSectionPicker._id)}
                disabled={Boolean(savingSections[activeSectionPicker._id])}
                className="btn-primary"
              >
                {savingSections[activeSectionPicker._id] ? 'Saving...' : 'Save Teachers'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
