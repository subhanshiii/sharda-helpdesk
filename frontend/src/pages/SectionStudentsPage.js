import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { FiArrowLeft, FiSearch, FiTrash2, FiUser } from 'react-icons/fi';
import { useNavigate, useParams } from 'react-router-dom';
import API from '../utils/api';
import { Alert, Avatar, ConfirmDialog, EmptyState, FullPageSpinner, PageHeader } from '../components/ui';

const matchesQuery = (student, query) => {
  if (!query) return true;
  const haystack = [
    student?.name,
    student?.email,
    student?.systemId,
    student?.department,
    student?.section,
  ].filter(Boolean).join(' ').toLowerCase();
  return haystack.includes(query);
};

export default function SectionStudentsPage() {
  const navigate = useNavigate();
  const { sectionId } = useParams();
  const [section, setSection] = useState(null);
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [confirmRemove, setConfirmRemove] = useState({ open: false, student: null, loading: false });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [workspaceRes, enrollmentsRes] = await Promise.all([
        API.get('/academics/workspace-data'),
        API.get('/academics/enrollments', {
          params: { section: sectionId, status: 'active', paginate: 'false' },
        }),
      ]);

      const sections = workspaceRes.data?.data?.options?.sections || [];
      const currentSection = sections.find((entry) => String(entry._id) === String(sectionId)) || null;
      const rows = (enrollmentsRes.data?.data || []).filter(
        (entry) => entry?.student?.status === 'approved' && entry?.student?.isActive !== false
      );

      setSection(currentSection);
      setEnrollments(rows);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to load enrolled students');
    } finally {
      setLoading(false);
    }
  }, [sectionId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredEnrollments = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return enrollments.filter((entry) => matchesQuery(entry.student, normalizedQuery));
  }, [enrollments, query]);

  const handleRemoveMapping = async () => {
    if (!confirmRemove.student?.systemId) return;
    setConfirmRemove((current) => ({ ...current, loading: true }));
    try {
      await API.put(`/users/${confirmRemove.student.systemId}`, { sectionId: '' });
      toast.success('Academic mapping removed');
      setConfirmRemove({ open: false, student: null, loading: false });
      await loadData();
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || 'Failed to remove academic mapping');
      setConfirmRemove((current) => ({ ...current, loading: false }));
    }
  };

  if (loading) return <FullPageSpinner />;

  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={confirmRemove.open}
        title="Remove section mapping"
        description={`Remove ${confirmRemove.student?.name || 'this student'} from the current section?`}
        confirmLabel="Remove Mapping"
        loading={confirmRemove.loading}
        onConfirm={handleRemoveMapping}
        onClose={() => setConfirmRemove({ open: false, student: null, loading: false })}
      />

      <PageHeader
        title="Enrolled Students"
        description={`Approved students currently mapped to ${section?.name ? `Section ${section.name}` : 'this section'}.`}
        meta={[
          section?.program?.name || 'Program',
          section?.course?.name || 'Course',
          section?.academicSession?.label || 'Academic Session',
        ]}
        action={(
          <button type="button" onClick={() => navigate('/academics')} className="btn-secondary">
            <FiArrowLeft size={15} />
            Back to Structure
          </button>
        )}
      />

      {error ? <Alert type="error" message={error} /> : null}

      <div className="card p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-lg font-bold text-gray-900">Student Directory</h2>
            <p className="mt-1 text-sm text-gray-500">Search approved students, open their profiles, or remove stale section mappings.</p>
          </div>
          <div className="relative w-full sm:max-w-xs">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
            <input
              className="input pl-10"
              placeholder="Search students"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </div>

        {filteredEnrollments.length ? (
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  <th className="pb-3 pr-4">Student</th>
                  <th className="pb-3 pr-4">System ID</th>
                  <th className="pb-3 pr-4">Semester</th>
                  <th className="pb-3 pr-4">Email</th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEnrollments.map((entry) => (
                  <tr key={entry._id}>
                    <td className="py-4 pr-4">
                      <div className="flex items-center gap-3">
                        <Avatar user={entry.student} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-gray-900">{entry.student?.name || 'Student'}</p>
                          <p className="mt-1 text-xs text-gray-500">{entry.student?.department || 'Department not set'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 pr-4 text-sm text-gray-700">{entry.student?.systemId || '—'}</td>
                    <td className="py-4 pr-4 text-sm text-gray-700">{entry.semester || '—'}</td>
                    <td className="py-4 pr-4 text-sm text-gray-500">{entry.student?.email || '—'}</td>
                    <td className="py-4 text-right">
                      <div className="flex justify-end gap-2">
                        {entry.student?.systemId ? (
                          <button type="button" onClick={() => navigate(`/admin/users/${entry.student.systemId}`)} className="btn-secondary text-xs">
                            <FiUser size={14} />
                            Open Profile
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => setConfirmRemove({ open: true, student: entry.student, loading: false })}
                          className="btn-secondary text-xs text-red-600 hover:text-red-700"
                        >
                          <FiTrash2 size={14} />
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-5">
            <EmptyState
              icon="👥"
              title="No approved students found"
              description="This section currently has no approved student enrollments matching the current search."
            />
          </div>
        )}
      </div>
    </div>
  );
}
