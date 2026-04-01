/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        crm: {
          bg: '#0a0a0a',
          surface: '#111111',
          card: '#161616',
          border: '#1f1f1f',
          'border-hover': '#2a2a2a',
          muted: '#6b6b6b',
          text: '#e5e5e5',
          'text-bright': '#fafafa',
          accent: '#dc2626',
          'accent-glow': '#ef4444',
          'accent-muted': '#991b1b',
          positive: '#22c55e',
          'positive-muted': '#166534',
          negative: '#ef4444',
          'negative-muted': '#991b1b',
          warning: '#f59e0b',
          'warning-muted': '#92400e',
        },
      },
      fontFamily: {
        display: ['"Outfit"', 'sans-serif'],
        body: ['"DM Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        'glow-red': '0 0 20px rgba(220, 38, 38, 0.15)',
        'glow-green': '0 0 20px rgba(34, 197, 94, 0.15)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(10px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        glow: { '0%': { boxShadow: '0 0 5px rgba(220, 38, 38, 0.1)' }, '100%': { boxShadow: '0 0 20px rgba(220, 38, 38, 0.2)' } },
      },
    },
  },
  plugins: [],
};
