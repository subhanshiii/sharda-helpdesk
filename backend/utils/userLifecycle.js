const { normalizeRole } = require('./roleHelpers');

const buildLifecycleSnapshot = ({
  role,
  emailVerified,
  passwordNeedsSetup,
  status,
  isActive,
  expiryDate,
  isAssigned = false,
}) => {
  const normalizedRole = normalizeRole(role);
  const now = new Date();
  const isExpired = Boolean(expiryDate && new Date(expiryDate) <= now);
  const verificationComplete = Boolean(emailVerified);
  const credentialReady = verificationComplete && !passwordNeedsSetup;
  const accessApproved = verificationComplete && credentialReady && status === 'approved';
  const assignmentRequired = ['student', 'faculty'].includes(normalizedRole);
  const rawAssignmentReady = assignmentRequired ? Boolean(isAssigned) : true;
  const assignmentReady = accessApproved && rawAssignmentReady;
  const hierarchyComplete = verificationComplete && credentialReady && accessApproved && assignmentReady;
  const operationallyActive = hierarchyComplete && isActive && !isExpired;

  const stages = [
    {
      key: 'provisioned',
      label: 'Provisioned',
      complete: true,
      description: 'Identity record exists in the ERP directory.',
    },
    {
      key: 'verified',
      label: 'Email Verified',
      complete: verificationComplete,
      description: verificationComplete ? 'Email verification is complete.' : 'Waiting for the user to verify their email.',
    },
    {
      key: 'credentials',
      label: 'Password Ready',
      complete: credentialReady,
      description: credentialReady
        ? 'User can authenticate with a managed password.'
        : !verificationComplete
          ? 'Complete email verification before the password step can be finished.'
          : 'Password setup still needs to be completed.',
    },
    {
      key: 'approval',
      label: 'Admin Approved',
      complete: accessApproved,
      description: !verificationComplete
        ? 'Complete email verification before admin approval can be treated as ready.'
        : !credentialReady
          ? 'Complete password setup before admin approval can be treated as ready.'
          : accessApproved
            ? 'The account has been approved for access.'
            : `Account status is ${status || 'pending'}.`,
    },
    {
      key: 'assignment',
      label: assignmentRequired ? 'Assignment Ready' : 'Assignment Not Required',
      complete: assignmentReady,
      description: !verificationComplete
        ? 'Complete email verification before academic mapping can be treated as ready.'
        : !credentialReady
          ? 'Complete password setup before academic mapping can be treated as ready.'
          : !accessApproved
            ? 'Complete admin approval before academic mapping can be treated as ready.'
            : assignmentRequired
              ? assignmentReady
                ? 'Academic assignment is linked and ready.'
                : `Waiting for ${normalizedRole === 'student' ? 'section enrollment' : 'teaching assignment'}.`
              : 'This role does not require academic assignment.',
    },
    {
      key: 'active',
      label: 'Account Access',
      complete: operationallyActive,
      description: operationallyActive
        ? 'Account access is allowed.'
        : isExpired
          ? 'Account access has expired.'
          : !isActive
            ? 'Account access is currently denied.'
            : hierarchyComplete
              ? 'Account access can be enabled by marking the account active.'
              : `Account status is ${status || 'pending'}.`,
    },
  ];

  const overall = operationallyActive
    ? 'active'
    : !verificationComplete
      ? 'pending_verification'
      : !credentialReady
        ? 'password_setup'
        : !accessApproved
          ? 'pending_approval'
          : !assignmentReady
          ? 'assignment_pending'
          : status === 'rejected'
            ? 'rejected'
            : status === 'suspended'
              ? 'suspended'
              : isExpired
                ? 'expired'
                : !isActive
                  ? 'inactive'
                  : accessApproved
                    ? 'ready'
                    : 'pending_approval';

  return {
    overall,
    stages,
    requiresAssignment: assignmentRequired,
    assignmentReady,
    accessApproved,
    hierarchyComplete,
    credentialReady,
    verificationComplete,
    operationallyActive,
    isExpired,
  };
};

module.exports = {
  buildLifecycleSnapshot,
};
