'use client';

import { useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { GlassModal } from '@/components/ui/GlassModal';
import { modalBtnPrimaryClass, modalInputClass } from '@/lib/ui/modalChrome';
import { shortenAddress } from '@/lib/utils/addresses';
import { cn } from '@/lib/utils/cn';
import { normalizeWebsiteDomain, usePulseHiddenMintsStore, type BlacklistKind } from '@/store/pulseHiddenMints';

type PulseBlacklistModalProps = {
  open: boolean;
  onClose: () => void;
};

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

const KINDS: { id: BlacklistKind; label: string; placeholder: string; note?: string }[] = [
  {
    id: 'funder',
    label: 'Funding wallet',
    placeholder: 'Dev funding wallet address',
    note: "Hides every token whose dev wallet was funded by this wallet — filter out anyone you don't trust.",
  },
  { id: 'dev', label: 'Developer address', placeholder: 'Dev / creator wallet address' },
  { id: 'ca', label: 'Contract address', placeholder: 'Token mint address' },
  { id: 'twitter', label: 'Twitter profile', placeholder: '@handle or x.com/handle' },
  { id: 'kol', label: 'KOL handle', placeholder: '@kol' },
  { id: 'keyword', label: 'Keyword', placeholder: 'word in name / ticker / description' },
  { id: 'website', label: 'Website', placeholder: 'example.com' },
];

const SUBLABEL: Record<BlacklistKind, string> = {
  funder: 'Funding wallet',
  dev: 'Dev wallet',
  ca: 'Hidden token',
  twitter: 'Twitter handle',
  kol: 'KOL handle',
  keyword: 'Keyword',
  website: 'Website',
};

export function PulseBlacklistModal({ open, onClose }: PulseBlacklistModalProps) {
  const [kind, setKind] = useState<BlacklistKind>('funder');
  const [tab, setTab] = useState<BlacklistKind | 'all'>('all');
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const s = usePulseHiddenMintsStore();

  const lists: Record<BlacklistKind, string[]> = {
    funder: s.blacklistedFunders ?? [],
    dev: s.blacklistedDevs ?? [],
    ca: s.mints ?? [],
    twitter: s.blacklistedTwitter ?? [],
    kol: s.blacklistedKol ?? [],
    keyword: s.blacklistedKeywords ?? [],
    website: s.blacklistedWebsites ?? [],
  };

  const total = Object.values(lists).reduce((n, l) => n + l.length, 0);

  const add = (k: BlacklistKind, v: string) => {
    if (k === 'funder') s.blacklistFunder(v);
    else if (k === 'dev') s.blacklistDev(v);
    else if (k === 'ca') s.hideToken(v);
    else if (k === 'twitter') s.blacklistTwitter(v);
    else if (k === 'kol') s.blacklistKol(v);
    else if (k === 'keyword') s.blacklistKeyword(v);
    else if (k === 'website') s.blacklistWebsite(v);
  };
  const remove = (k: BlacklistKind, v: string) => {
    if (k === 'funder') s.unblacklistFunder(v);
    else if (k === 'dev') s.unblacklistDev(v);
    else if (k === 'ca') s.unhideToken(v);
    else if (k === 'twitter') s.unblacklistTwitter(v);
    else if (k === 'kol') s.unblacklistKol(v);
    else if (k === 'keyword') s.unblacklistKeyword(v);
    else if (k === 'website') s.unblacklistWebsite(v);
  };

  function handleAdd() {
    const raw = input.trim();
    if (!raw) return;
    // Per-type validation so a wallet field can't be a keyword, etc.
    if ((kind === 'funder' || kind === 'dev' || kind === 'ca') && !BASE58.test(raw)) {
      setError('Enter a valid Solana address.');
      return;
    }
    setError(null);
    add(kind, raw);
    setInput('');
  }

  const rows = useMemo(() => {
    const items: { key: string; label: string; sub: string; remove: () => void }[] = [];
    const kinds: BlacklistKind[] = tab === 'all' ? KINDS.map((k) => k.id) : [tab];
    for (const k of kinds) {
      for (const v of lists[k]) {
        const isAddr = k === 'funder' || k === 'dev' || k === 'ca';
        const label = isAddr ? shortenAddress(v, 4) : k === 'twitter' || k === 'kol' ? `@${v}` : v;
        items.push({ key: `${k}:${v}`, label, sub: SUBLABEL[k], remove: () => remove(k, v) });
      }
    }
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, JSON.stringify(lists)]);

  const activeNote = KINDS.find((k) => k.id === kind)?.note;
  const placeholder = KINDS.find((k) => k.id === kind)?.placeholder ?? 'Value';

  const tabs: { id: BlacklistKind | 'all'; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: total },
    ...KINDS.map((k) => ({ id: k.id, label: k.label.split(' ')[0]!, count: lists[k.id].length })),
  ];

  return (
    <GlassModal
      open={open}
      onClose={onClose}
      title="Blacklist"
      maxWidthClass="max-w-lg"
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-[11px] text-fg-muted">{total} entries</span>
          <button
            type="button"
            onClick={() => {
              s.clearBlacklists();
              s.clearHiddenMints();
            }}
            className="rounded-sm border border-destructive/40 px-2.5 py-1 text-[11px] font-medium text-destructive transition hover:bg-destructive/10"
          >
            Delete all
          </button>
        </div>
      }
    >
      <div className="flex gap-2">
        <select
          value={kind}
          onChange={(e) => {
            setKind(e.target.value as BlacklistKind);
            setError(null);
          }}
          className={cn(modalInputClass, 'shrink-0 py-1.5 text-xs')}
          aria-label="Blacklist type"
        >
          {KINDS.map((k) => (
            <option key={k.id} value={k.id}>
              {k.label}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAdd();
          }}
          placeholder={placeholder}
          className={cn(modalInputClass, 'min-w-0 flex-1 py-1.5 text-sm')}
        />
        <button type="button" onClick={handleAdd} className={cn(modalBtnPrimaryClass, 'shrink-0 px-3 py-1.5 text-xs')}>
          Blacklist
        </button>
      </div>

      {error ? <p className="mt-1.5 text-[11px] text-destructive">{error}</p> : null}
      {activeNote ? <p className="mt-1.5 text-[11px] leading-relaxed text-fg-muted">{activeNote}</p> : null}

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
            {t.count ? ` (${t.count})` : ''}
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
