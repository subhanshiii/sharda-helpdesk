import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { FiArrowLeft, FiRefreshCw } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import API from '../utils/api';
import { Alert, ConfirmDialog, FullPageSpinner, PageHeader } from '../components/ui';
import AdvancedAcademicOperationsPanel from '../components/academics/AdvancedAcademicOperationsPanel';

export default function AdvancedAcademicOperationsPage() {
  const navigate = useNavigate();
  const [options, setOptions] = useState({
    colleges: [],
    departments: [],
    programs: [],
    courses: [],
    academicSessions: [],
    sections: [],
    subjects: [],
    faculty: [],
    students: [],
    enrollments: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState({ open: false, resource: '', item: null, loading: false });

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [
        workspaceRes,
        facultyRes,
        studentsRes,
      ] = await Promise.all([
        API.get('/academics/workspace-data'),
        API.get('/users?role=faculty&limit=100'),
        API.get('/users?role=student&limit=100'),
      ]);
      const workspace = workspaceRes.data?.data?.options || {};

      setOptions({
        colleges: workspace.colleges || [],
        departments: workspace.departments || [],
        programs: workspace.programs || [],
        courses: workspace.courses || [],
        academicSessions: workspace.academicSessions || [],
        sections: workspace.sections || [],
        subjects: workspace.subjects || [],
        faculty: facultyRes.data?.data || [],
        students: studentsRes.data?.data || [],
        enrollments: workspace.enrollments || [],
      });
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to load advanced academic operations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  const handleCreate = async (resource, payload) => {
    const response = await API.post(`/academics/${resource}`, payload);
    toast.success('Saved successfully');
    await loadWorkspace();
    return response;
  };

  const handleDelete = async () => {
    if (!confirmDelete.item || !confirmDelete.resource) return;
    setConfirmDelete((current) => ({ ...current, loading: true }));
    try {
      await API.delete(`/academics/${confirmDelete.resource}/${confirmDelete.item._id}`);
      toast.success('Academic record deleted');
      setConfirmDelete({ open: false, resource: '', item: null, loading: false });
      await loadWorkspace();
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || 'Delete failed');
      setConfirmDelete((current) => ({ ...current, loading: false }));
    }
  };

  if (loading) return <FullPageSpinner />;

  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={confirmDelete.open}
        title="Delete academic record"
        description={`Delete ${confirmDelete.item?.name || confirmDelete.item?.label || 'this record'}? This action cannot be undone.`}
        confirmLabel="Delete"
        loading={confirmDelete.loading}
        onConfirm={handleDelete}
        onClose={() => setConfirmDelete({ open: false, resource: '', item: null, loading: false })}
      />

      <PageHeader
        title="Advanced Academic Operations"
        description="Manage the deeper academic relationships that sit underneath the structure workspace."
        meta={['Subjects', 'Course links', 'Enrollments']}
        action={(
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => navigate('/academics')} className="btn-secondary">
              <FiArrowLeft size={15} />
              Back to Structure
            </button>
            <button type="button" onClick={loadWorkspace} className="btn-secondary">
              <FiRefreshCw size={15} />
              Refresh
            </button>
          </div>
        )}
      />

      {error ? <Alert type="error" message={error} /> : null}

      <AdvancedAcademicOperationsPanel
        options={options}
        onCreate={handleCreate}
        onDelete={(resourceKey, item) => setConfirmDelete({ open: true, resource: resourceKey, item, loading: false })}
      />
    </div>
  );
}
