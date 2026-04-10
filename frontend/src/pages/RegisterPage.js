import React from 'react';
import { Link } from 'react-router-dom';
import { FiHelpCircle, FiShield } from 'react-icons/fi';

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-sharda-light flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary-600 mb-4">
            <FiHelpCircle className="text-white" size={24} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Controlled Onboarding</h1>
          <p className="text-sm text-gray-500 mt-1">Accounts are provisioned by university administrators to keep identity, roles, and approvals secure.</p>
        </div>

        <div className="card p-6">
          <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm">
                <FiShield size={18} />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">How access works</h2>
                <ul className="mt-2 space-y-2 text-sm text-gray-600">
                  <li>1. Admin creates or imports your university account with a permanent system ID.</li>
                  <li>2. You verify your email using the link sent to your inbox.</li>
                  <li>3. If your account was provisioned without a password, you set one right after verification.</li>
                  <li>4. Once verification and password setup are complete, you can sign in with email/password or Google if your account exists.</li>
                </ul>
              </div>
            </div>
          </div>

          <p className="text-center text-sm text-gray-500 mt-5">
            Already have an account?{' '}
            <Link to="/login" className="text-primary-600 font-medium hover:underline">Sign in</Link>
          </p>
          <p className="text-center text-xs text-gray-400 mt-3">
            If your account has not been provisioned yet, contact your university administrator.
          </p>
        </div>
      </div>
    </div>
  );
}
