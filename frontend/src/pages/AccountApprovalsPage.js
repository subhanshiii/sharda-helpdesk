import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiAlertCircle, FiClock, FiRefreshCw, FiShield, FiUserCheck, FiUserX } from 'react-icons/fi';
import API from '../utils/api';
import { Alert, Avatar, EmptyState, FullPageSpinner, PageHeader } from '../components/ui';
import { formatDate, getRoleColor, getRoleLabel } from '../utils/helpers';
import { useTheme } from '../context/ThemeContext';

const ROLE_FILTERS = [
  { value: '', label: 'All Roles' },
  { value: 'student', label: 'Students' },
  { value: 'faculty', label: 'Faculty' },
  { value: 'staff', label: 'Staff' },
  { value: 'admin', label: 'Admins' },
];

const PAGE_SIZE = 8;

const SummaryCard = ({ icon: Icon, label, value, tone, active, onClick, isDark }) => (
  <button
    type="button"
    onClick={onClick}
    className={`identity-alert-summary-card card p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover ${tone} ${active ? (isDark ? 'ring-2 ring-blue-400 shadow-card-hover' : 'ring-2 ring-blue-300 shadow-card-hover') : ''}`}
  >
    <div className="flex items-center justify-between">
      <div>
        <p className={`identity-alert-summary-label text-xs font-semibold uppercase tracking-[0.16em] ${isDark ? 'text-slate-300' : 'text-gray-500'}`}>{label}</p>
        <p className={`identity-alert-summary-value mt-2 font-display text-2xl font-bold ${isDark ? 'text-slate-50' : 'text-gray-900'}`}>{value}</p>
      </div>
      <div className={`identity-alert-summary-icon rounded-xl p-3 shadow-sm ${isDark ? 'bg-slate-800/95' : 'bg-white/85'}`}>
        <Icon size={16} className={isDark ? 'text-slate-200' : 'text-gray-600'} />
      </div>
    </div>
  </button>
);

