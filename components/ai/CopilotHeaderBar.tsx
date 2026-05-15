'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  ArrowUp,
  ChevronDown,
  Loader2,
  PanelRight,
  Pin,
  Sparkles,
  X,
} from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { useAlertsTickerQuery } from '@/lib/hooks/useAlertsTicker';
import { useCopilotPillInsight } from '@/lib/hooks/useCopilotPillInsight';
import { selectActiveEntity, useUIStore } from '@/store/ui';
import { POINTER_COPILOT_QUICK_ASK_EVENT } from '@/lib/copilot/quickAsk';
import type { TooltipOutput } from '@/lib/ai/schemas';
import { shortenAddress } from '@/lib/utils/addresses';
import { cn } from '@/lib/utils/cn';

/**
 * Cluely-style co-pilot header bar with a drop-down sheet.
 *
 * Renders inside the top-bar's centered slot. The bar itself is always
 * visible (insight line + sparkle + chevron). Clicking it opens a wide
 * sheet that drops down directly below the bar:
 *   1. bar stretches outward
 *   2. sheet expands downward
 *   3. content fades in inside the sheet
 *
 * The sheet contains:
 *   - mode chips (Explain / Find risks / Build alert / Recap)
 *   - active-entity strip (hovered / locked token or wallet)
 *   - ask input + send + suggestion chips
 *   - latest answer (history of 3)
 *
 * Anchored to the bar's measured rect with a viewport-clamped sheet position
 * so it can never escape the screen when the topbar is near an edge.
 */

const SHEET_GAP_PX = 8;
const SHEET_MAX_WIDTH = 760;
const SHEET_MIN_WIDTH = 420;
const SHEET_SIDE_PAD = 12;

const SUGGESTIONS = [
  'Explain this token',
  'Find risks',
  'Top holders',
  'Bonding curve',
  'LP locked?',
];

type AskResult = {
  data: TooltipOutput;
  cacheHit: boolean;
  modelUsed: string;
  costUsd: number;
};

