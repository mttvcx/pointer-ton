'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Rocket } from 'lucide-react';
import { pulseIconBtnCls } from '@/components/pulse/pulseToolbarStyles';
import { PrefToggle } from '@/components/preferences/controls';
import { useOverlayPresence, POPOVER_ANIM_CLOSE_MS } from '@/lib/hooks/useOverlayPresence';
import { popoverPanelClasses } from '@/lib/ui/overlayMotion';
import { PortalToBody } from '@/lib/ui/portalToBody';
import { useAutoLaunchStore } from '@/store/autoLaunch';
import { cn } from '@/lib/utils/cn';

/** Pulse toolbar autolaunch control (Pointer-specific). */
export function PulseAutolaunchPopover() {
  const [open, setOpen] = useState(false);
  const { mounted, visible } = useOverlayPresence(open, POPOVER_ANIM_CLOSE_MS);
  const enabled = useAutoLaunchStore((s) => s.autoLaunchEnabled);
  const launchMode = useAutoLaunchStore((s) => s.launchMode);
  const launchBuySol = useAutoLaunchStore((s) => s.launchBuySol);
  const setPrefs = useAutoLaunchStore((s) => s.setPrefs);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
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
    <div className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Autolaunch"
        className={cn(
          pulseIconBtnCls,
          enabled && 'border-accent-primary/35 text-accent-primary hover:text-accent-primary',
        )}
      >
        <Rocket className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
      </button>

      {mounted ? (
        <PortalToBody>
          <div
            ref={popoverRef}
            role="dialog"
            aria-label="Autolaunch"
            className={cn(
              'fixed z-[200] w-64 rounded-lg border border-white/[0.08] bg-bg-raised p-3 shadow-2xl',
              popoverPanelClasses(visible),
            )}
            style={{ top: coords.top, right: coords.right }}
          >
          <h3 className="mb-2 text-xs font-semibold text-fg-primary">Autolaunch</h3>
          <p className="mb-3 text-[11px] leading-snug text-fg-muted">
            Deploy and buy on new token signals from X Monitor rules.
          </p>
          <div className="space-y-3">
            <PrefToggle
              label="Autolaunch enabled"
              description="Fire rules without clicking."
              value={enabled}
              onChange={(v) => setPrefs({ autoLaunchEnabled: v })}
            />
            <div className="flex gap-1">
              {(['ai', 'manual'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setPrefs({ launchMode: mode })}
                  className={cn(
                    'flex-1 rounded-sm border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide transition',
                    launchMode === mode
                      ? 'border-accent-primary/40 bg-accent-primary/12 text-accent-primary'
                      : 'border-white/[0.08] text-fg-muted hover:text-fg-secondary',
                  )}
                >
                  {mode === 'ai' ? 'AI' : 'Manual'}
                </button>
              ))}
            </div>
            <label className="block text-[11px] text-fg-muted">
              Launch buy (SOL)
              <input
                type="number"
                min={0}
                step={0.01}
                value={launchBuySol}
                onChange={(e) => {
                  const n = parseFloat(e.target.value);
                  if (Number.isFinite(n) && n >= 0) setPrefs({ launchBuySol: n });
                }}
                className="mt-1 w-full rounded-sm border border-white/[0.08] bg-bg-sunken px-2 py-1 font-mono text-xs text-fg-primary"
              />
            </label>
          </div>
        </div>
        </PortalToBody>
      ) : null}
    </div>
  );
}
