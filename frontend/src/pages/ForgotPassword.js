import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import API from '../utils/api';
import { FiMail, FiArrowLeft, FiCheckCircle } from 'react-icons/fi';
import { Alert } from '../components/ui';
import { useTheme } from '../context/ThemeContext';

export default function ForgotPassword() {
  const { isDark } = useTheme();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) { setError('Please enter your email'); return; }
    setLoading(true);
    try {
      await API.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`min-h-screen flex items-center justify-center p-6 ${isDark ? 'bg-slate-950' : ''}`}
      style={{
        background: isDark
          ? 'radial-gradient(circle at top, rgba(37,99,235,0.14) 0%, rgba(15,23,42,0.98) 42%, #020617 100%)'
          : 'linear-gradient(135deg, #f0f4ff 0%, #e8f0fe 100%)',
      }}
    >
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 shadow-lg overflow-hidden p-1"
            style={{ backgroundColor: '#ffffff' }}
          >
            <img src="/sharda-logo.png" alt="Sharda University" className="w-full h-full object-contain" /> {/* FIXED: restore the original Sharda logo */}
          </div>
          <h1 className={`font-display text-2xl font-black ${isDark ? 'text-slate-50' : 'text-gray-900'}`}>Forgot Password?</h1>
          <p className={`${isDark ? 'text-slate-400' : 'text-gray-500'} text-sm mt-1`}>No worries, we'll send you a reset link</p>
        </div>

        <div className={`card p-8 ${isDark ? 'border border-slate-800/90 bg-slate-900/95 shadow-2xl shadow-slate-950/40' : ''}`}>
          {sent ? (
            <div className="text-center py-4">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${isDark ? 'bg-emerald-950/60' : 'bg-green-50'}`}>
                <FiCheckCircle size={32} className="text-green-500" />
              </div>
              <h3 className={`font-display font-bold text-lg mb-2 ${isDark ? 'text-slate-50' : 'text-gray-900'}`}>Check your email!</h3>
              <p className={`${isDark ? 'text-slate-400' : 'text-gray-500'} text-sm leading-relaxed mb-6`}>
                If <strong>{email}</strong> is registered, you'll receive a password reset link shortly.
                The link expires in <strong>15 minutes</strong>.
              </p>
              <Link to="/login" className="btn-primary inline-flex justify-center w-full">
                Back to Login
              </Link>
            </div>
          ) : (
            <>
              {error && <div className="mb-4"><Alert type="error" message={error} /></div>}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label">Email Address</label>
                  <div className="relative">
                    <FiMail className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-400' : 'text-gray-400'}`} size={15} />
                    <input
                      type="email" value={email}
                      onChange={e => { setEmail(e.target.value); setError(''); }}
                      className="input pl-10"
                      placeholder="your.email@sharda.ac.in"
                    />
                  </div>
                  <p className={`text-xs mt-1.5 ${isDark ? 'text-slate-400' : 'text-gray-400'}`}>Enter the email you registered with</p>
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3">
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </form>
              <Link to="/login" className={`flex items-center justify-center gap-2 mt-5 text-sm transition-colors ${isDark ? 'text-slate-400 hover:text-blue-300' : 'text-gray-500 hover:text-blue-600'}`}>
                <FiArrowLeft size={14} /> Back to Login
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