export function CopilotHeaderBar() {
  const setPanelOpen = useUIStore((s) => s.setPanelOpen);
  const setDetached = useUIStore((s) => s.setCopilotDetached);

  const lockedEntity = useUIStore((s) => s.lockedEntity);
  const hoveredEntity = useUIStore((s) => s.hoveredEntity);
  const clearLocked = useUIStore((s) => s.clearLocked);
  const entity = useUIStore(selectActiveEntity);

  const { data: alertsData } = useAlertsTickerQuery();
  const insight = useCopilotPillInsight(alertsData);

  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const barRef = useRef<HTMLDivElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const [anchor, setAnchor] = useState<{ left: number; top: number; width: number } | null>(
    null,
  );

  const status: 'idle' | 'watching' | 'armed' = lockedEntity
    ? 'armed'
    : hoveredEntity
      ? 'watching'
      : 'idle';

  // Measure the bar and position the sheet right below it; clamp to viewport.
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const r = barRef.current?.getBoundingClientRect();
      if (!r) return;
      const vw = window.innerWidth;
      const desired = Math.min(SHEET_MAX_WIDTH, Math.max(SHEET_MIN_WIDTH, r.width + 80));
      const width = Math.min(desired, vw - SHEET_SIDE_PAD * 2);
      const centerX = r.left + r.width / 2;
      const half = width / 2;
      const left = Math.min(
        Math.max(SHEET_SIDE_PAD, centerX - half),
        Math.max(SHEET_SIDE_PAD, vw - SHEET_SIDE_PAD - width),
      );
      setAnchor({ left, top: r.bottom + SHEET_GAP_PX, width });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open]);

  // Outside-click + Esc to close.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (barRef.current?.contains(t)) return;
      if (sheetRef.current?.contains(t)) return;
      requestClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose();
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function requestClose() {
    if (!open) return;
    setClosing(true);
    window.setTimeout(() => {
      setClosing(false);
      setOpen(false);
    }, 180);
  }

  function openSheet() {
    if (closing) return;
    setOpen(true);
  }

  function openSidePanel() {
    requestClose();
    setDetached(false);
    setPanelOpen(true);
  }

  return (
    <>
      {/* always-visible bar */}
      <div
        ref={barRef}
        data-onboarding="copilot"
        className="pointer-events-auto flex w-full items-stretch"
      >
        <button
          type="button"
          aria-label={open ? 'Close AI co-pilot' : 'Open AI co-pilot'}
          aria-expanded={open}
          title={open ? 'Close co-pilot' : 'Open co-pilot'}
          onClick={() => (open ? requestClose() : openSheet())}
          className={cn(
            'group flex h-9 w-full min-w-0 items-center gap-2 rounded-full border pl-2 pr-1.5 text-left',
            'border-border-subtle bg-bg-raised/85 backdrop-blur-xl',
            'transition-[border-color,background-color,box-shadow] duration-150',
            open
              ? 'border-accent-primary/55 bg-bg-raised shadow-[0_0_22px_-6px_rgb(var(--accent-primary-rgb)/0.55)]'
              : 'hover:border-accent-primary/40 hover:bg-bg-raised hover:shadow-[0_0_22px_-8px_rgb(var(--accent-primary-rgb)/0.45)]',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-primary/40',
          )}
        >
          <span
            className={cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border',
              'border-accent-primary/40 bg-accent-primary/10',
              'shadow-[0_0_12px_-3px_rgb(var(--accent-primary-rgb)/0.55)]',
            )}
          >
            <Sparkles className="h-3.5 w-3.5 text-accent-primary" strokeWidth={2.25} />
          </span>
          <span className="hidden shrink-0 items-center gap-1.5 sm:flex">
            <span className="text-[12px] font-semibold leading-none text-fg-primary">
              Co-pilot
            </span>
            <StatusDot status={status} />
          </span>
          <span className="mx-1 hidden h-3.5 w-px shrink-0 self-center bg-border-subtle sm:block" />
          <span className="min-w-0 flex-1 truncate text-[12px] leading-tight text-fg-secondary">
            {insight.text}
          </span>
          <ChevronDown
            className={cn(
              'ml-1 h-4 w-4 shrink-0 self-center text-fg-muted transition-transform duration-200',
              open && 'rotate-180 text-fg-primary',
            )}
            strokeWidth={2.25}
            aria-hidden
          />
        </button>
      </div>

      {/* drop-down sheet (portaled to body so it overlays everything below the bar) */}
      {open && anchor
        ? createPortal(
            <div
              ref={sheetRef}
              role="dialog"
              aria-modal="false"
              aria-label="Pointer Co-Pilot"
              style={{
                position: 'fixed',
                left: anchor.left,
                top: anchor.top,
                width: anchor.width,
                zIndex: 60,
              }}
              className={cn(
                'rounded-2xl border border-border-subtle bg-bg-raised/95 backdrop-blur-2xl',
                'shadow-[0_24px_60px_-18px_rgba(0,0,0,0.55),0_0_0_1px_rgb(var(--accent-primary-rgb)/0.18)]',
                closing ? 'animate-copilot-sheet-out' : 'animate-copilot-sheet-in',
              )}
            >
              <div className="flex items-center justify-between gap-2 border-b border-border-subtle px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-accent-primary/40 bg-accent-primary/10">
                    <Sparkles className="h-3.5 w-3.5 text-accent-primary" strokeWidth={2.25} />
                  </span>
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold leading-tight text-fg-primary">
                      Pointer Co-Pilot
                    </div>
                    <div className="mt-0.5 text-[10px] text-fg-muted">
                      Ask about anything you see on screen.
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={openSidePanel}
                    className="focus-ring inline-flex h-7 items-center gap-1 rounded-md border border-border-subtle px-2 text-[11px] font-medium text-fg-secondary transition-colors hover:border-accent-primary/40 hover:text-fg-primary"
                    title="Open in side panel"
                  >
                    <PanelRight className="h-3.5 w-3.5" strokeWidth={2.25} />
                    <span className="hidden md:inline">Panel</span>
                  </button>
                  <button
                    type="button"
                    onClick={requestClose}
                    className="focus-ring inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-primary"
                    title="Hide co-pilot"
                  >
                    <ChevronDown className="h-3.5 w-3.5" strokeWidth={2.25} />
                    <span className="hidden md:inline">Hide</span>
                  </button>
                  <button
                    type="button"
                    aria-label="Close"
                    onClick={requestClose}
                    className="focus-ring rounded-md p-1 text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-primary"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={2.25} />
                  </button>
                </div>
              </div>

              <div className="space-y-3 px-3 py-3">
                <EntityChip
                  entity={entity}
                  source={lockedEntity?.source ?? null}
                  onClear={() => clearLocked({ onlyManual: true })}
                />

                <InlineAsk
                  onAnswered={() => {
                    // no-op for now; answer renders inside InlineAsk
                  }}
                />

                <div className="flex flex-wrap items-center gap-1.5">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        window.dispatchEvent(
                          new CustomEvent(POINTER_COPILOT_QUICK_ASK_EVENT, { detail: s }),
                        );
                      }}
                      className="inline-flex h-7 items-center rounded-full border border-border-subtle bg-bg-sunken px-2.5 text-[11px] font-medium text-fg-secondary transition-colors hover:border-accent-primary/40 hover:text-fg-primary"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-border-subtle bg-bg-sunken/60 px-3 py-1.5 text-[10px] text-fg-muted">
                <span className="font-medium">AI · alerts · rules</span>
                <span className="opacity-75">⌘ Enter to send</span>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function StatusDot({ status }: { status: 'idle' | 'watching' | 'armed' }) {
  return (
    <span
      className={cn(
        'flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider',
        status === 'idle'
          ? 'bg-bg-sunken text-fg-muted'
          : status === 'watching'
            ? 'bg-accent-primary/15 text-accent-primary'
            : 'bg-signal-bull/15 text-signal-bull',
      )}
    >
      <span
        className={cn(
          'h-1 w-1 rounded-full',
          status === 'idle'
            ? 'bg-fg-muted'
            : status === 'watching'
              ? 'bg-accent-primary'
              : 'bg-signal-bull',
        )}
        aria-hidden
      />
      {status}
    </span>
  );
}

