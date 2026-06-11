import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FiChevronRight, FiHome } from 'react-icons/fi';

const formatSegment = (segment) => {
  if (!segment) return '';
  if (segment === 'academics') return 'Academic Planning';
  if (segment === 'performance') return 'Student Performance';
  if (segment === 'users') return 'User Management';
  if (segment === 'approvals') return 'Identity Alerts';
  
  return segment
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const Breadcrumbs = () => {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter((x) => x);

  if (pathnames.length === 0 || (pathnames.length === 1 && pathnames[0] === 'dashboard')) {
    return null;
  }

  // Filter out Mongo ObjectIDs or long hashes
  const validPathSegments = pathnames.map((value, index) => {
    const to = `/${pathnames.slice(0, index + 1).join('/')}`;
    const isId = value.length >= 20 || /^\d+$/.test(value);
    return { value, to, isId };
  }).filter(segment => !segment.isId);

  return (
    <nav className="flex items-center text-xs font-medium mb-5" aria-label="Breadcrumb" style={{ color: 'var(--text-muted)' }}>
      <Link to="/dashboard" className="hover:text-blue-600 transition flex items-center gap-1.5 opacity-80 hover:opacity-100">
        <FiHome size={13} />
        Home
      </Link>
      
      {validPathSegments.map((segment, index) => {
        const isLast = index === validPathSegments.length - 1;

        return (
          <React.Fragment key={segment.to}>
            <FiChevronRight size={13} className="mx-2 opacity-40" />
            {isLast ? (
              <span className="font-semibold opacity-100" style={{ color: 'var(--text-main)' }}>
                {formatSegment(segment.value)}
              </span>
            ) : (
              <Link to={segment.to} className="hover:text-blue-600 transition opacity-80 hover:opacity-100">
                {formatSegment(segment.value)}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};

export default Breadcrumbs;
