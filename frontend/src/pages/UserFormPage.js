import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiArrowLeft, FiCheck, FiUpload } from 'react-icons/fi';
import API from '../utils/api';
import { Alert, HelpTooltip, PageHeader } from '../components/ui';
import { usePermissions } from '../context/PermissionContext';
import { ADMIN_TIER_DEFINITIONS, getAdminTierDefinition, getAdminTierTone } from '../utils/helpers';

const ROLES = ['student', 'faculty', 'staff', 'admin'];
const ADMIN_TIER_GROUPS = [
  { label: 'No Tier', options: [{ value: '', label: 'No Tier' }] },
  { label: 'System-level', options: [{ value: 'super_admin', label: 'Super Admin' }, { value: 'admin', label: 'Admin' }] },
  { label: 'Scoped', options: [{ value: 'college_admin', label: 'College Admin' }, { value: 'department_admin', label: 'Department Admin' }, { value: 'program_coordinator', label: 'Program Coordinator' }, { value: 'section_moderator', label: 'Section Moderator' }] },
];

const initialForm = {
  systemId: '',
  name: '',
  email: '',
  password: '',
  role: 'student',
  adminTier: '',
  academicProgramId: '',
  orgUnitId: '',
  status: 'pending',
  expiryDate: '',
  isActive: true,
  emailVerified: false,
  passwordNeedsSetup: false,
  sectionId: '',
  scopeCollegeId: '',
  scopeDepartmentId: '',
  scopeProgramId: '',
  adminScopeIds: [],
};

const buildLifecyclePreview = (form) => {
  const verificationComplete = Boolean(form.emailVerified);
  const passwordPending = Boolean(form.passwordNeedsSetup) || (!form.password && !form.systemId);
  const credentialReady = verificationComplete && !passwordPending;
  const accessApproved = verificationComplete && credentialReady && form.status === 'approved';
  const requiresAcademicMapping = ['student', 'faculty', 'staff', 'admin'].includes(form.role);
  const rawAssignmentReady = requiresAcademicMapping
    ? form.role === 'student'
      ? Boolean(form.sectionId)
      : Boolean(form.orgUnitId)
    : true;
  const assignmentReady = accessApproved && rawAssignmentReady;
  const isExpired = Boolean(form.expiryDate && new Date(form.expiryDate) <= new Date());
  const hierarchyComplete = verificationComplete && credentialReady && accessApproved && assignmentReady;
  const canSignIn = hierarchyComplete && form.isActive !== false && !isExpired;

  return [
    { label: 'Account Created', complete: true, description: 'The user record exists in the system.' },
    { label: 'Email Confirmed', complete: verificationComplete, description: verificationComplete ? 'Email verification is complete.' : 'Waiting for email verification.' },
    { label: 'Password Set', complete: credentialReady, description: credentialReady ? 'A usable password is available.' : !verificationComplete ? 'Email verification must be completed first.' : 'Password setup is still pending.' },
    { label: 'Admin Approved', complete: accessApproved, description: accessApproved ? 'The account is approved for access.' : !credentialReady ? 'Password readiness must be completed first.' : `Current status is ${form.status || 'pending'}.` },
    {
      label: requiresAcademicMapping ? 'Academic Mapping Complete' : 'Academic Mapping Not Required',
      complete: assignmentReady,
      description: !requiresAcademicMapping
        ? 'This role does not require academic mapping.'
        : assignmentReady
          ? 'Academic mapping is in place.'
          : !accessApproved
            ? 'Admin approval must be completed first.'
            : form.role === 'student'
              ? 'Assign a section to complete academic mapping.'
              : 'Assign a home department unit to complete non-student placement.',
    },
    { label: 'Account Access', complete: canSignIn, description: canSignIn ? 'Account access is allowed.' : isExpired ? 'Account access has expired.' : form.isActive === false ? 'Account access is currently denied.' : hierarchyComplete ? 'Account access can be enabled by marking the account active.' : 'One or more earlier steps are still incomplete.' },
  ];
};

