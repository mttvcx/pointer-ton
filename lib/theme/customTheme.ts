/**
 * Custom theme support — Phase 2 stretch goal.
 *
 * A custom theme is a JSON blob the user pastes into the settings modal.
 * Each color value can be a `#rrggbb` hex, a `#rgb` short hex, or an
 * already-normalized RGB triplet ("8 13 20"). The importer normalizes every
 * value to the RGB-triplet form Tailwind's `rgb(var(--*-rgb) / <alpha-value>)`
 * pipeline expects.
 *
 * Squads' `--accent-ethos*-rgb` is intentionally NOT part of the schema —
 * custom themes cannot override Ethos amber.
 */

import { z } from 'zod';

const HexShort = /^#?[0-9a-fA-F]{3}$/;
const HexLong = /^#?[0-9a-fA-F]{6}$/;
const Triplet = /^\d+\s+\d+\s+\d+$/;

const ColorString = z
  .string()
  .min(1)
  .refine(
    (raw) => {
      const v = raw.trim();
      return HexShort.test(v) || HexLong.test(v) || Triplet.test(v);
    },
    {
      message:
        'Color must be #rrggbb, #rgb, or an RGB triplet like "8 13 20".',
    },
  );

export const CustomThemeSchema = z.object({
  name: z.string().min(1).max(40),
  colors: z.object({
    'bg-base': ColorString,
    'bg-raised': ColorString,
    'bg-sunken': ColorString,
    'bg-hover': ColorString,
    'border-subtle': ColorString,
    'border-default': ColorString,
    'border-strong': ColorString,
    'fg-primary': ColorString,
    'fg-secondary': ColorString,
    'fg-muted': ColorString,
    'fg-inverse': ColorString,
    'accent-primary': ColorString,
    'accent-glow': ColorString,
    'signal-bull': ColorString,
    'signal-bear': ColorString,
    'signal-warn': ColorString,
    'signal-info': ColorString,
  }),
});

export type CustomTheme = z.infer<typeof CustomThemeSchema>;

export const CUSTOM_THEME_STORAGE_KEY = 'pointer.customTheme';

/** The 17 token names a custom theme can override. */
export const CUSTOM_THEME_KEYS: ReadonlyArray<keyof CustomTheme['colors']> = [
  'bg-base',
  'bg-raised',
  'bg-sunken',
  'bg-hover',
  'border-subtle',
  'border-default',
  'border-strong',
  'fg-primary',
  'fg-secondary',
  'fg-muted',
  'fg-inverse',
  'accent-primary',
  'accent-glow',
  'signal-bull',
  'signal-bear',
  'signal-warn',
  'signal-info',
];

/** Accepts hex (`#080D14` / `#08D`) or RGB triplet (`"8 13 20"`) and returns the triplet form. */
export function normalizeColor(input: string): string {
  const trimmed = input.trim();
  if (Triplet.test(trimmed)) return trimmed;
  const hex = trimmed.replace(/^#/, '');
  if (/^[0-9a-fA-F]{6}$/.test(hex)) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `${r} ${g} ${b}`;
  }
  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    const r = parseInt(hex[0]! + hex[0]!, 16);
    const g = parseInt(hex[1]! + hex[1]!, 16);
    const b = parseInt(hex[2]! + hex[2]!, 16);
    return `${r} ${g} ${b}`;
  }
  throw new Error(`Invalid color value: ${input}`);
}

/**
 * Writes the custom theme's tokens as inline CSS properties on `<html>`.
 * Sets `data-theme="custom"` so any future preset switch can detect it.
 */
export function applyCustomTheme(theme: CustomTheme): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-theme', 'custom');
  for (const key of CUSTOM_THEME_KEYS) {
    const raw = theme.colors[key];
    try {
      root.style.setProperty(`--${key}-rgb`, normalizeColor(raw));
    } catch {
      /* skip malformed individual entries; schema should have caught these */
    }
  }
}

/**
 * Removes the inline RGB-token overrides so the next `data-theme` CSS rule
 * can win without inline-style precedence. Call this before switching to a
 * preset.
 */
export function clearCustomTheme(): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  for (const key of CUSTOM_THEME_KEYS) {
    root.style.removeProperty(`--${key}-rgb`);
  }
}

export function saveCustomTheme(theme: CustomTheme): void {
  try {
    window.localStorage.setItem(CUSTOM_THEME_STORAGE_KEY, JSON.stringify(theme));
  } catch {
    /* storage unavailable — ignore */
  }
}

export function loadCustomTheme(): CustomTheme | null {
  try {
    const raw = window.localStorage.getItem(CUSTOM_THEME_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return CustomThemeSchema.parse(parsed);
  } catch {
    return null;
  }
}
