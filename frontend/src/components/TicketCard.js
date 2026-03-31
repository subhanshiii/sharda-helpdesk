import React, { memo } from 'react';
import { Link } from 'react-router-dom';
import { StatusBadge, PriorityBadge, CategoryBadge } from './ui';
import { formatRelative } from '../utils/helpers';
import { FiMessageSquare, FiClock, FiArrowRight } from 'react-icons/fi';

const priorityAccent = {
  'Critical': 'border-l-red-500',
  'High':     'border-l-orange-400',
  'Medium':   'border-l-blue-500',
  'Low':      'border-l-green-500',
};

/**
 * Memoized ticket card
 * React.memo prevents re-render unless ticket data actually changes
 * Without memo: all cards re-render when any filter/sort changes
 * With memo: only the changed ticket re-renders
 */
const TicketCard = memo(function TicketCard({ ticket }) {
  return (
    <Link to={`/tickets/${ticket._id}`}
      className={`card block p-5 border-l-4 hover:shadow-card-hover hover:-translate-y-1 transition-all duration-200 group ${priorityAccent[ticket.priority] || 'border-l-gray-200'}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-mono font-semibold text-gray-400 bg-gray-50 px-2 py-0.5 rounded-lg">{ticket.ticketId}</span>
            <StatusBadge status={ticket.status} />
          </div>
          <h3 className="font-display font-bold text-gray-900 text-sm truncate group-hover:text-blue-700 transition-colors">{ticket.title}</h3>
        </div>
        <FiArrowRight size={16} className="text-gray-300 group-hover:text-blue-500 flex-shrink-0 mt-1 transition-colors" />
      </div>
      <p className="text-xs text-gray-500 mb-3 line-clamp-2 leading-relaxed">{ticket.description}</p>
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        <CategoryBadge category={ticket.category} />
        <PriorityBadge priority={ticket.priority} />
      </div>
      <div className="flex items-center justify-between text-xs text-gray-400 pt-3 border-t border-gray-50">
        <span className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-xs font-bold">
            {(ticket.user?.name || 'U')[0]}
          </div>
          {ticket.user?.name || 'Unknown'}
        </span>
        <div className="flex items-center gap-3">
          {ticket.replies?.length > 0 && (
            <span className="flex items-center gap-1"><FiMessageSquare size={11}/>{ticket.replies.length}</span>
          )}
          <span className="flex items-center gap-1"><FiClock size={11}/>{formatRelative(ticket.createdAt)}</span>
        </div>
      </div>
    </Link>
  );
});

export default TicketCard;
