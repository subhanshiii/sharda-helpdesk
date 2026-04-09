import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { FiMail, FiLock, FiUser, FiHash, FiBook, FiHelpCircle } from 'react-icons/fi';
import { Alert } from '../components/ui';

const ROLE_OPTIONS = ['student', 'faculty', 'staff'];

export default function RegisterPage() {
  const { register, loading } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '', email: '', password: '', confirmPassword: '',
    department: '', enrollmentId: '', role: 'student',
  });
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) {
      setError('Name, email, and password are required');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    const result = await register({
      name: form.name,
      email: form.email,
      password: form.password,
      department: form.department,
      enrollmentId: form.enrollmentId,
      role: form.role,
    });

    if (result.success) {
      toast.success(result.message || 'Registration submitted. Verify your email, then wait for admin approval.');
      navigate('/login');
    } else {
      setError(result.message);
    }
  };

  return (
    <div className="min-h-screen bg-sharda-light flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary-600 mb-4">
            <FiHelpCircle className="text-white" size={24} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Create Account</h1>
          <p className="text-sm text-gray-500 mt-1">Register with email and password. Your account will be activated after admin approval.</p>
        </div>

        <div className="card p-6">
          {error && (
            <div className="mb-4">
              <Alert type="error" message={error} />
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Full Name <span className="text-red-500">*</span></label>
              <div className="relative">
                <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                <input name="name" value={form.name} onChange={handleChange}
                  className="input pl-9" placeholder="Your full name" />
              </div>
            </div>

            <div>
              <label className="label">Email Address <span className="text-red-500">*</span></label>
              <div className="relative">
                <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                <input type="email" name="email" value={form.email} onChange={handleChange}
                  className="input pl-9" placeholder="you@sharda.ac.in" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Role</label>
                <select
                  name="role"
                  value={form.role}
                  onChange={handleChange}
                  className="input"
                >
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role} value={role}>
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Department</label>
                <div className="relative">
                  <FiBook className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                  <input name="department" value={form.department} onChange={handleChange}
                    className="input pl-9" placeholder="e.g. CSE" />
                </div>
              </div>
              <div className="col-span-2">
                <label className="label">Enrollment ID</label>
                <div className="relative">
                  <FiHash className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                  <input name="enrollmentId" value={form.enrollmentId} onChange={handleChange}
                    className="input pl-9" placeholder={form.role === 'student' ? 'SU2024001' : 'Optional employee/university ID'} />
                </div>
              </div>
            </div>

            <div>
              <label className="label">Password <span className="text-red-500">*</span></label>
              <div className="relative">
                <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                <input type="password" name="password" value={form.password} onChange={handleChange}
                  className="input pl-9" placeholder="Minimum 6 characters" />
              </div>
            </div>

            <div>
              <label className="label">Confirm Password <span className="text-red-500">*</span></label>
              <div className="relative">
                <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                <input type="password" name="confirmPassword" value={form.confirmPassword} onChange={handleChange}
                  className="input pl-9" placeholder="Re-enter password" />
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5 mt-2">
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-5">
            Already have an account?{' '}
            <Link to="/login" className="text-primary-600 font-medium hover:underline">Sign in</Link>
          </p>
          <p className="text-center text-xs text-gray-400 mt-3">
            Use your university email address. You must verify the email before admin approval can activate the account.
          </p>
        </div>
      </div>
    </div>
  );
}
