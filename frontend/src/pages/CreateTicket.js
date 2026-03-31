import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../utils/api';
import toast from 'react-hot-toast';
import { PageHeader, Alert } from '../components/ui';
import { CATEGORIES, PRIORITIES } from '../utils/helpers';
import { FiUpload, FiX, FiZap, FiLoader, FiCheck } from 'react-icons/fi';

export default function CreateTicket() {
  const navigate = useNavigate();
  const debounceRef = useRef(null);

  const [form, setForm] = useState({
    title: '', description: '', category: '', priority: '', tags: '',
  });
  const [files,      setFiles]      = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [aiLoading,  setAiLoading]  = useState(false);
  const [appliedAI,  setAppliedAI]  = useState(false);

  // ── Real AI suggestion with debounce ──────────────────
  // Calls OpenAI after user stops typing for 1.5 seconds
  const fetchAISuggestion = async (title, description) => {
    if (title.length < 10 || description.length < 20) return;

    setAiLoading(true);
    try {
      const res = await API.post('/chat/categorize', { title, description });
      const { suggestedCategory, suggestedPriority, source } = res.data.data;

      setAiSuggestion({ category: suggestedCategory, priority: suggestedPriority, source });
    } catch {
      // Silently fail — don't distract user with AI errors
    } finally {
      setAiLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
    setError('');
    setAppliedAI(false);

    // Debounce AI call — only trigger after user stops typing
    if (name === 'title' || name === 'description') {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const title = name === 'title' ? value : form.title;
        const desc  = name === 'description' ? value : form.description;
        fetchAISuggestion(title, desc);
      }, 1500);
    }
  };

  const applyAISuggestion = () => {
    if (!aiSuggestion) return;
    setForm(f => ({
      ...f,
      category: aiSuggestion.category || f.category,
      priority: aiSuggestion.priority || f.priority,
    }));
    setAppliedAI(true);
    setAiSuggestion(null);
    toast.success('AI suggestion applied!');
  };

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files);
    const valid    = selected.filter(f => f.size <= 5 * 1024 * 1024);
    if (valid.length !== selected.length) toast.error('Some files exceed 5MB limit');
    setFiles(prev => [...prev, ...valid].slice(0, 5));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim())       { setError('Title is required');       return; }
    if (!form.description.trim()) { setError('Description is required'); return; }
    if (!form.category)           { setError('Please select a category'); return; }

    setLoading(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v); });
      files.forEach(file => fd.append('attachments', file));

      const res = await API.post('/tickets', fd, {
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
      <PageHeader title="Create New Ticket" subtitle="Describe your issue and we'll route it to the right team" />

      <div className="card p-6">
        {error && <div className="mb-4"><Alert type="error" message={error} /></div>}

        {/* AI suggestion banner */}
        {aiLoading && (
          <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
            <FiLoader size={15} className="text-blue-500 animate-spin" />
            <span className="text-sm text-blue-700">AI is analyzing your ticket...</span>
          </div>
        )}

        {aiSuggestion && !appliedAI && (
          <div className="mb-4 animate-fade-in-up">
            <div className="flex items-center justify-between gap-3 px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-xl">
              <div className="flex items-center gap-2">
                <FiZap size={15} className="text-indigo-500" />
                <div className="text-sm text-indigo-700">
                  <strong>AI suggests:</strong> Category → <strong>{aiSuggestion.category}</strong>,
                  Priority → <strong>{aiSuggestion.priority}</strong>
                  <span className="text-xs text-indigo-400 ml-2">
                    ({aiSuggestion.source === 'openai' ? '🤖 GPT' : '🔍 Smart detect'})
                  </span>
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={applyAISuggestion} className="btn-primary py-1 px-3 text-xs">
                  <FiCheck size={12} /> Apply
                </button>
                <button onClick={() => setAiSuggestion(null)} className="text-indigo-400 hover:text-indigo-600">
                  <FiX size={14} />
                </button>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Title <span className="text-red-500">*</span></label>
            <input name="title" value={form.title} onChange={handleChange}
              className="input" placeholder="Brief summary of your issue" maxLength={200} />
          </div>

          <div>
            <label className="label">Description <span className="text-red-500">*</span></label>
            <textarea name="description" value={form.description} onChange={handleChange}
              className="input resize-none" rows={5}
              placeholder="Describe your issue in detail — AI will automatically suggest category and priority as you type..." />
            <p className="text-xs text-gray-400 mt-1">
              {form.description.length < 20
                ? `Type at least ${20 - form.description.length} more characters for AI suggestions`
                : '✨ AI analysis active'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Category <span className="text-red-500">*</span></label>
              <select name="category" value={form.category} onChange={handleChange} className="input">
                <option value="">Select category</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">
                Priority
                {appliedAI && <span className="ml-2 text-xs text-green-500">✨ AI applied</span>}
              </label>
              <select name="priority" value={form.priority} onChange={handleChange} className="input">
                <option value="">Auto-detect</option>
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Tags <span className="text-gray-400 font-normal">(comma-separated)</span></label>
            <input name="tags" value={form.tags} onChange={handleChange}
              className="input" placeholder="e.g. wifi, login, hostel-b" />
          </div>

          <div>
            <label className="label">Attachments <span className="text-gray-400 font-normal">(max 5 files, 5MB each)</span></label>
            <label className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl p-4 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
              <FiUpload className="text-gray-400" size={18} />
              <span className="text-sm text-gray-500">Click to upload files</span>
              <input type="file" multiple className="hidden" onChange={handleFileChange}
                accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.txt,.zip" />
            </label>
            {files.length > 0 && (
              <div className="mt-2 space-y-1">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-1.5 bg-gray-50 rounded-lg text-xs text-gray-600">
                    <span className="truncate">{f.name}</span>
                    <button type="button" onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))}
                      className="ml-2 text-gray-400 hover:text-red-500"><FiX size={14} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center py-2.5">
              {loading ? 'Submitting...' : 'Submit Ticket'}
            </button>
            <button type="button" onClick={() => navigate(-1)} className="btn-secondary">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
