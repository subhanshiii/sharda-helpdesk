import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import {
  FiChevronDown,
  FiChevronUp,
  FiEdit3,
  FiMessageSquare,
  FiPlus,
  FiSearch,
  FiTrash2,
  FiX,
} from 'react-icons/fi';
import API from '../utils/api';
import { Alert, ConfirmDialog, FullPageSpinner, Modal, PageHeader } from '../components/ui';
import { usePermissions } from '../context/PermissionContext';

const initialForm = { question: '', answer: '' };

const FAQItem = ({ faq, isOpen, onClick, canEdit, canDelete, onEdit, onDelete }) => (
  <div className={`theme-surface overflow-hidden rounded-[28px] transition-all duration-200 ${isOpen ? 'ring-2 ring-blue-200' : ''}`}>
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 px-5 py-5 text-left transition-colors hover:bg-blue-50/40"
    >
      <span className="theme-text-strong text-sm font-semibold">{faq.question}</span>
      <div className="flex items-center gap-2">
        {canEdit ? (
          <span
            role="button"
            tabIndex={0}
            onClick={(event) => {
              event.stopPropagation();
              onEdit(faq);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                event.stopPropagation();
                onEdit(faq);
              }
            }}
            className="theme-ghost-button inline-flex h-9 w-9 items-center justify-center rounded-2xl theme-text-muted"
            aria-label={`Edit ${faq.question}`}
          >
            <FiEdit3 size={15} />
          </span>
        ) : null}
        {canDelete ? (
          <span
            role="button"
            tabIndex={0}
            onClick={(event) => {
              event.stopPropagation();
              onDelete(faq);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                event.stopPropagation();
                onDelete(faq);
              }
            }}
            className="theme-danger-button inline-flex h-9 w-9 items-center justify-center rounded-2xl"
            aria-label={`Delete ${faq.question}`}
          >
            <FiTrash2 size={15} />
          </span>
        ) : null}
        {isOpen ? <FiChevronUp className="flex-shrink-0 text-blue-600" size={18} /> : <FiChevronDown className="theme-text-muted flex-shrink-0" size={18} />}
      </div>
    </button>
    {isOpen ? (
      <div className="theme-text-muted animate-fade-in border-t border-blue-50 px-5 pb-5 pt-0 text-sm leading-relaxed">
        {faq.answer}
      </div>
    ) : null}
  </div>
);

const FAQEditorModal = ({ open, mode, form, loading, onChange, onClose, onSubmit }) => (
  <Modal
    open={open}
    onClose={loading ? undefined : onClose}
    panelClassName="max-w-2xl"
    contentClassName="theme-surface overflow-hidden rounded-[32px]"
  >
    <div className="theme-surface-soft border-b px-6 py-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="theme-accent-badge inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em]">
            FAQ management
          </p>
          <h2 className="theme-text-strong mt-3 font-display text-2xl font-bold">
            {mode === 'edit' ? 'Edit FAQ' : 'Add FAQ'}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="theme-ghost-button inline-flex h-11 w-11 items-center justify-center rounded-2xl transition"
        >
          <FiX size={18} />
        </button>
      </div>
    </div>

    <form onSubmit={onSubmit} className="space-y-5 px-6 py-6">
      <label className="block">
        <span className="theme-text-muted mb-2 block text-xs font-semibold uppercase tracking-[0.22em]">Question</span>
        <input
          value={form.question}
          onChange={(event) => onChange('question', event.target.value)}
          className="theme-input w-full rounded-2xl px-4 py-3 text-sm outline-none transition"
          placeholder="Enter the FAQ question"
        />
      </label>

      <label className="block">
        <span className="theme-text-muted mb-2 block text-xs font-semibold uppercase tracking-[0.22em]">Answer</span>
        <textarea
          rows={7}
          value={form.answer}
          onChange={(event) => onChange('answer', event.target.value)}
          className="theme-input w-full rounded-2xl px-4 py-3 text-sm outline-none transition"
          placeholder="Write the answer shown to students and staff"
        />
      </label>

      <div className="flex justify-end gap-3">
        <button type="button" onClick={onClose} disabled={loading} className="btn-secondary">
          Cancel
        </button>
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? 'Saving...' : mode === 'edit' ? 'Save changes' : 'Add FAQ'}
        </button>
      </div>
    </form>
  </Modal>
);

