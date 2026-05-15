'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  DEFAULT_THEME,
  isPresetTheme,
  isValidTheme,
  THEME_STORAGE_KEY,
  type ThemeId,
} from '@/lib/theme/themes';
import {
  applyCustomTheme,
  clearCustomTheme,
  loadCustomTheme,
} from '@/lib/theme/customTheme';

interface ThemeContextValue {
  theme: ThemeId;
  setTheme: (next: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/**
 * Reads the theme attribute that the SSR-injected `<script>` already set on
 * `<html>`. We don't read localStorage here — the script wins so first paint
 * matches the persisted theme without an extra round-trip.
 */
function readInitialTheme(): ThemeId {
  if (typeof document === 'undefined') return DEFAULT_THEME;
  const attr = document.documentElement.getAttribute('data-theme');
  return isValidTheme(attr) ? attr : DEFAULT_THEME;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(readInitialTheme);

  const setTheme = useCallback((next: ThemeId) => {
    if (next === 'custom') {
      // Load + reapply (the SSR script may have already inlined these, but we
      // re-apply to handle the in-app preset → custom toggle).
      const stored = typeof window !== 'undefined' ? loadCustomTheme() : null;
      if (!stored) {
        // No saved custom theme — fall back to default rather than silently
        // landing on data-theme="custom" with no overrides (which would leak
        // the previous preset's variables).
        setThemeState(DEFAULT_THEME);
        if (typeof document !== 'undefined') {
          clearCustomTheme();
          document.documentElement.setAttribute('data-theme', DEFAULT_THEME);
        }
        try {
          window.localStorage.setItem(THEME_STORAGE_KEY, DEFAULT_THEME);
        } catch {
          /* ignore */
        }
        return;
      }
      applyCustomTheme(stored);
      setThemeState('custom');
    } else if (isPresetTheme(next)) {
      // Wipe any inline custom overrides so the preset's CSS rules win.
      clearCustomTheme();
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', next);
      }
      setThemeState(next);
    } else {
      return;
    }
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* storage may be unavailable (Safari private, sandbox, etc.) — ignore. */
    }
  }, []);

  /** Cross-tab sync: respond to `storage` events from other tabs. */
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== THEME_STORAGE_KEY) return;
      if (!isValidTheme(e.newValue)) return;
      if (e.newValue === 'custom') {
        const stored = loadCustomTheme();
        if (stored) {
          applyCustomTheme(stored);
          setThemeState('custom');
        }
        return;
      }
      // Preset switch from another tab — clear inline overrides first.
      clearCustomTheme();
      document.documentElement.setAttribute('data-theme', e.newValue);
      setThemeState(e.newValue);
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
