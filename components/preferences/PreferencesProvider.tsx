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
  DEFAULT_PREFERENCES,
  PREFERENCES_STORAGE_KEY,
  isPreferences,
  withDefaults,
  type Preferences,
} from '@/lib/preferences/preferences';

interface PreferencesContextValue {
  prefs: Preferences;
  setPref: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
  resetPrefs: () => void;
}

const PreferencesContext = createContext<PreferencesContextValue | undefined>(undefined);

function readInitialPrefs(): Preferences {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return withDefaults(parsed as Partial<Preferences>);
    }
    return DEFAULT_PREFERENCES;
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Preferences>(readInitialPrefs);

  /** Reflect prefs onto <html> as data-* attributes so CSS selectors can pick them up. */
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-row-density', prefs.rowDensity);
    root.setAttribute('data-row-separators', String(prefs.rowSeparators));
    root.setAttribute('data-row-elevation', String(prefs.rowElevation));
    root.setAttribute('data-action-divider', String(prefs.actionZoneDivider));
    root.setAttribute('data-avatar-size', prefs.avatarSize);
  }, [prefs]);

  const setPref = useCallback<PreferencesContextValue['setPref']>((key, value) => {
    setPrefs((prev) => {
      const next: Preferences = { ...prev, [key]: value };
      try {
        window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable — ignore */
      }
      return next;
    });
  }, []);

  const resetPrefs = useCallback(() => {
    setPrefs(DEFAULT_PREFERENCES);
    try {
      window.localStorage.setItem(
        PREFERENCES_STORAGE_KEY,
        JSON.stringify(DEFAULT_PREFERENCES),
      );
    } catch {
      /* ignore */
    }
  }, []);

  /** Cross-tab sync. */
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== PREFERENCES_STORAGE_KEY) return;
      if (!e.newValue) {
        setPrefs(DEFAULT_PREFERENCES);
        return;
      }
      try {
        const parsed: unknown = JSON.parse(e.newValue);
        if (isPreferences(parsed)) {
          setPrefs(parsed);
        } else if (parsed && typeof parsed === 'object') {
          setPrefs(withDefaults(parsed as Partial<Preferences>));
        }
      } catch {
        /* ignore malformed cross-tab payloads */
      }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return (
    <PreferencesContext.Provider value={{ prefs, setPref, resetPrefs }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used inside <PreferencesProvider>');
  return ctx;
}
