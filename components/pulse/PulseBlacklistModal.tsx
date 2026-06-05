'use client';

import { useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { GlassModal } from '@/components/ui/GlassModal';
import { modalBtnPrimaryClass, modalInputClass } from '@/lib/ui/modalChrome';
import { shortenAddress } from '@/lib/utils/addresses';
import { cn } from '@/lib/utils/cn';
import { usePulseHiddenMintsStore } from '@/store/pulseHiddenMints';

type Tab = 'all' | 'dev' | 'twitter' | 'hidden';

type PulseBlacklistModalProps = {
  open: boolean;
  onClose: () => void;
};

export function PulseBlacklistModal({ open, onClose }: PulseBlacklistModalProps) {
  const [tab, setTab] = useState<Tab>('all');
  const [input, setInput] = useState('');

  const mints = usePulseHiddenMintsStore((s) => s.mints ?? []);
  const devs = usePulseHiddenMintsStore((s) => s.blacklistedDevs ?? []);
  const twitter = usePulseHiddenMintsStore((s) => s.blacklistedTwitter ?? []);
  const hideToken = usePulseHiddenMintsStore((s) => s.hideToken);
  const blacklistDev = usePulseHiddenMintsStore((s) => s.blacklistDev);
  const unblacklistDev = usePulseHiddenMintsStore((s) => s.unblacklistDev);
  const blacklistTwitter = usePulseHiddenMintsStore((s) => s.blacklistTwitter);
  const unblacklistTwitter = usePulseHiddenMintsStore((s) => s.unblacklistTwitter);
  const unhideToken = usePulseHiddenMintsStore((s) => s.unhideToken);
  const clearBlacklists = usePulseHiddenMintsStore((s) => s.clearBlacklists);
  const clearHiddenMints = usePulseHiddenMintsStore((s) => s.clearHiddenMints);

  const total = devs.length + twitter.length + mints.length;

  const rows = useMemo(() => {
    const items: { key: string; label: string; sub: string; remove: () => void }[] = [];
    if (tab === 'all' || tab === 'dev') {
      for (const w of devs) {
        items.push({
          key: `dev:${w}`,
          label: shortenAddress(w, 4),
          sub: 'Dev wallet',
          remove: () => unblacklistDev(w),
        });
      }
    }
    if (tab === 'all' || tab === 'twitter') {
      for (const h of twitter) {
        items.push({
          key: `tw:${h}`,
          label: `@${h}`,
          sub: 'Twitter handle',
          remove: () => unblacklistTwitter(h),
        });
      }
    }
    if (tab === 'all' || tab === 'hidden') {
      for (const m of mints) {
        items.push({
          key: `mint:${m}`,
          label: shortenAddress(m, 4),
          sub: 'Hidden token',
          remove: () => unhideToken(m),
        });
      }
    }
    return items;
  }, [tab, devs, twitter, mints, unblacklistDev, unblacklistTwitter, unhideToken]);

  function handleAdd() {
    const raw = input.trim();
    if (!raw) return;
    const isSolAddr = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(raw);
    if (raw.startsWith('@') || (!isSolAddr && raw.length <= 32)) {
      blacklistTwitter(raw);
    } else if (isSolAddr) {
      if (tab === 'hidden') hideToken(raw);
      else blacklistDev(raw);
    } else {
      blacklistTwitter(raw);
    }
    setInput('');
  }

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'all', label: 'All', count: total },
    { id: 'dev', label: 'Dev', count: devs.length },
    { id: 'twitter', label: 'Handles', count: twitter.length },
    { id: 'hidden', label: 'Hidden', count: mints.length },
  ];

  return (
    <GlassModal
      open={open}
      onClose={onClose}
      title="Blacklists"
      maxWidthClass="max-w-lg"
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-[11px] text-fg-muted">
            {total} entries
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                clearBlacklists();
                clearHiddenMints();
              }}
              className="rounded-sm border border-destructive/40 px-2.5 py-1 text-[11px] font-medium text-destructive transition hover:bg-destructive/10"
            >
              Delete all
            </button>
          </div>
        </div>
      }
    >
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAdd();
          }}
          placeholder="Dev address, mint, or @handle"
          className={cn(modalInputClass, 'min-w-0 flex-1 py-1.5 text-sm')}
        />
        <button type="button" onClick={handleAdd} className={cn(modalBtnPrimaryClass, 'shrink-0 px-3 py-1.5 text-xs')}>
          Add
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-1 border-b border-border-subtle pb-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={
              tab === t.id
                ? 'rounded-sm border border-accent-primary/35 bg-accent-primary/10 px-2 py-0.5 text-[11px] font-medium text-accent-primary'
                : 'rounded-sm px-2 py-0.5 text-[11px] text-fg-muted hover:text-fg-secondary'
            }
          >
            {t.label}
            {t.count != null ? ` (${t.count})` : ''}
          </button>
        ))}
      </div>

      <ul className="mt-2 max-h-[min(50vh,320px)] space-y-0.5 overflow-y-auto">
        {rows.length === 0 ? (
          <li className="py-8 text-center text-xs text-fg-muted">No entries yet.</li>
        ) : (
          rows.map((row) => (
            <li
              key={row.key}
              className="flex items-center justify-between gap-2 rounded-sm px-2 py-1.5 hover:bg-bg-hover"
            >
              <div className="min-w-0">
                <p className="truncate font-mono text-xs text-fg-primary">{row.label}</p>
                <p className="text-[10px] text-fg-muted">{row.sub}</p>
              </div>
              <button
                type="button"
                onClick={row.remove}
                title="Remove"
                className="shrink-0 rounded p-1 text-fg-muted transition hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              </button>
            </li>
          ))
        )}
      </ul>
    </GlassModal>
  );
}
