/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // Dark theme (current)
        'ssh-dark': '#1a1b26',
        'ssh-darker': '#13141c',
        'ssh-light': '#24283b',
        'ssh-accent': '#7aa2f7',
        'ssh-success': '#9ece6a',
        'ssh-warning': '#e0af68',
        'ssh-error': '#f7768e',
        // Light theme additions
        'lt-surface': '#f8fafc',
        'lt-panel': '#ffffff',
        'lt-accent': '#3b82f6',
        'lt-accent-strong': '#1d4ed8',
        'lt-success': '#059669',
        'lt-warning': '#d97706',
        'lt-danger': '#e11d48',
        'lt-text': '#0f172a',
        'lt-text-secondary': '#475569',
        'lt-border': '#e2e8f0',
      },
    },
  },
  plugins: [],
}