const UserRow = ({ item, meta, onClick, isDark }) => (
  <button
    type="button"
    onClick={() => onClick(item.systemId)}
    className={`w-full rounded-xl border px-4 py-3 text-left transition ${isDark ? 'border-slate-800 bg-slate-900 hover:border-slate-700 hover:bg-slate-800/90' : 'border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50'}`}
  >
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar user={item} size="sm" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className={`font-medium ${isDark ? 'text-slate-100' : 'text-gray-900'}`}>{item.name}</p>
            <span className={`badge ${getRoleColor(item.role)}`}>{getRoleLabel(item.role)}</span>
          </div>
          <p className={`mt-1 truncate text-sm ${isDark ? 'text-slate-300' : 'text-gray-500'}`}>{item.email}</p>
          <p className={`mt-1 text-xs font-mono ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>{item.systemId}</p>
        </div>
      </div>
      <div className={`text-right text-xs ${isDark ? 'text-slate-400' : 'text-gray-400'}`}>{meta}</div>
    </div>
  </button>
);

const AlertSection = ({ title, subtitle, items, emptyText, metaRenderer, onUserClick, compact = false, isDark = false }) => {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [items, title]);

  const totalPages = Math.max(Math.ceil(items.length / PAGE_SIZE), 1);
  const currentItems = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-3">
      {!compact ? (
        <div>
          <h2 className={`font-display text-lg font-bold ${isDark ? 'text-slate-100' : 'text-gray-900'}`}>{title}</h2>
          <p className={`mt-1 text-sm ${isDark ? 'text-slate-300' : 'text-gray-500'}`}>{subtitle}</p>
        </div>
      ) : null}
      {items.length === 0 ? (
        <div className={`rounded-xl border border-dashed px-4 py-4 text-sm ${isDark ? 'border-slate-700 text-slate-400' : 'border-gray-200 text-gray-400'}`}>{emptyText}</div>
      ) : (
        <>
          {currentItems.map((item) => (
            <UserRow
              key={`${title}-${item.systemId}`}
              item={item}
              meta={metaRenderer(item)}
              onClick={onUserClick}
              isDark={isDark}
            />
          ))}
          {totalPages > 1 ? (
            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(current - 1, 1))}
                disabled={page === 1}
                className="btn-secondary text-xs"
              >
                Previous
              </button>
              <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(current + 1, totalPages))}
                disabled={page === totalPages}
                className="btn-secondary text-xs"
              >
                Next Page
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
};

export default function AccountApprovalsPage() {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [alerts, setAlerts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeView, setActiveView] = useState('pending-verification');
  const [roleFilter, setRoleFilter] = useState('');

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (roleFilter) params.set('role', roleFilter);
      const res = await API.get(`/users/identity-alerts${params.toString() ? `?${params.toString()}` : ''}`);
      setAlerts(res.data?.data || null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load identity alerts');
    } finally {
      setLoading(false);
    }
  }, [roleFilter]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const combinedBlockedUsers = useMemo(() => {
    const registry = new Map();
    [...(alerts?.inactiveUsers || []), ...(alerts?.blockedUsers || [])].forEach((item) => {
      if (item?.systemId && !registry.has(item.systemId)) {
        registry.set(item.systemId, item);
      }
    });
    return Array.from(registry.values());
  }, [alerts]);

  const sections = useMemo(() => {
    if (!alerts) return [];
    return [
      {
        key: 'all',
        label: 'All Signals',
        count:
          (alerts.unverifiedUsers || []).length +
          (alerts.recentLogins || []).length +
          (alerts.expiringUsers || []).length +
          combinedBlockedUsers.length +
          (alerts.missingAcademicMapping || []).length,
        title: 'Identity Alerts Overview',
        subtitle: roleFilter
          ? `Monitoring verification, access, and lifecycle signals for ${ROLE_FILTERS.find((entry) => entry.value === roleFilter)?.label || 'the selected role'}.`
          : 'Monitoring verification, access, and lifecycle signals across the full identity directory.',
        tone: 'bg-white border border-gray-200',
        groups: [
          {
            title: 'Pending Verification',
            subtitle: 'Provisioned users who still need to verify their email.',
            items: alerts.unverifiedUsers || [],
            emptyText: 'All provisioned accounts are verified.',
            metaRenderer: (item) => `Created ${formatDate(item.createdAt)}`,
          },
          {
            title: 'Recent Logins',
            subtitle: 'Latest approved identities that signed in successfully.',
            items: alerts.recentLogins || [],
            emptyText: 'No recent sign-in activity yet.',
            metaRenderer: (item) => `Last login ${formatDate(item.lastLogin)}`,
          },
          {
            title: 'Expiring Soon',
            subtitle: 'Accounts that expire within the next 14 days.',
            items: alerts.expiringUsers || [],
            emptyText: 'No accounts are nearing expiry.',
            metaRenderer: (item) => `Expires ${formatDate(item.expiryDate)}`,
          },
          {
            title: 'Inactive or Blocked',
            subtitle: 'Inactive, rejected, or suspended identities.',
            items: combinedBlockedUsers,
            emptyText: 'No inactive or blocked accounts.',
            metaRenderer: (item) => `${item.status || 'inactive'} · Updated ${formatDate(item.updatedAt)}`,
          },
          {
            title: 'Student Mapping Issues',
            subtitle: 'Students missing section mapping that can break academic visibility.',
            items: alerts.missingAcademicMapping || [],
            emptyText: 'All students have valid academic mapping.',
            metaRenderer: (item) => [item.department, item.year && `Year ${item.year}`, item.section || 'No section'].filter(Boolean).join(' · '),
          },
        ],
      },
      {
        key: 'pending-verification',
        label: 'Pending Verification',
        count: alerts.summary?.unverifiedCount || 0,
        title: 'Pending Verification',
        subtitle: 'Users who still need to verify their email before their access record is complete.',
        tone: 'bg-amber-50/70 border border-amber-100',
        groups: [{
          title: 'Pending Verification',
          subtitle: 'Provisioned users who still need to verify their email.',
          items: alerts.unverifiedUsers || [],
          emptyText: 'All provisioned accounts are verified.',
          metaRenderer: (item) => `Created ${formatDate(item.createdAt)}`,
        }],
      },
      {
        key: 'recent-logins',
        label: 'Recent Logins',
        count: alerts.summary?.recentLoginCount || 0,
        title: 'Recent Logins',
        subtitle: 'Latest approved identities that signed in successfully.',
        tone: 'bg-emerald-50/70 border border-emerald-100',
        groups: [{
          title: 'Recent Logins',
          subtitle: 'Latest approved identities that signed in successfully.',
          items: alerts.recentLogins || [],
          emptyText: 'No recent sign-in activity yet.',
          metaRenderer: (item) => `Last login ${formatDate(item.lastLogin)}`,
        }],
      },
      {
        key: 'inactive',
        label: 'Inactive Accounts',
        count: alerts.summary?.inactiveCount || 0,
        title: 'Inactive Accounts',
        subtitle: 'Accounts marked inactive or otherwise removed from operational access.',
        tone: 'bg-red-50/70 border border-red-100',
        groups: [{
          title: 'Inactive Accounts',
          subtitle: 'Inactive, rejected, or suspended identities.',
          items: combinedBlockedUsers,
          emptyText: 'No inactive or blocked accounts.',
          metaRenderer: (item) => `${item.status || 'inactive'} · Updated ${formatDate(item.updatedAt)}`,
        }],
      },
      {
        key: 'expiring',
        label: 'Expiring Soon',
        count: alerts.summary?.expiringSoonCount || 0,
        title: 'Expiring Soon',
        subtitle: 'Accounts that need access renewal attention soon.',
        tone: 'bg-orange-50/70 border border-orange-100',
        groups: [{
          title: 'Expiring Soon',
          subtitle: 'Accounts that expire within the next 14 days.',
          items: alerts.expiringUsers || [],
          emptyText: 'No accounts are nearing expiry.',
          metaRenderer: (item) => `Expires ${formatDate(item.expiryDate)}`,
        }],
      },
      {
        key: 'blocked',
        label: 'Blocked Accounts',
        count: alerts.summary?.blockedCount || 0,
        title: 'Blocked Accounts',
        subtitle: 'Rejected and suspended identities that need admin attention.',
        tone: 'bg-slate-50 border border-slate-200',
        groups: [{
          title: 'Blocked Accounts',
          subtitle: 'Rejected and suspended identities.',
          items: (alerts.blockedUsers || []),
          emptyText: 'No blocked accounts.',
          metaRenderer: (item) => `${item.status || 'blocked'} · Updated ${formatDate(item.updatedAt)}`,
        }],
      },
      {
        key: 'mapping',
        label: 'Mapping Issues',
        count: alerts.summary?.mappingIssuesCount || 0,
        title: 'Student Mapping Issues',
        subtitle: 'Students missing section or academic mapping that can break downstream visibility.',
        tone: 'bg-blue-50/70 border border-blue-100',
        groups: [{
          title: 'Student Mapping Issues',
          subtitle: 'Students missing section mapping that can break academic visibility.',
          items: alerts.missingAcademicMapping || [],
          emptyText: 'All students have valid academic mapping.',
          metaRenderer: (item) => [item.department, item.year && `Year ${item.year}`, item.section || 'No section'].filter(Boolean).join(' · '),
        }],
      },
    ];
  }, [alerts, combinedBlockedUsers, roleFilter]);

  const activeSection = sections.find((section) => section.key === activeView) || sections[0];

  if (loading) return <FullPageSpinner />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Identity Alerts"
        description="Review verification, access, and lifecycle signals from one operational identity monitor."
        action={(
          <div className="flex flex-wrap items-center gap-3">
            <select className="input min-w-[170px]" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
              {ROLE_FILTERS.map((role) => (
                <option key={role.value || 'all'} value={role.value}>{role.label}</option>
              ))}
            </select>
            <button onClick={loadAlerts} className="btn-secondary">
              <FiRefreshCw size={15} />
              Refresh
            </button>
          </div>
        )}
      />

      {error ? <Alert type="error" message={error} /> : null}

      {!alerts ? (
        <EmptyState icon="🛡️" title="No identity data available" description="Refresh to load the latest user access signals." />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <SummaryCard icon={FiClock} label="Pending Verification" value={alerts.summary?.unverifiedCount || 0} tone={isDark ? 'border border-amber-900/60 bg-amber-950/60' : 'bg-amber-50/60 border border-amber-100'} active={activeView === 'pending-verification'} onClick={() => setActiveView('pending-verification')} isDark={isDark} />
            <SummaryCard icon={FiUserCheck} label="Recent Logins" value={alerts.summary?.recentLoginCount || 0} tone={isDark ? 'border border-emerald-900/60 bg-emerald-950/60' : 'bg-emerald-50/60 border border-emerald-100'} active={activeView === 'recent-logins'} onClick={() => setActiveView('recent-logins')} isDark={isDark} />
            <SummaryCard icon={FiUserX} label="Inactive Accounts" value={alerts.summary?.inactiveCount || 0} tone={isDark ? 'border border-red-900/60 bg-red-950/60' : 'bg-red-50/60 border border-red-100'} active={activeView === 'inactive'} onClick={() => setActiveView('inactive')} isDark={isDark} />
            <SummaryCard icon={FiAlertCircle} label="Expiring Soon" value={alerts.summary?.expiringSoonCount || 0} tone={isDark ? 'border border-orange-900/60 bg-orange-950/60' : 'bg-orange-50/60 border border-orange-100'} active={activeView === 'expiring'} onClick={() => setActiveView('expiring')} isDark={isDark} />
            <SummaryCard icon={FiShield} label="Blocked Accounts" value={alerts.summary?.blockedCount || 0} tone={isDark ? 'border border-slate-700 bg-slate-900/70' : 'bg-slate-50 border border-slate-100'} active={activeView === 'blocked'} onClick={() => setActiveView('blocked')} isDark={isDark} />
            <SummaryCard icon={FiUserCheck} label="Mapping Issues" value={alerts.summary?.mappingIssuesCount || 0} tone={isDark ? 'border border-blue-900/60 bg-blue-950/60' : 'bg-blue-50/60 border border-blue-100'} active={activeView === 'mapping'} onClick={() => setActiveView('mapping')} isDark={isDark} />
          </div>

          <section className={`card p-5 ${isDark ? 'border-slate-800 bg-slate-950' : (activeSection?.tone || 'border border-gray-200 bg-white')}`}>
            <div className={`flex flex-col gap-3 pb-4 sm:flex-row sm:items-end sm:justify-between ${isDark ? 'border-b border-slate-800' : 'border-b border-gray-100'}`}>
              <div>
                <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${isDark ? 'text-slate-400' : 'text-gray-400'}`}>Identity Monitor</p>
                <h2 className={`mt-2 font-display text-2xl font-bold ${isDark ? 'text-slate-50' : 'text-gray-900'}`}>{activeSection?.title || 'Identity Alerts Overview'}</h2>
                <p className={`mt-1 text-sm ${isDark ? 'text-slate-300' : 'text-gray-500'}`}>{activeSection?.subtitle}</p>
              </div>
              <button type="button" onClick={() => setActiveView('all')} className={`btn-secondary ${activeView === 'all' ? 'border-blue-300 text-blue-700' : ''}`}>
                Show Overview
              </button>
            </div>

            <div className="mt-5 space-y-6">
              {(activeSection?.groups || []).map((group) => (
                <AlertSection
                  key={group.title}
                  title={group.title}
                  subtitle={group.subtitle}
                  items={group.items}
                  emptyText={group.emptyText}
                  metaRenderer={group.metaRenderer}
                  onUserClick={(userId) => navigate(`/admin/users/${userId}`)}
                  compact={(activeSection?.groups || []).length === 1}
                  isDark={isDark}
                />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
