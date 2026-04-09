import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import API from '../utils/api';
import { Alert, FullPageSpinner } from '../components/ui';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [state, setState] = useState({ loading: true, success: false, message: '' });

  useEffect(() => {
    if (!token) {
      setState({ loading: false, success: false, message: 'Verification link is missing or invalid.' });
      return;
    }

    API.get(`/auth/verify-email/${token}`)
      .then((res) => {
        setState({
          loading: false,
          success: true,
          message: res.data?.message || 'Email verified successfully.',
        });
      })
      .catch((err) => {
        setState({
          loading: false,
          success: false,
          message: err.response?.data?.message || 'Verification link is invalid or expired.',
        });
      });
  }, [token]);

  if (state.loading) return <FullPageSpinner />;

  return (
    <div className="min-h-screen bg-sharda-light flex items-center justify-center p-4">
      <div className="w-full max-w-md card p-8 text-center">
        <h1 className="font-display text-2xl font-bold text-gray-900 mb-2">Email Verification</h1>
        <div className="mb-5">
          <Alert type={state.success ? 'success' : 'error'} message={state.message} />
        </div>
        <p className="text-sm text-gray-500 mb-6">
          {state.success
            ? 'Your email is verified. Once an admin approves your account, you can sign in.'
            : 'You can request a new verification link from the login or registration flow.'}
        </p>
        <Link to="/login" className="btn-primary inline-flex justify-center w-full">
          Go to Login
        </Link>
      </div>
    </div>
  );
}
