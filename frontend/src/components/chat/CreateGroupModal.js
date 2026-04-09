import React, { useState, useCallback } from 'react';
import API from '../../utils/api';
import toast from 'react-hot-toast';
import { FiX, FiPlus, FiSearch, FiTrash2, FiUsers } from 'react-icons/fi';
import { getRoleLabel } from '../../utils/helpers';

const DEPARTMENTS = ['CSE','ECE','EEE','MECH','CIVIL','MBA','MCA','BBA','BTECH','Other'];
const YEARS       = ['1','2','3','4','5'];
const SECTIONS    = ['A','B','C','D','E'];
const ROLE_OPTIONS = [
  { value: 'student', label: 'Student' },
  { value: 'faculty', label: 'Faculty' },
  { value: 'staff', label: 'Staff' },
  { value: 'admin', label: 'Group Admin' },
];

const UserSearchResult = ({ user, onAdd }) => (
  <button onClick={() => onAdd(user)}
    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-blue-50 transition-colors text-left">
    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
      {user.name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold text-gray-800 truncate">{user.name}</p>
      <p className="text-xs text-gray-500 truncate">{user.email} · {getRoleLabel(user.role)}</p>
    </div>
    <FiPlus size={15} className="text-blue-500 flex-shrink-0" />
  </button>
);

export default function CreateGroupModal({ onClose, onCreated }) {
  const [step,         setStep]         = useState(1); // 1=details, 2=members
  const [form,         setForm]         = useState({ name:'', department:'', year:'', section:'', description:'' });
  const [nameTouched, setNameTouched] = useState(false);
  const [searchQuery,  setSearchQuery]  = useState('');
  const [searchResults,setSearchResults]= useState([]);
  const [selectedUsers,setSelectedUsers]= useState([]);
  const [userRoles,    setUserRoles]    = useState({}); // {userId: role}
  const [searching,    setSearching]    = useState(false);
  const [creating,     setCreating]     = useState(false);
  const [error,        setError]        = useState('');

  // Auto-generate group name from department+year+section
  const handleFormChange = useCallback((key, value) => {
    setForm(prev => {
      const updated = { ...prev, [key]: value };
      if (!nameTouched && ['department','year','section'].includes(key)) {
        const parts = [updated.department, updated.year && `Year ${updated.year}`, updated.section && `Sec ${updated.section}`].filter(Boolean);
        updated.name = parts.join(' - ');
      }
      return updated;
    });
  }, [nameTouched]);

  // Search users to add
  const handleSearch = useCallback(async (q) => {
    setSearchQuery(q);
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await API.get(`/chat-groups/users/search?q=${encodeURIComponent(q)}`);
      const filtered = res.data.data.filter(u => !selectedUsers.some(s => s._id === u._id));
      setSearchResults(filtered);
    } catch {}
    finally { setSearching(false); }
  }, [selectedUsers]);

  const addUser = useCallback((user) => {
    setSelectedUsers(prev => [...prev, user]);
    setUserRoles(prev => ({
      ...prev,
      [user._id]: user.role === 'admin'
        ? 'admin'
        : user.role === 'faculty'
        ? 'faculty'
        : user.role === 'staff' || user.role === 'agent'
        ? 'staff'
        : 'student',
    }));
    setSearchResults(prev => prev.filter(u => u._id !== user._id));
    setSearchQuery('');
  }, []);

  const handleNameChange = useCallback((value) => {
    setNameTouched(true);
    setForm(prev => ({ ...prev, name: value }));
  }, []);

  const removeUser = useCallback((userId) => {
    setSelectedUsers(prev => prev.filter(u => u._id !== userId));
    setUserRoles(prev => { const n = {...prev}; delete n[userId]; return n; });
  }, []);

  const handleCreate = useCallback(async () => {
    if (!form.name.trim()) { setError('Group name is required'); return; }
    setCreating(true);
    setError('');
    try {
      // Step 1: Create group
      const res = await API.post('/chat-groups', {
        name:        form.name.trim(),
        department:  form.department,
        year:        form.year,
        section:     form.section,
        description: form.description,
      });

      const groupId = res.data.data._id;

      // Step 2: Add members if any selected
      if (selectedUsers.length > 0) {
        await API.post(`/chat-groups/${groupId}/members`, {
          userIds: selectedUsers.map(u => u._id),
          roles:   selectedUsers.map(u => userRoles[u._id] || 'student'),
        });
      }

      // Fetch the full group
      const fullGroup = await API.get(`/chat-groups/${groupId}`);
      toast.success(`Group "${form.name}" created!`);
      onCreated(fullGroup.data.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create group');
    } finally { setCreating(false); }
  }, [form, selectedUsers, userRoles, onCreated, onClose]);

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col animate-fade-in-up">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="font-display font-bold text-gray-900">Create New Group</h2>
            <p className="text-xs text-gray-500 mt-0.5">Step {step} of 2 — {step === 1 ? 'Group Details' : 'Add Members'}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
            <FiX size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              {error}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              {/* Department + Year + Section grid */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Department</label>
                  <input
                    list="department-options"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                    value={form.department}
                    onChange={e => handleFormChange('department', e.target.value)}
                    placeholder="Select or type department"
                  />
                  <datalist id="department-options">
                    {DEPARTMENTS.map(d => <option key={d} value={d} />)}
                  </datalist>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Year</label>
                  <input
                    list="year-options"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                    value={form.year}
                    onChange={e => handleFormChange('year', e.target.value)}
                    placeholder="Select or type year"
                  />
                  <datalist id="year-options">
                    {YEARS.map(y => <option key={y} value={y} />)}
                  </datalist>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Section</label>
                  <input
                    list="section-options"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                    value={form.section}
                    onChange={e => handleFormChange('section', e.target.value)}
                    placeholder="Select or type section"
                  />
                  <datalist id="section-options">
                    {SECTIONS.map(s => <option key={s} value={s} />)}
                  </datalist>
                </div>
              </div>
              <p className="text-xs text-gray-400">You can choose a suggested value or type a custom one in any field.</p>
              {form.department && form.year && form.section && (
                <div className="px-4 py-3 rounded-xl bg-blue-50 border border-blue-100 text-sm text-blue-700">
                  Approved users matching {form.department} · Year {form.year} · Section {form.section} will be added automatically. You can still add extra members manually in the next step.
                </div>
              )}

              {/* Group name (auto-generated or manual) */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Group Name *</label>
                <input className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                  value={form.name}
                  onChange={e => handleNameChange(e.target.value)}
                  placeholder="e.g. CSE Year 2 - Sec A" />
                <p className="text-xs text-gray-400 mt-1">Auto-filled from your group details until you type a custom name</p>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Description</label>
                <textarea className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none"
                  rows={3} value={form.description}
                  onChange={e => setForm(p => ({...p, description: e.target.value}))}
                  placeholder="What is this group for? (optional)" />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              {/* Search users */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Search & Add Members</label>
                <div className="relative">
                  <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                  <input
                    className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                    value={searchQuery}
                    onChange={e => handleSearch(e.target.value)}
                    placeholder="Search by name, email, or enrollment ID..."
                  />
                </div>
              </div>

              {/* Search results */}
              {searchResults.length > 0 && (
                <div className="border border-gray-100 rounded-xl overflow-hidden divide-y divide-gray-50">
                  {searchResults.slice(0, 6).map(u => <UserSearchResult key={u._id} user={u} onAdd={addUser} />)}
                </div>
              )}
              {searching && <p className="text-xs text-gray-400 text-center py-2">Searching...</p>}

              {/* Selected members list */}
              {selectedUsers.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <FiUsers size={14} className="text-gray-500" />
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      Selected Members ({selectedUsers.length})
                    </p>
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {selectedUsers.map(u => (
                      <div key={u._id} className="flex items-center gap-3 px-3 py-2 bg-blue-50 rounded-xl">
                        <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {u.name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800 truncate">{u.name}</p>
                        </div>
                        {/* Role selector */}
                        <select
                          value={userRoles[u._id] || 'student'}
                          onChange={e => setUserRoles(prev => ({...prev, [u._id]: e.target.value}))}
                          className="text-xs border border-blue-200 rounded-lg px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400">
                          {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                        <button onClick={() => removeUser(u._id)}
                          className="p-1 text-gray-400 hover:text-red-500 rounded-lg transition-colors flex-shrink-0">
                          <FiTrash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedUsers.length === 0 && !searchQuery && (
                <div className="text-center py-6">
                  <FiUsers size={32} className="text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">Search and add members to the group</p>
                  <p className="text-xs text-gray-400 mt-1">You can also add members after creating the group</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer buttons */}
        <div className="flex gap-3 p-5 border-t border-gray-100 flex-shrink-0">
          {step === 1 ? (
            <>
              <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
              <button onClick={() => {
                if (!form.name.trim()) { setError('Group name is required'); return; }
                setError(''); setStep(2);
              }} className="btn-primary flex-1 justify-center">Next: Add Members →</button>
            </>
          ) : (
            <>
              <button onClick={() => setStep(1)} className="btn-secondary flex-1 justify-center">← Back</button>
              <button onClick={handleCreate} disabled={creating}
                className="btn-primary flex-1 justify-center">
                {creating ? 'Creating...' : `Create Group ${selectedUsers.length > 0 ? `(+${selectedUsers.length})` : ''}`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
