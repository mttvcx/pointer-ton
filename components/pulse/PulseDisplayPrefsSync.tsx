'use client';

import { useEffect } from 'react';
import { usePreferences } from '@/components/preferences/PreferencesProvider';
import { usePulseDisplayPrefsStore } from '@/store/pulseDisplayPrefs';

/** Keeps global PreferencesProvider in sync with Pulse Display (compact tables, etc.). */
export function PulseDisplayPrefsSync() {
  const compactTables = usePulseDisplayPrefsStore((s) => s.compactTables);
  const { prefs, setPref } = usePreferences();

  useEffect(() => {
    const target = compactTables ? 'tabled' : 'compact';
    if (prefs.rowDensity !== target) setPref('rowDensity', target);
  }, [compactTables, prefs.rowDensity, setPref]);

  return null;
}
