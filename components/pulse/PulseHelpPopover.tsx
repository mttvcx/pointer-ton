'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CircleHelp } from 'lucide-react';
import { pulseIconBtnCls } from '@/components/pulse/pulseToolbarStyles';
import { useOverlayPresence, POPOVER_ANIM_CLOSE_MS } from '@/lib/hooks/useOverlayPresence';
import { popoverPanelClasses } from '@/lib/ui/overlayMotion';
import { PortalToBody } from '@/lib/ui/portalToBody';
import { cn } from '@/lib/utils/cn';

const TIPS = [
  {
    title: 'Display',
    body: 'MC size, quick-buy chips, Layout/Metrics/Row/Extras tabs — matches Axiom Display.',
  },
  {
    title: 'Column presets',
    body: 'Each column has P1–P3. Filters, sort, and quick-buy amount are saved per preset.',
  },
  {
    title: 'Quick buy',
    body: 'Set SOL size with the lightning chip in the column header, then use the green buy on each row.',
  },
  {
    title: 'Hidden & blacklist',
    body: 'Eye hides tokens from the feed. Bookmark blocks devs and handles — manage lists in the modal.',
  },
  {
    title: 'Autolaunch',
    body: 'Rocket toggles auto deploy/buy on X Monitor rules without clicking each alert.',
  },
  {
    title: 'Watchlist ticker',
    body: 'Star a token on its page to pin it under the nav bar. Gear icon opens watchlist settings.',
  },
] as const;

/** Axiom-style ? help — compact popover, not the release-notes modal. */
export function PulseHelpPopover() {
  const [open, setOpen] = useState(false);
  const { mounted, visible } = useOverlayPresence(open, POPOVER_ANIM_CLOSE_MS);
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
        title="Help with recommended settings"
        className={cn(pulseIconBtnCls, open && 'border-white/[0.12] bg-bg-hover/75 text-fg-primary')}
        aria-label="Help with recommended settings"
      >
        <CircleHelp className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
      </button>

      {mounted ? (
        <PortalToBody>
          <div
            ref={popoverRef}
            role="dialog"
            aria-label="Pulse help"
            className={cn(
              'fixed z-[200] w-[min(18rem,calc(100vw-1rem))] rounded-lg border border-white/[0.08] bg-bg-raised p-3 shadow-2xl',
              popoverPanelClasses(visible),
            )}
            style={{ top: coords.top, right: coords.right }}
          >
          <p className="text-[11px] font-medium uppercase tracking-wide text-fg-muted">
            Recommended settings
          </p>
          <ul className="mt-2 max-h-[min(60vh,20rem)] space-y-2.5 overflow-y-auto">
            {TIPS.map((tip) => (
              <li key={tip.title}>
                <p className="text-[12px] font-semibold text-fg-primary">{tip.title}</p>
                <p className="mt-0.5 text-[11px] leading-snug text-fg-muted">{tip.body}</p>
              </li>
            ))}
          </ul>
        </div>
        </PortalToBody>
      ) : null}
    </div>
  );
}
