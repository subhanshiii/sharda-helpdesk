import React from 'react';

/**
 * Skeleton Loaders
 *
 * Show these WHILE data is loading instead of a spinner.
 * Users perceive the app as faster because content structure
 * is visible immediately — even before data arrives.
 *
 * This is the same pattern used by LinkedIn, YouTube, Facebook.
 */

// ── Base shimmer animation ─────────────────────────────
const Shimmer = ({ className = '' }) => (
  <div
    className={`bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 rounded-lg animate-pulse ${className}`}
    style={{ backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite linear' }}
  />
);

// ── Stat card skeleton ─────────────────────────────────
export const StatCardSkeleton = () => (
  <div className="card p-5">
    <div className="flex items-start justify-between">
      <div className="space-y-2 flex-1">
        <Shimmer className="h-3 w-20" />
        <Shimmer className="h-8 w-16" />
        <Shimmer className="h-2 w-24" />
      </div>
      <Shimmer className="w-12 h-12 rounded-2xl flex-shrink-0" />
    </div>
    <div className="mt-4">
      <Shimmer className="h-1 w-full rounded-full" />
    </div>
  </div>
);

// ── Ticket card skeleton ───────────────────────────────
export const TicketCardSkeleton = () => (
  <div className="card p-5 border-l-4 border-l-gray-100">
    <div className="flex items-start justify-between gap-3 mb-3">
      <div className="flex-1 space-y-2">
        <div className="flex gap-2">
          <Shimmer className="h-5 w-20 rounded-full" />
          <Shimmer className="h-5 w-16 rounded-full" />
        </div>
        <Shimmer className="h-4 w-3/4" />
      </div>
      <Shimmer className="h-5 w-14 rounded-full flex-shrink-0" />
    </div>
    <Shimmer className="h-3 w-full mb-2" />
    <Shimmer className="h-3 w-2/3 mb-4" />
    <div className="flex gap-2 mb-3">
      <Shimmer className="h-5 w-24 rounded-full" />
      <Shimmer className="h-5 w-16 rounded-full" />
    </div>
    <div className="flex justify-between pt-3 border-t border-gray-50">
      <Shimmer className="h-3 w-24" />
      <Shimmer className="h-3 w-20" />
    </div>
  </div>
);

// ── Dashboard skeleton ─────────────────────────────────
export const DashboardSkeleton = () => (
  <div className="space-y-5">
    {/* Welcome banner */}
    <Shimmer className="h-36 w-full rounded-2xl" />
    {/* Quick links */}
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="card p-3.5 flex flex-col items-center gap-2">
          <Shimmer className="w-8 h-8 rounded-xl" />
          <Shimmer className="h-3 w-14" />
        </div>
      ))}
    </div>
    {/* Stat cards */}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => <StatCardSkeleton key={i} />)}
    </div>
    {/* Widget grid */}
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="card overflow-hidden">
          <div className="px-4 py-3.5 border-b border-gray-50 flex justify-between">
            <Shimmer className="h-4 w-32" />
            <Shimmer className="h-4 w-16" />
          </div>
          <div className="p-4 space-y-3">
            {[...Array(4)].map((_, j) => (
              <div key={j} className="flex gap-3 items-center">
                <Shimmer className="w-9 h-9 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Shimmer className="h-3 w-3/4" />
                  <Shimmer className="h-2.5 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
);

// ── Ticket list skeleton ───────────────────────────────
export const TicketListSkeleton = () => (
  <div>
    <div className="flex justify-between mb-6">
      <div className="space-y-2">
        <Shimmer className="h-7 w-40" />
        <Shimmer className="h-4 w-24" />
      </div>
      <Shimmer className="h-10 w-32 rounded-xl" />
    </div>
    <div className="flex gap-3 mb-4">
      <Shimmer className="h-10 flex-1 rounded-xl" />
      <Shimmer className="h-10 w-28 rounded-xl" />
    </div>
    <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {[...Array(6)].map((_, i) => <TicketCardSkeleton key={i} />)}
    </div>
  </div>
);

// ── Ticket detail skeleton ─────────────────────────────
export const TicketDetailSkeleton = () => (
  <div className="max-w-4xl mx-auto space-y-4">
    <div className="flex items-center gap-3">
      <Shimmer className="w-10 h-10 rounded-xl" />
      <div className="flex-1 space-y-2">
        <div className="flex gap-2">
          <Shimmer className="h-5 w-24 rounded-full" />
          <Shimmer className="h-5 w-20 rounded-full" />
        </div>
        <Shimmer className="h-6 w-2/3" />
      </div>
    </div>
    <div className="grid lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        <div className="card p-5 space-y-3">
          <div className="flex gap-3">
            <Shimmer className="w-10 h-10 rounded-xl" />
            <div className="space-y-1.5">
              <Shimmer className="h-4 w-32" />
              <Shimmer className="h-3 w-24" />
            </div>
          </div>
          <Shimmer className="h-3 w-full" />
          <Shimmer className="h-3 w-4/5" />
          <Shimmer className="h-3 w-3/5" />
        </div>
        <Shimmer className="h-32 w-full rounded-2xl" />
      </div>
      <div className="card p-4 space-y-3">
        <Shimmer className="h-4 w-32" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex justify-between">
            <Shimmer className="h-3 w-20" />
            <Shimmer className="h-5 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ── Generic table skeleton ─────────────────────────────
export const TableSkeleton = ({ rows = 5 }) => (
  <div className="card overflow-hidden">
    <div className="bg-gray-50 border-b border-gray-100 px-4 py-3 flex gap-4">
      {[...Array(5)].map((_, i) => <Shimmer key={i} className={`h-3 ${i === 0 ? 'w-32' : 'w-20'}`} />)}
    </div>
    <div className="divide-y divide-gray-50">
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="px-4 py-4 flex items-center gap-4">
          <div className="flex items-center gap-3 flex-1">
            <Shimmer className="w-9 h-9 rounded-xl" />
            <div className="space-y-1.5">
              <Shimmer className="h-3 w-32" />
              <Shimmer className="h-2.5 w-24" />
            </div>
          </div>
          <Shimmer className="h-5 w-16 rounded-full" />
          <Shimmer className="h-3 w-20" />
          <Shimmer className="h-5 w-14 rounded-full" />
          <Shimmer className="h-3 w-24" />
          <div className="flex gap-2">
            <Shimmer className="w-7 h-7 rounded-lg" />
            <Shimmer className="w-7 h-7 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

// ── Announcement skeleton ──────────────────────────────
export const AnnouncementSkeleton = () => (
  <div className="space-y-3">
    {[...Array(3)].map((_, i) => (
      <div key={i} className="card p-5">
        <div className="flex items-start gap-3">
          <Shimmer className="w-9 h-9 rounded-xl flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="flex gap-2 items-center">
              <Shimmer className="h-4 w-48" />
              <Shimmer className="h-5 w-16 rounded-full" />
            </div>
            <Shimmer className="h-3 w-full" />
            <Shimmer className="h-3 w-3/4" />
            <Shimmer className="h-3 w-1/3" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

// ── Opportunities grid skeleton ────────────────────────
export const OpportunitiesSkeleton = () => (
  <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
    {[...Array(6)].map((_, i) => (
      <div key={i} className="card overflow-hidden">
        <Shimmer className="h-1.5 w-full rounded-none" />
        <div className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Shimmer className="w-10 h-10 rounded-xl" />
              <div className="space-y-1.5">
                <Shimmer className="h-4 w-20 rounded-full" />
                <Shimmer className="h-3 w-16" />
              </div>
            </div>
            <Shimmer className="w-8 h-8 rounded-xl" />
          </div>
          <Shimmer className="h-4 w-5/6" />
          <Shimmer className="h-3 w-full" />
          <Shimmer className="h-3 w-4/5" />
          <div className="space-y-1.5">
            <Shimmer className="h-3 w-24" />
            <Shimmer className="h-3 w-32" />
          </div>
          <div className="flex gap-1.5">
            {[...Array(3)].map((_, j) => <Shimmer key={j} className="h-5 w-16 rounded-full" />)}
          </div>
          <div className="flex justify-between pt-3 border-t border-gray-50">
            <Shimmer className="h-5 w-20 rounded-full" />
            <Shimmer className="h-8 w-20 rounded-xl" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

export default Shimmer;
