import React from 'react';
import { Link } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-sharda-light flex items-center justify-center p-6">
      <div className="text-center">
        <div className="text-8xl mb-4">🎫</div>
        <h1 className="text-6xl font-extrabold text-gray-200 mb-2">404</h1>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Page Not Found</h2>
        <p className="text-gray-500 text-sm mb-6">
          The page you're looking for doesn't exist or you don't have access.
        </p>
        <Link to="/dashboard" className="btn-primary inline-flex">
          <FiArrowLeft size={15} /> Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
