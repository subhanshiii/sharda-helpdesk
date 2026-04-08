import React, { useEffect, useState } from 'react';
import API from '../../utils/api';
import toast from 'react-hot-toast';
import { useTheme } from '../../context/ThemeContext';
import { FiX, FiEdit3, FiTrash2, FiUsers, FiSave, FiSearch, FiUserPlus } from 'react-icons/fi';
import { getRoleLabel } from '../../utils/helpers';

const ROLE_OPTIONS = [
  { value: 'student', label: 'Student' },
  { value: 'faculty', label: 'Faculty' },
  { value: 'staff', label: 'Staff' },
  { value: 'admin', label: 'Group Admin' },
];

export default function GroupInfoModal({ group, isOpen, onClose, canManageGroup, isSystemAdmin, currentUserId, onGroupUpdated, onGroupDeleted }) {
  const { isDark } = useTheme();
  const canManageMembers = canManageGroup || isSystemAdmin;
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({ name: group?.name || '', department: group?.department || '', year: group?.year || '', section: group?.section || '', description: group?.description || '' });
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedRole, setSelectedRole] = useState('student');
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    setForm({
      name: group?.name || '',
      department: group?.department || '',
      year: group?.year || '',
      section: group?.section || '',
      description: group?.description || '',
    });
    setIsEditing(false);
    setSearchQuery('');
    setSearchResults([]);
    setSelectedRole('student');
  }, [group]);

  if (!isOpen || !group) return null;

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Group name is required');
      return;
    }

    setLoading(true);
    try {
      const res = await API.put(`/chat-groups/${group._id}`, {
        name: form.name.trim(),
        department: form.department.trim(),
        year: form.year.trim(),
        section: form.section.trim(),
        description: form.description.trim(),
      });
      toast.success('Group updated successfully');
      onGroupUpdated(res.data.data);
      setIsEditing(false);
    } catch (err) {
      toast.error('Failed to update group');
    } finally {
      setLoading(false);
    }
  };

  const refreshGroup = async () => {
    const res = await API.get(`/chat-groups/${group._id}`);
    onGroupUpdated(res.data.data);
    return res.data.data;
  };

  const handleSearch = async (value) => {
    setSearchQuery(value);
    if (value.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const res = await API.get(`/chat-groups/users/search?q=${encodeURIComponent(value)}`);
      const currentMemberIds = new Set(group.members?.map((member) => member.user._id));
      setSearchResults((res.data.data || []).filter((user) => !currentMemberIds.has(user._id)));
    } catch {
      toast.error('Failed to search users');
    } finally {
      setSearching(false);
    }
  };

  const handleAddMember = async (userId) => {
    setLoading(true);
    try {
      await API.post(`/chat-groups/${group._id}/members`, {
        userIds: [userId],
        roles: [selectedRole],
      });
      await refreshGroup();
      setSearchQuery('');
      setSearchResults([]);
      toast.success('Member added successfully');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add member');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId, role) => {
    setLoading(true);
    try {
      const res = await API.put(`/chat-groups/${group._id}/members/${userId}`, { role });
      onGroupUpdated(res.data.data);
      toast.success('Member role updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update member role');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!window.confirm('Remove this member from the group?')) return;

    setLoading(true);
    try {
      await API.delete(`/chat-groups/${group._id}/members/${userId}`);
      if (userId === currentUserId) {
        onGroupDeleted(group._id);
        onClose();
      } else {
        await refreshGroup();
      }
      toast.success('Member removed successfully');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove member');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete "${group.name}"? This action cannot be undone.`)) return;

    setLoading(true);
    try {
      await API.delete(`/chat-groups/${group._id}`);
      toast.success('Group deleted successfully');
      onGroupDeleted(group._id);
      onClose();
    } catch (err) {
      toast.error('Failed to delete group');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`rounded-2xl max-w-md w-full shadow-xl ${
        isDark ? 'bg-slate-950 border border-slate-800' : 'bg-white'
      }`}>
        {/* Header */}
        <div className={`flex items-center justify-between p-6 ${
          isDark ? 'border-b border-slate-800' : 'border-b border-gray-100'
        }`}>
          <h2 className={`text-xl font-bold ${isDark ? 'text-slate-100' : 'text-gray-900'}`}>Group Info</h2>
          <button onClick={onClose} className={`p-2 rounded-xl transition-colors ${isDark ? 'hover:bg-slate-900' : 'hover:bg-gray-100'}`}>
            <FiX size={20} className={isDark ? 'text-slate-400' : 'text-gray-400'} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Group Avatar & Name */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-xl font-bold shadow-sm">
              {group.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1">
              {isEditing ? (
                <input
                  value={form.name}
                  onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                  placeholder="Group name"
                />
              ) : (
                <h3 className={`text-lg font-bold ${isDark ? 'text-slate-100' : 'text-gray-900'}`}>{group.name}</h3>
              )}
              <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                {group.members?.length || 0} members
                {group.department && ` · ${group.department}`}
                {group.year && ` Year ${group.year}`}
                {group.section && ` · Section ${group.section}`}
              </p>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>Group Structure</label>
            {isEditing ? (
              <div className="grid grid-cols-3 gap-3 mb-4">
                <input
                  value={form.department}
                  onChange={(e) => setForm(prev => ({ ...prev, department: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                  placeholder="Department"
                />
                <input
                  value={form.year}
                  onChange={(e) => setForm(prev => ({ ...prev, year: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                  placeholder="Year"
                />
                <input
                  value={form.section}
                  onChange={(e) => setForm(prev => ({ ...prev, section: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                  placeholder="Section"
                />
              </div>
            ) : null}
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>Description</label>
            {isEditing ? (
              <textarea
                value={form.description}
                onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 resize-none"
                rows={3}
                placeholder="Group description (optional)"
              />
            ) : (
              <p className={`text-sm rounded-xl p-3 min-h-[60px] ${
                isDark ? 'text-slate-300 bg-slate-900' : 'text-gray-600 bg-gray-50'
              }`}>
                {group.description || 'No description'}
              </p>
            )}
          </div>

          {/* Members */}
          <div>
            <h4 className={`text-sm font-medium mb-3 flex items-center gap-2 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
              <FiUsers size={16} />
              Members ({group.members?.length || 0})
            </h4>
            {canManageMembers && (
              <div className="mb-4 space-y-3">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                    <input
                      value={searchQuery}
                      onChange={(e) => handleSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                      placeholder="Search users to add"
                    />
                  </div>
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                  >
                    {ROLE_OPTIONS.map((role) => (
                      <option key={role.value} value={role.value}>{role.label}</option>
                    ))}
                  </select>
                </div>
                {searching && <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-400'}`}>Searching users...</p>}
                {searchResults.length > 0 && (
                  <div className={`space-y-2 max-h-36 overflow-y-auto rounded-xl p-2 ${
                    isDark ? 'border border-slate-800 bg-slate-900/70' : 'border border-gray-100'
                  }`}>
                    {searchResults.map((user) => (
                      <div key={user._id} className={`flex items-center gap-3 px-2 py-2 rounded-xl ${isDark ? 'hover:bg-slate-800' : 'hover:bg-blue-50'}`}>
                        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
                          {user.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${isDark ? 'text-slate-100' : 'text-gray-900'}`}>{user.name}</p>
                          <p className={`text-xs truncate ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>{user.email} · {getRoleLabel(user.role)}</p>
                        </div>
                        <button
                          onClick={() => handleAddMember(user._id)}
                          disabled={loading}
                          className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 flex items-center gap-1"
                        >
                          <FiUserPlus size={12} />
                          Add
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {group.members?.map((member) => (
                <div key={member.user._id} className={`flex items-center gap-3 p-2 rounded-xl ${isDark ? 'bg-slate-900' : 'bg-gray-50'}`}>
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center text-white text-xs font-bold">
                    {member.user.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${isDark ? 'text-slate-100' : 'text-gray-900'}`}>{member.user.name}</p>
                    <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>{ROLE_OPTIONS.find((role) => role.value === member.role)?.label || getRoleLabel(member.role)}</p>
                  </div>
                  {canManageMembers ? (
                    <>
                      <select
                        value={member.role}
                        onChange={(e) => handleRoleChange(member.user._id, e.target.value)}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
                        disabled={loading}
                      >
                        {ROLE_OPTIONS.map((role) => (
                          <option key={role.value} value={role.value}>{role.label}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleRemoveMember(member.user._id)}
                        disabled={loading}
                        className="p-2 text-gray-400 hover:text-red-500 rounded-lg transition-colors disabled:opacity-60"
                        title="Remove member"
                      >
                        <FiTrash2 size={14} />
                      </button>
                    </>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        {(canManageMembers || isSystemAdmin) && (
          <div className={`flex items-center justify-between p-6 rounded-b-2xl ${
            isDark ? 'border-t border-slate-800 bg-slate-900' : 'border-t border-gray-100 bg-gray-50'
          }`}>
            {canManageMembers && isEditing ? (
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setForm({
                      name: group.name,
                      department: group.department || '',
                      year: group.year || '',
                      section: group.section || '',
                      description: group.description || '',
                    });
                  }}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-xl transition-colors"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-2"
                  disabled={loading}
                >
                  <FiSave size={14} />
                  {loading ? 'Saving...' : 'Save'}
                </button>
              </div>
            ) : canManageMembers ? (
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-xl transition-colors flex items-center gap-2"
              >
                <FiEdit3 size={14} />
                Edit Group
              </button>
            ) : <div />}

            {isSystemAdmin && (
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-xl transition-colors flex items-center gap-2"
                disabled={loading}
              >
                <FiTrash2 size={14} />
                Delete Group
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
