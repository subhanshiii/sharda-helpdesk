import React, { useEffect, useState } from 'react';
import { FiImage, FiUpload, FiX } from 'react-icons/fi';
import { getAvatarPresetUrl } from '../utils/helpers';
import { Modal } from './ui';

export default function AvatarPickerPopover({
  open,
  title = 'Avatar Picker',
  subtitle = 'Choose a preset avatar or upload your own image.',
  avatars = [],
  selectedAvatar = '',
  loading = false,
  onClose,
  onSelect,
  onUpload,
}) {
  const [brokenTiles, setBrokenTiles] = useState({});

  useEffect(() => {
    if (!open) {
      setBrokenTiles({});
    }
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} panelClassName="max-w-2xl">
      <div className="avatar-picker-card relative w-full rounded-3xl border border-slate-200/70 bg-white p-5 shadow-2xl dark:border-slate-700/80 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-slate-800 dark:text-amber-300">
              <FiImage size={18} />
            </div>
            <h3 className="mt-4 font-display text-xl font-bold text-gray-900 dark-text-primary">{title}</h3>
            <p className="mt-1 text-sm text-gray-500 dark-text-muted">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-gray-200 p-2 text-gray-400 transition hover:border-gray-300 hover:bg-gray-50 hover:text-gray-600 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <FiX size={18} />
          </button>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <label className="btn-secondary cursor-pointer">
            <FiUpload size={14} />
            {loading ? 'Uploading...' : 'Upload image'}
            <input type="file" accept="image/*" className="hidden" onChange={onUpload} disabled={loading} />
          </label>
          <p className="text-xs text-gray-400 dark-text-muted">Uploaded image takes priority over selected avatar.</p>
        </div>

        <div className="avatar-picker-scroll mt-5 max-h-[320px] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {avatars.filter((avatarChoice) => !brokenTiles[avatarChoice]).map((avatarChoice) => (
              <button
                key={avatarChoice}
                type="button"
                disabled={loading}
                onClick={() => onSelect?.(avatarChoice)}
                className={`rounded-2xl border p-3 transition duration-200 ${selectedAvatar === avatarChoice ? 'border-blue-300 bg-blue-50 shadow-sm dark:border-amber-300/50 dark:bg-slate-800/90' : 'border-gray-200 bg-white hover:-translate-y-0.5 hover:border-gray-300 hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-900/80 dark:hover:border-slate-500 dark:hover:bg-slate-800'}`}
              >
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white p-1.5 shadow-sm">
                  <img
                    src={getAvatarPresetUrl(avatarChoice)}
                    alt="Preset avatar"
                    className="h-full w-full rounded-full object-contain"
                    onError={() => {
                      setBrokenTiles((current) => ({ ...current, [avatarChoice]: true }));
                    }}
                  />
                </div>
              </button>
            ))}
          </div>
        </div>

        <p className="mt-5 text-xs text-gray-400 dark-text-muted">Icons made by Freepik from www.flaticon.com</p>
      </div>
    </Modal>
  );
}
