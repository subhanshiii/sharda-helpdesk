import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiUpload, FiX } from 'react-icons/fi';
import API from '../utils/api';
import { Alert, PageHeader } from '../components/ui';
import VisibilitySection from '../components/content/VisibilitySection';

const CATEGORY_OPTIONS = [
  { value: 'academic', label: 'Academic' },
  { value: 'administrative', label: 'Administrative' },
  { value: 'student-services', label: 'Student Services' },
];

const emptyAudience = {
  audienceTiers: [],
  audienceRoles: [],
  audienceCollegeId: '',
  audienceDepartmentId: '',
  audienceProgramId: '',
  audienceCourseId: '',
  audienceStudyYear: '',
  audienceSectionId: '',
  audienceDepartments: [],
  audienceYears: [],
  audienceSections: [],
};

export default function CreateNoticePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'academic',
    priority: 'medium',
    ...emptyAudience,
  });
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.title.trim() || !form.description.trim()) {
      setError('Title and description are required');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const payload = new FormData();
      Object.entries(form).forEach(([key, value]) => payload.append(key, value));
      payload.append('contentType', 'notice');
      payload.append('type', form.priority === 'high' ? 'urgent' : form.priority === 'low' ? 'info' : 'warning');
      files.forEach((file) => payload.append('attachments', file));

      await API.post('/content', payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      toast.success('Notice published');
      navigate('/notice-board');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to publish notice');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Publish Notice" subtitle="Share a clear update with the right audience in a polished announcement." />

      <div className="card p-6">
        {error ? <div className="mb-4"><Alert type="error" message={error} /></div> : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Title</label>
            <input
              className="input"
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="Semester registration window revised"
            />
          </div>

          <div>
            <label className="label">Description</label>
            <textarea
              className="input resize-none"
              rows={5}
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="Write the full notice here..."
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Category</label>
              <select
                className="input"
                value={form.category}
                onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
              >
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Priority</label>
              <select
                className="input"
                value={form.priority}
                onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          <VisibilitySection
            form={form}
            onChange={(key, value) => setForm((current) => ({ ...current, [key]: value }))}
          />

          <div>
            <label className="label">Attachments</label>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 p-4 transition-colors hover:border-blue-400 hover:bg-blue-50">
              <FiUpload className="text-gray-400" size={18} />
              <span className="text-sm text-gray-500">Click to upload files</span>
              <input type="file" multiple className="hidden" onChange={(event) => setFiles(Array.from(event.target.files || []).slice(0, 5))} />
            </label>
            {files.length > 0 ? (
              <div className="mt-2 space-y-1">
                {files.map((file, index) => (
                  <div key={`${file.name}-${index}`} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-1.5 text-xs text-gray-600">
                    <span className="truncate">{file.name}</span>
                    <button type="button" onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="ml-2 text-gray-400 hover:text-red-500">
                      <FiX size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center py-2.5">
              {loading ? 'Publishing...' : 'Publish'}
            </button>
            <button type="button" onClick={() => navigate('/notice-board')} className="btn-secondary">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
