import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../context/PermissionContext';
import { FiAlertTriangle, FiX } from 'react-icons/fi';

const PreviewBanner = () => {
  const { user, trueUser, previewMode, setPreviewMode } = useAuth();
  const { roleSummaries, adminTierDefinitions } = usePermissions();

  if (!user?.isPreviewing || !previewMode || trueUser?.adminTier !== 'super_admin') return null;

  const roleName = roleSummaries?.[previewMode.role]?.name || previewMode.role;
  const tierName = previewMode.adminTier 
    ? (adminTierDefinitions?.find(t => t.id === previewMode.adminTier)?.name || previewMode.adminTier)
    : null;

  return (
    <div className="bg-yellow-500 text-black px-4 py-2 flex items-center justify-between z-[100] shadow-md relative w-full flex-shrink-0">
      <div className="flex items-center gap-2 font-medium">
        <FiAlertTriangle className="w-5 h-5 flex-shrink-0" />
        <span className="text-sm">
          Viewing As: <strong className="ml-1">{roleName}</strong>
          {tierName && <span> &middot; {tierName}</span>}
        </span>
      </div>
      <button 
        onClick={() => setPreviewMode(null)}
        className="flex items-center gap-1.5 bg-black/10 hover:bg-black/20 transition-colors px-3 py-1.5 rounded-lg text-sm font-bold ml-4 whitespace-nowrap"
      >
        <FiX className="w-4 h-4" />
        Exit Preview
      </button>
    </div>
  );
};

export default PreviewBanner;
