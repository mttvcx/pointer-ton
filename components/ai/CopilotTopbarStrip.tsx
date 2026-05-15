'use client';

import { ChevronDown, Sparkles } from 'lucide-react';
import { useUIStore } from '@/store/ui';
import { useAlertsTickerQuery } from '@/lib/hooks/useAlertsTicker';
import { useCopilotPillInsight } from '@/lib/hooks/useCopilotPillInsight';
import { cn } from '@/lib/utils/cn';

/**
 * Embedded co-pilot strip that sits in the top-bar's center slot.
 *
 * Replaces the small draggable floating pill (`CopilotPillTopbarCollapsed`) with
 * a wider, theme-aware strip that always shows the live insight plus four
 * quick-action chips. Click opens co-pilot (pill → expanded card; panel → right rail).
 * This is the Cluely-style "always-expanded" UX requested in Task P, but inlined into
 * the chrome instead of overlaying it.
 */
export function CopilotTopbarStrip() {
  const mode = useUIStore((s) => s.copilotDisplayMode);
  const expanded = useUIStore((s) => s.copilotPillExpanded);
  const anchor = useUIStore((s) => s.copilotPillAnchor);
  const setExpanded = useUIStore((s) => s.setCopilotPillExpanded);
  const setPanelOpen = useUIStore((s) => s.setPanelOpen);
  const setDetached = useUIStore((s) => s.setCopilotDetached);
  const lockedEntity = useUIStore((s) => s.lockedEntity);
  const hoveredEntity = useUIStore((s) => s.hoveredEntity);

  const { data: alertsData } = useAlertsTickerQuery();
  const insight = useCopilotPillInsight(alertsData);

  // Default UI mode is `panel`; still show this strip so the header isn't empty.
  // Pill mode → expands `CopilotPillExpandedCard`; panel mode → opens the right rail.
  if (expanded || anchor !== 'header') return null;

  const status: 'idle' | 'watching' | 'armed' = lockedEntity
    ? 'armed'
    : hoveredEntity
      ? 'watching'
      : 'idle';

  const open = () => {
    if (mode === 'pill') {
      setExpanded(true);
      return;
    }
    setDetached(false);
    setPanelOpen(true);
  };

  return (
    <div
      data-onboarding="copilot"
      className="pointer-events-auto flex w-full items-stretch"
    >
      <button
        type="button"
        onClick={open}
        aria-label="Open AI co-pilot"
        title="Open co-pilot"
        className={cn(
          'group flex h-9 w-full min-w-0 items-center gap-2 rounded-full border px-2 text-left',
          'border-border-subtle bg-bg-raised/85 backdrop-blur-xl',
          'transition-[border-color,background-color,box-shadow] duration-150',
          'hover:border-accent-primary/40 hover:bg-bg-raised hover:shadow-[0_0_22px_-8px_rgb(var(--accent-primary-rgb)/0.45)]',
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

        <span className="hidden shrink-0 items-center gap-1 md:flex">
          <ActionChip
            label="Explain"
            onClick={(e) => {
              e.stopPropagation();
              open();
            }}
          />
          <ActionChip
            label="Find risks"
            onClick={(e) => {
              e.stopPropagation();
              open();
            }}
          />
          <ActionChip
            label="Build alert"
            onClick={(e) => {
              e.stopPropagation();
              open();
            }}
          />
          <ActionChip
            label="Recap"
            onClick={(e) => {
              e.stopPropagation();
              open();
            }}
          />
        </span>

        <ChevronDown
          className="ml-1 h-4 w-4 shrink-0 self-center text-fg-muted transition-transform group-hover:translate-y-px"
          strokeWidth={2.25}
          aria-hidden
        />
      </button>
    </div>
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

function ActionChip({
  label,
  onClick,
}: {
  label: string;
  onClick: (e: React.MouseEvent<HTMLSpanElement>) => void;
}) {
  // span (not nested button) — parent strip is a <button>, nested buttons would
  // throw a console warning. We propagate the click via onClick on span.
  return (
    <span
      role="button"
      tabIndex={-1}
      onClick={onClick}
      className={cn(
        'inline-flex h-6 cursor-pointer items-center rounded-full px-2 text-[10px] font-medium',
        'bg-bg-sunken text-fg-secondary',
        'transition-colors hover:bg-accent-primary/15 hover:text-accent-primary',
      )}
    >
      {label}
    </span>
  );
}
