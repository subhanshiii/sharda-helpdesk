import React, { memo } from 'react';
import { FiFile, FiDownload, FiTrash2, FiInfo } from 'react-icons/fi';
import { getAssetUrl } from '../../utils/helpers';

const ROLE_COLORS = {
  admin:   { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Admin'   },
  agent:   { bg: 'bg-indigo-100', text: 'text-indigo-700', label: 'Staff' },
  staff:   { bg: 'bg-indigo-100', text: 'text-indigo-700', label: 'Staff' },
  faculty: { bg: 'bg-blue-100',   text: 'text-blue-700',   label: 'Faculty' },
  teacher: { bg: 'bg-blue-100',   text: 'text-blue-700',   label: 'Teacher' },
  student: { bg: 'bg-green-100',  text: 'text-green-700',  label: 'Student' },
};

const formatTime = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatDate = (date) => {
  if (!date) return '';
  const d    = new Date(date);
  const now  = new Date();
  const diff = now - d;

  if (diff < 24 * 60 * 60 * 1000) return 'Today';
  if (diff < 48 * 60 * 60 * 1000) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

// ── Date separator ─────────────────────────────────────
export const DateSeparator = memo(({ date }) => (
  <div className="flex items-center gap-3 my-4">
    <div className="flex-1 h-px bg-gray-100" />
    <span className="text-xs text-gray-400 font-medium px-3 py-1 bg-gray-50 rounded-full">
      {formatDate(date)}
    </span>
    <div className="flex-1 h-px bg-gray-100" />
  </div>
));

// ── System message ─────────────────────────────────────
export const SystemMessage = memo(({ message }) => (
  <div className="flex justify-center my-2">
    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-full text-xs text-gray-500">
      <FiInfo size={11} />
      {message.systemMessage}
    </div>
  </div>
));

// ── File attachment preview ────────────────────────────
const FileAttachment = memo(({ file, isOwn }) => {
  const isImage = file.mimeType?.startsWith('image/');
  const fileUrl = getAssetUrl(file.url);
  const downloadUrl = `${fileUrl}${fileUrl.includes('?') ? '&' : '?'}download=1`;

  if (isImage) {
    return (
      <div className="mt-2 rounded-xl overflow-hidden max-w-xs space-y-2">
        <img
          src={fileUrl}
          alt={file.originalName}
          loading="lazy"
          className="w-full h-auto max-h-64 object-cover rounded-xl cursor-pointer hover:opacity-95 transition-opacity"
          onClick={() => window.open(fileUrl, '_blank', 'noopener,noreferrer')}
          onError={e => { e.target.style.display = 'none'; }}
        />
        <div className="flex items-center justify-between gap-3 text-xs">
          <p className="opacity-70 truncate">{file.originalName}</p>
          <a href={downloadUrl} download={file.originalName} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1 ${isOwn ? 'text-white/80' : 'text-blue-600'}`}>
            <FiDownload size={12} /> Download
          </a>
        </div>
      </div>
    );
  }

  return (
    <a href={downloadUrl} download={file.originalName} target="_blank" rel="noreferrer"
      className={`flex items-center gap-3 mt-2 p-3 rounded-xl border transition-colors ${
        isOwn
          ? 'bg-white/10 border-white/20 hover:bg-white/20'
          : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
      }`}>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${isOwn ? 'bg-white/20' : 'bg-blue-50'}`}>
        <FiFile size={18} className={isOwn ? 'text-white' : 'text-blue-500'} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-semibold truncate ${isOwn ? 'text-white' : 'text-gray-800'}`}>
          {file.originalName}
        </p>
        <p className={`text-xs ${isOwn ? 'text-white/70' : 'text-gray-500'}`}>
          {file.size ? `${(file.size / 1024).toFixed(1)} KB` : 'Document'}
        </p>
      </div>
      <FiDownload size={15} className={isOwn ? 'text-white/70' : 'text-gray-400'} />
    </a>
  );
});

// ── Main message bubble ────────────────────────────────
const MessageBubble = memo(({ message, isOwn, showAvatar, onDelete }) => {
  if (message.type === 'system') return <SystemMessage message={message} />;

  const senderRole  = message.sender?.role || 'student';
  const roleStyle   = ROLE_COLORS[senderRole] || ROLE_COLORS.student;
  const initials    = (message.sender?.name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  if (message.isDeleted) {
    return (
      <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-1`}>
        <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs italic ${isOwn ? 'bg-gray-100 text-gray-400' : 'bg-gray-50 text-gray-400'}`}>
          🚫 This message was deleted
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-end gap-2 mb-1 group ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar — shown when showAvatar is true */}
      {showAvatar ? (
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0 mb-1 shadow-sm ${
          senderRole === 'admin'   ? 'bg-gradient-to-br from-purple-500 to-purple-700' :
          ['faculty', 'teacher'].includes(senderRole) ? 'bg-gradient-to-br from-blue-500 to-blue-700' :
          ['staff', 'agent'].includes(senderRole) ? 'bg-gradient-to-br from-indigo-500 to-indigo-700' :
                                     'bg-gradient-to-br from-green-500 to-teal-600'
        }`}>
          {initials}
        </div>
      ) : (
        <div className="w-8 flex-shrink-0" /> /* Spacer to align messages */
      )}

      <div className={`max-w-[70%] flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
        {/* Sender name + role badge (shown above first message in a sequence) */}
        {showAvatar && !isOwn && (
          <div className="flex items-center gap-2 mb-1 px-1">
            <span className="text-xs font-semibold text-gray-700">{message.sender?.name}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${roleStyle.bg} ${roleStyle.text}`}>
              {roleStyle.label}
            </span>
            {message.sender?.department && (
              <span className="text-xs text-gray-400">{message.sender.department}</span>
            )}
          </div>
        )}

        {/* Message bubble */}
        <div className={`relative px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
          isOwn
            ? 'text-white rounded-br-sm'
            : 'bg-white text-gray-800 border border-gray-100 rounded-bl-sm'
        }`} style={isOwn ? { background: 'linear-gradient(135deg, #1e40af, #2563eb)' } : {}}>

          {/* Text content */}
          {message.content && (
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          )}

          {/* File attachment */}
          {message.file?.url && (
            <FileAttachment file={message.file} isOwn={isOwn} />
          )}

          {/* Timestamp inside bubble */}
          <div className={`flex items-center gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
            <span className={`text-xs ${isOwn ? 'text-white/60' : 'text-gray-400'}`}>
              {formatTime(message.createdAt)}
            </span>
          </div>
        </div>

        {/* Delete button (hover) — only for own messages */}
        {isOwn && onDelete && (
          <button
            onClick={() => onDelete(message._id)}
            className="opacity-0 group-hover:opacity-100 transition-opacity mt-1 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
          >
            <FiTrash2 size={12} />
          </button>
        )}
      </div>
    </div>
  );
});

export default MessageBubble;
