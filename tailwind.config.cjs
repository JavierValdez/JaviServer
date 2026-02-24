/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Colores personalizados para la app
        'ssh-dark': '#1a1b26',
        'ssh-darker': '#13141c',
        'ssh-light': '#24283b',
        'ssh-accent': '#7aa2f7',
        'ssh-success': '#9ece6a',
        'ssh-warning': '#e0af68',
        'ssh-error': '#f7768e',
      },
    },
  },
  plugins: [],
}
