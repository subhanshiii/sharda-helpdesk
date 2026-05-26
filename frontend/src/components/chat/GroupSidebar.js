import React, { memo } from 'react';
import { FiHash, FiUsers, FiSearch, FiPlus, FiWifi } from 'react-icons/fi';
import { formatRelative } from '../../utils/helpers';

const DEPT_COLORS = {
  CSE: 'from-blue-500 to-cyan-500',
  ECE: 'from-violet-500 to-purple-500',
  MBA: 'from-emerald-500 to-teal-500',
  MECH:'from-orange-500 to-amber-500',
  CIVIL:'from-pink-500 to-rose-500',
  DEFAULT:'from-gray-500 to-slate-500',
};

const GroupAvatar = memo(({ group }) => {
  const color = DEPT_COLORS[group.department] || DEPT_COLORS.DEFAULT;
  const initials = group.name.slice(0, 2).toUpperCase();
  return (
    <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-sm`}>
      {initials}
    </div>
  );
});

const GroupItem = memo(({ group, isActive, onClick }) => (
  <button
    onClick={() => onClick(group)}
    className={`w-full flex items-center gap-3 rounded-[22px] px-3.5 py-3 text-left transition-all duration-150 ${
      isActive
        ? 'theme-surface-accent shadow-lg'
        : 'theme-surface-soft hover:shadow-sm'
    }`}
  >
    <GroupAvatar group={group} />
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between">
        <p className={`truncate text-sm font-semibold ${isActive ? 'theme-text-strong' : 'theme-text-strong'}`}>
          {group.name}
        </p>
        {group.lastMessage?.createdAt && (
          <span className={`ml-2 flex-shrink-0 text-xs ${isActive ? 'theme-text-main' : 'theme-text-muted'}`}>
            {formatRelative(group.lastMessage.createdAt)}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between mt-0.5">
        <p className={`truncate text-xs ${isActive ? 'theme-text-main' : 'theme-text-muted'}`}>
          {group.lastMessage
            ? group.lastMessage.isDeleted
              ? 'Message deleted'
              : group.lastMessage.type === 'image'
              ? '📷 Image'
              : group.lastMessage.type === 'document'
              ? '📄 Document'
              : group.lastMessage.type === 'system'
              ? group.lastMessage.systemMessage
              : group.lastMessage.content
            : `${group.members?.length || 0} members`}
        </p>
        {group.unreadCount > 0 && !isActive && (
          <span className="ml-2 flex h-5 min-w-[20px] flex-shrink-0 items-center justify-center rounded-full bg-[var(--accent-primary)] px-1.5 text-xs font-bold text-white">
            {group.unreadCount > 99 ? '99+' : group.unreadCount}
          </span>
        )}
      </div>
    </div>
  </button>
));

export default function GroupSidebar({
  groups, activeGroup, onGroupSelect, onCreateGroup,
  canCreateGroup, searchQuery, onSearchChange, isOnline,
}) {
  const filtered = groups.filter(g =>
    g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    g.department?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="theme-surface flex h-full flex-col border-r border-[color:var(--border-soft)]">
      {/* Header */}
      <div className="theme-surface-soft border-b border-[color:var(--border-soft)] px-4 pb-4 pt-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-2">
            <div className="theme-icon-surface flex h-10 w-10 items-center justify-center rounded-2xl shadow-sm">
              <FiHash size={18} className="theme-text-main" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-lg font-bold theme-text-strong">Groups</h2>
              <p className="text-xs theme-text-muted">Team channels and shared discussions</p>
            </div>
          </div>

          <div className="flex flex-shrink-0 items-center gap-3">
            <div className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${isOnline ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
              <FiWifi size={10} />
              {isOnline ? 'Live' : 'Offline'}
            </div>
            {canCreateGroup && (
              <button
                onClick={onCreateGroup}
                className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,var(--button-primary-start),var(--button-primary-mid),var(--button-primary-end))] text-[var(--button-primary-text)] shadow-sm transition hover:-translate-y-0.5"
                aria-label="Create group"
              >
                <FiPlus size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <FiSearch className="theme-text-muted absolute left-3 top-1/2 -translate-y-1/2" size={14} />
          <input
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            className="theme-input w-full rounded-2xl py-2.5 pl-9 pr-3 text-sm outline-none transition-all"
            placeholder="Search groups..."
          />
        </div>
      </div>

      {/* Group list */}
      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {filtered.length === 0 ? (
          <div className="theme-surface-soft flex flex-col items-center justify-center rounded-[28px] px-4 py-12 text-center">
            <FiUsers size={32} className="theme-text-muted mb-3" />
            <p className="theme-text-muted text-sm">
              {searchQuery ? 'No groups match your search' : 'No groups yet'}
            </p>
            {canCreateGroup && !searchQuery && (
              <button onClick={onCreateGroup}
                className="theme-text-main mt-3 text-xs font-medium hover:underline">
                + Create first group
              </button>
            )}
          </div>
        ) : (
          filtered.map(group => (
            <GroupItem
              key={group._id}
              group={group}
              isActive={activeGroup?._id === group._id}
              onClick={onGroupSelect}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div className="theme-surface-soft border-t border-[color:var(--border-soft)] px-4 py-3">
        <p className="theme-text-muted text-center text-xs">
          {groups.length} group{groups.length !== 1 ? 's' : ''} · Real-time
        </p>
      </div>
    </div>
  );
}
