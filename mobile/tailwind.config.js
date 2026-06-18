// tailwind.config.js
// Tailwind CSS configuration for NativeWind.
// Scans all app and component files for className usage to generate utility styles.
// Extended with Horizon OS dark theme color palette.

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        horizon: {
          bg: '#0f172a',
          card: '#1e293b',
          border: '#334155',
          text: '#f8fafc',
          muted: '#94a3b8',
          primary: '#2563eb',
          'primary-hover': '#1d4ed8',
          success: '#16a34a',
          warning: '#d97706',
          danger: '#dc2626',
        },
      },
    },
  },
  plugins: [],
};
