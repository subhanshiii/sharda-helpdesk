import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import API from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { FullPageSpinner, EmptyState, PageHeader } from '../components/ui';
import TicketCard from '../components/TicketCard';
import { CATEGORIES, PRIORITIES, STATUSES } from '../utils/helpers';
import { FiPlusCircle, FiSearch, FiFilter, FiX } from 'react-icons/fi';

const FilterSelect = ({ label, value, onChange, options, placeholder }) => (
  <div className="relative">
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="input pr-8 appearance-none text-sm"
    >
      <option value="">{placeholder || `All ${label}`}</option>
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  </div>
);

export default function TicketList() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1, currentPage: 1 });
  const [filters, setFilters] = useState({ status: '', category: '', priority: '', search: '' });
  const [showFilters, setShowFilters] = useState(false);
  const [searchInput, setSearchInput] = useState('');

  const fetchTickets = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 12 });
      if (filters.status)   params.append('status', filters.status);
      if (filters.category) params.append('category', filters.category);
      if (filters.priority) params.append('priority', filters.priority);
      if (filters.search)   params.append('search', filters.search);
      const res = await API.get(`/tickets?${params}`);
      setTickets(res.data.data);
      setPagination({ total: res.data.total, totalPages: res.data.totalPages, currentPage: res.data.currentPage });
    } catch {
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchTickets(1); }, [fetchTickets]);

  const handleSearch = (e) => {
    e.preventDefault();
    setFilters((f) => ({ ...f, search: searchInput }));
  };

  const clearFilter = (key) => setFilters((f) => ({ ...f, [key]: '' }));
  const clearAll = () => { setFilters({ status: '', category: '', priority: '', search: '' }); setSearchInput(''); };

  const activeFilters = Object.entries(filters).filter(([, v]) => v);
  const hasFilters = activeFilters.length > 0;

  return (
    <div>
      <PageHeader
        title="Support Tickets"
        subtitle={`${pagination.total} ticket${pagination.total !== 1 ? 's' : ''} total`}
        action={
          <Link to="/tickets/new" className="btn-primary">
            <FiPlusCircle size={15} /> New Ticket
          </Link>
        }
      />

      {/* Search + Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <form onSubmit={handleSearch} className="flex-1 relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="input pl-9 pr-4"
            placeholder="Search by title, ID, or description..."
          />
        </form>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`btn-secondary gap-2 ${hasFilters ? 'border-primary-300 text-primary-600' : ''}`}
        >
          <FiFilter size={15} />
          Filters
          {hasFilters && (
            <span className="w-5 h-5 rounded-full bg-primary-600 text-white text-xs flex items-center justify-center">
              {activeFilters.length}
            </span>
          )}
        </button>
      </div>

      {/* Filter dropdowns */}
      {showFilters && (
        <div className="card p-4 mb-4 animate-fade-in">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
            <FilterSelect label="Status"   value={filters.status}   onChange={(v) => setFilters(f => ({...f, status: v}))}   options={STATUSES}    placeholder="All Statuses" />
            <FilterSelect label="Category" value={filters.category} onChange={(v) => setFilters(f => ({...f, category: v}))} options={CATEGORIES}  placeholder="All Categories" />
            <FilterSelect label="Priority" value={filters.priority} onChange={(v) => setFilters(f => ({...f, priority: v}))} options={PRIORITIES}  placeholder="All Priorities" />
          </div>
          {hasFilters && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
              {activeFilters.map(([key, val]) => (
                <span key={key} className="inline-flex items-center gap-1 px-2 py-1 bg-primary-50 text-primary-700 rounded-md text-xs font-medium">
                  {val}
                  <button onClick={() => clearFilter(key)} className="hover:text-primary-900">
                    <FiX size={11} />
                  </button>
                </span>
              ))}
              <button onClick={clearAll} className="text-xs text-gray-500 hover:text-red-500 ml-1">
                Clear all
              </button>
            </div>
          )}
        </div>
      )}

      {/* Ticket grid */}
      {loading ? (
        <FullPageSpinner />
      ) : tickets.length === 0 ? (
        <EmptyState
          icon="🎫"
          title={hasFilters ? 'No tickets match your filters' : 'No tickets yet'}
          description={hasFilters ? 'Try adjusting your filters' : "Create your first support ticket and we'll get back to you soon."}
          action={
            !hasFilters ? (
              <Link to="/tickets/new" className="btn-primary">
                <FiPlusCircle size={15} /> Create Ticket
              </Link>
            ) : (
              <button onClick={clearAll} className="btn-secondary">Clear Filters</button>
            )
          }
        />
      ) : (
        <>
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {tickets.map((t) => <TicketCard key={t._id} ticket={t} />)}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-6">
              <button
                onClick={() => fetchTickets(pagination.currentPage - 1)}
                disabled={pagination.currentPage === 1}
                className="btn-secondary"
              >
                Previous
              </button>
              <span className="text-sm text-gray-500">
                Page {pagination.currentPage} of {pagination.totalPages}
              </span>
              <button
                onClick={() => fetchTickets(pagination.currentPage + 1)}
                disabled={pagination.currentPage === pagination.totalPages}
                className="btn-secondary"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