function EntityChip({
  entity,
  source,
  onClear,
}: {
  entity: ReturnType<typeof selectActiveEntity>;
  source: 'route' | 'manual' | null;
  onClear: () => void;
}) {
  if (!entity) {
    return (
      <div className="rounded-lg border border-dashed border-border-subtle/70 bg-bg-sunken/40 px-3 py-2 text-[11px] text-fg-muted">
        Hover a token row or open a token page to give the co-pilot live context.
      </div>
    );
  }
  const label = entity.label ?? `${entity.type} ${shortenAddress(entity.id, 3)}`;
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-border-subtle bg-bg-sunken/70 px-2.5 py-1.5">
      <div className="flex min-w-0 items-center gap-2">
        <Pin className="h-3 w-3 shrink-0 text-accent-primary" strokeWidth={2.25} />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-fg-muted">
          {entity.type}
        </span>
        <span className="min-w-0 truncate text-[12px] font-medium text-fg-primary">
          {label}
        </span>
        {source === 'manual' ? (
          <span className="rounded bg-accent-primary/15 px-1 py-px text-[9px] font-semibold uppercase tracking-wider text-accent-primary">
            pinned
          </span>
        ) : null}
      </div>
      {source === 'manual' ? (
        <button
          type="button"
          onClick={onClear}
          className="rounded p-1 text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-primary"
          aria-label="Unpin entity"
          title="Unpin"
        >
          <X className="h-3 w-3" strokeWidth={2.25} />
        </button>
      ) : null}
    </div>
  );
}

