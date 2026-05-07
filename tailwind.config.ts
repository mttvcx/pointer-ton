import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '1rem',
    },
    extend: {
      colors: {
        bg: {
          base: '#0A0B0E',
          raised: '#0A0B0E',
          sunken: '#0A0B0E',
          hover: '#1A1D24',
        },
        border: {
          subtle: '#1F232C',
          DEFAULT: '#2A2F3A',
          strong: '#3A4150',
        },
        fg: {
          primary: '#E8EBF0',
          secondary: '#9BA3B0',
          muted: '#6B7280',
          inverse: '#0A0B0E',
        },
        accent: {
          primary: '#7C5CFF',
          glow: '#9D7BFF',
        },
        signal: {
          bull: '#3DDC97',
          bear: '#FF5E78',
          warn: '#FFB547',
          info: '#5EBBFF',
        },
        // shadcn token bridge - points all shadcn primitives at our palette
        background: '#0A0B0E',
        foreground: '#E8EBF0',
        card: {
          DEFAULT: '#0A0B0E',
          foreground: '#E8EBF0',
        },
        popover: {
          DEFAULT: '#0A0B0E',
          foreground: '#E8EBF0',
        },
        primary: {
          DEFAULT: '#7C5CFF',
          foreground: '#0A0B0E',
        },
        secondary: {
          DEFAULT: '#0A0B0E',
          foreground: '#E8EBF0',
        },
        muted: {
          DEFAULT: '#0A0B0E',
          foreground: '#9BA3B0',
        },
        destructive: {
          DEFAULT: '#FF5E78',
          foreground: '#0A0B0E',
        },
        input: '#2A2F3A',
        ring: '#7C5CFF',
      },
      fontFamily: {
        sans: [
          'var(--font-inter)',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'Arial',
          'sans-serif',
        ],
      },
      fontSize: {
        xs: ['11px', { lineHeight: '1.35' }],
        sm: ['12px', { lineHeight: '1.35' }],
        base: ['13px', { lineHeight: '1.35' }],
        lg: ['15px', { lineHeight: '1.25' }],
        xl: ['16px', { lineHeight: '1.2' }],
        '2xl': ['20px', { lineHeight: '1.2' }],
        '3xl': ['22px', { lineHeight: '1.2' }],
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
        md: '6px',
        lg: '10px',
      },
      boxShadow: {
        glow: '0 0 24px -4px rgba(124, 92, 255, 0.45)',
        'glow-sm': '0 0 12px -2px rgba(124, 92, 255, 0.35)',
        panel: '0 1px 0 0 rgba(255,255,255,0.03) inset, 0 0 0 1px #1F232C',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(2px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.55' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
        /** Bottom bar: vertical price strip (~3s per asset, slide between). */
        'bottom-bar-ticker': {
          '0%, 20%': { transform: 'translateY(0)' },
          '22.5%, 40%': { transform: 'translateY(-1.25rem)' },
          '42.5%, 60%': { transform: 'translateY(-2.5rem)' },
          '62.5%, 80%': { transform: 'translateY(-3.75rem)' },
          '82.5%, 100%': { transform: 'translateY(-5rem)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 160ms ease-out',
        'pulse-soft': 'pulse-soft 1.6s ease-in-out infinite',
        shimmer: 'shimmer 1.4s linear infinite',
        'bottom-bar-ticker': 'bottom-bar-ticker 12s linear infinite',
      },
    },
  },
  plugins: [animate],
};

export default config;
