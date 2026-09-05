/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f7ff',
          100: '#e0effe',
          500: '#0284c7',
          600: '#0369a1',
          700: '#075985',
          900: '#0c4a6e',
        },
        slate: {
          850: '#152033',
          950: '#070c18',
        },
        navy: {
          900: '#02060D',
          800: '#030914',
          700: '#06111F',
          black: '#02050A',
          surface1: 'rgba(5, 15, 28, 0.72)',
          surface2: 'rgba(6, 18, 34, 0.68)',
          surface3: 'rgba(8, 20, 38, 0.55)',
        },
        accent: {
          cyan: '#22D3EE',
          brightCyan: '#06B6D4',
          electricBlue: '#3B82F6',
          deepBlue: '#2563EB',
          intelligence: '#8B5CF6',
          brightViolet: '#A855F7',
          success: '#22C55E',
          warning: '#F59E0B',
          error: '#EF4444',
        },
        text: {
          primary: '#F8FAFC',
          secondary: '#94A3B8',
          muted: '#64748B',
          technical: '#67E8F9',
        },
        border: {
          DEFAULT: 'rgba(34,211,238,0.18)',
          active: 'rgba(34,211,238,0.45)',
          violet: 'rgba(139,92,246,0.28)',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        display: ['Space Grotesk', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-cyan-blue-violet': 'linear-gradient(to right, #22D3EE, #3B82F6, #8B5CF6)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSlow: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        spinSlow: {
          '100%': { transform: 'rotate(360deg)' },
        },
        spinSlowReverse: {
          '100%': { transform: 'rotate(-360deg)' },
        },
        breathe: {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.8' },
          '50%': { transform: 'scale(1.05)', opacity: '1' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        slideUp: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        pulseSlow: 'pulseSlow 4s infinite ease-in-out',
        spinSlow: 'spinSlow 40s linear infinite',
        spinSlowReverse: 'spinSlowReverse 50s linear infinite',
        breathe: 'breathe 6s ease-in-out infinite',
        shimmer: 'shimmer 2s infinite',
      },
    },
  },
  plugins: [],
}
