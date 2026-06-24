/** Pointer dark palette (mirrors the web tokens). */
export const colors = {
  bg: '#080D14',
  bgRaised: '#0e151f',
  bgSunken: '#060a10',
  border: '#1b2230',
  borderStrong: '#283143',
  fg: '#ffffff',
  fgSecondary: '#aab3c2',
  fgMuted: '#7a8595',
  accent: '#5865F2',
  accentSoft: 'rgba(88,101,242,0.16)',
  bull: '#16c784',
  bullSoft: 'rgba(22,199,132,0.14)',
  bear: '#ea3943',
  bearSoft: 'rgba(234,57,67,0.14)',
  warn: '#f0a020',
  warnSoft: 'rgba(240,160,32,0.14)',
} as const;

export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;
export const space = (n: number) => n * 4;
