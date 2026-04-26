import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import API from '../utils/api';
import { Avatar, ConfirmDialog, EmptyState, FullPageSpinner } from '../components/ui';
import { formatDate, formatRelative, getAssetUrl, getRoleLabel } from '../utils/helpers';
import { usePermissions } from '../context/PermissionContext';
import { useAuth } from '../context/AuthContext';
import { FiArrowLeft, FiCheck, FiDownload, FiTrash2, FiUpload, FiX } from 'react-icons/fi';

const SubmissionState = ({ status }) => {
  const styles = {
    submitted: 'bg-blue-50 text-blue-700 border border-blue-200',
    graded: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    returned: 'bg-amber-50 text-amber-700 border border-amber-200',
  };
  return <span className={`badge ${styles[status] || 'bg-gray-100 text-gray-600'}`}>{status}</span>;
};

export default function AssignmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const [assignment, setAssignment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [gradingId, setGradingId] = useState('');
  const [error, setError] = useState('');
  const [submissionComment, setSubmissionComment] = useState('');
  const [submissionFiles, setSubmissionFiles] = useState([]);
  const [gradeDrafts, setGradeDrafts] = useState({});
  const [deleteState, setDeleteState] = useState({ open: false, loading: false });

  const canManageAssignments = ['faculty', 'admin'].includes(user?.role) || hasPermission('canManageAssignments');
  const canSubmitAssignments = user?.role === 'student' || hasPermission('canSubmitAssignments');

  useEffect(() => {
    const loadAssignment = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await API.get(`/assignments/${id}`);
        setAssignment(res.data.data);
      } catch (err) {
        const message = err.response?.data?.message || 'Failed to load assignment';
        setError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    };

    loadAssignment();
  }, [id, navigate]);

  const handleSubmitWork = async (e) => {
    e.preventDefault();
    if (!submissionComment.trim() && submissionFiles.length === 0) {
      toast.error('Add a note or a file before submitting');
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('comment', submissionComment);
      submissionFiles.forEach((file) => fd.append('attachments', file));
      await API.post(`/assignments/${id}/submissions`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const res = await API.get(`/assignments/${id}`);
      setAssignment(res.data.data);
      setSubmissionComment('');
      setSubmissionFiles([]);
      setError('');
      toast.success('Submission saved');
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to submit assignment';
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGrade = async (submissionId) => {
    setGradingId(submissionId);
    try {
      const draft = gradeDrafts[submissionId] || {};
      await API.put(`/assignments/${id}/submissions/${submissionId}/grade`, draft);
      const res = await API.get(`/assignments/${id}`);
      setAssignment(res.data.data);
      setError('');
      toast.success('Submission graded');
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to grade submission';
      setError(message);
      toast.error(message);
    } finally {
      setGradingId('');
    }
  };

  const dueState = useMemo(() => {
    if (!assignment?.dueDate) return '';
    const due = new Date(assignment.dueDate);
    return due < new Date() ? 'Past due' : `Due ${formatRelative(assignment.dueDate)}`;
  }, [assignment?.dueDate]);

  if (loading) return <FullPageSpinner />;
  if (!assignment) {
    return (
      <div className="space-y-5">
        {error ? <div className="card p-5"><p className="text-sm text-red-600">{error}</p></div> : null}
        <EmptyState
          icon="📘"
          title="Assignment unavailable"
          description="This assignment could not be loaded or you may not have access to it."
          action={<Link to="/assignments" className="btn-secondary">Back to assignments</Link>}
        />
      </div>
    );
  }

  const getDownloadUrl = (assetPath) => {
    const url = getAssetUrl(assetPath);
    return `${url}${url.includes('?') ? '&' : '?'}download=1`;
  };

  const handleDeleteAssignment = async () => {
    setDeleteState({ open: true, loading: true });
    try {
      await API.delete(`/assignments/${id}`);
      toast.success('Assignment deleted');
      navigate('/assignments');
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to delete assignment';
      setError(message);
      toast.error(message);
      setDeleteState({ open: true, loading: false });
    }
  };

  return (
    <div className="space-y-5">
      <ConfirmDialog
        open={deleteState.open}
        title="Delete assignment"
        description="This will remove the assignment and all submitted work linked to it. This action cannot be undone."
        confirmLabel="Delete Assignment"
        loading={deleteState.loading}
        onConfirm={handleDeleteAssignment}
        onClose={() => setDeleteState({ open: false, loading: false })}
      />
      <div className="flex items-start gap-3">
        <button onClick={() => navigate('/assignments')} className="btn-secondary p-2"><FiArrowLeft size={16} /></button>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-bold text-gray-900">{assignment.title}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{assignment.subject || 'General'} · {dueState}</p>
        </div>
        {canManageAssignments ? (
          <button type="button" onClick={() => setDeleteState({ open: true, loading: false })} className="btn-secondary text-red-600 hover:text-red-700">
            <FiTrash2 size={14} />
            Delete
          </button>
        ) : null}
      </div>

      <div className="card p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
          <span className="badge bg-blue-50 text-blue-700 border border-blue-200">{assignment.maxScore} points</span>
          <span className="badge bg-slate-100 text-slate-700">{assignment.allowLateSubmissions ? 'Late allowed' : 'Late blocked'}</span>
          <span>Created by {assignment.createdBy?.name} · {getRoleLabel(assignment.createdBy?.role)}</span>
          <span>{formatDate(assignment.dueDate)}</span>
        </div>
        <p className="text-sm text-gray-700 leading-7 whitespace-pre-wrap">{assignment.description}</p>

        {assignment.attachments?.length > 0 && (
          <div className="grid md:grid-cols-2 gap-2">
            {assignment.attachments.map((file, index) => (
              <a key={`${file.url}-${index}`} href={getDownloadUrl(file.url)} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
                  <FiDownload size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-800 truncate">{file.originalName}</p>
                  <p className="text-xs text-gray-500">{file.mimetype || 'Attachment'}</p>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>

      {error ? <div className="card p-4"><p className="text-sm text-red-600">{error}</p></div> : null}

      {canSubmitAssignments && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-bold text-gray-900">Your Submission</h2>
            {assignment.mySubmission ? <SubmissionState status={assignment.mySubmission.status} /> : <span className="badge bg-gray-100 text-gray-600">Not submitted</span>}
          </div>

          {assignment.mySubmission && (
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-2">
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{assignment.mySubmission.comment || 'No submission note added.'}</p>
              <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                <span>Submitted {formatDate(assignment.mySubmission.submittedAt)}</span>
                {assignment.mySubmission.score !== null && <span>Score: {assignment.mySubmission.score}/{assignment.maxScore}</span>}
              </div>
              {assignment.mySubmission.feedback && (
                <div className="rounded-xl bg-white p-3 border border-emerald-100">
                  <p className="text-xs uppercase tracking-wide text-emerald-500">Faculty Feedback</p>
                  <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{assignment.mySubmission.feedback}</p>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmitWork} className="space-y-3">
            <textarea className="input resize-none" rows={4} value={submissionComment} onChange={(e) => setSubmissionComment(e.target.value)} placeholder="Add your submission note, summary, or relevant links..." />
            <label className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-2xl px-4 py-5 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
              <FiUpload size={16} className="text-blue-500" />
              <span className="text-sm text-gray-600">Upload submission files</span>
              <input type="file" multiple className="hidden" onChange={(e) => setSubmissionFiles(Array.from(e.target.files || []).slice(0, 5))} />
            </label>
            {submissionFiles.length > 0 && (
              <div className="space-y-2">
                {submissionFiles.map((file, index) => (
                  <div key={`${file.name}-${index}`} className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-600">
                    <span className="truncate">{file.name}</span>
                    <button type="button" onClick={() => setSubmissionFiles((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}>
                      <FiX size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button type="submit" disabled={submitting} className="btn-primary">
              <FiCheck size={14} /> {submitting ? 'Saving...' : assignment.mySubmission ? 'Update Submission' : 'Submit Assignment'}
            </button>
          </form>
        </div>
      )}

      {canManageAssignments && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold text-gray-900">Student Submissions</h2>
            <span className="text-sm text-gray-500">{assignment.submissions?.length || 0} received</span>
          </div>
          {assignment.submissions?.length ? (
            <div className="space-y-4">
              {assignment.submissions.map((submission) => (
                <div key={submission._id} className="rounded-2xl border border-gray-100 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={submission.student?.name} size="md" />
                      <div>
                        <p className="font-semibold text-gray-900">{submission.student?.name}</p>
                        <p className="text-xs text-gray-400">{submission.student?.department} · Year {submission.student?.year || 'N/A'} · Section {submission.student?.section || 'N/A'}</p>
                      </div>
                    </div>
                    <SubmissionState status={submission.status} />
                  </div>

                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{submission.comment || 'No submission note added.'}</p>

                  {submission.attachments?.length > 0 && (
                    <div className="grid md:grid-cols-2 gap-2">
                      {submission.attachments.map((file, index) => (
                        <a key={`${file.url}-${index}`} href={getDownloadUrl(file.url)} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors">
                          <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
                            <FiDownload size={16} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-gray-800 truncate">{file.originalName}</p>
                            <p className="text-xs text-gray-500">{file.mimetype || 'Attachment'}</p>
                          </div>
                        </a>
                      ))}
                    </div>
                  )}

                  <div className="grid md:grid-cols-2 gap-3">
                    <div>
                      <label className="label text-xs">Score</label>
                      <input type="number" min="0" max={assignment.maxScore} className="input text-sm" value={gradeDrafts[submission._id]?.score ?? submission.score ?? ''} onChange={(e) => setGradeDrafts((prev) => ({ ...prev, [submission._id]: { ...(prev[submission._id] || {}), score: e.target.value, feedback: prev[submission._id]?.feedback ?? submission.feedback ?? '' } }))} />
                    </div>
                    <div>
                      <label className="label text-xs">Status</label>
                      <select className="input text-sm" value={gradeDrafts[submission._id]?.status ?? submission.status} onChange={(e) => setGradeDrafts((prev) => ({ ...prev, [submission._id]: { ...(prev[submission._id] || {}), status: e.target.value, score: prev[submission._id]?.score ?? submission.score ?? '', feedback: prev[submission._id]?.feedback ?? submission.feedback ?? '' } }))}>
                        <option value="submitted">Submitted</option>
                        <option value="graded">Graded</option>
                        <option value="returned">Returned</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="label text-xs">Feedback</label>
                    <textarea className="input resize-none text-sm" rows={3} value={gradeDrafts[submission._id]?.feedback ?? submission.feedback ?? ''} onChange={(e) => setGradeDrafts((prev) => ({ ...prev, [submission._id]: { ...(prev[submission._id] || {}), feedback: e.target.value, score: prev[submission._id]?.score ?? submission.score ?? '', status: prev[submission._id]?.status ?? submission.status } }))} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">Submitted {formatDate(submission.submittedAt)}</span>
                    <button onClick={() => handleGrade(submission._id)} disabled={gradingId === submission._id} className="btn-primary">
                      <FiCheck size={14} /> {gradingId === submission._id ? 'Saving...' : 'Save Grade'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon="📝" title="No submissions yet" description="Student work will appear here once the assignment is submitted." />
          )}
        </div>
      )}

      {!canManageAssignments && !canSubmitAssignments && (
        <EmptyState icon="📚" title="Assignments unavailable" description="This account does not currently have assignment access." action={<Link to="/dashboard" className="btn-secondary">Back to dashboard</Link>} />
      )}
    </div>
  );
}
