import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_THEME_ID,
  getThemeDefinition,
  normalizeThemeId,
  THEME_DEFINITIONS,
  THEME_STORAGE_KEY,
} from '../theme/themeRegistry';

const ThemeContext = createContext();

const getInitialTheme = () => {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  if (savedTheme) return normalizeThemeId(savedTheme);

  if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark-pro';
  }

  return DEFAULT_THEME_ID;
};

export const ThemeProvider = ({ children }) => {
  const [activeThemeId, setActiveThemeId] = useState(getInitialTheme);
  const [previewThemeId, setPreviewThemeId] = useState(null);

  const resolvedThemeId = previewThemeId || activeThemeId;
  const resolvedTheme = getThemeDefinition(resolvedThemeId);
  const activeTheme = getThemeDefinition(activeThemeId);

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme.id;
    document.documentElement.dataset.appearance = resolvedTheme.appearance;
    document.documentElement.style.colorScheme = resolvedTheme.appearance;
  }, [resolvedTheme]);

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, activeThemeId);
  }, [activeThemeId]);

  const toggleTheme = () => {
    setPreviewThemeId(null);
    setActiveThemeId((currentThemeId) => {
      const currentTheme = getThemeDefinition(currentThemeId);
      return currentTheme.appearance === 'dark' ? DEFAULT_THEME_ID : 'dark-pro';
    });
  };

  const value = useMemo(() => ({
    themes: THEME_DEFINITIONS,
    theme: resolvedTheme.id,
    activeTheme,
    activeThemeId,
    previewThemeId,
    resolvedTheme,
    isDark: resolvedTheme.appearance === 'dark',
    setTheme: (themeId) => {
      setPreviewThemeId(null);
      setActiveThemeId(normalizeThemeId(themeId));
    },
    setPreviewTheme: (themeId) => {
      setPreviewThemeId(themeId ? normalizeThemeId(themeId) : null);
    },
    clearPreviewTheme: () => setPreviewThemeId(null),
    toggleTheme,
  }), [activeTheme, activeThemeId, previewThemeId, resolvedTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};
