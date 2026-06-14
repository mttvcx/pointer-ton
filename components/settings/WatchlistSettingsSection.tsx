'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowDownUp, Check, ChevronDown, Tag } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { WatchlistQuickbuyMode, WatchlistSortKey } from '@/lib/watchlist/watchlistModel';
import { useOverlayPresence, POPOVER_ANIM_CLOSE_MS } from '@/lib/hooks/useOverlayPresence';
import { popoverPanelClasses } from '@/lib/ui/overlayMotion';
import { useWatchlistStore } from '@/store/watchlist';

const WATCHLIST_SORT_OPTIONS: { id: WatchlistSortKey; label: string }[] = [
  { id: 'price', label: 'Price' },
  { id: 'added', label: 'Date added' },
  { id: 'symbol', label: 'Symbol' },
];

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-fg-primary">{label}</p>
        {description ? (
          <p className="mt-0.5 text-[11px] leading-snug text-fg-muted">{description}</p>
        ) : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200',
          checked ? 'bg-accent-primary' : 'bg-white/10',
        )}
      >
        <span
          className={cn(
            'block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200',
            checked ? 'translate-x-4' : 'translate-x-0',
          )}
        />
      </button>
    </div>
  );
}

function QuickbuyPreview({ mode }: { mode: WatchlistQuickbuyMode }) {
  const showBtn = mode === 'always' || mode === 'hover';
  return (
    <div
      className={cn(
        'flex h-9 items-center gap-1.5 rounded-md border px-2',
        mode === 'hover'
          ? 'border-accent-primary/45 bg-accent-primary/5'
          : 'border-border-subtle bg-bg-base/40',
      )}
    >
      <span className="h-4 w-4 shrink-0 rounded-full bg-white/10" />
      <span className="text-[10px] font-semibold text-fg-secondary">TOK</span>
      <span className="ml-auto text-[9px] tabular-nums text-fg-muted">$12K</span>
      {showBtn ? (
        <span className="rounded-full bg-accent-primary/20 px-1.5 py-0.5 text-[8px] font-bold text-accent-primary">
          ⚡ 0.1
        </span>
      ) : null}
    </div>
  );
}

function WatchlistSortSelect({
  value,
  onChange,
}: {
  value: WatchlistSortKey;
  onChange: (key: WatchlistSortKey) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const { mounted: menuMounted, visible: menuVisible } = useOverlayPresence(open, POPOVER_ANIM_CLOSE_MS);
  const current = WATCHLIST_SORT_OPTIONS.find((o) => o.id === value) ?? WATCHLIST_SORT_OPTIONS[1]!;

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div ref={wrapRef} className="relative min-w-0 flex-1">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex h-9 w-full items-center gap-2 rounded-lg border border-border-subtle bg-bg-base px-2.5 text-[12px] text-fg-primary outline-none transition-colors',
          'hover:border-border-default hover:bg-bg-hover/30',
          'focus-visible:ring-2 focus-visible:ring-accent-primary/35',
          open && 'border-border-default bg-bg-hover/20',
        )}
      >
        <Tag className="h-3.5 w-3.5 shrink-0 text-fg-muted" strokeWidth={2} aria-hidden />
        <span className="min-w-0 flex-1 truncate text-left font-medium">{current.label}</span>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 shrink-0 text-fg-muted transition-transform duration-200',
            open && 'rotate-180',
          )}
          aria-hidden
        />
      </button>

      {menuMounted ? (
        <div
          role="listbox"
          aria-label="Sort watchlist by"
          className={cn(
            'absolute inset-x-0 top-[calc(100%+4px)] z-[140] overflow-hidden rounded-lg border border-border-subtle bg-bg-raised p-1 shadow-panel fill-mode-forwards',
            popoverPanelClasses(menuVisible),
          )}
        >
          {WATCHLIST_SORT_OPTIONS.map((opt) => {
            const selected = opt.id === value;
            return (
              <button
                key={opt.id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(opt.id);
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[12px] transition-colors',
                  selected
                    ? 'bg-bg-hover font-medium text-fg-primary'
                    : 'text-fg-secondary hover:bg-bg-hover/70 hover:text-fg-primary',
                )}
              >
                <Tag className="h-3.5 w-3.5 shrink-0 text-fg-muted" strokeWidth={2} aria-hidden />
                <span className="min-w-0 flex-1 truncate">{opt.label}</span>
                {selected ? (
                  <Check className="h-3.5 w-3.5 shrink-0 text-accent-primary" strokeWidth={2.5} aria-hidden />
                ) : (
                  <span className="h-3.5 w-3.5 shrink-0" aria-hidden />
                )}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function WatchlistSettingsSection() {
  const settings = useWatchlistStore((s) => s.settings);
  const setShowTicker = useWatchlistStore((s) => s.setShowTicker);
  const setQuickbuyMode = useWatchlistStore((s) => s.setQuickbuyMode);
  const setShowActivePositionMc = useWatchlistStore((s) => s.setShowActivePositionMc);
  const setSort = useWatchlistStore((s) => s.setSort);

  const quickbuyOptions: { id: WatchlistQuickbuyMode; label: string }[] = [
    { id: 'never', label: 'Never' },
    { id: 'always', label: 'Always' },
    { id: 'hover', label: 'On Hover' },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-fg-primary">Watchlist</h3>
        <p className="mt-0.5 text-xs text-fg-muted">Configure the ticker row under the header.</p>
      </div>

      <div className="divide-y divide-border-subtle/60 rounded-lg border border-border-subtle/80 bg-bg-base/30 px-3">
        <ToggleRow
          label="Show watchlist ticker"
          description="Compact row of pinned tokens below the top bar."
          checked={settings.showTicker}
          onChange={setShowTicker}
        />
      </div>

      <div>
        <p className="mb-2 text-[12px] font-medium text-fg-primary">Show quickbuy</p>
        <div className="grid grid-cols-3 gap-2">
          {quickbuyOptions.map((opt) => {
            const active = settings.quickbuyMode === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setQuickbuyMode(opt.id)}
                className={cn(
                  'rounded-lg border p-2 text-left transition-[border-color,background-color] duration-200',
                  active
                    ? 'border-accent-primary/50 bg-accent-primary/8'
                    : 'border-border-subtle bg-bg-base/30 hover:border-border-default hover:bg-bg-hover/40',
                )}
              >
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-fg-muted">
                  {opt.label}
                </p>
                <QuickbuyPreview mode={opt.id} />
              </button>
            );
          })}
        </div>
      </div>

      <div className="divide-y divide-border-subtle/60 rounded-lg border border-border-subtle/80 bg-bg-base/30 px-3">
        <ToggleRow
          label="Show active positions market caps"
          checked={settings.showActivePositionMc}
          onChange={setShowActivePositionMc}
        />
      </div>

      <div>
        <p className="mb-2 text-[12px] font-medium text-fg-primary">Sort watchlist by</p>
        <div className="flex items-center gap-2">
          <WatchlistSortSelect
            value={settings.sortKey}
            onChange={(sortKey) => setSort(sortKey, settings.sortDir)}
          />
          <button
            type="button"
            title={settings.sortDir === 'desc' ? 'Descending' : 'Ascending'}
            onClick={() =>
              setSort(settings.sortKey, settings.sortDir === 'desc' ? 'asc' : 'desc')
            }
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-bg-base text-fg-muted transition hover:bg-bg-hover hover:text-fg-primary"
          >
            <ArrowDownUp className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
}
