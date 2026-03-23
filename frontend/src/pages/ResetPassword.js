import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import API from '../utils/api';
import toast from 'react-hot-toast';
import { FiLock, FiCheckCircle, FiAlertCircle, FiEye, FiEyeOff } from 'react-icons/fi';
import { Alert, FullPageSpinner } from '../components/ui';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [status, setStatus] = useState('verifying'); // verifying | valid | invalid | success
  const [form, setForm] = useState({ newPassword: '', confirmPassword: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) { setStatus('invalid'); return; }
    API.get(`/auth/verify-reset-token/${token}`)
      .then(() => setStatus('valid'))
      .catch(() => setStatus('invalid'));
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword) { setError('Passwords do not match'); return; }
    if (form.newPassword.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      await API.post('/auth/reset-password', { token, newPassword: form.newPassword });
      setStatus('success');
      toast.success('Password reset successfully!');
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  if (status === 'verifying') return <FullPageSpinner />;

  return (
    <div className="min-h-screen flex items-center justify-center p-6"
      style={{ background: 'linear-gradient(135deg, #f0f4ff 0%, #e8f0fe 100%)' }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 shadow-lg overflow-hidden bg-white p-1">
            <img src="/sharda-logo.png" alt="Sharda University" className="w-full h-full object-contain" />
          </div>
          <h1 className="font-display text-2xl font-black text-gray-900">Reset Password</h1>
        </div>

        <div className="card p-8">
          {status === 'invalid' && (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
                <FiAlertCircle size={32} className="text-red-500" />
              </div>
              <h3 className="font-display font-bold text-gray-900 text-lg mb-2">Link Invalid or Expired</h3>
              <p className="text-gray-500 text-sm mb-6">This reset link is no longer valid. Please request a new one.</p>
              <Link to="/forgot-password" className="btn-primary inline-flex justify-center w-full">Request New Link</Link>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
                <FiCheckCircle size={32} className="text-green-500" />
              </div>
              <h3 className="font-display font-bold text-gray-900 text-lg mb-2">Password Reset!</h3>
              <p className="text-gray-500 text-sm mb-2">Your password has been reset successfully.</p>
              <p className="text-xs text-gray-400">Redirecting to login in 3 seconds...</p>
            </div>
          )}

          {status === 'valid' && (
            <>
              {error && <div className="mb-4"><Alert type="error" message={error} /></div>}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label">New Password</label>
                  <div className="relative">
                    <FiLock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={form.newPassword}
                      onChange={e => { setForm(f => ({...f, newPassword: e.target.value})); setError(''); }}
                      className="input pl-10 pr-10"
                      placeholder="Minimum 6 characters"
                    />
                    <button type="button" onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPass ? <FiEyeOff size={15} /> : <FiEye size={15} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="label">Confirm New Password</label>
                  <div className="relative">
                    <FiLock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                    <input
                      type="password"
                      value={form.confirmPassword}
                      onChange={e => { setForm(f => ({...f, confirmPassword: e.target.value})); setError(''); }}
                      className="input pl-10"
                      placeholder="Re-enter new password"
                    />
                  </div>
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3">
                  {loading ? 'Resetting...' : 'Reset Password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