const buildDerivedAcademic = ({ role, section, program, orgUnit, departments, colleges }) => {
  if (role === 'student' && section) {
    return {
      school: section.department?.college?.name || '—',
      department: section.department?.name || '—',
      program: section.program?.name || '—',
      course: section.course?.name || '—',
      year: section.studyYear ? String(section.studyYear) : '—',
      section: section.name || '—',
    };
  }

  if (orgUnit) {
    const linkedDepartment = departments.find((entry) => String(entry._id) === String(orgUnit.linkedDepartmentId?._id || orgUnit.linkedDepartmentId || '')) || orgUnit.linkedDepartmentId || null;
    const linkedCollege = colleges.find((entry) => String(entry._id) === String(linkedDepartment?.college?._id || linkedDepartment?.college || orgUnit.collegeId?._id || orgUnit.collegeId || '')) || orgUnit.collegeId || null;

    return {
      school: linkedCollege?.name || '—',
      department: orgUnit.name || linkedDepartment?.name || '—',
      program: role === 'faculty' && program ? (program.name || '—') : (orgUnit.type === 'academic' ? 'Academic home unit' : 'Operational home unit'),
      course: '—',
      year: '—',
      section: '—',
    };
  }

  if ((role === 'faculty' || role === 'staff') && program) {
    const department = departments.find((entry) => String(entry._id) === String(program.department?._id || program.department)) || program.department || null;
    const college = colleges.find((entry) => String(entry._id) === String(department?.college?._id || department?.college)) || null;

    return {
      school: college?.name || '—',
      department: department?.name || '—',
      program: program.name || '—',
      course: '—',
      year: '—',
      section: '—',
    };
  }

  return {
    school: '—',
    department: '—',
    program: '—',
    course: '—',
    year: '—',
    section: '—',
  };
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
  const [orgUnitOptions, setOrgUnitOptions] = useState([]);
  const isStudent = form.role === 'student';
  const usesProgramReference = form.role === 'faculty';
  const needsOrgUnit = !isStudent;
  const { isSuperAdmin } = usePermissions();
  const selectedTierDefinition = getAdminTierDefinition(form.adminTier);
  const lifecyclePreview = buildLifecyclePreview(form);
  const selectedSection = useMemo(
    () => sectionOptions.find((entry) => String(entry._id) === String(form.sectionId)) || null,
    [form.sectionId, sectionOptions]
  );
  const selectedProgram = useMemo(
    () => programOptions.find((entry) => String(entry._id) === String(form.academicProgramId)) || null,
    [form.academicProgramId, programOptions]
  );
  const selectedOrgUnit = useMemo(
    () => orgUnitOptions.find((entry) => String(entry._id) === String(form.orgUnitId)) || null,
    [form.orgUnitId, orgUnitOptions]
  );
  const derivedAcademic = useMemo(
    () => buildDerivedAcademic({
      role: form.role,
      section: selectedSection,
      program: selectedProgram,
      orgUnit: selectedOrgUnit,
      departments: departmentOptions,
      colleges: collegeOptions,
    }),
    [collegeOptions, departmentOptions, form.role, selectedOrgUnit, selectedProgram, selectedSection]
  );

  useEffect(() => {
    if (!isEdit) return undefined;

    let mounted = true;
    const loadUser = async () => {
      setLoading(true);
      try {
        const res = await API.get(`/users/${systemId}`);
        const user = res.data?.data;
        if (!mounted || !user) return;

        const firstScopeId = String(user.adminScopes?.[0]?.scopeId || '');
        setForm({
          systemId: user.systemId || '',
          name: user.name || '',
          email: user.email || '',
          password: '',
          role: user.role || 'student',
          adminTier: user.adminTier || '',
          academicProgramId: user.role === 'student' ? '' : String(user.programId?._id || user.programId || ''),
          orgUnitId: String(user.orgUnitId?._id || user.orgUnitId || ''),
          status: user.status || 'pending',
          expiryDate: user.expiryDate ? new Date(user.expiryDate).toISOString().slice(0, 10) : '',
          isActive: user.isActive !== false,
          emailVerified: Boolean(user.emailVerified),
          passwordNeedsSetup: Boolean(user.passwordNeedsSetup),
          sectionId: String(user.sectionId?._id || user.sectionId || ''),
          scopeCollegeId: user.adminTier === 'college_admin' ? firstScopeId : '',
          scopeDepartmentId: user.adminTier === 'department_admin' ? firstScopeId : '',
          scopeProgramId: user.adminTier === 'program_coordinator' ? firstScopeId : '',
          adminScopeIds: user.adminTier === 'section_moderator' && Array.isArray(user.adminScopes)
            ? user.adminScopes.map((scope) => String(scope.scopeId))
            : [],
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
      API.get('/academics/org-units'),
    ]).then(([collegesRes, departmentsRes, programsRes, sectionsRes, orgUnitsRes]) => {
      if (!mounted) return;
      setCollegeOptions(collegesRes.data?.data || []);
      setDepartmentOptions(departmentsRes.data?.data || []);
      setProgramOptions(programsRes.data?.data || []);
      setSectionOptions(sectionsRes.data?.data || []);
      setOrgUnitOptions(orgUnitsRes.data?.data?.units || []);
    }).catch(() => {
      if (!mounted) return;
      setCollegeOptions([]);
      setDepartmentOptions([]);
      setProgramOptions([]);
      setSectionOptions([]);
      setOrgUnitOptions([]);
    });

    return () => {
      mounted = false;
    };
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => {
      const normalizedValue = (name === 'emailVerified' || name === 'isActive') ? value === 'true' : value;
      const next = { ...current, [name]: normalizedValue };

      if (name === 'role') {
        if (value !== 'student') next.sectionId = '';
        if (value !== 'faculty') next.academicProgramId = '';
        if (value === 'student') next.orgUnitId = '';
      }

      if (name === 'adminTier') {
        next.scopeCollegeId = '';
        next.scopeDepartmentId = '';
        next.scopeProgramId = '';
        next.adminScopeIds = [];
      }

      if (name === 'scopeCollegeId') {
        next.scopeDepartmentId = '';
        next.scopeProgramId = '';
      }

      if (name === 'scopeDepartmentId') {
        next.scopeProgramId = '';
      }

      if (name === 'scopeProgramId') {
        next.adminScopeIds = [];
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
        ? Boolean(form.scopeCollegeId)
        : form.adminTier === 'department_admin'
          ? Boolean(form.scopeDepartmentId)
          : form.adminTier === 'program_coordinator'
            ? Boolean(form.scopeProgramId)
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
        systemId: form.systemId || undefined,
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
        adminTier: form.adminTier,
        orgUnitId: needsOrgUnit ? (form.orgUnitId || null) : null,
        programId: usesProgramReference ? (form.academicProgramId || null) : null,
        sectionId: isStudent ? (form.sectionId || null) : null,
        status: form.status,
        expiryDate: form.expiryDate || null,
        isActive: form.isActive,
        emailVerified: form.emailVerified,
      };

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
        ? (form.scopeCollegeId ? [form.scopeCollegeId] : [])
        : form.adminTier === 'department_admin'
          ? (form.scopeDepartmentId ? [form.scopeDepartmentId] : [])
          : form.adminTier === 'program_coordinator'
            ? (form.scopeProgramId ? [form.scopeProgramId] : [])
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
                    <select name="scopeCollegeId" value={form.scopeCollegeId} onChange={handleChange} className="input" required disabled={!isSuperAdmin}>
                      <option value="">Select College</option>
                      {collegeOptions.map((college) => <option key={college._id} value={college._id}>{college.name}</option>)}
                    </select>
                  </div>
                ) : null}

                {form.adminTier === 'department_admin' ? (
                  <div>
                    <label className="label">Department Scope</label>
                    <select name="scopeDepartmentId" value={form.scopeDepartmentId} onChange={handleChange} className="input" required disabled={!isSuperAdmin}>
                      <option value="">Select Department</option>
                      {departmentOptions
                        .filter((department) => !form.scopeCollegeId || String(department.college?._id || department.college) === String(form.scopeCollegeId))
                        .map((department) => <option key={department._id} value={department._id}>{department.name}</option>)}
                    </select>
                  </div>
                ) : null}

                {form.adminTier === 'program_coordinator' ? (
                  <div>
                    <label className="label">Program Scope</label>
                    <select name="scopeProgramId" value={form.scopeProgramId} onChange={handleChange} className="input" required disabled={!isSuperAdmin}>
                      <option value="">Select Program</option>
                      {programOptions
                        .filter((program) => !form.scopeDepartmentId || String(program.department?._id || program.department) === String(form.scopeDepartmentId))
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

            <div className="space-y-4 rounded-3xl border border-gray-100 bg-gray-50 p-5">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Placement reference</h3>
                <p className="mt-1 text-sm text-gray-500">Students still derive their hierarchy from sections. Faculty, staff, and admins use a separate home department unit. Academic departments drive curriculum and teaching scope; department units drive people placement and ownership.</p>
              </div>

              {isStudent ? (
                <div>
                  <label className="label">Section Assignment</label>
                  <select name="sectionId" value={form.sectionId} onChange={handleChange} className="input">
                    <option value="">Select a section</option>
                    {sectionOptions.map((sectionOption) => (
                      <option key={sectionOption._id} value={sectionOption._id}>
                        {[sectionOption.program?.name, sectionOption.course?.name, sectionOption.academicSession?.label, sectionOption.name ? `Section ${sectionOption.name}` : null].filter(Boolean).join(' · ')}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">This section becomes the single source of truth for the student’s academic hierarchy.</p>
                </div>
              ) : null}

              {needsOrgUnit ? (
                <div>
                  <label className="label">Home Department Unit</label>
                  <select name="orgUnitId" value={form.orgUnitId} onChange={handleChange} className="input">
                    <option value="">Select Department Unit</option>
                    {orgUnitOptions
                      .filter((unit) => form.role !== 'faculty' || unit.type === 'academic')
                      .map((unit) => (
                        <option key={unit._id} value={unit._id}>
                          {[unit.name, unit.type === 'academic' ? 'Academic' : 'Operational', unit.linkedDepartmentId?.name || unit.collegeId?.name || null].filter(Boolean).join(' · ')}
                        </option>
                      ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    {form.role === 'faculty'
                      ? 'Faculty use an academic home unit here, such as a unit linked to CSE. Teaching visibility still comes from subject and section assignments, not from the home unit alone.'
                      : 'This unit becomes the non-student ownership anchor for placement, scope, and grouping.'}
                  </p>
                </div>
              ) : null}

              {usesProgramReference ? (
                <div>
                  <label className="label">Program Affiliation</label>
                  <select name="academicProgramId" value={form.academicProgramId} onChange={handleChange} className="input">
                    <option value="">Select Program</option>
                    {programOptions.map((program) => <option key={program._id} value={program._id}>{program.name}</option>)}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">Optional for faculty when you want a visible academic affiliation in addition to the home unit. This does not replace subject-section teaching assignments.</p>
                </div>
              ) : null}

              {!isStudent && !needsOrgUnit ? (
                <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600">
                  This role does not require a direct academic mapping in the user form.
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-2xl border border-gray-200 bg-white px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">School</p>
                  <p className="mt-2 text-sm font-semibold text-gray-900">{derivedAcademic.school}</p>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-white px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Department</p>
                  <p className="mt-2 text-sm font-semibold text-gray-900">{derivedAcademic.department}</p>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-white px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Program</p>
                  <p className="mt-2 text-sm font-semibold text-gray-900">{derivedAcademic.program}</p>
                </div>
                {isStudent ? (
                  <>
                    <div className="rounded-2xl border border-gray-200 bg-white px-4 py-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Course</p>
                      <p className="mt-2 text-sm font-semibold text-gray-900">{derivedAcademic.course}</p>
                    </div>
                    <div className="rounded-2xl border border-gray-200 bg-white px-4 py-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Study Year</p>
                      <p className="mt-2 text-sm font-semibold text-gray-900">{derivedAcademic.year}</p>
                    </div>
                    <div className="rounded-2xl border border-gray-200 bg-white px-4 py-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Section</p>
                      <p className="mt-2 text-sm font-semibold text-gray-900">{derivedAcademic.section}</p>
                    </div>
                  </>
                ) : null}
              </div>
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
                  <label className="label">Account Access</label>
                  <select name="isActive" value={String(form.isActive)} onChange={handleChange} className="input">
                    <option value="true">Allowed</option>
                    <option value="false">Denied</option>
                  </select>
                </div>
                <div>
                  <label className="label">Expiry Date</label>
                  <input name="expiryDate" type="date" value={form.expiryDate} onChange={handleChange} className="input" />
                  <p className="mt-1 text-xs text-gray-500">{isStudent ? 'Recommended for student lifecycle control.' : 'Optional for non-student operational accounts.'}</p>
                </div>
              </div>

              <div className="mt-5 border-t border-gray-200 pt-5">
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-gray-900 dark-text-primary">Derived Readiness Preview</h4>
                  <p className="mt-1 text-sm text-gray-500 dark-text-muted">These tags update from the current form values before you save.</p>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {lifecyclePreview.map((item) => (
                    <div key={item.label} className={`rounded-2xl border px-4 py-4 ${item.complete ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-gray-900">{item.label}</p>
                        <span className={`badge ${item.complete ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
                          {item.complete ? 'True' : 'False'}
                        </span>
                      </div>
                      <p className="mt-3 text-xs leading-5 text-gray-500">{item.description}</p>
                    </div>
                  ))}
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
