/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#0f1f5c',
        },
        sharda: {
          blue:   '#1e3a8a',
          navy:   '#0c1654',
          yellow: '#f59e0b',
          orange: '#f97316',
          pink:   '#ec4899',
          cyan:   '#06b6d4',
          green:  '#10b981',
          light:  '#f0f4ff',
        }
      },
      fontFamily: {
        sans:    ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'card':       '0 1px 4px rgba(30,58,138,0.06), 0 4px 16px rgba(30,58,138,0.04)',
        'card-hover': '0 4px 16px rgba(30,58,138,0.12), 0 8px 32px rgba(30,58,138,0.08)',
        'blue':       '0 4px 14px rgba(30,58,138,0.35)',
        'blue-lg':    '0 8px 32px rgba(30,58,138,0.4)',
        'inner-white':'inset 0 1px 0 rgba(255,255,255,0.15)',
      },
      backgroundImage: {
        'gradient-sharda':  'linear-gradient(135deg, #1e3a8a 0%, #1e40af 60%, #2563eb 100%)',
        'gradient-warm':    'linear-gradient(135deg, #f59e0b, #f97316)',
        'gradient-cool':    'linear-gradient(135deg, #06b6d4, #3b82f6)',
        'gradient-pink':    'linear-gradient(135deg, #ec4899, #f97316)',
        'gradient-green':   'linear-gradient(135deg, #10b981, #06b6d4)',
      },
    },
  },
  plugins: [],
};
