import React, { useMemo, useRef, useState } from 'react';
import { FiFile, FiSearch, FiUploadCloud, FiX } from 'react-icons/fi';
import { Alert, Modal } from '../ui';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_TYPES = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
const ACCEPTED_EXTENSIONS = ['.pdf', '.doc', '.docx'];

const RESOURCE_TYPE_OPTIONS = [
  { value: 'notes', label: 'Notes' },
  { value: 'pyq', label: 'Question Paper (PYQ)' },
  { value: 'study-material', label: 'Study Material' },
  { value: 'document', label: 'Document' },
];

const formatFileSize = (bytes = 0) => `${(bytes / (1024 * 1024)).toFixed(bytes >= 1024 * 1024 ? 1 : 2)} MB`;

export default function ResourceUploadModal({
  open,
  onClose,
  onSubmit,
  loading = false,
  courses = [],
}) {
  const fileInputRef = useRef(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    resourceType: 'notes',
    courseId: '',
  });
  const [courseSearch, setCourseSearch] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [error, setError] = useState('');

  const visibleCourses = useMemo(() => {
    const query = courseSearch.trim().toLowerCase();
    if (!query) return courses;
    return courses.filter((course) => (
      `${course.name} ${course.code || ''} ${course.programName || ''} ${course.departmentName || ''}`
        .toLowerCase()
        .includes(query)
    ));
  }, [courseSearch, courses]);

  const selectedCourse = useMemo(
    () => courses.find((course) => course._id === form.courseId) || null,
    [courses, form.courseId]
  );

  const resetState = () => {
    setForm({ title: '', description: '', resourceType: 'notes', courseId: '' });
    setCourseSearch('');
    setSelectedFile(null);
    setError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    if (loading) return;
    resetState();
    onClose?.();
  };

  const validateFile = (file) => {
    if (!file) return 'Please choose a file to upload.';
    const lowerName = file.name.toLowerCase();
    const hasAllowedExtension = ACCEPTED_EXTENSIONS.some((extension) => lowerName.endsWith(extension));
    if (!ACCEPTED_TYPES.includes(file.type) && !hasAllowedExtension) return 'Only PDF, DOC, and DOCX files are supported.';
    if (file.size > MAX_FILE_SIZE) return 'File size must be 10MB or smaller.';
    return '';
  };

  const handleFileChange = (file) => {
    const nextError = validateFile(file);
    setError(nextError);
    setSelectedFile(nextError ? null : file);
  };

  const submitForm = async (event) => {
    event.preventDefault();
    const fileError = validateFile(selectedFile);
    if (fileError) {
      setError(fileError);
      return;
    }
    if (!form.title.trim()) {
      setError('Please enter a title for the resource.');
      return;
    }
    if (!form.courseId) {
      setError('Please select a course so the hierarchy tags can be derived automatically.');
      return;
    }

    setError('');
    const payload = new FormData();
    payload.append('title', form.title.trim());
    payload.append('description', form.description.trim());
    payload.append('resourceType', form.resourceType);
    payload.append('courseId', form.courseId);
    payload.append('file', selectedFile);

    const success = await onSubmit?.(payload);
    if (success) {
      handleClose();
    }
  };

  return (
    <Modal open={open} onClose={handleClose} panelClassName="max-w-4xl" contentClassName="theme-surface rounded-[32px] overflow-hidden">
      <div className="theme-surface-soft border-b px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="theme-accent-badge inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em]">Upload resource</p>
            <h2 className="theme-text-strong mt-3 font-display text-2xl font-bold">Share notes, PYQs, and study material</h2>
            <p className="theme-text-muted mt-1 text-sm leading-6">
              Course selection automatically assigns department, program, and school metadata for cleaner discovery.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="theme-ghost-button inline-flex h-11 w-11 items-center justify-center rounded-2xl transition"
          >
            <FiX size={18} />
          </button>
        </div>
      </div>

      <form onSubmit={submitForm} className="grid gap-6 px-6 py-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-5">
          <label className="block">
            <span className="theme-text-muted mb-2 block text-xs font-semibold uppercase tracking-[0.24em]">Title</span>
            <input
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="e.g. Data Structures Unit 3 Notes"
              className="theme-input w-full rounded-2xl px-4 py-3 text-sm outline-none transition"
            />
          </label>

          <label className="block">
            <span className="theme-text-muted mb-2 block text-xs font-semibold uppercase tracking-[0.24em]">Description</span>
            <textarea
              rows={4}
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="Add context such as units covered, exam relevance, or source."
              className="theme-input w-full rounded-2xl px-4 py-3 text-sm outline-none transition"
            />
          </label>

          <label className="block">
            <span className="theme-text-muted mb-2 block text-xs font-semibold uppercase tracking-[0.24em]">Resource type</span>
            <select
              value={form.resourceType}
              onChange={(event) => setForm((current) => ({ ...current, resourceType: event.target.value }))}
              className="theme-input w-full rounded-2xl px-4 py-3 text-sm outline-none transition"
            >
              {RESOURCE_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <div>
            <span className="theme-text-muted mb-2 block text-xs font-semibold uppercase tracking-[0.24em]">File</span>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDrop={(event) => {
                event.preventDefault();
                handleFileChange(event.dataTransfer.files?.[0] || null);
              }}
              onDragOver={(event) => event.preventDefault()}
              className="theme-surface-accent flex w-full flex-col items-center justify-center rounded-[28px] border border-dashed px-6 py-10 text-center transition"
            >
              <div className="theme-surface flex h-14 w-14 items-center justify-center rounded-2xl shadow-sm">
                <FiUploadCloud size={24} />
              </div>
              <p className="theme-text-strong mt-4 font-display text-lg font-bold">
                {selectedFile ? selectedFile.name : 'Drag and drop a file here'}
              </p>
              <p className="theme-text-muted mt-1 text-sm">
                PDF, DOC, or DOCX up to 10MB. Click to browse if you prefer.
              </p>
              {selectedFile ? (
                <p className="theme-text-main mt-3 text-xs font-semibold uppercase tracking-[0.24em]">
                  {formatFileSize(selectedFile.size)}
                </p>
              ) : null}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={(event) => handleFileChange(event.target.files?.[0] || null)}
            />
          </div>
        </div>

        <div className="theme-surface rounded-[28px] p-5">
          <p className="theme-accent-badge inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em]">Course tagging</p>
          <h3 className="theme-text-strong mt-3 font-display text-xl font-bold">Select a course</h3>
          <p className="theme-text-muted mt-1 text-sm leading-6">
            We’ll derive the full academic hierarchy from the selected course automatically.
          </p>

          <div className="relative mt-4">
            <FiSearch className="theme-text-muted pointer-events-none absolute left-4 top-1/2 -translate-y-1/2" size={16} />
            <input
              value={courseSearch}
              onChange={(event) => setCourseSearch(event.target.value)}
              placeholder="Search by course or code"
              className="theme-input w-full rounded-2xl py-3 pl-11 pr-4 text-sm outline-none transition"
            />
          </div>

          <div className="mt-4 max-h-72 space-y-2 overflow-y-auto pr-1">
            {visibleCourses.map((course) => {
              const isActive = form.courseId === course._id;
              return (
                <button
                  key={course._id}
                  type="button"
                  onClick={() => setForm((current) => ({ ...current, courseId: course._id }))}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                    isActive
                      ? 'theme-surface-accent shadow-sm'
                      : 'theme-surface theme-surface-interactive'
                  }`}
                >
                  <p className="theme-text-strong font-semibold">{course.name}</p>
                  <p className="theme-text-muted mt-1 text-xs">{course.code || 'No code'} • {course.programName} • {course.departmentName}</p>
                </button>
              );
            })}
            {!visibleCourses.length ? (
              <div className="theme-surface-soft theme-text-muted rounded-2xl border border-dashed px-4 py-8 text-center text-sm">
                No courses matched your search.
              </div>
            ) : null}
          </div>

          <div className="theme-surface-soft mt-5 rounded-[24px] p-4">
            <div className="theme-text-main flex items-center gap-2">
              <FiFile size={16} />
              <p className="text-sm font-semibold">Derived metadata preview</p>
            </div>
            {selectedCourse ? (
              <div className="theme-text-muted mt-3 space-y-2 text-sm">
                <p><span className="theme-text-strong font-semibold">Program:</span> {selectedCourse.programName}</p>
                <p><span className="theme-text-strong font-semibold">Department:</span> {selectedCourse.departmentName}</p>
                <p><span className="theme-text-strong font-semibold">School:</span> {selectedCourse.schoolName}</p>
              </div>
            ) : (
              <p className="theme-text-muted mt-3 text-sm">Pick a course to preview the derived hierarchy.</p>
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          <Alert type="error" message={error} />
        </div>

        <div className="flex items-center justify-end gap-3 lg:col-span-2">
          <button
            type="button"
            onClick={handleClose}
            className="theme-ghost-button rounded-2xl px-5 py-3 text-sm font-semibold transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary rounded-2xl px-5 py-3 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Uploading...' : 'Upload resource'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
