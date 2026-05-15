'use client';

import { usePreferences } from '@/components/preferences/PreferencesProvider';
import {
  PrefField,
  PrefToggle,
  SegmentedControl,
} from '@/components/preferences/controls';

/**
 * Modal-form factor of the Display preferences. Same controls as
 * {@link DisplayPopover} (top-bar tear-off), wider layout. State is shared
 * through `PreferencesProvider` so changes here update the popover live and
 * vice versa.
 */
export function DisplayPreferences() {
  const { prefs, setPref } = usePreferences();

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <PrefField label="Row layout">
          <SegmentedControl
            value={prefs.rowDensity}
            onChange={(v) => setPref('rowDensity', v)}
            options={[
              { value: 'compact', label: 'Compact' },
              { value: 'tabled', label: 'Tabled' },
            ]}
          />
        </PrefField>

        <PrefField label="Avatar size">
          <SegmentedControl
            value={prefs.avatarSize}
            onChange={(v) => setPref('avatarSize', v)}
            options={[
              { value: 'small', label: 'Small' },
              { value: 'default', label: 'Default' },
              { value: 'large', label: 'Large' },
            ]}
          />
        </PrefField>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <PrefToggle
          label="Row separators"
          description="Show a hairline between rows."
          value={prefs.rowSeparators}
          onChange={(v) => setPref('rowSeparators', v)}
        />
        <PrefToggle
          label="Row elevation"
          description="Lift rows above the page background."
          value={prefs.rowElevation}
          onChange={(v) => setPref('rowElevation', v)}
        />
        <PrefToggle
          label="Action zone divider"
          description="Separate the trade panel with a vertical line."
          value={prefs.actionZoneDivider}
          onChange={(v) => setPref('actionZoneDivider', v)}
        />
      </div>
    </div>
  );
}
