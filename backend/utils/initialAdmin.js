const getInitialAdminEmail = () => String(process.env.INITIAL_ADMIN_EMAIL || '').trim().toLowerCase();

const isSeededSuperAdmin = (user) => {
  const initialAdminEmail = getInitialAdminEmail();
  if (!initialAdminEmail || !user) return false;

  return String(user.email || '').trim().toLowerCase() === initialAdminEmail
    && user.role === 'admin'
    && user.adminTier === 'super_admin';
};

module.exports = {
  getInitialAdminEmail,
  isSeededSuperAdmin,
};
