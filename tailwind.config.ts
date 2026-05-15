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
        // Theme-aware tokens — resolve through CSS vars so `data-theme` on <html>
        // can recolor the app without rebuilding. `<alpha-value>` is Tailwind's
        // placeholder for opacity modifiers like `bg-bg-base/40`.
        bg: {
          base: 'rgb(var(--bg-base-rgb) / <alpha-value>)',
          raised: 'rgb(var(--bg-raised-rgb) / <alpha-value>)',
          sunken: 'rgb(var(--bg-sunken-rgb) / <alpha-value>)',
          hover: 'rgb(var(--bg-hover-rgb) / <alpha-value>)',
        },
        border: {
          subtle: 'rgb(var(--border-subtle-rgb) / <alpha-value>)',
          DEFAULT: 'rgb(var(--border-default-rgb) / <alpha-value>)',
          strong: 'rgb(var(--border-strong-rgb) / <alpha-value>)',
        },
        fg: {
          primary: 'rgb(var(--fg-primary-rgb) / <alpha-value>)',
          secondary: 'rgb(var(--fg-secondary-rgb) / <alpha-value>)',
          muted: 'rgb(var(--fg-muted-rgb) / <alpha-value>)',
          inverse: 'rgb(var(--fg-inverse-rgb) / <alpha-value>)',
        },
        accent: {
          primary: 'rgb(var(--accent-primary-rgb) / <alpha-value>)',
          glow: 'rgb(var(--accent-glow-rgb) / <alpha-value>)',
          ethos: 'rgb(var(--accent-ethos-rgb) / <alpha-value>)',
          'ethos-soft': 'rgb(var(--accent-ethos-soft-rgb) / <alpha-value>)',
          'ethos-dim': 'rgb(var(--accent-ethos-dim-rgb) / <alpha-value>)',
        },
        signal: {
          bull: 'rgb(var(--signal-bull-rgb) / <alpha-value>)',
          bear: 'rgb(var(--signal-bear-rgb) / <alpha-value>)',
          warn: 'rgb(var(--signal-warn-rgb) / <alpha-value>)',
          info: 'rgb(var(--signal-info-rgb) / <alpha-value>)',
        },
        // shadcn token bridge - points all shadcn primitives at our palette
        background: '#080D14',
        foreground: '#E8EBF0',
        card: {
          DEFAULT: '#080D14',
          foreground: '#E8EBF0',
        },
        popover: {
          DEFAULT: '#080D14',
          foreground: '#E8EBF0',
        },
        primary: {
          DEFAULT: '#0077B6',
          foreground: '#080D14',
        },
        secondary: {
          DEFAULT: '#080D14',
          foreground: '#E8EBF0',
        },
        muted: {
          DEFAULT: '#080D14',
          foreground: '#9BA3B0',
        },
        destructive: {
          DEFAULT: 'rgb(var(--signal-bear-rgb) / <alpha-value>)',
          foreground: 'rgb(var(--fg-inverse-rgb) / <alpha-value>)',
        },
        input: '#2A2F3A',
        ring: '#0077B6',
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
        mono: [
          '"SF Mono"',
          '"Fira Code"',
          '"Fira Mono"',
          '"Roboto Mono"',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          '"Liberation Mono"',
          '"Courier New"',
          'monospace',
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
        // Semantic glows now follow --accent-primary across themes.
        glow: '0 0 24px -4px rgb(var(--accent-primary-rgb) / 0.45)',
        'glow-sm': '0 0 12px -2px rgb(var(--accent-primary-rgb) / 0.35)',
        // Panel hairline: previously a frozen `#1F232C`. Now tracks the theme's
        // subtle border (visually equivalent in Pointer; recolors on Axiom/Terminal).
        panel:
          '0 1px 0 0 rgba(255,255,255,0.03) inset, 0 0 0 1px rgb(var(--border-subtle-rgb) / 1)',
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
        'copilot-pill-in': {
          from: { opacity: '0', transform: 'scale(0.98)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'copilot-pill-out': {
          from: { opacity: '1', transform: 'scale(1)' },
          to: { opacity: '0', transform: 'scale(0.98)' },
        },
        /**
         * Co-pilot expanded card — animate only scale/opacity on an inner shell.
         * (Never put translate-x-50% here: it overrides the outer centering transform and makes the card jump left.)
         */
        'copilot-card-enter': {
          '0%': { opacity: '0', transform: 'scale(0.94)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        /** Cluely-style drop-down sheet — bar stretches outward then drops content down. */
        'copilot-sheet-in': {
          '0%': {
            opacity: '0',
            transform: 'translateY(-6px) scaleX(0.92) scaleY(0.6)',
            transformOrigin: 'top center',
          },
          '55%': {
            opacity: '1',
            transform: 'translateY(0px) scaleX(1) scaleY(0.6)',
            transformOrigin: 'top center',
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0px) scaleX(1) scaleY(1)',
            transformOrigin: 'top center',
          },
        },
        'copilot-sheet-out': {
          '0%': { opacity: '1', transform: 'translateY(0px) scaleY(1)', transformOrigin: 'top center' },
          '100%': { opacity: '0', transform: 'translateY(-4px) scaleY(0.85)', transformOrigin: 'top center' },
        },
      },
      animation: {
        'fade-in': 'fade-in 160ms ease-out',
        'pulse-soft': 'pulse-soft 1.6s ease-in-out infinite',
        shimmer: 'shimmer 1.4s linear infinite',
        'bottom-bar-ticker': 'bottom-bar-ticker 12s linear infinite',
        'copilot-pill-in': 'copilot-pill-in 200ms ease-out forwards',
        'copilot-pill-out': 'copilot-pill-out 200ms ease-out forwards',
        'copilot-card-enter': 'copilot-card-enter 380ms cubic-bezier(0.22, 0.9, 0.22, 1) both',
        'copilot-sheet-in': 'copilot-sheet-in 340ms cubic-bezier(0.22, 0.9, 0.22, 1) both',
        'copilot-sheet-out': 'copilot-sheet-out 180ms cubic-bezier(0.4, 0, 1, 1) both',
      },
    },
  },
  plugins: [animate],
};

export default config;
