export const THEME_STORAGE_KEY = 'sharda-theme';

export const THEME_DEFINITIONS = [
  {
    id: 'dark-pro',
    name: 'Dark Pro',
    description: 'Minimal contrast with restrained glow and polished depth.',
    appearance: 'dark',
    swatches: ['#050816', '#121a2b', '#f8fafc', '#7dd3fc'],
    kind: 'dark-pro',
  },
  {
    id: 'pastel-dream',
    name: 'Pastel Dream',
    description: 'Soft layered pastels with a playful editorial feel.',
    appearance: 'light',
    swatches: ['#fff0f6', '#e0f2fe', '#dcfce7', '#fef3c7', '#ede9fe'],
    kind: 'pastel-dream',
  },
  {
    id: 'neon-pulse',
    name: 'Neon Pulse',
    description: 'Cyberpunk gradients, bright edges, and electric glow.',
    appearance: 'dark',
    swatches: ['#09111f', '#111827', '#22d3ee', '#f472b6', '#22c55e'],
    kind: 'neon-pulse',
  },
  {
    id: 'focus-mode',
    name: 'Focus Mode',
    description: 'Quiet, typographic, and low-color for long work sessions.',
    appearance: 'light',
    swatches: ['#f7f5ef', '#ffffff', '#d6d3d1', '#44403c'],
    kind: 'focus-mode',
  },
];

export const DEFAULT_THEME_ID = 'focus-mode';

export const LEGACY_THEME_ALIASES = {
  light: 'focus-mode',
  dark: 'dark-pro',
  'soft-pastel': 'pastel-dream',
  'midnight-dark': 'dark-pro',
  'neon-cyber': 'neon-pulse',
  'glass-frosted': 'focus-mode',
  'warm-sepia': 'focus-mode',
  'high-contrast': 'dark-pro',
};

export const themeMap = Object.fromEntries(
  THEME_DEFINITIONS.map((theme) => [theme.id, theme]),
);

export const normalizeThemeId = (value) => {
  if (!value) return DEFAULT_THEME_ID;
  const normalized = LEGACY_THEME_ALIASES[value] || value;
  return themeMap[normalized] ? normalized : DEFAULT_THEME_ID;
};

export const getThemeDefinition = (value) => themeMap[normalizeThemeId(value)];
