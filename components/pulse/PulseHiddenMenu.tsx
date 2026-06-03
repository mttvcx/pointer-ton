'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Check, EyeOff } from 'lucide-react';
import { pulseIconBtnCls } from '@/components/pulse/pulseToolbarStyles';
import { useOverlayPresence, POPOVER_ANIM_CLOSE_MS } from '@/lib/hooks/useOverlayPresence';
import { popoverPanelClasses } from '@/lib/ui/overlayMotion';
import { PortalToBody } from '@/lib/ui/portalToBody';
import { usePulseHiddenMintsStore } from '@/store/pulseHiddenMints';
import { cn } from '@/lib/utils/cn';

function MenuRow({
  label,
  checked,
  onSelect,
  kind,
}: {
  label: string;
  checked: boolean;
  onSelect: () => void;
  kind: 'check' | 'radio';
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center justify-between gap-3 rounded-sm px-2 py-1.5 text-left text-[13px] text-fg-primary transition-colors hover:bg-bg-hover"
    >
      <span>{label}</span>
      {kind === 'check' ? (
        checked ? (
          <Check className="h-3.5 w-3.5 shrink-0 text-fg-primary" strokeWidth={2.5} aria-hidden />
        ) : (
          <span className="h-3.5 w-3.5 shrink-0" aria-hidden />
        )
      ) : (
        <span
          className={cn(
            'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border',
            checked
              ? 'border-accent-primary bg-accent-primary'
              : 'border-white/[0.2] bg-transparent',
          )}
          aria-hidden
        >
          {checked ? <span className="h-1.5 w-1.5 rounded-full bg-fg-inverse" /> : null}
        </span>
      )}
    </button>
  );
}

/** Axiom-style hidden-token visibility menu. */
export function PulseHiddenMenu() {
  const [open, setOpen] = useState(false);
  const { mounted, visible } = useOverlayPresence(open, POPOVER_ANIM_CLOSE_MS);
  const showHidden = usePulseHiddenMintsStore((s) => s.showHiddenTokens);
  const unhideOnMigration = usePulseHiddenMintsStore((s) => s.unhideOnMigration);
  const setShowHidden = usePulseHiddenMintsStore((s) => s.setShowHiddenTokens);
  const setUnhideOnMigration = usePulseHiddenMintsStore((s) => s.setUnhideOnMigration);

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
        aria-haspopup="menu"
        aria-expanded={open}
        title="Hidden tokens"
        className={pulseIconBtnCls}
      >
        <EyeOff className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
      </button>

      {mounted ? (
        <PortalToBody>
        <div
          ref={popoverRef}
          role="menu"
          aria-label="Hidden tokens"
          className={cn(
            'fixed z-[200] w-56 rounded-lg border border-white/[0.08] bg-bg-raised p-1 shadow-2xl',
            popoverPanelClasses(visible),
          )}
          style={{ top: coords.top, right: coords.right }}
        >
          <p className="px-2 pb-1 pt-1.5 text-[10px] font-medium uppercase tracking-wide text-fg-muted">
            Show hidden tokens
          </p>
          <MenuRow
            label="Show hidden tokens"
            checked={showHidden}
            kind="check"
            onSelect={() => setShowHidden(true)}
          />
          <MenuRow
            label="Hide hidden tokens"
            checked={!showHidden}
            kind="check"
            onSelect={() => setShowHidden(false)}
          />
          <div className="my-1 border-t border-white/[0.06]" />
          <MenuRow
            label="Unhide on migration"
            checked={unhideOnMigration}
            kind="radio"
            onSelect={() => setUnhideOnMigration(true)}
          />
          <MenuRow
            label="Keep migrated hidden"
            checked={!unhideOnMigration}
            kind="radio"
            onSelect={() => setUnhideOnMigration(false)}
          />
        </div>
        </PortalToBody>
      ) : null}
    </div>
  );
}
