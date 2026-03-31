import React from 'react';
import { Link } from 'react-router-dom';
import { FiRefreshCw, FiHome, FiAlertCircle } from 'react-icons/fi';

/**
 * Error Boundary
 *
 * Catches React render errors so a single broken component
 * doesn't crash the entire app. Shows a friendly error UI instead.
 *
 * Usage:
 *   <ErrorBoundary fallback="Something went wrong">
 *     <YourComponent />
 *   </ErrorBoundary>
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    // In production, send to error tracking (Sentry, etc.)
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return typeof this.props.fallback === 'string'
          ? <div className="p-4 text-sm text-red-600">{this.props.fallback}</div>
          : this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
              <FiAlertCircle size={32} className="text-red-500" />
            </div>
            <h1 className="font-display text-2xl font-bold text-gray-900 mb-2">Something went wrong</h1>
            <p className="text-gray-500 text-sm mb-6 leading-relaxed">
              An unexpected error occurred. Our team has been notified.
              Please try refreshing the page.
            </p>

            {/* Show error details in development */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-left">
                <p className="text-xs font-mono text-red-700 break-all">
                  {this.state.error.toString()}
                </p>
              </div>
            )}

            <div className="flex gap-3 justify-center">
              <button onClick={this.handleReset} className="btn-primary">
                <FiRefreshCw size={15} /> Try Again
              </button>
              <Link to="/dashboard" className="btn-secondary">
                <FiHome size={15} /> Go Home
              </Link>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
