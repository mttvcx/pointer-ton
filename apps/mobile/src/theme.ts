/**
 * FOMO-cloned dark palette. Direction (locked with founder 2026-06-24): clone FOMO
 * 1:1 first, tweak later. Near-pure-black base, periwinkle accent, rounded radii.
 * NO monospace / slashed-zero number fonts anywhere — numbers use the system font.
 */
export const colors = {
  bg: '#04050A',
  bgRaised: '#0E1117',
  bgRaised2: '#15181F',
  bgSunken: '#02030A',
  border: '#181C24',
  borderStrong: '#283143',
  fg: '#ffffff',
  fgSecondary: '#C9CDD4',
  fgMuted: '#8C929C',
  fgFaint: '#5A606B',
  accent: '#5B6EF5',
  accentGlow: '#8FA0FF',
  accentSoft: 'rgba(91,110,245,0.16)',
  bull: '#1FD760',
  bullSoft: 'rgba(31,215,96,0.14)',
  bear: '#FF4E45',
  bearSoft: 'rgba(255,78,69,0.14)',
  warn: '#FFB23E',
  warnSoft: 'rgba(255,178,62,0.14)',
  danger: '#FF6A3D',
  chartDown: '#FF6A2C',
  verify: '#3B82F6',
} as const;

export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;
export const space = (n: number) => n * 4;

/** Fixed top inset (no safe-area-context dep). Clears the Dynamic Island. */
export const TOP_INSET = 60;
