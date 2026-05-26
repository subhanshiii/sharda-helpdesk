import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import API from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../context/PermissionContext';
import { useSocket } from '../hooks/useSocket';
import GroupSidebar from '../components/chat/GroupSidebar';
import ChatWindow from '../components/chat/ChatWindow';
import CreateGroupModal from '../components/chat/CreateGroupModal';
import GroupInfoModal from '../components/chat/GroupInfoModal';
import { isAdminUser } from '../utils/access';
import { FiMessageSquare, FiUsers, FiMenu } from 'react-icons/fi';

export default function GroupChatPage() {
  const { user }                = useAuth();
  const { hasPermission }       = usePermissions();
  const socket                  = useSocket();
  const [searchParams, setSearchParams] = useSearchParams();
  const [groups, setGroups]     = useState([]);
  const [activeGroup, setActiveGroup] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [showCreate, setShowCreate]   = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSidebar, setShowSidebar] = useState(true); // Mobile toggle
  const [isOnline, setIsOnline] = useState(false);
  const [showGroupInfo, setShowGroupInfo] = useState(false);

  const isAdmin = isAdminUser(user);
  const canCreateGroup = hasPermission('canManageGroups');
  const activeGroupRole = activeGroup?.myRole || activeGroup?.members?.find(
    (member) => member.user?._id === user?._id
  )?.role;
  const canManageGroup = isAdmin || activeGroupRole === 'admin';
  const requestedGroupId = searchParams.get('groupId');

  // ── Fetch user's groups ────────────────────────────────
  const fetchGroups = useCallback(async () => {
    try {
      const endpoint = isAdmin ? '/chat-groups' : '/chat-groups/my';
      const res = await API.get(endpoint);
      const data = res.data.data || [];
      setGroups(data);
      setActiveGroup((current) => {
        if (current) {
          return data.find((group) => group._id === current._id) || current;
        }
        return data[0] || null;
      });
    } catch (err) {
      console.error('Failed to fetch groups:', err);
    } finally { setLoading(false); }
  }, [isAdmin]);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  useEffect(() => {
    if (!requestedGroupId || groups.length === 0) return;

    const matchedGroup = groups.find((group) => group._id === requestedGroupId);
    if (!matchedGroup) return;

    setActiveGroup((prev) => (prev?._id === matchedGroup._id ? prev : matchedGroup));
    setGroups((prev) => prev.map((group) => (
      group._id === matchedGroup._id ? { ...group, unreadCount: 0 } : group
    )));

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('groupId');
    setSearchParams(nextParams, { replace: true });
  }, [groups, requestedGroupId, searchParams, setSearchParams]);

  // ── Socket: listen for new groups + group updates ─────
  useEffect(() => {
    if (!socket) return;
    setIsOnline(socket.connected);

    const onConnect    = () => setIsOnline(true);
    const onDisconnect = () => setIsOnline(false);

    const onGroupCreated = ({ group }) => {
      setGroups(prev => {
        const exists = prev.some(g => g._id === group._id);
        return exists ? prev : [group, ...prev];
      });
    };

    const onGroupAdded   = ({ groupId }) => fetchGroups(); // Re-fetch when added to new group
    const onGroupRemoved = ({ groupId }) => {
      setGroups(prev => prev.filter(g => g._id !== groupId));
      if (activeGroup?._id === groupId) setActiveGroup(null);
    };
    const onGroupDeleted = ({ groupId }) => {
      setGroups(prev => prev.filter(g => g._id !== groupId));
      if (activeGroup?._id === groupId) setActiveGroup(null);
    };
    const onGroupUpdated = ({ group }) => {
      setGroups(prev => prev.map(g => g._id === group._id ? group : g));
      if (activeGroup?._id === group._id) setActiveGroup(group);
    };

    // Update last message preview in sidebar
    const onNewMessage = (message) => {
      setGroups(prev => prev.map(g =>
        g._id === message.group || g._id === message.group?._id
          ? { ...g, lastMessage: message, updatedAt: message.createdAt }
          : g
      ).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)));

      // Increment unread count if not currently viewing this group
      if (activeGroup?._id !== (message.group || message.group?._id)) {
        setGroups(prev => prev.map(g =>
          g._id === message.group || g._id === message.group?._id
            ? { ...g, unreadCount: (g.unreadCount || 0) + 1 }
            : g
        ));
      }
    };

    socket.on('connect',        onConnect);
    socket.on('disconnect',     onDisconnect);
    socket.on('group:created',  onGroupCreated);
    socket.on('group:added',    onGroupAdded);
    socket.on('group:removed',  onGroupRemoved);
    socket.on('group:deleted',  onGroupDeleted);
    socket.on('group:updated',  onGroupUpdated);
    socket.on('chat:message',   onNewMessage);

    return () => {
      socket.off('connect',       onConnect);
      socket.off('disconnect',    onDisconnect);
      socket.off('group:created', onGroupCreated);
      socket.off('group:added',   onGroupAdded);
      socket.off('group:removed', onGroupRemoved);
      socket.off('group:deleted', onGroupDeleted);
      socket.off('group:updated', onGroupUpdated);
      socket.off('chat:message',  onNewMessage);
    };
  }, [socket, activeGroup, fetchGroups]);

  const handleGroupSelect = useCallback((group) => {
    setActiveGroup(group);
    // Reset unread count when opening group
    setGroups(prev => prev.map(g => g._id === group._id ? { ...g, unreadCount: 0 } : g));
    setShowSidebar(false); // On mobile, hide sidebar when group selected
  }, []);

  const handleGroupCreated = useCallback((newGroup) => {
    setGroups(prev => { // FIXED: dedupe local insert against the socket-created event so one action never renders two groups.
      const existingIndex = prev.findIndex((group) => group._id === newGroup._id);
      if (existingIndex !== -1) {
        const next = [...prev];
        next[existingIndex] = { ...next[existingIndex], ...newGroup };
        return next;
      }
      return [newGroup, ...prev];
    });
    setActiveGroup(newGroup);
    setShowSidebar(false);
  }, []);

  const handleGroupInfo = useCallback(() => {
    setShowGroupInfo(true);
  }, []);

  const handleGroupUpdated = useCallback((updatedGroup) => {
    setGroups(prev => prev.map(g => g._id === updatedGroup._id ? updatedGroup : g));
    if (activeGroup?._id === updatedGroup._id) {
      setActiveGroup(updatedGroup);
    }
    setShowGroupInfo(false);
  }, [activeGroup]);

  const handleGroupDeleted = useCallback((groupId) => {
    setGroups(prev => prev.filter(g => g._id !== groupId));
    if (activeGroup?._id === groupId) {
      setActiveGroup(null);
    }
  }, [activeGroup]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          <p className="theme-text-muted text-sm">Loading groups...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="theme-surface flex h-full overflow-hidden rounded-[30px] border border-[color:var(--border-soft)] shadow-[var(--shadow-card)]" style={{ height: 'calc(100vh - 8rem)' }}>

      {showCreate && (
        <CreateGroupModal
          onClose={() => setShowCreate(false)}
          onCreated={handleGroupCreated}
        />
      )}

      {showGroupInfo && activeGroup && (
        <GroupInfoModal
          group={activeGroup}
          isOpen={showGroupInfo}
          onClose={() => setShowGroupInfo(false)}
          canManageGroup={canManageGroup}
          isSystemAdmin={isAdmin}
          currentUserId={user?._id}
          onGroupUpdated={handleGroupUpdated}
          onGroupDeleted={handleGroupDeleted}
        />
      )}

      {/* ── Sidebar ── */}
      <div className={`${showSidebar ? 'flex' : 'hidden'} md:flex w-72 flex-shrink-0 flex-col xl:w-80`}>
        <GroupSidebar
          groups={groups}
          activeGroup={activeGroup}
          onGroupSelect={handleGroupSelect}
          onCreateGroup={() => setShowCreate(true)}
          canCreateGroup={canCreateGroup}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          isOnline={isOnline}
        />
      </div>

      {/* ── Chat area ── */}
      <div className={`${!showSidebar ? 'flex' : 'hidden'} md:flex flex-col flex-1 min-w-0`}>
        {activeGroup ? (
          <>
            {/* Mobile: back button */}
            <div className="theme-surface-soft md:hidden flex items-center gap-2 border-b border-[color:var(--border-soft)] px-4 py-3">
              <button onClick={() => setShowSidebar(true)}
                className="theme-ghost-button rounded-xl p-1.5 theme-text-muted">
                <FiMenu size={20} />
              </button>
              <span className="theme-text-strong text-sm font-medium">{activeGroup.name}</span>
            </div>
            <ChatWindow
              group={activeGroup}
              onGroupInfoClick={handleGroupInfo}
            />
          </>
        ) : (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-500 to-cyan-500 text-3xl text-white shadow-lg">
              💬
            </div>
            <h2 className="theme-text-strong mb-2 font-display text-2xl font-bold">Group Chat</h2>
            <p className="theme-text-muted mb-6 max-w-xs text-sm leading-relaxed">
              Select a group from the sidebar to start chatting with your department or class.
            </p>
            {groups.length === 0 && (
              <div className="space-y-3">
                <div className="theme-surface-soft theme-text-main flex items-center gap-2 rounded-xl px-4 py-3 text-sm">
                  <FiUsers size={16} />
                  {isAdmin
                    ? 'No groups yet. Create the first group!'
                    : 'You have not been added to any groups yet. Contact your admin.'}
                </div>
                {canCreateGroup && (
                  <button onClick={() => setShowCreate(true)} className="btn-primary">
                    + Create First Group
                  </button>
                )}
              </div>
            )}
            {/* Mobile: show sidebar button */}
            <button onClick={() => setShowSidebar(true)}
              className="md:hidden mt-4 btn-secondary">
              <FiMessageSquare size={15} /> View Groups
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
