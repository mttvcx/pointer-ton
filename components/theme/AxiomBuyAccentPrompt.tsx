'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Zap } from 'lucide-react';
import { useTheme } from '@/components/theme/ThemeProvider';
import { usePulseDisplayPrefsStore } from '@/store/pulseDisplayPrefs';
import { useThemeAccentPromptStore } from '@/store/themeAccentPrompt';
import { AXIOM_BUY_ACCENT_HEX } from '@/lib/ui/pulseAccent';
import { cn } from '@/lib/utils/cn';

/**
 * One-time nudge: when the Axiom theme is active but the Quick-Buy button isn't
 * Axiom's blue, offer to match it. "Don't ask again" persists a permanent
 * dismissal; either action stops the nag for the session. New users already
 * default to Axiom blue, so this only ever shows for users who customized.
 */
export function AxiomBuyAccentPrompt() {
  const { theme } = useTheme();
  const accentHex = usePulseDisplayPrefsStore((s) => s.accentHex);
  const setPrefs = usePulseDisplayPrefsStore((s) => s.setPrefs);
  const dismissedForever = useThemeAccentPromptStore((s) => s.dismissedForever);
  const sessionDismissed = useThemeAccentPromptStore((s) => s.sessionDismissed);
  const setDismissedForever = useThemeAccentPromptStore((s) => s.setDismissedForever);
  const dismissSession = useThemeAccentPromptStore((s) => s.dismissSession);

  const [mounted, setMounted] = useState(false);
  const [dontAsk, setDontAsk] = useState(false);
  useEffect(() => setMounted(true), []);

  const eligible =
    theme === 'axiom' &&
    accentHex.toLowerCase() !== AXIOM_BUY_ACCENT_HEX.toLowerCase() &&
    !dismissedForever &&
    !sessionDismissed;

  if (!mounted || !eligible) return null;

  const finish = (persistForever: boolean) => {
    if (persistForever || dontAsk) setDismissedForever(true);
    dismissSession();
  };

  return createPortal(
    <div
      role="dialog"
      aria-label="Match Axiom's blue Quick Buy button"
      className="fixed bottom-[calc(var(--app-bottombar-h,44px)+14px)] left-1/2 z-[520] w-[min(360px,calc(100vw-24px))] -translate-x-1/2 animate-in fade-in slide-in-from-bottom-2 duration-200"
    >
      <div className="overflow-hidden rounded-xl border border-border-subtle bg-bg-raised shadow-2xl">
        <div className="flex items-start gap-3 px-3.5 py-3">
          <span
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${AXIOM_BUY_ACCENT_HEX}22`, border: `1px solid ${AXIOM_BUY_ACCENT_HEX}55` }}
          >
            <Zap className="h-4 w-4" strokeWidth={2.25} style={{ color: AXIOM_BUY_ACCENT_HEX }} />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-fg-primary">Match Axiom&apos;s blue Quick Buy?</p>
            <p className="mt-0.5 text-[11px] leading-snug text-fg-muted">
              Your Quick-Buy button is a custom color. Switch it to Axiom&apos;s signature blue to
              match the theme?
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border-subtle px-3.5 py-2.5">
          <label className="flex cursor-pointer select-none items-center gap-1.5 text-[10px] text-fg-muted">
            <input
              type="checkbox"
              checked={dontAsk}
              onChange={(e) => setDontAsk(e.target.checked)}
              className="h-3 w-3 accent-[color:var(--accent-primary)]"
            />
            Don&apos;t ask again
          </label>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => finish(false)}
              className="rounded-md border border-border-subtle bg-bg-sunken px-2.5 py-1 text-[11px] font-medium text-fg-secondary transition hover:bg-bg-hover hover:text-fg-primary"
            >
              Keep mine
            </button>
            <button
              type="button"
              onClick={() => {
                setPrefs({ accentHex: AXIOM_BUY_ACCENT_HEX });
                finish(false);
              }}
              className={cn(
                'rounded-md px-2.5 py-1 text-[11px] font-semibold text-white transition hover:brightness-110',
              )}
              style={{ backgroundColor: AXIOM_BUY_ACCENT_HEX }}
            >
              Use Axiom blue
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
