'use client';

import { ArrowDownUp, Tag } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { WatchlistQuickbuyMode } from '@/lib/watchlist/watchlistModel';
import { useWatchlistStore } from '@/store/watchlist';

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
          <div className="relative min-w-0 flex-1">
            <Tag className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-muted" />
            <select
              value={settings.sortKey}
              onChange={(e) =>
                setSort(e.target.value as typeof settings.sortKey, settings.sortDir)
              }
              className="h-9 w-full appearance-none rounded-lg border border-border-subtle bg-bg-base pl-8 pr-3 text-[12px] text-fg-primary outline-none focus:border-accent-primary/45"
            >
              <option value="price">Price</option>
              <option value="added">Date added</option>
              <option value="symbol">Symbol</option>
            </select>
          </div>
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
