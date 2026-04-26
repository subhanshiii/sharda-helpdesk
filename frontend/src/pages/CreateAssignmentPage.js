import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiUpload, FiX } from 'react-icons/fi';
import API from '../utils/api';
import { Alert, PageHeader } from '../components/ui';
import VisibilitySection from '../components/content/VisibilitySection';

export default function CreateAssignmentPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: '',
    description: '',
    subject: '',
    dueDate: '',
    maxScore: 100,
    audienceTiers: [],
    audienceRoles: [],
    audienceCollegeId: '',
    audienceDepartmentId: '',
    audienceProgramId: '',
    audienceCourseId: '',
    audienceStudyYear: '',
    audienceSectionId: '',
    allowLateSubmissions: false,
  });
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.title.trim() || !form.description.trim() || !form.dueDate) {
      setError('Title, description, and due date are required');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([key, value]) => fd.append(key, value));
      files.forEach((file) => fd.append('attachments', file));

      await API.post('/assignments', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      toast.success('Assignment published');
      navigate('/assignments');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to create assignment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Create Assignment" subtitle="Publish coursework with clear scope, due dates, and student-facing guidance." />

      <div className="card p-6">
        {error ? <div className="mb-4"><Alert type="error" message={error} /></div> : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Title</label>
            <input className="input" value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} placeholder="Database Systems - Assignment 03" />
          </div>

          <div>
            <label className="label">Description</label>
            <textarea className="input resize-none" rows={5} value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} placeholder="Explain the task, rubric, and submission expectations..." />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="label">Subject</label>
              <input className="input" value={form.subject} onChange={(event) => setForm((prev) => ({ ...prev, subject: event.target.value }))} placeholder="DBMS" />
            </div>
            <div>
              <label className="label">Due Date</label>
              <input type="datetime-local" className="input" value={form.dueDate} onChange={(event) => setForm((prev) => ({ ...prev, dueDate: event.target.value }))} />
            </div>
            <div>
              <label className="label">Max Score</label>
              <input type="number" min="1" className="input" value={form.maxScore} onChange={(event) => setForm((prev) => ({ ...prev, maxScore: event.target.value }))} />
            </div>
          </div>

          <VisibilitySection form={form} onChange={(key, value) => setForm((prev) => ({ ...prev, [key]: value }))} />

          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={form.allowLateSubmissions} onChange={(event) => setForm((prev) => ({ ...prev, allowLateSubmissions: event.target.checked }))} />
            Allow late submissions
          </label>

          <div>
            <label className="label">Attachments</label>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 p-4 transition-colors hover:border-blue-400 hover:bg-blue-50">
              <FiUpload size={18} className="text-gray-400" />
              <span className="text-sm text-gray-500">Click to upload files</span>
              <input type="file" multiple className="hidden" onChange={(event) => setFiles(Array.from(event.target.files || []).slice(0, 5))} />
            </label>
            {files.length > 0 ? (
              <div className="mt-2 space-y-1">
                {files.map((file, index) => (
                  <div key={`${file.name}-${index}`} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-1.5 text-xs text-gray-600">
                    <span className="truncate">{file.name}</span>
                    <button type="button" onClick={() => setFiles((prev) => prev.filter((_, itemIndex) => itemIndex !== index))} className="ml-2 text-gray-400 hover:text-red-500">
                      <FiX size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center py-2.5">
              {saving ? 'Saving...' : 'Create'}
            </button>
            <button type="button" onClick={() => navigate('/assignments')} className="btn-secondary">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
