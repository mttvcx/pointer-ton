'use client';

import { createPortal } from 'react-dom';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Bug, ChevronDown, ChevronRight, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  BUG_CATEGORY_OPTIONS,
  BUG_SEVERITY_OPTIONS,
  type BugReportCategoryId,
  type BugReportPayload,
  type BugSeverityId,
} from '@/lib/reports/bugReportModel';
import {
  buildBugReportPayload,
  collectBugReportContext,
  useBugReportWarmData,
  POINTER_APP_VERSION_LABEL,
  deriveRouteHints,
} from '@/lib/reports/buildBugReportPayload';
import { submitBugReport } from '@/lib/reports/submitBugReport';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { useUIStore } from '@/store/ui';
import type { EntityRef } from '@/store/ui';
import { cn } from '@/lib/utils/cn';

function entityRefFromLock(
  locked: { type: 'token' | 'wallet'; id: string; label?: string } | null,
): EntityRef | null {
  if (!locked) return null;
  return { type: locked.type, id: locked.id, label: locked.label };
}

export function DiagnosticsTriggerButton({
  onClick,
  className,
  compactMobile,
}: {
  onClick: () => void;
  className?: string;
  /** When false, hides text label — icon only (mobile dock). */
  compactMobile?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title="Diagnostics · report issue (no keys / tokens)"
      className={cn(
        'btn-press inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-semibold text-[#4b5563] transition hover:bg-white/5 hover:text-[#cbd5f5]',
        className,
      )}
    >
      <Bug className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
      <span className={cn(compactMobile ? 'hidden sm:inline' : 'inline')}>Diagnostics</span>
    </button>
  );
}