export default function FAQPage() {
  const { can } = usePermissions();
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState('create');
  const [form, setForm] = useState(initialForm);
  const [editingFaq, setEditingFaq] = useState(null);
  const [deleteState, setDeleteState] = useState({ open: false, faq: null, loading: false });
  const [error, setError] = useState('');

  const canCreateFaq = can('create', 'faq');
  const canEditFaq = can('edit', 'faq');
  const canDeleteFaq = can('delete', 'faq');

  const loadFAQs = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await API.get('/chat/faqs');
      setFaqs(res.data?.data || []);
    } catch (requestError) {
      console.error('Failed to load FAQs:', requestError);
      setFaqs([]);
      setError(requestError.response?.data?.message || 'Unable to load FAQs right now.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFAQs();
  }, []);

  const filtered = useMemo(() => faqs.filter((item) => (
    item.question.toLowerCase().includes(search.toLowerCase())
    || item.answer.toLowerCase().includes(search.toLowerCase())
  )), [faqs, search]);

  const openCreate = () => {
    setEditorMode('create');
    setEditingFaq(null);
    setForm(initialForm);
    setEditorOpen(true);
  };

  const openEdit = (faq) => {
    setEditorMode('edit');
    setEditingFaq(faq);
    setForm({ question: faq.question || '', answer: faq.answer || '' });
    setEditorOpen(true);
  };

  const closeEditor = () => {
    if (saving) return;
    setEditorOpen(false);
    setEditingFaq(null);
    setForm(initialForm);
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!form.question.trim() || !form.answer.trim()) {
      toast.error('Question and answer are required');
      return;
    }

    setSaving(true);
    try {
      if (editorMode === 'edit' && editingFaq?.id) {
        const res = await API.put(`/chat/faqs/${editingFaq.id}`, {
          question: form.question.trim(),
          answer: form.answer.trim(),
        });
        const updated = res.data?.data;
        setFaqs((current) => current.map((item) => (item.id === updated.id ? updated : item)));
        toast.success('FAQ updated');
      } else {
        const res = await API.post('/chat/faqs', {
          question: form.question.trim(),
          answer: form.answer.trim(),
        });
        const created = res.data?.data;
        setFaqs((current) => [created, ...current]);
        setOpenId(created.id);
        toast.success('FAQ added');
      }
      closeEditor();
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || 'Failed to save FAQ');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteState.faq?.id) return;
    setDeleteState((current) => ({ ...current, loading: true }));
    try {
      await API.delete(`/chat/faqs/${deleteState.faq.id}`);
      setFaqs((current) => current.filter((item) => item.id !== deleteState.faq.id));
      setOpenId((current) => (current === deleteState.faq.id ? '' : current));
      setDeleteState({ open: false, faq: null, loading: false });
      toast.success('FAQ deleted');
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || 'Failed to delete FAQ');
      setDeleteState((current) => ({ ...current, loading: false }));
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <ConfirmDialog
        open={deleteState.open}
        title="Delete FAQ"
        description={`Delete "${deleteState.faq?.question || 'this FAQ'}"?`}
        confirmLabel="Delete FAQ"
        loading={deleteState.loading}
        onConfirm={confirmDelete}
        onClose={() => setDeleteState({ open: false, faq: null, loading: false })}
      />

      <FAQEditorModal
        open={editorOpen}
        mode={editorMode}
        form={form}
        loading={saving}
        onChange={(key, value) => setForm((current) => ({ ...current, [key]: value }))}
        onClose={closeEditor}
        onSubmit={handleSave}
      />

      <PageHeader
        title="FAQ"
        description="Find answers to common questions and keep the help library up to date."
        meta={[
          'Search across questions and answers',
          canCreateFaq || canEditFaq || canDeleteFaq ? 'FAQ management enabled for your role' : 'Read-only FAQ access',
        ]}
        action={canCreateFaq ? (
          <button type="button" onClick={openCreate} className="btn-primary rounded-2xl px-5 py-3">
            <FiPlus size={16} />
            Add FAQ
          </button>
        ) : null}
      />

      {error ? <Alert type="error" message={error} /> : null}

      <div className="relative mb-6">
        <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input
          className="theme-input w-full rounded-2xl py-3 pl-11 pr-4 text-base outline-none transition"
          placeholder="Search questions..."
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setOpenId('');
          }}
        />
      </div>

      {loading ? <FullPageSpinner /> : (
        <>
          <div className="mb-8 space-y-3">
            {filtered.length === 0 ? (
              <div className="py-12 text-center" role="status" aria-live="polite">
                <div className="mb-3 text-4xl">🤔</div>
                <p className="theme-text-muted">No FAQs match your search.</p>
              </div>
            ) : filtered.map((faq) => (
              <FAQItem
                key={faq.id}
                faq={faq}
                isOpen={openId === faq.id}
                onClick={() => setOpenId(openId === faq.id ? '' : faq.id)}
                canEdit={canEditFaq}
                canDelete={canDeleteFaq}
                onEdit={openEdit}
                onDelete={(item) => setDeleteState({ open: true, faq: item, loading: false })}
              />
            ))}
          </div>

          <div className="card p-6 text-center" style={{ background: 'linear-gradient(135deg,#eff6ff,#f0fdf4)' }}>
            <FiMessageSquare size={28} className="mx-auto mb-3 text-blue-500" />
            <h3 className="mb-1 font-display font-bold text-gray-900">Still have questions?</h3>
            <p className="mb-4 text-sm text-gray-500">Can't find what you're looking for? Our support team is here to help.</p>
            <div className="flex justify-center gap-3">
              <Link to="/ai-assistant" className="btn-secondary text-sm">Ask AI Assistant</Link>
              <Link to="/tickets/new" className="btn-primary text-sm">Raise a Ticket</Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
