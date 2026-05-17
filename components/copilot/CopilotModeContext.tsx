'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

/**
 * Task R — co-pilot layout mode.
 *
 * - `embedded` (default): full panel lives in the top strip below the topbar.
 * - `minimized`: only the strip header is shown; expanded body collapsed.
 * - `sidebar`: panel is hidden from the top zone; the existing right-rail
 *   `AICopilotPanel` takes over (its visibility is coordinated by the
 *   callers of `setMode`).
 *
 * Mode is persisted in localStorage and synced across tabs.
 */
export type CopilotMode = 'embedded' | 'minimized' | 'sidebar';

const STORAGE_KEY = 'pointer.copilot.mode';
const DEFAULT_MODE: CopilotMode = 'embedded';

interface CopilotModeContextValue {
  mode: CopilotMode;
  setMode: (mode: CopilotMode) => void;
}

const CopilotModeContext = createContext<CopilotModeContextValue | undefined>(undefined);

function isValidMode(value: unknown): value is CopilotMode {
  return value === 'embedded' || value === 'minimized' || value === 'sidebar';
}

export function CopilotModeProvider({ children }: { children: ReactNode }) {
  // SSR-safe initializer: default until the client effect rehydrates from
  // localStorage. We avoid reading `window` during render to keep the markup
  // stable for hydration.
  const [mode, setModeState] = useState<CopilotMode>(DEFAULT_MODE);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (isValidMode(stored)) setModeState(stored);
    } catch {
      /* ignore — private mode / storage disabled */
    }
  }, []);

  const setMode = useCallback((next: CopilotMode) => {
    setModeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  // Cross-tab sync: if the user changes mode in another tab, mirror it here.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && isValidMode(e.newValue)) {
        setModeState(e.newValue);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return (
    <CopilotModeContext.Provider value={{ mode, setMode }}>
      {children}
    </CopilotModeContext.Provider>
  );
}

export function useCopilotMode() {
  const ctx = useContext(CopilotModeContext);
  if (!ctx) throw new Error('useCopilotMode must be used inside CopilotModeProvider');
  return ctx;
}
