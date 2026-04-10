import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiArrowLeft, FiCheck, FiUpload } from 'react-icons/fi';
import API from '../utils/api';
import { Alert, PageHeader } from '../components/ui';
import { usePermissions } from '../context/PermissionContext';

const ROLES = ['student', 'faculty', 'staff', 'admin'];

const initialForm = {
  systemId: '',
  name: '',
  email: '',
  password: '',
  role: 'student',
  department: '',
  year: '',
  section: '',
  status: 'pending',
  expiryDate: '',
  isActive: true,
  emailVerified: false,
};

export default function UserFormPage() {
  const navigate = useNavigate();
  const { systemId } = useParams();
  const isEdit = Boolean(systemId);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [verificationLink, setVerificationLink] = useState('');
  const isStudent = form.role === 'student';
  const { isSuperAdmin } = usePermissions();

  useEffect(() => {
    if (!isEdit) return;

    let mounted = true;
    const loadUser = async () => {
      setLoading(true);
      try {
        const res = await API.get(`/users/${systemId}`);
        const user = res.data?.data;
        if (!mounted || !user) return;
        setForm({
          systemId: user.systemId || '',
          name: user.name || '',
          email: user.email || '',
          password: '',
          role: user.role || 'student',
          department: user.department || '',
          year: user.year || '',
          section: user.section || '',
          status: user.status || 'pending',
          expiryDate: user.expiryDate ? new Date(user.expiryDate).toISOString().slice(0, 10) : '',
          isActive: user.isActive !== false,
          emailVerified: Boolean(user.emailVerified),
        });
      } catch (requestError) {
        setError(requestError.response?.data?.message || 'Failed to load user');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadUser();
    return () => { mounted = false; };
  }, [isEdit, systemId]);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((current) => {
      const normalizedValue = type === 'checkbox'
        ? checked
        : (name === 'emailVerified' || name === 'isActive')
          ? value === 'true'
          : value;
      const next = { ...current, [name]: normalizedValue };
      if (name === 'role' && value !== 'student') {
        next.year = '';
        next.section = '';
      }
      return next;
    });
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setVerificationLink('');

    try {
      const payload = {
        ...form,
        systemId: form.systemId || undefined,
        expiryDate: form.expiryDate || null,
      };
      const res = isEdit
        ? await API.put(`/users/${systemId}`, payload)
        : await API.post('/users', payload);

      if (res.data?.data?.verificationLink) {
        setVerificationLink(res.data.data.verificationLink);
      }

      toast.success(isEdit ? 'User updated' : 'User provisioned');
      navigate('/users');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        title={isEdit ? 'Edit User' : 'Provision User'}
        subtitle={isEdit ? 'Update lifecycle, role, and access settings for this identity.' : 'Provision a new managed identity with a controlled system ID and approval workflow.'}
        action={(
          <button type="button" onClick={() => navigate('/users')} className="btn-secondary">
            <FiArrowLeft size={14} />
            Back to Identity & Access
          </button>
        )}
      />

      <div className="card p-6">
        {error ? <div className="mb-4"><Alert type="error" message={error} /></div> : null}
        {verificationLink ? <div className="mb-4"><Alert type="warning" message={`Development verification link: ${verificationLink}`} /></div> : null}
        {loading ? (
          <div className="py-10 text-center text-sm text-gray-500">Loading user…</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="label">System ID</label>
                <input name="systemId" value={form.systemId} disabled={isEdit} onChange={handleChange} className="input" placeholder="Leave blank to auto-generate" />
              </div>
              <div>
                <label className="label">Role</label>
                <select name="role" value={form.role} onChange={handleChange} className="input">
                  {ROLES.filter((role) => isSuperAdmin || role !== 'admin').map((role) => <option key={role} value={role}>{role}</option>)}
                </select>
                {!isSuperAdmin ? <p className="mt-1 text-xs text-gray-500">Only the super admin can provision or modify admin accounts.</p> : null}
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="label">Full Name</label>
                <input name="name" value={form.name} onChange={handleChange} className="input" required />
              </div>
              <div>
                <label className="label">Email</label>
                <input name="email" type="email" value={form.email} onChange={handleChange} className="input" required />
              </div>
            </div>

            {!isEdit ? (
              <div>
                <label className="label">Temporary Password</label>
                <input name="password" type="password" value={form.password} onChange={handleChange} className="input" placeholder="Leave blank to auto-generate" />
              </div>
            ) : null}

            <div className={`grid gap-5 ${isStudent ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
              <div>
                <label className="label">Department</label>
                <input
                  name="department"
                  value={form.department}
                  onChange={handleChange}
                  className="input"
                  placeholder={isStudent ? 'Student department' : 'Owning department'}
                />
              </div>
              {isStudent ? (
                <>
                  <div>
                    <label className="label">Year</label>
                    <input name="year" value={form.year} onChange={handleChange} className="input" placeholder="e.g. 2" />
                  </div>
                  <div>
                    <label className="label">Section</label>
                    <input name="section" value={form.section} onChange={handleChange} className="input" placeholder="e.g. A" />
                  </div>
                </>
              ) : null}
            </div>

            <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-5 dark-surface-subtle">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-gray-900 dark-text-primary">Account State</h3>
                <p className="mt-1 text-sm text-gray-500 dark-text-muted">Manage sign-in readiness and lifecycle for this identity.</p>
              </div>

              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                <div>
                  <label className="label">Status</label>
                  <select name="status" value={form.status} onChange={handleChange} className="input">
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
                <div>
                  <label className="label">Verification</label>
                  <select name="emailVerified" value={String(form.emailVerified)} onChange={handleChange} className="input">
                    <option value="false">Not Verified</option>
                    <option value="true">Verified</option>
                  </select>
                </div>
                <div>
                  <label className="label">Access</label>
                  <select name="isActive" value={String(form.isActive)} onChange={handleChange} className="input">
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
                <div>
                  <label className="label">Expiry Date</label>
                  <input name="expiryDate" type="date" value={form.expiryDate} onChange={handleChange} className="input" />
                  <p className="mt-1 text-xs text-gray-500">{isStudent ? 'Recommended for student lifecycle control.' : 'Optional for non-student operational accounts.'}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-600 dark-surface-subtle dark-text-muted">
                Use the account state controls above to manage approval, verification, and access in one place.
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-600 dark-surface-subtle dark-text-muted">
                {isEdit ? 'Changes apply immediately after save.' : 'Provisioning keeps identity and access data aligned from the start.'}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
                <FiCheck size={14} />
                {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Provision User'}
              </button>
              <button type="button" onClick={() => navigate('/users')} className="btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {!isEdit ? (
        <div className="mt-5 card p-5">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
            <FiUpload size={15} />
            Bulk provisioning
          </div>
          <p className="mt-2 text-sm text-gray-500">Use the CSV import action from the user directory when you need to onboard many identities at once.</p>
        </div>
      ) : null}
    </div>
  );
}
