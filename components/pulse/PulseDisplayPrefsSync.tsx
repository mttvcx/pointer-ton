'use client';

import { useEffect } from 'react';
import { usePreferences } from '@/components/preferences/PreferencesProvider';

/** Tabled row layout was removed — keep rows pinned to compact for everyone. */
export function PulseDisplayPrefsSync() {
  const { prefs, setPref } = usePreferences();

  useEffect(() => {
    if (prefs.rowDensity !== 'compact') setPref('rowDensity', 'compact');
  }, [prefs.rowDensity, setPref]);

  return null;
}
