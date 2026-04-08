import React from 'react';
import { FiMoon, FiSun } from 'react-icons/fi';
import { useTheme } from '../context/ThemeContext';

export default function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="theme-toggle inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-all"
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      {isDark ? <FiSun size={16} /> : <FiMoon size={16} />}
      <span className="hidden sm:inline">{isDark ? 'Light' : 'Dark'} Mode</span>
    </button>
  );
}
