/**
 * Invo-inspired dark palette (locked with founder 2026-07-02). ONE mint-green hero:
 * accent = primary actions = gains (a single green, not two). Orange-red for
 * down / short / stop. Blue reserved for the brand mark + FAB only. Pure-black
 * base. Text on mint fills is DARK (`onAccent`) — Invo's signature, higher contrast
 * than white-on-green. NO monospace / slashed-zero number fonts — numbers use the
 * system font.
 */
export const colors = {
  bg: '#000000',
  bgRaised: '#121316',
  bgRaised2: '#1B1D22',
  bgSunken: '#000000',
  border: '#232529',
  borderStrong: '#33373E',
  fg: '#ffffff',
  fgSecondary: '#C9CDD4',
  fgMuted: '#8B9099',
  fgFaint: '#5A606B',
  // Mint hero — used for primary actions AND gains (one green).
  accent: '#00E0A0',
  accentGlow: '#57F0C4',
  accentSoft: 'rgba(0,224,160,0.15)',
  bull: '#00E0A0',
  bullSoft: 'rgba(0,224,160,0.14)',
  // Down / short / stop-loss.
  bear: '#FF5C45',
  bearSoft: 'rgba(255,92,69,0.14)',
  warn: '#FFB23E',
  warnSoft: 'rgba(255,178,62,0.14)',
  danger: '#FF6A3D',
  chartDown: '#FF6A3D',
  // Brand blue — logo + FAB only, never a generic action color.
  brand: '#2F7BF6',
  verify: '#2F7BF6',
  // Dark ink that sits on top of mint/green fills (Invo uses dark-on-green).
  onAccent: '#04140E',
  // Our own identity: a deep mint-tinted night gradient (not FOMO's flat black),
  // + a faint top aura. Subtle — depth, not decoration.
  bgGradient: ['#08130F', '#04080A', '#000000'] as const,
  aura: 'rgba(0,224,160,0.06)',
} as const;

export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;
export const space = (n: number) => n * 4;

/** Fixed top inset (no safe-area-context dep). Clears the Dynamic Island. */
export const TOP_INSET = 60;
