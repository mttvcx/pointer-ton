'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown, LayoutList, Monitor, RotateCcw } from 'lucide-react';
import { pulsePillBtnCls } from '@/components/pulse/pulseToolbarStyles';
import { usePreferences } from '@/components/preferences/PreferencesProvider';
import {
  PrefField,
  PrefToggle,
  SegmentedControl,
} from '@/components/preferences/controls';
import { SettingsPopoverPortal } from '@/components/ui/SettingsPopoverPortal';
import { useOverlayPresence, SETTINGS_POPOVER_ANIM_CLOSE_MS } from '@/lib/hooks/useOverlayPresence';
import { cn } from '@/lib/utils/cn';

/**
 * Top-bar tear-off for the same preferences surface that lives in the
 * settings modal. Anchored to its trigger button; closes on outside click +
 * ESC. Changes propagate through `PreferencesProvider` so the modal version
 * and this popover stay in sync.
 */
type DisplayPopoverProps = {
  variant?: 'topbar' | 'pulse';
};

export function DisplayPopover({ variant = 'topbar' }: DisplayPopoverProps) {
  const isPulse = variant === 'pulse';
  const [open, setOpen] = useState(false);
  const { mounted, visible } = useOverlayPresence(open, SETTINGS_POPOVER_ANIM_CLOSE_MS);
  const { prefs, setPref, resetPrefs } = usePreferences();
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [coords, setCoords] = useState({ top: 0, right: 0 });

  function updatePosition() {
    const el = buttonRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setCoords({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) });
  }

  useLayoutEffect(() => {
    if (!mounted || !visible) return;
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [mounted, visible]);

  useEffect(() => {
    if (!open) return;
    function onMouse(e: MouseEvent) {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if (buttonRef.current?.contains(target)) return;
      setOpen(false);
    }
    window.addEventListener('mousedown', onMouse);
    return () => window.removeEventListener('mousedown', onMouse);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Display preferences"
        className={
          isPulse
            ? pulsePillBtnCls
            : 'flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-fg-secondary transition-colors hover:bg-bg-hover hover:text-fg-primary lg:px-2.5'
        }
      >
        {isPulse ? (
          <LayoutList className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
        ) : (
          <Monitor className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
        )}
        <span className={isPulse ? 'inline' : 'hidden lg:inline'}>Display</span>
        {isPulse ? (
          <ChevronDown className="h-3 w-3 shrink-0 text-fg-muted" strokeWidth={2.25} aria-hidden />
        ) : null}
      </button>

      <SettingsPopoverPortal
        mounted={mounted}
        visible={visible}
        onClose={() => setOpen(false)}
        popoverRef={popoverRef}
        aria-label="Display preferences"
        panelClassName="w-72 rounded-lg border border-border-subtle bg-bg-raised p-3 shadow-2xl"
        style={{ top: coords.top, right: coords.right }}
      >
          <header className="mb-3 flex items-center justify-between border-b border-border-subtle pb-2">
            <h3 className="text-xs font-semibold tracking-tight text-fg-primary">Display</h3>
            <button
              type="button"
              onClick={resetPrefs}
              title="Reset to defaults"
              className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-fg-muted transition-colors hover:text-fg-secondary"
            >
              <RotateCcw className="h-3 w-3" aria-hidden />
              Reset
            </button>
          </header>

          <div className="space-y-4">
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
      </SettingsPopoverPortal>
    </div>
  );
}
