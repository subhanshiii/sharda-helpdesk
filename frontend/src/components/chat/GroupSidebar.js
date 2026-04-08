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
    className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all duration-150 ${
      isActive
        ? 'bg-blue-600 shadow-lg'
        : 'hover:bg-gray-50'
    }`}
  >
    <GroupAvatar group={group} />
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between">
        <p className={`text-sm font-semibold truncate ${isActive ? 'text-white' : 'text-gray-900'}`}>
          {group.name}
        </p>
        {group.lastMessage?.createdAt && (
          <span className={`text-xs flex-shrink-0 ml-2 ${isActive ? 'text-blue-200' : 'text-gray-400'}`}>
            {formatRelative(group.lastMessage.createdAt)}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between mt-0.5">
        <p className={`text-xs truncate ${isActive ? 'text-blue-200' : 'text-gray-500'}`}>
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
          <span className="ml-2 min-w-[20px] h-5 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center px-1.5 flex-shrink-0">
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
    <div className="flex flex-col h-full bg-white border-r border-gray-100">
      {/* Header */}
      <div className="px-4 pt-5 pb-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FiHash size={20} className="text-blue-600" />
            <h2 className="font-display font-bold text-gray-900 text-lg">Groups</h2>
            <div className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${isOnline ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
              <FiWifi size={10} />
              {isOnline ? 'Live' : 'Offline'}
            </div>
          </div>
          {canCreateGroup && (
            <button onClick={onCreateGroup}
              className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 transition-colors shadow-sm">
              <FiPlus size={16} />
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
          <input
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
            placeholder="Search groups..."
          />
        </div>
      </div>

      {/* Group list */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <FiUsers size={32} className="text-gray-300 mb-3" />
            <p className="text-sm text-gray-500">
              {searchQuery ? 'No groups match your search' : 'No groups yet'}
            </p>
            {canCreateGroup && !searchQuery && (
              <button onClick={onCreateGroup}
                className="mt-3 text-xs text-blue-600 hover:underline font-medium">
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
      <div className="px-4 py-3 border-t border-gray-100">
        <p className="text-xs text-gray-400 text-center">
          {groups.length} group{groups.length !== 1 ? 's' : ''} · Real-time
        </p>
      </div>
    </div>
  );
}
