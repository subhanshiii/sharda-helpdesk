import React, { useState, useEffect, useCallback } from 'react';
import API from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../hooks/useSocket';
import GroupSidebar from '../components/chat/GroupSidebar';
import ChatWindow from '../components/chat/ChatWindow';
import CreateGroupModal from '../components/chat/CreateGroupModal';
import { FiMessageSquare, FiUsers, FiMenu, FiX } from 'react-icons/fi';

export default function GroupChatPage() {
  const { user }                = useAuth();
  const socket                  = useSocket();
  const [groups, setGroups]     = useState([]);
  const [activeGroup, setActiveGroup] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [showCreate, setShowCreate]   = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSidebar, setShowSidebar] = useState(true); // Mobile toggle
  const [isOnline, setIsOnline] = useState(false);

  const isAdmin = user?.role === 'admin';

  // ── Fetch user's groups ────────────────────────────────
  const fetchGroups = useCallback(async () => {
    try {
      const endpoint = isAdmin ? '/chat-groups' : '/chat-groups/my';
      const res = await API.get(endpoint);
      const data = res.data.data || [];
      setGroups(data);
      // Auto-select first group if none selected
      if (!activeGroup && data.length > 0) setActiveGroup(data[0]);
    } catch (err) {
      console.error('Failed to fetch groups:', err);
    } finally { setLoading(false); }
  }, [isAdmin, activeGroup]);

  useEffect(() => { fetchGroups(); }, []);

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
    socket.on('chat:message',   onNewMessage);

    return () => {
      socket.off('connect',       onConnect);
      socket.off('disconnect',    onDisconnect);
      socket.off('group:created', onGroupCreated);
      socket.off('group:added',   onGroupAdded);
      socket.off('group:removed', onGroupRemoved);
      socket.off('group:deleted', onGroupDeleted);
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
    setGroups(prev => [newGroup, ...prev]);
    setActiveGroup(newGroup);
    setShowSidebar(false);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Loading groups...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full rounded-2xl overflow-hidden border border-gray-100 shadow-sm bg-white" style={{ height: 'calc(100vh - 8rem)' }}>

      {showCreate && (
        <CreateGroupModal
          onClose={() => setShowCreate(false)}
          onCreated={handleGroupCreated}
        />
      )}

      {/* ── Sidebar ── */}
      <div className={`${showSidebar ? 'flex' : 'hidden'} md:flex flex-col w-72 flex-shrink-0`}>
        <GroupSidebar
          groups={groups}
          activeGroup={activeGroup}
          onGroupSelect={handleGroupSelect}
          onCreateGroup={() => setShowCreate(true)}
          isAdmin={isAdmin}
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
            <div className="md:hidden flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-100">
              <button onClick={() => setShowSidebar(true)}
                className="p-1.5 text-gray-500 hover:text-blue-600 rounded-lg">
                <FiMenu size={20} />
              </button>
              <span className="text-sm font-medium text-gray-700">{activeGroup.name}</span>
            </div>
            <ChatWindow
              group={activeGroup}
              onGroupInfoClick={() => {/* TODO: Group info panel */}}
            />
          </>
        ) : (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-3xl mb-5 shadow-lg">
              💬
            </div>
            <h2 className="font-display text-2xl font-bold text-gray-900 mb-2">Group Chat</h2>
            <p className="text-gray-500 text-sm max-w-xs leading-relaxed mb-6">
              Select a group from the sidebar to start chatting with your department or class.
            </p>
            {groups.length === 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 px-4 py-3 bg-blue-50 rounded-xl text-sm text-blue-700">
                  <FiUsers size={16} />
                  {isAdmin
                    ? 'No groups yet. Create the first group!'
                    : 'You have not been added to any groups yet. Contact your admin.'}
                </div>
                {isAdmin && (
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
