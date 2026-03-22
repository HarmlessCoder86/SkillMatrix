/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        harvest: {
          0: '#e5e7eb', // empty
          1: '#93c5fd', // quarter
          2: '#3b82f6', // half
          3: '#1d4ed8', // three-quarter
          4: '#1e3a5f', // full
        },
        gap: '#ef4444',
        unconfirmed: '#f59e0b',
      },
      animation: {
        'pulse-border': 'pulse-border 2s ease-in-out infinite',
      },
      keyframes: {
        'pulse-border': {
          '0%, 100%': { borderColor: 'rgb(245 158 11 / 0.4)' },
          '50%': { borderColor: 'rgb(245 158 11 / 1)' },
        },
      },
    },
  },
  plugins: [],
}
