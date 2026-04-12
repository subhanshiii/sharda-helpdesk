import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiArrowLeft, FiCheck, FiUpload } from 'react-icons/fi';
import API from '../utils/api';
import { Alert, HelpTooltip, PageHeader } from '../components/ui';
import { usePermissions } from '../context/PermissionContext';
import { ADMIN_TIER_DEFINITIONS, getAdminTierDefinition, getAdminTierTone } from '../utils/helpers';

const ROLES = ['student', 'faculty', 'staff', 'admin'];
const ADMIN_TIER_GROUPS = [
  {
    label: 'No Tier',
    options: [
      { value: '', label: 'No Tier' },
    ],
  },
  {
    label: 'System-level',
    options: [
      { value: 'super_admin', label: 'Super Admin' },
      { value: 'admin', label: 'Admin' },
    ],
  },
  {
    label: 'Scoped',
    options: [
      { value: 'college_admin', label: 'College Admin' },
      { value: 'department_admin', label: 'Department Admin' },
      { value: 'program_coordinator', label: 'Program Coordinator' },
      { value: 'section_moderator', label: 'Section Moderator' },
    ],
  },
];

const initialForm = {
  systemId: '',
  name: '',
  email: '',
  password: '',
  role: 'student',
  adminTier: '',
  collegeId: '',
  department: '',
  departmentId: '',
  programId: '',
  year: '',
  section: '',
  status: 'pending',
  expiryDate: '',
  isActive: true,
  emailVerified: false,
  sectionId: '',
  adminScopeIds: [],
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
  const [collegeOptions, setCollegeOptions] = useState([]);
  const [departmentOptions, setDepartmentOptions] = useState([]);
  const [programOptions, setProgramOptions] = useState([]);
  const [sectionOptions, setSectionOptions] = useState([]);
  const isStudent = form.role === 'student';
  const { isSuperAdmin } = usePermissions();
  const selectedTierDefinition = getAdminTierDefinition(form.adminTier);

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
          adminTier: user.adminTier || '',
          collegeId: user.collegeId?._id || user.collegeId || '',
          department: user.department || '',
          departmentId: user.departmentId?._id || user.departmentId || '',
          programId: user.programId?._id || user.programId || '',
          year: user.year || '',
          section: user.section || '',
          status: user.status || 'pending',
          expiryDate: user.expiryDate ? new Date(user.expiryDate).toISOString().slice(0, 10) : '',
          isActive: user.isActive !== false,
          emailVerified: Boolean(user.emailVerified),
          sectionId: user.sectionId?._id || user.sectionId || '',
          adminScopeIds: Array.isArray(user.adminScopes) ? user.adminScopes.map((scope) => String(scope.scopeId)) : [],
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

  useEffect(() => {
    let mounted = true;
    Promise.all([
      API.get('/academics/colleges'),
      API.get('/academics/departments'),
      API.get('/academics/programs'),
      API.get('/academics/sections'),
    ])
      .then(([collegesRes, departmentsRes, programsRes, sectionsRes]) => {
        if (!mounted) return;
        setCollegeOptions(collegesRes.data?.data || []);
        setDepartmentOptions(departmentsRes.data?.data || []);
        setProgramOptions(programsRes.data?.data || []);
        setSectionOptions(sectionsRes.data?.data || []);
      })
      .catch(() => {
        if (!mounted) return;
        setCollegeOptions([]);
        setDepartmentOptions([]);
        setProgramOptions([]);
        setSectionOptions([]);
      });

    return () => {
      mounted = false;
    };
  }, []);

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
        next.sectionId = '';
      }
      if (name === 'adminTier') {
        next.adminScopeIds = [];
        if (!value || value === 'super_admin' || value === 'admin') {
          next.collegeId = '';
          next.departmentId = '';
          next.programId = '';
        }
      }
      if (name === 'collegeId' && ['college_admin', 'department_admin', 'program_coordinator', 'section_moderator'].includes(current.adminTier)) {
        next.departmentId = '';
        next.programId = '';
      }
      if (name === 'departmentId' && ['department_admin', 'program_coordinator', 'section_moderator'].includes(current.adminTier)) {
        next.programId = '';
      }
      if (name === 'programId' && ['program_coordinator', 'section_moderator'].includes(current.adminTier)) {
        next.adminScopeIds = [];
      }
      if (name === 'sectionId') {
        const selectedSection = sectionOptions.find((entry) => String(entry._id) === String(value));
        next.section = selectedSection?.name || '';
        next.department = selectedSection?.department?.name || current.department || '';
        next.departmentId = selectedSection?.department?._id || current.departmentId || '';
        next.collegeId = selectedSection?.department?.college?._id || current.collegeId || '';
        next.programId = selectedSection?.program?._id || current.programId || '';
        next.year = selectedSection?.academicSession?.yearNumber ? String(selectedSection.academicSession.yearNumber) : current.year;
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

    if (form.adminTier) {
      const needsScope = ['college_admin', 'department_admin', 'program_coordinator', 'section_moderator'].includes(form.adminTier);
      const hasScope = form.adminTier === 'college_admin'
        ? Boolean(form.collegeId)
        : form.adminTier === 'department_admin'
          ? Boolean(form.departmentId)
          : form.adminTier === 'program_coordinator'
            ? Boolean(form.programId)
            : form.adminScopeIds.length > 0;
      if (needsScope && !hasScope) {
        setError('Please select the required scope for this access tier');
        setSaving(false);
        return;
      }
      if (!isSuperAdmin) {
        setError('Only the super admin can assign or modify access tiers');
        setSaving(false);
        return;
      }
    }

    try {
      const payload = {
        ...form,
        systemId: form.systemId || undefined,
        expiryDate: form.expiryDate || null,
      };
      delete payload.adminScopeIds;
      const res = isEdit
        ? await API.put(`/users/${systemId}`, payload)
        : await API.post('/users', payload);

      const savedUser = res.data?.data;
      const scopedTierType = {
        college_admin: 'college',
        department_admin: 'department',
        program_coordinator: 'program',
        section_moderator: 'section',
      }[form.adminTier];
      const scopeIds = form.adminTier === 'college_admin'
        ? (form.collegeId ? [form.collegeId] : [])
        : form.adminTier === 'department_admin'
          ? (form.departmentId ? [form.departmentId] : [])
          : form.adminTier === 'program_coordinator'
            ? (form.programId ? [form.programId] : [])
            : form.adminScopeIds;

      if (isSuperAdmin && savedUser?._id) {
        await API.post('/admin-scope', {
          userId: savedUser._id,
          scopes: scopedTierType ? scopeIds.map((scopeId) => ({ scopeType: scopedTierType, scopeId })) : [],
        });
      }

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

            <div className="space-y-4 rounded-3xl border border-gray-100 bg-gray-50 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <label className="label !mb-0">Access Tier</label>
                    <HelpTooltip
                      title="Tier-based access"
                      items={ADMIN_TIER_DEFINITIONS.map((tier) => ({
                        label: `${tier.label} · Tier ${tier.level}`,
                        description: `${tier.scopeLabel}. ${tier.description}`,
                      }))}
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">Roles define the user’s base function. A tier is optional and adds elevated access on top of that role.</p>
                </div>
                {selectedTierDefinition ? (
                  <div className={`badge ${getAdminTierTone(selectedTierDefinition.key)}`}>
                    {selectedTierDefinition.label} · Tier {selectedTierDefinition.level}
                  </div>
                ) : (
                  <div className="badge bg-slate-100 text-slate-600">No Tier</div>
                )}
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <select name="adminTier" value={form.adminTier} onChange={handleChange} className="input" disabled={!isSuperAdmin}>
                    {ADMIN_TIER_GROUPS.map((group) => (
                      <optgroup key={group.label} label={group.label}>
                        {group.options.map((option) => (
                          <option key={option.value || 'none'} value={option.value}>{option.label}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  {!isSuperAdmin ? <p className="mt-1 text-xs text-gray-500">Only the super admin can assign or change tiers.</p> : null}
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600">
                  {selectedTierDefinition ? (
                    <>
                      <p className="font-semibold text-gray-900">{selectedTierDefinition.scopeLabel}</p>
                      <p className="mt-1">{selectedTierDefinition.description}</p>
                    </>
                  ) : (
                    <>
                      <p className="font-semibold text-gray-900">No Tier</p>
                      <p className="mt-1">This user will only receive the standard permissions that come from their role.</p>
                    </>
                  )}
                </div>

                {form.adminTier === 'college_admin' ? (
                  <div>
                    <label className="label">College Scope</label>
                    <select name="collegeId" value={form.collegeId} onChange={handleChange} className="input" required disabled={!isSuperAdmin}>
                      <option value="">Select College</option>
                      {collegeOptions.map((college) => <option key={college._id} value={college._id}>{college.name}</option>)}
                    </select>
                  </div>
                ) : null}

                {form.adminTier === 'department_admin' ? (
                  <div>
                    <label className="label">Department Scope</label>
                    <select name="departmentId" value={form.departmentId} onChange={handleChange} className="input" required disabled={!isSuperAdmin}>
                      <option value="">Select Department</option>
                      {departmentOptions
                        .filter((department) => !form.collegeId || String(department.college?._id || department.college) === String(form.collegeId))
                        .map((department) => <option key={department._id} value={department._id}>{department.name}</option>)}
                    </select>
                  </div>
                ) : null}

                {form.adminTier === 'program_coordinator' ? (
                  <div>
                    <label className="label">Program Scope</label>
                    <select name="programId" value={form.programId} onChange={handleChange} className="input" required disabled={!isSuperAdmin}>
                      <option value="">Select Program</option>
                      {programOptions
                        .filter((program) => !form.departmentId || String(program.department?._id || program.department) === String(form.departmentId))
                        .map((program) => <option key={program._id} value={program._id}>{program.name}</option>)}
                    </select>
                  </div>
                ) : null}
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
                  disabled={isStudent && Boolean(form.sectionId)}
                />
              </div>
              {isStudent ? (
                <>
                  <div>
                    <label className="label">Section Assignment</label>
                    <select name="sectionId" value={form.sectionId} onChange={handleChange} className="input">
                      <option value="">Select a section</option>
                      {sectionOptions.map((sectionOption) => (
                        <option key={sectionOption._id} value={sectionOption._id}>
                          {[
                            sectionOption.program?.name,
                            sectionOption.course?.name,
                            sectionOption.academicSession?.label,
                            sectionOption.name ? `Section ${sectionOption.name}` : null,
                          ].filter(Boolean).join(' · ')}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-gray-500">Assigning a section keeps student academics aligned with timetable, attendance, and subjects.</p>
                  </div>
                  <div>
                    <label className="label">Year Snapshot</label>
                    <input name="year" value={form.year} onChange={handleChange} className="input" placeholder="e.g. 2" disabled={Boolean(form.sectionId)} />
                  </div>
                  <div className="md:col-span-3">
                    <label className="label">Section Snapshot</label>
                    <input name="section" value={form.section} onChange={handleChange} className="input" placeholder="e.g. A" disabled={Boolean(form.sectionId)} />
                  </div>
                </>
              ) : null}
            </div>

            {form.adminTier === 'section_moderator' ? (
              <div>
                <label className="label">Section Scope</label>
                <div className="grid max-h-56 gap-3 overflow-y-auto rounded-2xl border border-gray-100 bg-gray-50/70 p-4 md:grid-cols-2">
                  {sectionOptions.map((sectionOption) => {
                    const checked = form.adminScopeIds.includes(String(sectionOption._id));
                    return (
                      <label key={sectionOption._id} className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 transition ${checked ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-white'}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!isSuperAdmin}
                          onChange={(event) => {
                            const value = String(sectionOption._id);
                            setForm((current) => ({
                              ...current,
                              adminScopeIds: event.target.checked
                                ? [...current.adminScopeIds, value]
                                : current.adminScopeIds.filter((entry) => entry !== value),
                            }));
                          }}
                        />
                        <span className="text-sm text-gray-700">
                          {[sectionOption.program?.name, sectionOption.course?.name, sectionOption.academicSession?.label, sectionOption.name ? `Section ${sectionOption.name}` : null].filter(Boolean).join(' · ')}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ) : null}

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
