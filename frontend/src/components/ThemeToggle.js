import React, { useEffect, useRef, useState } from 'react';
import { FiCheck, FiDroplet } from 'react-icons/fi';
import { useTheme } from '../context/ThemeContext';

function ThemePreviewCard({ theme }) {
  return (
    <div className={`theme-preview-card theme-preview-card--${theme.kind}`} aria-hidden="true">
      <div className="theme-preview-card-topbar">
        <span className="theme-preview-dot" />
        <span className="theme-preview-dot" />
        <span className="theme-preview-dot" />
      </div>
      <div className="theme-preview-card-body">
        <div className="theme-preview-sidebar">
          <span className="theme-preview-sidebar-line short" />
          <span className="theme-preview-sidebar-line" />
          <span className="theme-preview-sidebar-line" />
        </div>
        <div className="theme-preview-content">
          <div className="theme-preview-hero" />
          <div className="theme-preview-row">
            <span className="theme-preview-pill" />
            <span className="theme-preview-pill muted" />
          </div>
          <div className="theme-preview-stats">
            <span className="theme-preview-stat" />
            <span className="theme-preview-stat" />
            <span className="theme-preview-stat accent" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ThemeToggle() {
  const {
    themes,
    activeThemeId,
    previewThemeId,
    setTheme,
    setPreviewTheme,
    clearPreviewTheme,
  } = useTheme();
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) {
      clearPreviewTheme();
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        clearPreviewTheme();
        setOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        clearPreviewTheme();
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [clearPreviewTheme, open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="theme-toggle theme-toggle-trigger inline-flex items-center justify-center rounded-full transition-all"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Open theme selector"
        title="Open theme selector"
      >
        <FiDroplet size={15} className={`theme-toggle-icon ${open ? 'is-open' : ''}`} />
      </button>

      {open ? (
        <div
          role="menu"
          className="theme-selector-popover animate-fade-in-up"
          onMouseLeave={clearPreviewTheme}
        >
          <div className="theme-selector-header">
            <p className="theme-selector-eyebrow">Theme Studio</p>
            <h3 className="theme-selector-title">Choose your workspace mood</h3>
            <p className="theme-selector-subtitle">Hover for a live preview, click to keep it.</p>
          </div>

          <div className="theme-selector-list">
            {themes.map((theme) => {
              const isSelected = activeThemeId === theme.id;
              const isPreviewing = previewThemeId === theme.id;

              return (
                <button
                  key={theme.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={isSelected}
                  className={`theme-selector-item theme-selector-item--${theme.kind} ${isSelected ? 'is-selected' : ''} ${isPreviewing ? 'is-previewing' : ''}`}
                  onMouseEnter={() => setPreviewTheme(theme.id)}
                  onFocus={() => setPreviewTheme(theme.id)}
                  onClick={() => {
                    setTheme(theme.id);
                    setOpen(false);
                  }}
                >
                  <ThemePreviewCard theme={theme} />
                  <div className="theme-selector-copy">
                    <span className="theme-selector-item-name">{theme.name}</span>
                    <span className="theme-selector-item-description">{theme.description}</span>
                  </div>
                  <span className={`theme-selector-state ${isSelected ? 'is-visible' : ''}`}>
                    <FiCheck size={14} />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
