/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        crm: {
          bg: 'var(--crm-bg)',
          surface: 'var(--crm-surface)',
          card: 'var(--crm-card)',
          border: 'var(--crm-border)',
          'border-hover': 'var(--crm-border-hover)',
          muted: 'var(--crm-muted)',
          text: 'var(--crm-text)',
          'text-bright': 'var(--crm-text-bright)',
          accent: 'var(--crm-accent)',
          'accent-glow': 'var(--crm-accent-glow)',
          'accent-muted': 'var(--crm-accent-muted)',
          positive: 'var(--crm-positive)',
          'positive-muted': 'var(--crm-positive-muted)',
          negative: 'var(--crm-negative)',
          'negative-muted': 'var(--crm-negative-muted)',
          warning: 'var(--crm-warning)',
          'warning-muted': 'var(--crm-warning-muted)',
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
