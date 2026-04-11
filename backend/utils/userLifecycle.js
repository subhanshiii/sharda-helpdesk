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
  const assignmentRequired = ['student', 'faculty'].includes(normalizedRole);
  const assignmentReady = assignmentRequired ? Boolean(isAssigned) : true;
  const accessApproved = status === 'approved';
  const operationallyActive = accessApproved && isActive && !isExpired;

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
      description: credentialReady ? 'User can authenticate with a managed password.' : 'Password setup still needs to be completed.',
    },
    {
      key: 'assignment',
      label: assignmentRequired ? 'Assignment Ready' : 'Assignment Not Required',
      complete: assignmentReady,
      description: assignmentRequired
        ? assignmentReady
          ? 'Academic assignment is linked and ready.'
          : `Waiting for ${normalizedRole === 'student' ? 'section enrollment' : 'teaching assignment'}.`
        : 'This role does not require academic assignment.',
    },
    {
      key: 'active',
      label: 'Access Active',
      complete: operationallyActive,
      description: operationallyActive
        ? 'User can sign in and access assigned modules.'
        : isExpired
          ? 'Account access has expired.'
          : !isActive
            ? 'Account is currently inactive.'
            : accessApproved
              ? 'Waiting on remaining readiness checks.'
              : `Account status is ${status || 'pending'}.`,
    },
  ];

  const overall = operationallyActive
    ? 'active'
    : !verificationComplete
      ? 'pending_verification'
      : !credentialReady
        ? 'password_setup'
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
    credentialReady,
    verificationComplete,
    operationallyActive,
    isExpired,
  };
};

module.exports = {
  buildLifecycleSnapshot,
};
