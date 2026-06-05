'use client';

import { createPortal } from 'react-dom';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Bug, Camera, ChevronDown, ChevronRight, Loader2, X } from 'lucide-react';
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
import {
  captureDiagnosticsScreenshot,
  downloadScreenshotDataUrl,
} from '@/lib/reports/captureDiagnosticsScreenshot';
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
        'btn-press inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-fg-muted transition hover:bg-white/[0.06] hover:text-fg-primary',
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
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [capturingShot, setCapturingShot] = useState(false);
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
    setScreenshotPreview(null);
    setScreenshotOptIn(false);
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
      screenshotDataUrl: screenshotPreview,
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
    screenshotPreview,
  ]);

  const routeHints = deriveRouteHints(pathname);

  async function onSaveScreenshot() {
    const toastId = toast.loading('Capturing screenshot…');
    try {
      const dataUrl = await captureDiagnosticsScreenshot();
      if (!dataUrl) {
        toast.error('Could not capture screenshot', { id: toastId });
        return;
      }
      downloadScreenshotDataUrl(dataUrl);
      toast.success('Screenshot saved', { id: toastId });
    } catch {
      toast.error('Screenshot failed', { id: toastId });
    }
  }

  async function onToggleScreenshot(checked: boolean) {
    setScreenshotOptIn(checked);
    if (!checked) {
      setScreenshotPreview(null);
      return;
    }
    setCapturingShot(true);
    try {
      const dataUrl = await captureDiagnosticsScreenshot();
      setScreenshotPreview(dataUrl);
      if (!dataUrl) toast.error('Could not capture screenshot');
    } finally {
      setCapturingShot(false);
    }
  }

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
          screenshotDataUrl: screenshotPreview,
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
    screenshotPreview,
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
      data-diagnostics-overlay
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
        data-diagnostics-overlay
        className={cn(
          'relative flex w-full max-h-[calc(100dvh-48px)] max-w-[460px] flex-col overflow-hidden rounded-xl',
          'border border-white/[0.08] bg-bg-raised shadow-[0_40px_120px_-52px_rgba(0,0,0,0.95)]',
          'animate-in zoom-in-[0.985] fade-in duration-300 ease-out',
        )}
      >
        <button
          type="button"
          onClick={handleClose}
          className="absolute right-3 top-3 z-10 rounded-md p-1.5 text-fg-muted transition-colors hover:bg-white/[0.07] hover:text-fg-primary"
          aria-label="Close diagnostics"
        >
          <X className="h-4 w-4" strokeWidth={2} aria-hidden />
        </button>

        <header className="shrink-0 border-b border-white/[0.06] px-5 pb-4 pt-5 pr-12">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <Bug className="h-4 w-4 shrink-0 text-fg-muted" strokeWidth={2} aria-hidden />
              <h2
                id="pointer-diagnostics-title"
                className="text-sm font-semibold tracking-tight text-fg-primary"
              >
                Diagnostics
              </h2>
            </div>
            <button
              type="button"
              onClick={() => void onSaveScreenshot()}
              className="btn-press inline-flex shrink-0 items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-fg-secondary transition hover:bg-white/[0.07] hover:text-fg-primary"
            >
              <Camera className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              Screenshot
            </button>
          </div>
          <p className="mt-1 text-xs leading-snug text-fg-muted">
            Report issues or save a screenshot. No keys or tokens are collected.
          </p>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 text-xs text-fg-muted">
          {done ? (
            <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-xs font-medium text-emerald-200">
              Report sent. We&apos;ll review it shortly.
            </p>
          ) : (
            <>
              <div className="space-y-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-fg-muted">
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
                          ? 'bg-white/[0.1] text-fg-primary'
                          : 'text-fg-muted hover:bg-white/[0.06] hover:text-fg-secondary',
                      )}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-fg-muted">
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
                            ? 'bg-signal-bear/15 text-signal-bear'
                            : 'bg-signal-warn/12 text-signal-warn'
                          : 'text-fg-muted hover:bg-white/[0.06] hover:text-fg-secondary',
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="mt-4 block">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-fg-muted">
                  What happened
                </span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                  maxLength={12000}
                  placeholder="Route, expected vs actual, timestamps if relevant…"
                  className="mt-1.5 w-full resize-y rounded-lg border-0 bg-white/[0.04] px-3 py-2 text-xs leading-snug text-fg-primary outline-none placeholder:text-fg-muted/70 focus:bg-white/[0.06] focus:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
                />
              </label>

              <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-lg border border-dashed border-white/[0.1] px-3 py-2">
                <input
                  type="checkbox"
                  checked={screenshotOptIn}
                  disabled={capturingShot}
                  onChange={(e) => void onToggleScreenshot(e.target.checked)}
                  className="mt-0.5 h-3 w-3 rounded accent-accent-primary"
                />
                <span className="text-[11px] leading-snug text-fg-muted">
                  {capturingShot ? 'Capturing screenshot…' : 'Attach screenshot with this report'}
                </span>
              </label>
              {screenshotPreview ? (
                <div className="mt-2 overflow-hidden rounded-lg border border-white/[0.08]">
                  {/* eslint-disable-next-line @next/next/no-img-element -- data URL preview */}
                  <img src={screenshotPreview} alt="Screenshot preview" className="max-h-28 w-full object-cover object-top" />
                  <div className="flex justify-end gap-2 border-t border-white/[0.06] px-2 py-1.5">
                    <button
                      type="button"
                      className="text-[10px] font-medium text-fg-muted hover:text-fg-secondary"
                      onClick={() => downloadScreenshotDataUrl(screenshotPreview)}
                    >
                      Download
                    </button>
                  </div>
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => setCtxOpen((o) => !o)}
                className="mt-4 flex w-full items-center justify-between gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-left text-[11px] font-medium text-fg-muted transition-colors hover:bg-white/[0.06] hover:text-fg-secondary"
              >
                <span>Context snapshot (auto)</span>
                {ctxOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
              {ctxOpen && previewContext ? (
                <pre
                  className="mt-2 max-h-44 overflow-auto rounded-lg border border-white/[0.08] bg-white/[0.03] p-3 text-[10px] leading-relaxed text-fg-muted"
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
          <footer className="shrink-0 border-t border-white/[0.06] bg-bg-raised px-5 py-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] uppercase tracking-wider text-fg-muted">
                v{POINTER_APP_VERSION_LABEL}
              </span>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void onSubmit()}
                className="btn-press inline-flex h-8 min-w-[7.5rem] items-center justify-center gap-1.5 rounded-lg bg-white/[0.1] px-3 text-xs font-semibold text-fg-primary transition-colors hover:bg-white/[0.14] disabled:opacity-50"
              >
                {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Send report
              </button>
            </div>
          </footer>
        ) : (
          <footer className="shrink-0 border-t border-white/[0.06] bg-bg-raised px-5 py-3">
            <button
              type="button"
              onClick={handleClose}
              className="btn-press inline-flex h-8 w-full items-center justify-center rounded-lg bg-white/[0.08] text-xs font-semibold text-fg-primary transition-colors hover:bg-white/[0.12]"
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
