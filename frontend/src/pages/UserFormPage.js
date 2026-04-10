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
  const isFaculty = form.role === 'faculty';
  const isStaff = form.role === 'staff';
  const isAdmin = form.role === 'admin';
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
      const next = { ...current, [name]: type === 'checkbox' ? checked : value };
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

            <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
              <p className="text-sm font-semibold text-gray-900">Role mapping</p>
              <p className="mt-1 text-sm text-gray-500">
                {isStudent ? 'Students require academic placement fields so timetable, assignments, and attendance map correctly.' : null}
                {isFaculty ? 'Faculty accounts should carry department data. Teaching assignments are linked separately through academic structure.' : null}
                {isStaff ? 'Staff accounts can be provisioned with department ownership and lifecycle settings only.' : null}
                {isAdmin ? 'Admin accounts get platform-wide access. The system admin remains the only super admin and is managed from environment bootstrap.' : null}
              </p>
            </div>

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

            <div className="grid gap-5 md:grid-cols-3">
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
                <label className="label">Expiry Date</label>
                <input name="expiryDate" type="date" value={form.expiryDate} onChange={handleChange} className="input" />
                <p className="mt-1 text-xs text-gray-500">{isStudent ? 'Recommended for student lifecycle control.' : 'Optional for non-student operational accounts.'}</p>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input name="isActive" type="checkbox" checked={form.isActive} onChange={handleChange} className="rounded" />
                  Account active
                </label>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input name="emailVerified" type="checkbox" checked={form.emailVerified} onChange={handleChange} className="rounded" />
                Mark email as verified
              </label>
              <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-xs text-gray-500">
                Super admin and admins can override lifecycle state here. A verified + approved + active account can sign in immediately.
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