export function BugReportDrawer({
  open,
  onClose,
  connectionStatusLabel,
  regionLabel,
}: {
  open: boolean;
  onClose: () => void;
  connectionStatusLabel?: string | null;
  regionLabel?: string | null;
}) {
  const pathname = usePathname() ?? '/';
  const { authenticated } = usePointerAuth();
  const activeChain = useUIStore((s) => s.activeChain);
  const hoveredEntity = useUIStore((s) => s.hoveredEntity);
  const lockedRaw = useUIStore((s) => s.lockedEntity);
  const pulseMint = useUIStore((s) => s.trackPulseHighlightMint);
  const { activeMasked, activeLabel, myWalletsPending } = useBugReportWarmData();

  const [category, setCategory] = useState<BugReportCategoryId>('other');
  const [severity, setSeverity] = useState<BugSeverityId>('minor');
  const [description, setDescription] = useState('');
  const [screenshotOptIn, setScreenshotOptIn] = useState(false);
  const [ctxOpen, setCtxOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const handleClose = useCallback(() => {
    // Reset on close so the next open lands on a fresh form.
    setDone(false);
    setCtxOpen(false);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    function onEsc(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      handleClose();
    }
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [open, handleClose]);

  const lockedEntity = entityRefFromLock(lockedRaw);

  const previewContext = useMemo(() => {
    if (!mounted) return null;
    return collectBugReportContext({
      pathname,
      activeChain,
      authenticated,
      hoveredEntity,
      lockedEntity,
      pulseFlashMint: pulseMint,
      activeWalletMasked: authenticated ? activeMasked : null,
      activeWalletLabel: authenticated ? activeLabel : null,
      connectionStatus: connectionStatusLabel ?? null,
      region: regionLabel ?? null,
      includeScreenshotRequested: screenshotOptIn,
    });
  }, [
    mounted,
    pathname,
    activeChain,
    authenticated,
    hoveredEntity,
    lockedEntity,
    pulseMint,
    activeMasked,
    activeLabel,
    connectionStatusLabel,
    regionLabel,
    screenshotOptIn,
  ]);

  const routeHints = deriveRouteHints(pathname);

  const onSubmit = useCallback(async () => {
    if (!description.trim() || description.trim().length < 6) {
      toast.error('Add a short description (6+ characters).');
      return;
    }
    setSubmitting(true);
    try {
      const payload: BugReportPayload = buildBugReportPayload(
        {
          category,
          severity,
          description,
          includeScreenshotRequested: screenshotOptIn,
        },
        {
          pathname,
          activeChain,
          authenticated,
          hoveredEntity,
          lockedEntity,
          pulseFlashMint: pulseMint,
          activeWalletMasked: authenticated ? activeMasked : null,
          activeWalletLabel: authenticated ? activeLabel : null,
          connectionStatus: connectionStatusLabel ?? null,
          region: regionLabel ?? null,
        },
      );
      const res = await submitBugReport(payload);
      if (!res.ok) {
        toast.error(res.error ?? 'Report failed');
        return;
      }
      setDone(true);
      setDescription('');
    } finally {
      setSubmitting(false);
    }
  }, [
    description,
    category,
    severity,
    screenshotOptIn,
    pathname,
    activeChain,
    authenticated,
    hoveredEntity,
    lockedEntity,
    pulseMint,
    activeMasked,
    activeLabel,
    connectionStatusLabel,
    regionLabel,
  ]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pointer-diagnostics-title"
      className={cn(
        'fixed inset-0 z-[560] flex items-center justify-center p-3 sm:p-8',
        'bg-black/65 backdrop-blur-xl',
        'animate-in fade-in duration-300',
      )}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        className={cn(
          'relative flex w-full max-h-[calc(100dvh-48px)] max-w-[460px] flex-col overflow-hidden rounded-[18px]',
          'border border-white/[0.09] bg-background shadow-[0_40px_120px_-52px_rgba(0,0,0,0.95)]',
          'animate-in zoom-in-[0.985] fade-in duration-300 ease-out',
        )}
      >
        <button
          type="button"
          onClick={handleClose}
          className="absolute right-3 top-3 z-10 rounded-md p-1.5 text-white/45 transition-colors hover:bg-white/[0.07] hover:text-foreground"
          aria-label="Close diagnostics"
        >
          <X className="h-4 w-4" strokeWidth={2} aria-hidden />
        </button>

        <header className="shrink-0 border-b border-border/50 px-5 pb-4 pt-5">
          <div className="flex items-center gap-2">
            <Bug className="h-4 w-4 text-muted-foreground" strokeWidth={2} aria-hidden />
            <h2
              id="pointer-diagnostics-title"
              className="text-sm font-semibold tracking-tight text-foreground"
            >
              Diagnostics
            </h2>
          </div>
          <p className="mt-1 text-xs leading-snug text-muted-foreground">
            Terminal issue report — no keys or tokens are collected.
          </p>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 text-xs text-muted-foreground">
          {done ? (
            <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-xs font-medium text-emerald-200">
              Report sent. We&apos;ll review it shortly.
            </p>
          ) : (
            <>
              <div className="space-y-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                  Category
                </span>
                <div className="flex flex-wrap gap-1">
                  {BUG_CATEGORY_OPTIONS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCategory(c.id)}
                      className={cn(
                        'btn-press inline-flex h-7 items-center rounded-md px-2.5 text-xs font-medium transition-colors',
                        category === c.id
                          ? 'bg-sky-500/15 text-sky-200'
                          : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
                      )}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                  Severity
                </span>
                <div className="flex flex-wrap gap-1">
                  {BUG_SEVERITY_OPTIONS.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSeverity(s.id)}
                      className={cn(
                        'btn-press inline-flex h-7 items-center rounded-md px-2.5 text-xs font-medium transition-colors',
                        severity === s.id
                          ? s.id === 'urgent_funds'
                            ? 'bg-rose-500/15 text-rose-200'
                            : 'bg-amber-500/12 text-amber-100'
                          : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="mt-4 block">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                  What happened
                </span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                  maxLength={12000}
                  placeholder="Route, expected vs actual, timestamps if relevant…"
                  className="mt-1.5 w-full resize-y rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-xs leading-snug text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-sky-500/50"
                />
              </label>

              <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-md border border-dashed border-border/60 px-3 py-2">
                <input
                  type="checkbox"
                  checked={screenshotOptIn}
                  onChange={(e) => setScreenshotOptIn(e.target.checked)}
                  className="mt-0.5 h-3 w-3 rounded border-border bg-background"
                />
                <span className="text-[11px] leading-snug text-muted-foreground">
                  Request screenshot capture in a future build (flag only — nothing is uploaded yet).
                </span>
              </label>

              <button
                type="button"
                onClick={() => setCtxOpen((o) => !o)}
                className="mt-4 flex w-full items-center justify-between gap-2 rounded-md border border-border/60 bg-muted/10 px-3 py-1.5 text-left text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
              >
                <span>Context snapshot (auto)</span>
                {ctxOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
              {ctxOpen && previewContext ? (
                <pre
                  className="mt-2 max-h-44 overflow-auto rounded-md border border-border/60 bg-muted/10 p-3 text-[10px] leading-relaxed text-muted-foreground/90"
                  style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}
                >
                  {JSON.stringify(
                    {
                      route: previewContext.route,
                      chain: previewContext.activeChain,
                      build: previewContext.appVersion,
                      viewport: previewContext.viewport,
                      tokenHints: previewContext.tokenMintHints,
                      walletMasked: previewContext.activeWalletMasked,
                      walletLabel: previewContext.activeWalletLabel,
                      walletPage: previewContext.walletPageMasked,
                      region: previewContext.region,
                      connectivity: previewContext.connectionStatus,
                      signedIn: previewContext.sessionAuthenticated,
                      recentErrors: (previewContext.recentClientErrors ?? []).length,
                    },
                    null,
                    2,
                  )}
                </pre>
              ) : null}

              {myWalletsPending ? (
                <p className="mt-3 text-[11px] text-muted-foreground/70">Resolving active wallet label…</p>
              ) : null}
              {routeHints.tokenMint ? (
                <p className="mt-1 text-[11px] text-muted-foreground/70">
                  Token route mint:{' '}
                  <span className="font-mono text-muted-foreground">
                    {routeHints.tokenMint.length > 12
                      ? `${routeHints.tokenMint.slice(0, 10)}…`
                      : routeHints.tokenMint}
                  </span>
                </p>
              ) : null}
            </>
          )}
        </div>

        {!done ? (
          <footer className="shrink-0 border-t border-border/50 bg-muted/10 px-5 py-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
                v{POINTER_APP_VERSION_LABEL}
              </span>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void onSubmit()}
                className="btn-press inline-flex h-8 min-w-[7.5rem] items-center justify-center gap-1.5 rounded-md bg-sky-500/15 px-3 text-xs font-semibold text-sky-100 transition-colors hover:bg-sky-500/25 disabled:opacity-50"
              >
                {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Send report
              </button>
            </div>
          </footer>
        ) : (
          <footer className="shrink-0 border-t border-border/50 bg-muted/10 px-5 py-3">
            <button
              type="button"
              onClick={handleClose}
              className="btn-press inline-flex h-8 w-full items-center justify-center rounded-md bg-muted/40 text-xs font-semibold text-foreground transition-colors hover:bg-muted/60"
            >
              Close
            </button>
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}
