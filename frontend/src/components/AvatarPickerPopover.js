import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FiImage, FiUpload, FiX } from 'react-icons/fi';
import { getAvatarPresetUrl } from '../utils/helpers';
import { createCroppedImageFile, loadImageDimensions } from '../utils/imageCrop';
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
  const [cropDraft, setCropDraft] = useState(null);
  const [cropZoom, setCropZoom] = useState(1);
  const [cropOffsetX, setCropOffsetX] = useState(0);
  const [cropOffsetY, setCropOffsetY] = useState(0);

  const cropSize = 280;
  const coverScale = useMemo(() => {
    if (!cropDraft) return 1;
    return Math.max(cropSize / cropDraft.width, cropSize / cropDraft.height);
  }, [cropDraft]);

  const displayWidth = cropDraft ? cropDraft.width * coverScale * cropZoom : 0;
  const displayHeight = cropDraft ? cropDraft.height * coverScale * cropZoom : 0;
  const maxOffsetX = Math.max((displayWidth - cropSize) / 2, 0);
  const maxOffsetY = Math.max((displayHeight - cropSize) / 2, 0);

  const resetCropState = useCallback(() => {
    if (cropDraft?.src) URL.revokeObjectURL(cropDraft.src);
    setCropDraft(null);
    setCropZoom(1);
    setCropOffsetX(0);
    setCropOffsetY(0);
  }, [cropDraft]);

  useEffect(() => {
    if (!open) {
      setBrokenTiles({});
      resetCropState();
    }
  }, [open, resetCropState]);

  useEffect(() => {
    if (!cropDraft) return;
    setCropOffsetX((current) => Math.max(Math.min(current, maxOffsetX), -maxOffsetX));
    setCropOffsetY((current) => Math.max(Math.min(current, maxOffsetY), -maxOffsetY));
  }, [cropDraft, maxOffsetX, maxOffsetY]);

  const handleFileSelect = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const src = URL.createObjectURL(file);
    try {
      const dimensions = await loadImageDimensions(src);
      resetCropState();
      setCropDraft({
        file,
        src,
        width: dimensions.width,
        height: dimensions.height,
      });
    } catch {
      URL.revokeObjectURL(src);
    }
  };

  const handleCropConfirm = async () => {
    if (!cropDraft) return;
    const croppedFile = await createCroppedImageFile({
      src: cropDraft.src,
      fileName: cropDraft.file?.name || 'avatar.jpg',
      width: cropDraft.width,
      height: cropDraft.height,
      zoom: cropZoom,
      offsetX: cropOffsetX,
      offsetY: cropOffsetY,
      cropSize,
    });
    await onUpload?.(croppedFile);
    resetCropState();
  };

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
            {loading ? 'Uploading...' : cropDraft ? 'Replace image' : 'Upload image'}
            <input type="file" accept="image/*" className="hidden" onChange={handleFileSelect} disabled={loading} />
          </label>
          <p className="text-xs text-gray-400 dark-text-muted">Uploaded image takes priority over selected avatar, and now includes a crop step before save.</p>
        </div>

        {cropDraft ? (
          <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-950/40">
            <div className="mx-auto flex max-w-[320px] flex-col items-center">
              <div className="relative h-[280px] w-[280px] overflow-hidden rounded-[32px] border border-slate-200 bg-slate-900 shadow-inner dark:border-slate-700">
                <img
                  src={cropDraft.src}
                  alt="Crop preview"
                  className="absolute left-1/2 top-1/2 max-w-none select-none"
                  style={{
                    width: `${displayWidth}px`,
                    height: `${displayHeight}px`,
                    transform: `translate(calc(-50% + ${cropOffsetX}px), calc(-50% + ${cropOffsetY}px))`,
                  }}
                />
                <div className="pointer-events-none absolute inset-0 rounded-[32px] ring-1 ring-inset ring-white/60" />
              </div>
            </div>
            <div className="mt-5 grid gap-4">
              <div>
                <label className="label">Zoom</label>
                <input type="range" min="1" max="3" step="0.01" value={cropZoom} onChange={(event) => setCropZoom(Number(event.target.value))} className="w-full" />
              </div>
              <div>
                <label className="label">Horizontal Crop</label>
                <input type="range" min={-maxOffsetX} max={maxOffsetX} step="1" value={Math.max(Math.min(cropOffsetX, maxOffsetX), -maxOffsetX)} onChange={(event) => setCropOffsetX(Number(event.target.value))} className="w-full" disabled={!maxOffsetX} />
              </div>
              <div>
                <label className="label">Vertical Crop</label>
                <input type="range" min={-maxOffsetY} max={maxOffsetY} step="1" value={Math.max(Math.min(cropOffsetY, maxOffsetY), -maxOffsetY)} onChange={(event) => setCropOffsetY(Number(event.target.value))} className="w-full" disabled={!maxOffsetY} />
              </div>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button type="button" onClick={resetCropState} className="btn-secondary" disabled={loading}>Cancel Crop</button>
              <button type="button" onClick={handleCropConfirm} className="btn-primary" disabled={loading}>
                {loading ? 'Uploading...' : 'Save Cropped Image'}
              </button>
            </div>
          </div>
        ) : (
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
        )}

        <p className="mt-5 text-xs text-gray-400 dark-text-muted">Icons made by Freepik from www.flaticon.com</p>
      </div>
    </Modal>
  );
}
