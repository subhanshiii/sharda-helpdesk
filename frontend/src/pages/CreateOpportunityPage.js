import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import API from '../utils/api';
import { Alert, PageHeader } from '../components/ui';
import VisibilitySection from '../components/content/VisibilitySection';
import { FiBook, FiBriefcase, FiCode, FiDollarSign, FiExternalLink, FiStar, FiTag, FiUsers, FiAward } from 'react-icons/fi';

const TYPE_CONFIG = {
  Internship: { icon: FiBriefcase, color: 'from-blue-500 to-cyan-500' },
  Hackathon: { icon: FiCode, color: 'from-violet-500 to-purple-600' },
  Competition: { icon: FiAward, color: 'from-orange-500 to-amber-500' },
  Workshop: { icon: FiBook, color: 'from-teal-500 to-green-500' },
  Job: { icon: FiUsers, color: 'from-pink-500 to-rose-500' },
  Scholarship: { icon: FiStar, color: 'from-yellow-500 to-orange-400' },
};

const TYPES = Object.keys(TYPE_CONFIG);

export default function CreateOpportunityPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: '', description: '', type: 'Internship', company: '', location: 'Remote',
    externalLink: '', deadline: '', stipend: '', eligibility: '', tags: '',
    audienceTiers: [], audienceRoles: [],
    audienceCollegeId: '', audienceDepartmentId: '', audienceProgramId: '', audienceCourseId: '', audienceStudyYear: '', audienceSectionId: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.title || !form.description || !form.type) {
      setError('Title, description and type are required');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await API.post('/opportunities', form);
      toast.success('Opportunity posted');
      navigate('/opportunities');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to save opportunity');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Post Opportunity"
        subtitle="Create a complete opportunity listing with audience targeting, deadlines, links, and discovery-friendly details."
      />

      <div className="card p-6">
        {error ? <div className="mb-4"><Alert type="error" message={error} /></div> : null}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="label">Type</label>
            <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
              {TYPES.map((type) => {
                const cfg = TYPE_CONFIG[type];
                const Icon = cfg.icon;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setForm((current) => ({ ...current, type }))}
                    className={`flex flex-col items-center gap-1 rounded-xl border-2 p-2.5 text-xs font-semibold transition ${
                      form.type === type ? `border-transparent bg-gradient-to-br ${cfg.color} text-white shadow-md` : 'border-gray-200 text-gray-500'
                    }`}
                  >
                    <Icon size={16} />
                    {type}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="label">Title</label>
            <input className="input" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Software Engineer Intern at Google" />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Company</label>
              <input className="input" value={form.company} onChange={(event) => setForm((current) => ({ ...current, company: event.target.value }))} placeholder="Google" />
            </div>
            <div>
              <label className="label">Location</label>
              <input className="input" value={form.location} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))} placeholder="Remote / Delhi" />
            </div>
          </div>

          <div>
            <label className="label">Description</label>
            <textarea className="input resize-none" rows={4} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Describe the role, scope, and who should apply..." />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Deadline</label>
              <input type="date" className="input" value={form.deadline} onChange={(event) => setForm((current) => ({ ...current, deadline: event.target.value }))} />
            </div>
            <div>
              <label className="label">Stipend / Compensation</label>
              <div className="relative">
                <FiDollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <input className="input pl-9" value={form.stipend} onChange={(event) => setForm((current) => ({ ...current, stipend: event.target.value }))} placeholder="₹15,000/month or Unpaid" />
              </div>
            </div>
          </div>

          <div>
            <label className="label">Apply Link</label>
            <div className="relative">
              <FiExternalLink className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input className="input pl-9" value={form.externalLink} onChange={(event) => setForm((current) => ({ ...current, externalLink: event.target.value }))} placeholder="https://apply.example.com" />
            </div>
          </div>

          <div>
            <label className="label">Tags</label>
            <div className="relative">
              <FiTag className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input className="input pl-9" value={form.tags} onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))} placeholder="React, Python, ML" />
            </div>
          </div>

          <div>
            <label className="label">Eligibility</label>
            <textarea className="input resize-none" rows={3} value={form.eligibility} onChange={(event) => setForm((current) => ({ ...current, eligibility: event.target.value }))} placeholder="Who is eligible, expected skills, preferred background..." />
          </div>

          <VisibilitySection form={form} onChange={(key, value) => setForm((current) => ({ ...current, [key]: value }))} />

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
              <FiBriefcase size={15} /> {saving ? 'Saving...' : 'Post Opportunity'}
            </button>
            <button type="button" onClick={() => navigate('/opportunities')} className="btn-secondary">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
