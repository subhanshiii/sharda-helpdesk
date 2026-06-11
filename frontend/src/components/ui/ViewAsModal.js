import React, { useState } from 'react';
import { usePermissions } from '../../context/PermissionContext';
import { useAuth } from '../../context/AuthContext';
import { FiX, FiCheck, FiUserCheck } from 'react-icons/fi';

const ViewAsModal = ({ isOpen, onClose }) => {
  const { setPreviewMode } = useAuth();
  const { roleSummaries, adminTierDefinitions } = usePermissions();
  
  const [selectedRole, setSelectedRole] = useState('student');
  const [selectedTier, setSelectedTier] = useState('');

  if (!isOpen) return null;

  const handleStartPreview = () => {
    setPreviewMode({
      role: selectedRole,
      adminTier: selectedTier || null,
    });
    onClose();
  };

  const isRoleAdmin = selectedRole === 'admin';

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-scale-up" style={{ background: 'var(--surface-card)' }}>
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-main)' }}>
          <h3 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--text-main)' }}>
            <FiUserCheck className="text-blue-500" /> View As...
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition">
            <FiX className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-semibold" style={{ color: 'var(--text-main)' }}>Select Role</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(roleSummaries || {}).map(([roleKey, roleDef]) => (
                <button
                  key={roleKey}
                  onClick={() => {
                    setSelectedRole(roleKey);
                    if (roleKey !== 'admin') setSelectedTier('');
                  }}
                  className={`px-4 py-3 rounded-xl border text-sm font-medium text-left transition ${
                    selectedRole === roleKey 
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500' 
                      : 'border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-slate-600'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span>{roleDef.name || roleKey}</span>
                    {selectedRole === roleKey && <FiCheck className="w-4 h-4 text-blue-500" />}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {isRoleAdmin && (
            <div className="space-y-2 animate-fade-in-up">
              <label className="text-sm font-semibold" style={{ color: 'var(--text-main)' }}>Select Admin Tier</label>
              <select
                value={selectedTier}
                onChange={(e) => setSelectedTier(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border bg-transparent text-sm transition focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                style={{ borderColor: 'var(--border-main)', color: 'var(--text-main)' }}
              >
                <option value="">No specific tier</option>
                {adminTierDefinitions?.map(tier => (
                  <option key={tier.id} value={tier.id}>
                    {tier.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3" style={{ borderColor: 'var(--border-main)' }}>
          <button 
            onClick={onClose} 
            className="px-5 py-2.5 rounded-xl font-medium text-sm transition hover:bg-slate-200 dark:hover:bg-slate-700"
            style={{ color: 'var(--text-main)' }}
          >
            Cancel
          </button>
          <button 
            onClick={handleStartPreview}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-sm shadow-lg shadow-blue-500/30 transition flex items-center gap-2"
          >
            <FiUserCheck /> Start Preview
          </button>
        </div>
      </div>
    </div>
  );
};

export default ViewAsModal;
