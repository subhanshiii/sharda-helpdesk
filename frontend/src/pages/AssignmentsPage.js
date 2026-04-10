import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import API from '../utils/api';
import { EmptyState, FullPageSpinner, PageHeader, Alert } from '../components/ui';
import { formatDate, formatRelative } from '../utils/helpers';
import { usePermissions } from '../context/PermissionContext';
import { useAuth } from '../context/AuthContext';
import { FiBookOpen, FiClock, FiPlus } from 'react-icons/fi';

const SubmissionBadge = ({ submission }) => {
  if (!submission) return <span className="badge bg-gray-100 text-gray-600">Pending</span>;
  const styles = {
    submitted: 'bg-blue-50 text-blue-700 border border-blue-200',
    graded: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    returned: 'bg-amber-50 text-amber-700 border border-amber-200',
  };
  return <span className={`badge ${styles[submission.status] || 'bg-gray-100 text-gray-600'}`}>{submission.status}</span>;
};

export default function AssignmentsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const canManageAssignments = ['faculty', 'admin'].includes(user?.role) || hasPermission('canManageAssignments');
  const canSubmitAssignments = user?.role === 'student' || hasPermission('canSubmitAssignments');

  useEffect(() => {
    const loadAssignments = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await API.get('/assignments');
        setAssignments(Array.isArray(res.data?.data) ? res.data.data : []);
      } catch (requestError) {
        const message = requestError.response?.data?.message || 'Failed to load assignments';
        setAssignments([]);
        setError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    };

    loadAssignments();
  }, []);

  const stats = useMemo(() => ({
    total: assignments.length,
    dueSoon: assignments.filter((assignment) => new Date(assignment.dueDate) > new Date() && new Date(assignment.dueDate) < new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)).length,
    submitted: assignments.filter((assignment) => assignment.mySubmission).length,
  }), [assignments]);

  if (!canManageAssignments && !canSubmitAssignments) {
    return <EmptyState icon="📚" title="Assignments unavailable" description="This account does not currently have assignment access." />;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Assignments"
        description={canManageAssignments
          ? 'Publish coursework, monitor upcoming deadlines, and keep assignment delivery consistent.'
          : 'Review assigned coursework, stay ahead of deadlines, and track your submission progress.'}
        action={canManageAssignments ? (
          <button onClick={() => navigate('/assignments/new')} className="btn-primary">
            <FiPlus size={15} /> Create Assignment
          </button>
        ) : null}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-gray-400">Assignments</p>
          <p className="mt-1 font-display text-3xl font-black text-gray-900">{stats.total}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-gray-400">Due Soon</p>
          <p className="mt-1 font-display text-3xl font-black text-orange-600">{stats.dueSoon}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-gray-400">{canManageAssignments ? 'Published' : 'Submitted'}</p>
          <p className="mt-1 font-display text-3xl font-black text-blue-700">{canManageAssignments ? stats.total : stats.submitted}</p>
        </div>
      </div>

      {error ? <Alert type="error" message={error} /> : null}

      {loading ? (
        <FullPageSpinner />
      ) : assignments.length === 0 ? (
        <EmptyState
          icon="📘"
          title={canManageAssignments ? 'No assignments yet' : 'No assignments assigned yet'}
          description={canManageAssignments ? 'Create the first assignment for your students.' : 'Assignments from faculty will appear here once published.'}
          action={canManageAssignments ? <button onClick={() => navigate('/assignments/new')} className="btn-primary"><FiPlus size={15} /> Create Assignment</button> : null}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {assignments.map((assignment) => (
            <Link key={assignment._id} to={`/assignments/${assignment._id}`} className="card p-5 transition-all hover:-translate-y-0.5 hover:shadow-card-hover">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-400">{assignment.subject || 'General'}</p>
                  <h3 className="mt-1 font-display text-lg font-bold text-gray-900">{assignment.title}</h3>
                </div>
                {canSubmitAssignments ? <SubmissionBadge submission={assignment.mySubmission} /> : <span className="badge bg-slate-100 text-slate-700">{assignment.submissionCount || 0} submissions</span>}
              </div>
              <p className="mt-3 line-clamp-3 text-sm leading-7 text-gray-600">{assignment.description}</p>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                <span className="inline-flex items-center gap-1"><FiClock size={12} /> Due {formatDate(assignment.dueDate)}</span>
                <span className="inline-flex items-center gap-1"><FiBookOpen size={12} /> {assignment.maxScore} points</span>
                {canManageAssignments ? <span>{assignment.gradedCount || 0} graded</span> : assignment.mySubmission?.submittedAt ? <span>Updated {formatRelative(assignment.mySubmission.submittedAt)}</span> : null}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
