/**
 * Theme registry.
 *
 * A theme is a CSS-variable override set applied to `:root[data-theme="…"]`.
 * Theme switching never changes layout, density, typography, or component
 * anatomy — only the values of the existing tokens in `globals.css`.
 *
 * Squads' `--accent-ethos-*` palette is intentionally NOT themed. It stays
 * amber across every theme so the institutional Squads brand never drifts.
 */

export type ThemeId = 'pointer' | 'axiom' | 'terminal' | 'custom';

export interface ThemeMeta {
  id: ThemeId;
  label: string;
  description: string;
  /** Three swatches for the picker tile (kept inline so the picker can render without reading CSS vars). */
  swatches: [string, string, string];
}

export const THEMES: readonly ThemeMeta[] = [
  {
    id: 'axiom',
    label: 'Axiom',
    description: 'The default. Neutral grey, muted, institutional.',
    swatches: ['#0A0A0B', '#9CA3AF', '#3DDC97'],
  },
  {
    id: 'pointer',
    label: 'Pointer',
    description: 'Cool navy with cyan accents.',
    swatches: ['#080D14', '#0077B6', '#00A3E0'],
  },
  {
    id: 'terminal',
    label: 'Terminal',
    description: 'Phosphor green on near-black. CRT-inspired.',
    swatches: ['#06080A', '#3DDC97', '#1F8F5C'],
  },
] as const;

export const DEFAULT_THEME: ThemeId = 'axiom';

export const THEME_STORAGE_KEY = 'pointer.theme';

/**
 * Routes where the theme is LOCKED to the default (axiom) regardless of the
 * user's saved preference — the marketing/auth surface always shows the clean
 * brand look. Theme switching only takes effect inside the app. Matched as
 * exact `/` or prefix for the rest.
 */
export function isThemeLockedRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  if (pathname === '/') return true;
  return pathname.startsWith('/auth') || pathname.startsWith('/beta');
}

export function isValidTheme(value: string | null | undefined): value is ThemeId {
  return (
    value === 'pointer' ||
    value === 'axiom' ||
    value === 'terminal' ||
    value === 'custom'
  );
}

/** The three preset palettes (custom is per-user, not in the registry). */
export function isPresetTheme(value: string | null | undefined): value is Exclude<ThemeId, 'custom'> {
  return value === 'pointer' || value === 'axiom' || value === 'terminal';
}
