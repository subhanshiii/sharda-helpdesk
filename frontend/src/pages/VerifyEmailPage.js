import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FiCheckCircle, FiLoader, FiXCircle } from 'react-icons/fi';
import API from '../utils/api';
import { Alert } from '../components/ui';

export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [state, setState] = useState({ loading: true, success: false, message: '', redirecting: false });

  useEffect(() => {
    let redirectTimer;

    if (!token) {
      setState({ loading: false, success: false, message: 'Invalid or expired verification link', redirecting: false });
      return;
    }

    API.get(`/verify-email?token=${encodeURIComponent(token)}`)
      .then((res) => {
        const passwordSetupLink = res.data?.data?.passwordSetupRequired ? res.data?.data?.resetLink : null;
        setState({
          loading: false,
          success: true,
          message: res.data?.message || 'Email verified successfully',
          redirecting: true,
        });

        redirectTimer = window.setTimeout(() => {
          if (passwordSetupLink) {
            const nextUrl = new URL(passwordSetupLink, window.location.origin);
            navigate(`${nextUrl.pathname}${nextUrl.search}`, { replace: true });
            return;
          }
          navigate('/login?verified=success', { replace: true });
        }, 2500);
      })
      .catch((err) => {
        setState({
          loading: false,
          success: false,
          message: err.response?.data?.message || 'Invalid or expired verification link',
          redirecting: false,
        });
      });

    return () => {
      if (redirectTimer) {
        window.clearTimeout(redirectTimer);
      }
    };
  }, [navigate, token]);

  return (
    <div className="min-h-screen bg-sharda-light flex items-center justify-center p-4">
      <div className="w-full max-w-md card p-8 text-center">
        <div className="mb-5 flex justify-center">
          {state.loading ? (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-blue-600">
              <FiLoader size={30} className="animate-spin" />
            </div>
          ) : state.success ? (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <FiCheckCircle size={30} />
            </div>
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-600">
              <FiXCircle size={30} />
            </div>
          )}
        </div>

        <h1 className="font-display text-2xl font-bold text-gray-900 mb-2">Email Verification</h1>

        {state.loading ? (
          <p className="text-sm text-gray-500">Verifying your email...</p>
        ) : (
          <>
            <div className="mb-5">
              <Alert type={state.success ? 'success' : 'error'} message={state.message} />
            </div>
            <p className="text-sm text-gray-500 mb-6">
              {state.success
                ? 'Your email is verified. Redirecting you to the next step...'
                : 'You can request a new verification link from the login or registration flow.'}
            </p>
            {!state.success ? (
              <button type="button" onClick={() => navigate('/login', { replace: true })} className="btn-primary inline-flex justify-center w-full">
                Go to Login
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
