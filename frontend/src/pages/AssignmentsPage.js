import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import API from '../utils/api';
import { EmptyState, FullPageSpinner, PageHeader, Alert } from '../components/ui';
import { formatDate, formatRelative } from '../utils/helpers';
import { usePermissions } from '../context/PermissionContext';
import { useAuth } from '../context/AuthContext';
import { FiBookOpen, FiClock, FiPlus, FiUpload, FiX } from 'react-icons/fi';

const SubmissionBadge = ({ submission }) => {
  if (!submission) return <span className="badge bg-gray-100 text-gray-600">Pending</span>;
  const styles = {
    submitted: 'bg-blue-50 text-blue-700 border border-blue-200',
    graded: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    returned: 'bg-amber-50 text-amber-700 border border-amber-200',
  };
  return <span className={`badge ${styles[submission.status] || 'bg-gray-100 text-gray-600'}`}>{submission.status}</span>;
};

function CreateAssignmentModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    subject: '',
    dueDate: '',
    maxScore: 100,
    audienceDepartments: '',
    audienceYears: '',
    audienceSections: '',
    allowLateSubmissions: false,
  });
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim() || !form.dueDate) {
      setError('Title, description, and due date are required');
      return;
    }

    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([key, value]) => fd.append(key, value));
      files.forEach((file) => fd.append('attachments', file));

      const res = await API.post('/assignments', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onCreated(res.data.data);
      toast.success('Assignment published');
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create assignment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col animate-fade-in-up">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h2 className="font-display font-bold text-gray-900 text-lg">Create Assignment</h2>
            <p className="text-xs text-gray-500 mt-1">Publish coursework for students by audience or specific section.</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500">
            <FiX size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4">
          {error && <Alert type="error" message={error} />}
          <div>
            <label className="label">Title</label>
            <input className="input" value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} placeholder="Database Systems - Assignment 03" />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input resize-none" rows={5} value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="Explain the task, rubric, and submission expectations..." />
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="label">Subject</label>
              <input className="input" value={form.subject} onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))} placeholder="DBMS" />
            </div>
            <div>
              <label className="label">Due Date</label>
              <input type="datetime-local" className="input" value={form.dueDate} onChange={(e) => setForm((prev) => ({ ...prev, dueDate: e.target.value }))} />
            </div>
            <div>
              <label className="label">Max Score</label>
              <input type="number" min="1" className="input" value={form.maxScore} onChange={(e) => setForm((prev) => ({ ...prev, maxScore: e.target.value }))} />
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="label">Departments</label>
              <input className="input" value={form.audienceDepartments} onChange={(e) => setForm((prev) => ({ ...prev, audienceDepartments: e.target.value }))} placeholder="CSE, IT" />
            </div>
            <div>
              <label className="label">Years</label>
              <input className="input" value={form.audienceYears} onChange={(e) => setForm((prev) => ({ ...prev, audienceYears: e.target.value }))} placeholder="2, 3" />
            </div>
            <div>
              <label className="label">Sections</label>
              <input className="input" value={form.audienceSections} onChange={(e) => setForm((prev) => ({ ...prev, audienceSections: e.target.value }))} placeholder="A, B" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={form.allowLateSubmissions} onChange={(e) => setForm((prev) => ({ ...prev, allowLateSubmissions: e.target.checked }))} />
            Allow late submissions
          </label>
          <div>
            <label className="label">Attachments</label>
            <label className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-2xl px-4 py-5 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
              <FiUpload size={16} className="text-blue-500" />
              <span className="text-sm text-gray-600">Upload assignment files</span>
              <input type="file" multiple className="hidden" onChange={(e) => setFiles(Array.from(e.target.files || []).slice(0, 5))} />
            </label>
            {files.length > 0 && (
              <div className="mt-3 space-y-2">
                {files.map((file, index) => (
                  <div key={`${file.name}-${index}`} className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-600">
                    <span className="truncate">{file.name}</span>
                    <button type="button" onClick={() => setFiles((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}>
                      <FiX size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">{saving ? 'Saving...' : 'Publish Assignment'}</button>
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AssignmentsPage() {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
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
      } catch (err) {
        const message = err.response?.data?.message || 'Failed to load assignments';
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
      {showModal && <CreateAssignmentModal onClose={() => setShowModal(false)} onCreated={(assignment) => setAssignments((prev) => [assignment, ...prev])} />}

      <PageHeader
        title="Assignments"
        subtitle={canManageAssignments
          ? `${stats.total} assignments published · ${stats.dueSoon} due soon`
          : `${stats.total} assignments assigned · ${stats.submitted} submitted`}
        action={canManageAssignments ? (
          <button onClick={() => setShowModal(true)} className="btn-primary">
            <FiPlus size={15} /> Create Assignment
          </button>
        ) : null}
      />

      <div className="grid md:grid-cols-3 gap-4">
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-gray-400">Assignments</p>
          <p className="font-display text-3xl font-black text-gray-900 mt-1">{stats.total}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-gray-400">Due Soon</p>
          <p className="font-display text-3xl font-black text-orange-600 mt-1">{stats.dueSoon}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-gray-400">{canManageAssignments ? 'Published' : 'Submitted'}</p>
          <p className="font-display text-3xl font-black text-blue-700 mt-1">{canManageAssignments ? stats.total : stats.submitted}</p>
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
          action={canManageAssignments ? <button onClick={() => setShowModal(true)} className="btn-primary"><FiPlus size={15} /> Create Assignment</button> : null}
        />
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          {assignments.map((assignment) => (
            <Link key={assignment._id} to={`/assignments/${assignment._id}`} className="card p-5 hover:-translate-y-0.5 hover:shadow-card-hover transition-all">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-400">{assignment.subject || 'General'}</p>
                  <h3 className="font-display text-lg font-bold text-gray-900 mt-1">{assignment.title}</h3>
                </div>
                {canSubmitAssignments ? <SubmissionBadge submission={assignment.mySubmission} /> : <span className="badge bg-slate-100 text-slate-700">{assignment.submissionCount || 0} submissions</span>}
              </div>
              <p className="text-sm text-gray-600 leading-7 mt-3 line-clamp-3">{assignment.description}</p>
              <div className="flex flex-wrap items-center gap-3 mt-4 text-xs text-gray-500">
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
