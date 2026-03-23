import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../utils/api';
import toast from 'react-hot-toast';
import { PageHeader, Alert } from '../components/ui';
import { CATEGORIES, PRIORITIES } from '../utils/helpers';
import { FiUpload, FiX, FiZap } from 'react-icons/fi';

export default function CreateTicket() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: '', description: '', category: '', priority: '', tags: '',
  });
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [aiSuggestion, setAiSuggestion] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    setError('');

    // AI priority suggestion on description change
    if (name === 'description' || name === 'title') {
      const combined = (value + ' ' + (name === 'title' ? form.description : form.title)).toLowerCase();
      if (combined.includes('urgent') || combined.includes('emergency') || combined.includes('broken') || combined.includes('cannot access')) {
        setAiSuggestion({ priority: 'High', reason: 'Keywords suggest urgency' });
      } else if (combined.includes('suggestion') || combined.includes('feedback') || combined.includes('question')) {
        setAiSuggestion({ priority: 'Low', reason: 'Looks like a general inquiry' });
      } else {
        setAiSuggestion(null);
      }
    }
  };

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files);
    const valid = selected.filter((f) => f.size <= 5 * 1024 * 1024);
    if (valid.length !== selected.length) toast.error('Some files exceed 5MB limit');
    setFiles((prev) => [...prev, ...valid].slice(0, 5));
  };

  const removeFile = (i) => setFiles((f) => f.filter((_, idx) => idx !== i));

  const applyAiSuggestion = () => {
    setForm((f) => ({ ...f, priority: aiSuggestion.priority }));
    setAiSuggestion(null);
    toast.success(`Priority set to ${aiSuggestion.priority}`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim())       { setError('Title is required'); return; }
    if (!form.description.trim()) { setError('Description is required'); return; }
    if (!form.category)           { setError('Please select a category'); return; }

    setLoading(true);
    try {
      const formData = new FormData();
      Object.entries(form).forEach(([k, v]) => { if (v) formData.append(k, v); });
      files.forEach((file) => formData.append('attachments', file));

      const res = await API.post('/tickets', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(`Ticket ${res.data.data.ticketId} created!`);
      navigate(`/tickets/${res.data.data._id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create ticket');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader
        title="Create New Ticket"
        subtitle="Describe your issue and we'll route it to the right team"
      />

      <div className="card p-6">
        {error && <div className="mb-4"><Alert type="error" message={error} /></div>}

        {/* AI suggestion banner */}
        {aiSuggestion && (
          <div className="mb-4 flex items-center justify-between gap-3 px-4 py-3 bg-primary-50 border border-primary-200 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-primary-700">
              <FiZap size={15} />
              <span>AI suggests <strong>{aiSuggestion.priority}</strong> priority — {aiSuggestion.reason}</span>
            </div>
            <button onClick={applyAiSuggestion} className="text-xs btn-primary py-1 px-3">Apply</button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Title <span className="text-red-500">*</span></label>
            <input
              name="title" value={form.title} onChange={handleChange}
              className="input" placeholder="Brief summary of your issue"
              maxLength={200}
            />
          </div>

          <div>
            <label className="label">Description <span className="text-red-500">*</span></label>
            <textarea
              name="description" value={form.description} onChange={handleChange}
              className="input resize-none" rows={5}
              placeholder="Describe your issue in detail — include any error messages, steps to reproduce, etc."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Category <span className="text-red-500">*</span></label>
              <select name="category" value={form.category} onChange={handleChange} className="input">
                <option value="">Select category</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Priority</label>
              <select name="priority" value={form.priority} onChange={handleChange} className="input">
                <option value="">Auto-detect</option>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Tags <span className="text-gray-400 font-normal">(optional, comma-separated)</span></label>
            <input
              name="tags" value={form.tags} onChange={handleChange}
              className="input" placeholder="e.g. wifi, login, hostel-b"
            />
          </div>

          {/* File attachment */}
          <div>
            <label className="label">Attachments <span className="text-gray-400 font-normal">(max 5 files, 5MB each)</span></label>
            <label className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-lg p-4 cursor-pointer hover:border-primary-400 hover:bg-primary-50 transition-colors">
              <FiUpload className="text-gray-400" size={18} />
              <span className="text-sm text-gray-500">Click to upload files</span>
              <input type="file" multiple className="hidden" onChange={handleFileChange} accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.txt,.zip" />
            </label>
            {files.length > 0 && (
              <div className="mt-2 space-y-1">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-1.5 bg-gray-50 rounded-lg text-xs text-gray-600">
                    <span className="truncate">{f.name}</span>
                    <button type="button" onClick={() => removeFile(i)} className="ml-2 text-gray-400 hover:text-red-500">
                      <FiX size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center py-2.5">
              {loading ? 'Submitting...' : 'Submit Ticket'}
            </button>
            <button type="button" onClick={() => navigate(-1)} className="btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
