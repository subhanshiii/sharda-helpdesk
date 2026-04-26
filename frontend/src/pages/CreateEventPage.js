import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import API from '../utils/api';
import { Alert, PageHeader } from '../components/ui';
import VisibilitySection from '../components/content/VisibilitySection';
import { FiCalendar, FiExternalLink, FiMapPin, FiTag, FiUpload, FiUsers, FiVideo, FiX } from 'react-icons/fi';

const CAT_CONFIG = {
  Technical: { emoji: '💻', color: 'from-blue-500 to-cyan-500' },
  Cultural: { emoji: '🎭', color: 'from-pink-500 to-rose-500' },
  Sports: { emoji: '⚽', color: 'from-green-500 to-emerald-500' },
  Academic: { emoji: '🎓', color: 'from-indigo-500 to-violet-500' },
  Workshop: { emoji: '🔧', color: 'from-orange-500 to-amber-500' },
  Seminar: { emoji: '🎤', color: 'from-teal-500 to-cyan-500' },
  Other: { emoji: '📌', color: 'from-gray-500 to-slate-500' },
};

const CATEGORIES = Object.keys(CAT_CONFIG);

export default function CreateEventPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: '', description: '', category: 'Technical',
    date: '', endDate: '', venue: 'Sharda University Campus',
    videoLink: '', registrationLink: '', organizer: '',
    maxParticipants: '', tags: '',
    audienceTiers: [], audienceRoles: [],
    audienceCollegeId: '', audienceDepartmentId: '', audienceProgramId: '', audienceCourseId: '', audienceStudyYear: '', audienceSectionId: '',
    audienceDepartments: [], audienceYears: [], audienceSections: [],
  });
  const [poster, setPoster] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.title || !form.description || !form.date) {
      setError('Title, description and date are required');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([key, value]) => { if (value) fd.append(key, value); });
      if (poster) fd.append('poster', poster);
      await API.post('/events', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Event created');
      navigate('/events');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to create event');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Create Event"
        subtitle="Create a full event record with schedule, registration links, visibility targeting, and supporting details."
      />

      <div className="card p-6">
        {error ? <div className="mb-4"><Alert type="error" message={error} /></div> : null}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="label">Category</label>
            <div className="grid grid-cols-3 gap-2 md:grid-cols-7">
              {CATEGORIES.map((category) => {
                const cfg = CAT_CONFIG[category];
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setForm((current) => ({ ...current, category }))}
                    className={`flex flex-col items-center gap-1 rounded-xl border-2 p-2 text-xs font-semibold transition ${
                      form.category === category ? `border-transparent bg-gradient-to-br ${cfg.color} text-white shadow-md` : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    <span className="text-lg">{cfg.emoji}</span>
                    <span>{category}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="label">Event Title</label>
            <input className="input" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Annual Hackathon 2026" />
          </div>

          <div>
            <label className="label">Description</label>
            <textarea className="input resize-none" rows={4} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Describe the event, agenda, and who should attend..." />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Start Date & Time</label>
              <input type="datetime-local" className="input" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} />
            </div>
            <div>
              <label className="label">End Date & Time</label>
              <input type="datetime-local" className="input" value={form.endDate} onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))} />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Venue</label>
              <div className="relative">
                <FiMapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <input className="input pl-9" value={form.venue} onChange={(event) => setForm((current) => ({ ...current, venue: event.target.value }))} placeholder="Auditorium, Block A" />
              </div>
            </div>
            <div>
              <label className="label">Organizer / Club</label>
              <div className="relative">
                <FiUsers className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <input className="input pl-9" value={form.organizer} onChange={(event) => setForm((current) => ({ ...current, organizer: event.target.value }))} placeholder="Tech Club" />
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Registration Link</label>
              <div className="relative">
                <FiExternalLink className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <input className="input pl-9" value={form.registrationLink} onChange={(event) => setForm((current) => ({ ...current, registrationLink: event.target.value }))} placeholder="https://..." />
              </div>
            </div>
            <div>
              <label className="label">Video / Live Link</label>
              <div className="relative">
                <FiVideo className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <input className="input pl-9" value={form.videoLink} onChange={(event) => setForm((current) => ({ ...current, videoLink: event.target.value }))} placeholder="https://..." />
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Max Participants</label>
              <input type="number" className="input" value={form.maxParticipants} onChange={(event) => setForm((current) => ({ ...current, maxParticipants: event.target.value }))} placeholder="Leave blank for unlimited" />
            </div>
            <div>
              <label className="label">Tags</label>
              <div className="relative">
                <FiTag className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <input className="input pl-9" value={form.tags} onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))} placeholder="coding, startup, leadership" />
              </div>
            </div>
          </div>

          <VisibilitySection form={form} onChange={(key, value) => setForm((current) => ({ ...current, [key]: value }))} />

          <div>
            <label className="label">Event Poster</label>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 p-4 transition-colors hover:border-blue-400 hover:bg-blue-50">
              <FiUpload className="text-gray-400" size={18} />
              <span className="text-sm text-gray-500">{poster ? poster.name : 'Click to upload poster (JPG, PNG)'}</span>
              <input type="file" accept=".jpg,.jpeg,.png,.gif" className="hidden" onChange={(event) => setPoster(event.target.files?.[0] || null)} />
            </label>
            {poster ? (
              <div className="mt-2 flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
                <span className="truncate">{poster.name}</span>
                <button type="button" onClick={() => setPoster(null)} className="text-gray-400 hover:text-red-500"><FiX size={14} /></button>
              </div>
            ) : null}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
              <FiCalendar size={15} /> {saving ? 'Creating...' : 'Create Event'}
            </button>
            <button type="button" onClick={() => navigate('/events')} className="btn-secondary">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