/** Self-contained ask input that hits /api/ai/tooltip and shows the last 3 answers. */
function InlineAsk({ onAnswered }: { onAnswered: () => void }) {
  const { authenticated, getAccessToken } = usePointerAuth();
  const entity = useUIStore(selectActiveEntity);

  const [term, setTerm] = useState('');
  const [history, setHistory] = useState<AskResult[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const mutation = useMutation({
    mutationFn: async (raw: string) => {
      const t = raw.trim();
      if (!t) throw new Error('empty');
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const context = entity?.label ?? (entity ? `${entity.type} ${entity.id}` : undefined);
      const res = await fetch('/api/ai/tooltip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ term: t, context }),
      });
      const json: unknown = await res.json();
      if (!res.ok) {
        throw new Error(
          typeof json === 'object' && json && 'message' in json
            ? String((json as { message: unknown }).message)
            : `Failed (${res.status})`,
        );
      }
      return json as AskResult;
    },
    onSuccess: (res) => {
      setHistory((h) => [res, ...h].slice(0, 3));
      onAnswered();
    },
  });

  const submit = useCallback(
    (raw?: string) => {
      const value = (raw ?? term).trim();
      if (!value) return;
      mutation.mutate(value);
      setTerm('');
    },
    [mutation, term],
  );

  // Autofocus when sheet mounts (the parent only renders this when open).
  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, []);

  // Quick-ask channel — chips dispatch the same event used elsewhere.
  useEffect(() => {
    function onQuick(e: Event) {
      const ce = e as CustomEvent<string>;
      if (typeof ce.detail !== 'string' || !ce.detail.trim()) return;
      if (!authenticated || mutation.isPending) return;
      submit(ce.detail);
    }
    window.addEventListener(POINTER_COPILOT_QUICK_ASK_EVENT, onQuick as EventListener);
    return () =>
      window.removeEventListener(POINTER_COPILOT_QUICK_ASK_EVENT, onQuick as EventListener);
  }, [authenticated, mutation.isPending, submit]);

  const placeholder = entity?.label
    ? `Ask about ${entity.label}, or any term…`
    : 'Ask about a token, wallet, or any term…';

  return (
    <div>
      <form
        className="relative"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          ref={inputRef}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          disabled={!authenticated || mutation.isPending}
          placeholder={authenticated ? placeholder : 'Sign in to ask the co-pilot…'}
          aria-label="Ask Pointer"
          className={cn(
            'h-10 w-full rounded-full border border-border-subtle bg-bg-sunken pl-4 pr-11 text-[13px] text-fg-primary placeholder:text-fg-muted',
            'transition-[border-color,background-color] duration-150',
            'hover:border-border-default focus-visible:border-accent-primary/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-primary/40',
            'disabled:opacity-60',
          )}
          maxLength={120}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
          }}
        />
        <button
          type="submit"
          disabled={!authenticated || mutation.isPending || !term.trim()}
          aria-label="Send"
          className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-accent-primary text-fg-inverse transition-[transform,filter] disabled:opacity-40 enabled:hover:brightness-110 enabled:active:scale-95"
        >
          {mutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowUp className="h-4 w-4" strokeWidth={2.25} />
          )}
        </button>
      </form>

      {mutation.isError ? (
        <div className="mt-2 flex items-start gap-1.5 rounded-md border border-signal-bear/25 bg-signal-bear/10 px-2 py-1.5 text-[11px] text-signal-bear">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
          <span>AI is temporarily unavailable. Token data and trading are unaffected.</span>
        </div>
      ) : null}

      {history.length > 0 ? (
        <ul className="mt-2 space-y-1.5">
          {history.map((entry, i) => (
            <li
              key={`${i}-${entry.modelUsed}`}
              className="rounded-md border border-border-subtle bg-bg-sunken/60 px-2.5 py-1.5 text-[12px] leading-snug text-fg-primary"
            >
              {entry.data.text}
              <div className="mt-1 flex gap-2 text-[9px] uppercase tracking-wider text-fg-muted">
                <span>{entry.cacheHit ? 'cached' : 'fresh'}</span>
                <span className="tabular-nums">
                  {entry.modelUsed.split('-').slice(0, 2).join('-')}
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
