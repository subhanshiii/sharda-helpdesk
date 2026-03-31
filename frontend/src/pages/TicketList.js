import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { Link } from 'react-router-dom';
import API from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { EmptyState } from '../components/ui';
import { TicketListSkeleton, TicketCardSkeleton } from '../components/skeletons/SkeletonComponents';
import TicketCard from '../components/TicketCard';
import { CATEGORIES, PRIORITIES, STATUSES } from '../utils/helpers';
import { FiPlusCircle, FiSearch, FiFilter, FiX } from 'react-icons/fi';

/**
 * Memoized filter select — only re-renders when its own value changes
 * Without memo, ALL selects re-render when ANY filter changes
 */
const FilterSelect = memo(({ value, onChange, options, placeholder }) => (
  <select value={value} onChange={e => onChange(e.target.value)} className="input text-sm">
    <option value="">{placeholder}</option>
    {options.map(o => <option key={o} value={o}>{o}</option>)}
  </select>
));

/**
 * Memoized ticket card — only re-renders when ticket data changes
 * Without memo, all cards re-render when filters change
 */
const MemoTicketCard = memo(TicketCard);

export default function TicketList() {
  const { user } = useAuth();
  const [tickets,     setTickets]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pagination,  setPagination]  = useState({ total: 0, totalPages: 1, currentPage: 1 });
  const [filters,     setFilters]     = useState({ status: '', category: '', priority: '', search: '' });
  const [searchInput, setSearchInput] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Memoize the query string — only recompute when filters change
  const queryString = useMemo(() => {
    const params = new URLSearchParams({ limit: 12 });
    if (filters.status)   params.append('status',   filters.status);
    if (filters.category) params.append('category', filters.category);
    if (filters.priority) params.append('priority', filters.priority);
    if (filters.search)   params.append('search',   filters.search);
    return params.toString();
  }, [filters]);

  const fetchTickets = useCallback(async (page = 1, append = false) => {
    if (append) setLoadingMore(true);
    else        setLoading(true);

    try {
      const res = await API.get(`/tickets?${queryString}&page=${page}`);
      setTickets(prev => append ? [...prev, ...res.data.data] : res.data.data);
      setPagination({
        total:       res.data.total,
        totalPages:  res.data.totalPages,
        currentPage: res.data.currentPage,
      });
    } catch {
      setTickets([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [queryString]);

  useEffect(() => { fetchTickets(1); }, [fetchTickets]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters(f => ({ ...f, search: searchInput }));
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const updateFilter = useCallback((key, value) => {
    setFilters(f => ({ ...f, [key]: value }));
  }, []);

  const clearAll = useCallback(() => {
    setFilters({ status: '', category: '', priority: '', search: '' });
    setSearchInput('');
  }, []);

  // Memoize active filter count to avoid recalculating on every render
  const activeFilterCount = useMemo(
    () => Object.values(filters).filter(Boolean).length,
    [filters]
  );

  const hasFilters = activeFilterCount > 0;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900">Support Tickets</h1>
          <p className="text-sm text-gray-500 mt-0.5">{pagination.total} ticket{pagination.total !== 1 ? 's' : ''} total</p>
        </div>
        <Link to="/tickets/new" className="btn-primary flex-shrink-0">
          <FiPlusCircle size={15} /> New Ticket
        </Link>
      </div>

      {/* Search + filter bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex-1 relative">
          <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className="input pl-10"
            placeholder="Search by title, ID, or description..."
          />
          {searchInput && (
            <button onClick={() => setSearchInput('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <FiX size={14} />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`btn-secondary gap-2 ${hasFilters ? 'border-blue-300 text-blue-600' : ''}`}>
          <FiFilter size={15} />
          Filters
          {activeFilterCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Filter dropdowns */}
      {showFilters && (
        <div className="card p-4 mb-4 animate-fade-in">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
            <FilterSelect value={filters.status}   onChange={v => updateFilter('status', v)}   options={STATUSES}   placeholder="All Statuses" />
            <FilterSelect value={filters.category} onChange={v => updateFilter('category', v)} options={CATEGORIES} placeholder="All Categories" />
            <FilterSelect value={filters.priority} onChange={v => updateFilter('priority', v)} options={PRIORITIES} placeholder="All Priorities" />
          </div>
          {hasFilters && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
              {Object.entries(filters).filter(([, v]) => v).map(([key, val]) => (
                <span key={key} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium">
                  {val}
                  <button onClick={() => updateFilter(key, '')} className="hover:text-blue-900"><FiX size={11} /></button>
                </span>
              ))}
              <button onClick={clearAll} className="text-xs text-gray-500 hover:text-red-500">Clear all</button>
            </div>
          )}
        </div>
      )}

      {/* Ticket grid */}
      {loading ? (
        <TicketListSkeleton />
      ) : tickets.length === 0 ? (
        <EmptyState
          icon="🎫"
          title={hasFilters ? 'No tickets match your filters' : 'No tickets yet'}
          description={hasFilters ? 'Try adjusting your filters' : 'Create your first support ticket to get started.'}
          action={
            !hasFilters
              ? <Link to="/tickets/new" className="btn-primary"><FiPlusCircle size={15} /> Create Ticket</Link>
              : <button onClick={clearAll} className="btn-secondary">Clear Filters</button>
          }
        />
      ) : (
        <>
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {tickets.map(t => <MemoTicketCard key={t._id} ticket={t} />)}
            {/* Show skeleton cards while loading more */}
            {loadingMore && [...Array(3)].map((_, i) => <TicketCardSkeleton key={`sk-${i}`} />)}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex justify-center items-center gap-3 mt-6">
              <button
                onClick={() => fetchTickets(pagination.currentPage - 1)}
                disabled={pagination.currentPage === 1}
                className="btn-secondary">
                Previous
              </button>
              <span className="text-sm text-gray-500">
                Page {pagination.currentPage} of {pagination.totalPages}
              </span>
              <button
                onClick={() => fetchTickets(pagination.currentPage + 1)}
                disabled={pagination.currentPage === pagination.totalPages}
                className="btn-secondary">
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
