'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { usePathname } from 'next/navigation';
import {
  DEFAULT_THEME,
  isPresetTheme,
  isThemeLockedRoute,
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
  /** The user's CHOSEN theme (what the in-app picker reflects). */
  theme: ThemeId;
  setTheme: (next: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/** The persisted preference, default axiom. (We read storage, not the DOM
 *  attribute — on a locked route the attribute is forced to axiom but the
 *  user's chosen theme may differ.) */
function readChosenTheme(): ThemeId {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  try {
    const v = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isValidTheme(v) ? v : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

/** Apply an EFFECTIVE theme to <html> (custom-aware). */
function applyTheme(t: ThemeId): void {
  if (typeof document === 'undefined') return;
  if (t === 'custom') {
    const stored = loadCustomTheme();
    if (stored) {
      applyCustomTheme(stored);
      return;
    }
    // No saved custom palette — fall back to the default rather than leaking vars.
    clearCustomTheme();
    document.documentElement.setAttribute('data-theme', DEFAULT_THEME);
    return;
  }
  clearCustomTheme();
  document.documentElement.setAttribute('data-theme', t);
}

/**
 * Theme controller.
 *
 * - The user's CHOSEN theme is persisted in localStorage (default: axiom).
 * - The EFFECTIVE theme is route-aware: home / login / beta routes are LOCKED to
 *   the default (axiom) so the marketing + auth surface always shows the clean
 *   brand look; theme switching only takes effect inside the app. This also
 *   keeps client-side navigation between the landing and the app correct.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [theme, setThemeState] = useState<ThemeId>(readChosenTheme);

  // Apply the effective theme whenever the route or the chosen theme changes.
  useEffect(() => {
    applyTheme(isThemeLockedRoute(pathname) ? DEFAULT_THEME : theme);
  }, [pathname, theme]);

  const setTheme = useCallback((next: ThemeId) => {
    let chosen: ThemeId;
    if (next === 'custom') {
      const stored = typeof window !== 'undefined' ? loadCustomTheme() : null;
      chosen = stored ? 'custom' : DEFAULT_THEME;
    } else if (isPresetTheme(next)) {
      chosen = next;
    } else {
      return;
    }
    setThemeState(chosen); // the effect re-applies (respecting locked routes)
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, chosen);
    } catch {
      /* storage may be unavailable (Safari private, sandbox, etc.) — ignore. */
    }
  }, []);

  /** Cross-tab sync: mirror the chosen theme from other tabs; the effect applies it. */
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== THEME_STORAGE_KEY || !isValidTheme(e.newValue)) return;
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
