'use client';

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy, DollarSign, EyeOff, LineChart, Plus, Search, Star } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { shortenAddress } from '@/lib/utils/addresses';
import { appChainForWalletAddress } from '@/lib/chains/walletIntelChain';
import { useWalletIntelStore } from '@/store/walletIntelStore';
import { useWalletGroupsStore } from '@/store/walletGroups';
import { useKolPrefsStore } from '@/store/kolPrefs';
import { useWalletTrackerPreviewStore } from '@/store/walletTrackerPreview';
import { DEMO_KOLS, type DemoKol } from '@/lib/dev/kolsDemo';

function KolAvatar({ handle }: { handle: string }) {
  const [err, setErr] = useState(false);
  if (err) {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[11px] font-bold text-fg-muted">
        {handle.slice(0, 2).toUpperCase()}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://unavatar.io/twitter/${handle}`}
      alt=""
      referrerPolicy="no-referrer"
      onError={() => setErr(true)}
      className="h-8 w-8 shrink-0 rounded-full object-cover"
    />
  );
}

/** Star → track: pick which group the KOL's wallet belongs to. */
function StarGroupMenu({ address }: { address: string }) {
  const groups = useWalletGroupsStore((s) => s.groups);
  const toggleWalletInGroup = useWalletGroupsStore((s) => s.toggleWalletInGroup);
  const createGroup = useWalletGroupsStore((s) => s.createGroup);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const ref = useRef<HTMLButtonElement>(null);

  const inAnyGroup = groups.some((g) => g.walletAddresses.includes(address));

  useLayoutEffect(() => {
    if (!open) return;
    const r = ref.current?.getBoundingClientRect();
    if (r) setPos({ left: Math.min(r.left, window.innerWidth - 168), top: r.bottom + 4 });
    const onDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-star-menu]')) setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  return (
    <>
      <button
        ref={ref}
        type="button"
        data-star-menu
        onClick={() => setOpen((v) => !v)}
        title={inAnyGroup ? 'Tracked — choose group' : 'Track this wallet'}
        className={cn('flex h-6 w-6 items-center justify-center rounded-md transition-colors', inAnyGroup ? 'text-accent-primary' : 'text-fg-muted hover:text-fg-secondary')}
      >
        <Star className="h-4 w-4" strokeWidth={2} fill={inAnyGroup ? 'currentColor' : 'none'} />
      </button>
      {open && pos && typeof document !== 'undefined'
        ? createPortal(
            <div data-star-menu className="fixed z-[280] w-[168px] rounded-lg border border-white/[0.1] bg-[#0a0a0a] p-1 shadow-2xl shadow-black/60" style={{ left: pos.left, top: pos.top }}>
              <div className="px-1.5 py-1 text-[9px] font-semibold uppercase tracking-wide text-fg-muted">Track in group</div>
              {groups.length === 0 ? (
                <p className="px-1.5 py-1 text-[10px] text-fg-muted">No groups yet.</p>
              ) : (
                groups.map((g) => {
                  const inGroup = g.walletAddresses.includes(address);
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => toggleWalletInGroup(g.id, address)}
                      className="flex w-full items-center justify-between gap-2 rounded px-1.5 py-1 text-left text-[11px] text-fg-secondary transition-colors hover:bg-white/[0.05]"
                    >
                      <span className="truncate">{g.label}</span>
                      {inGroup ? <Check className="h-3.5 w-3.5 shrink-0 text-accent-primary" strokeWidth={2.5} /> : null}
                    </button>
                  );
                })
              )}
              {creating ? (
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && name.trim()) {
                      const id = createGroup(name.trim());
                      toggleWalletInGroup(id, address);
                      setName('');
                      setCreating(false);
                    }
                    if (e.key === 'Escape') setCreating(false);
                  }}
                  onBlur={() => setCreating(false)}
                  placeholder="Group name…"
                  className="mt-0.5 w-full rounded border border-accent-primary/40 bg-white/[0.03] px-1.5 py-1 text-[11px] text-fg-primary outline-none"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="mt-0.5 flex w-full items-center gap-1 rounded px-1.5 py-1 text-left text-[11px] font-semibold text-accent-primary transition-colors hover:bg-accent-primary/10"
                >
                  <Plus className="h-3 w-3" strokeWidth={2.5} /> New group
                </button>
              )}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

/** $ → set min buy (USD) for the KOL to appear as a chart bubble. */
function MinBubbleMenu({ address }: { address: string }) {
  const minBubbleUsd = useKolPrefsStore((s) => s.minBubbleUsd[address] ?? 0);
  const setMinBubble = useKolPrefsStore((s) => s.setMinBubble);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [val, setVal] = useState(String(minBubbleUsd || ''));
  const ref = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    if (!open) return;
    setVal(String(minBubbleUsd || ''));
    const r = ref.current?.getBoundingClientRect();
    if (r) setPos({ left: Math.min(r.left - 100, window.innerWidth - 168), top: r.bottom + 4 });
    const onDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-minb]')) setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const commit = () => {
    setMinBubble(address, Number(val) || 0);
    setOpen(false);
  };

  return (
    <>
      <button
        ref={ref}
        type="button"
        data-minb
        onClick={() => setOpen((v) => !v)}
        title="Set min buy amount"
        className={cn('flex h-6 w-6 items-center justify-center rounded-md transition-colors', minBubbleUsd > 0 ? 'text-accent-primary' : 'text-fg-muted hover:text-fg-secondary')}
      >
        <DollarSign className="h-4 w-4" strokeWidth={2} />
      </button>
      {open && pos && typeof document !== 'undefined'
        ? createPortal(
            <div data-minb className="fixed z-[280] w-[152px] rounded-lg border border-white/[0.1] bg-[#0a0a0a] p-2 shadow-2xl shadow-black/60" style={{ left: pos.left, top: pos.top }}>
              <div className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-fg-muted">Min bubble · USD</div>
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-fg-muted">$</span>
                <input
                  autoFocus
                  value={val}
                  onChange={(e) => setVal(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commit();
                    if (e.key === 'Escape') setOpen(false);
                  }}
                  inputMode="decimal"
                  placeholder="0"
                  className="min-w-0 flex-1 rounded border border-white/[0.1] bg-white/[0.03] px-1.5 py-1 text-[11px] tabular-nums text-fg-primary outline-none focus:border-accent-primary/40"
                />
                <button type="button" onClick={commit} className="rounded bg-accent-primary/20 px-2 py-1 text-[10px] font-bold text-accent-primary hover:bg-accent-primary/30">
                  Set
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function KolRow({ k }: { k: DemoKol }) {
  const [copied, setCopied] = useState(false);
  const openWallet = useWalletIntelStore((s) => s.openWallet);
  const hidden = useKolPrefsStore((s) => Boolean(s.hiddenFromBubbles[k.wallet]));
  const toggleHidden = useKolPrefsStore((s) => s.toggleHidden);

  return (
    <div className="flex items-center gap-2 border-b border-white/[0.04] px-3 py-2 transition-colors hover:bg-white/[0.03]">
      <KolAvatar handle={k.handle} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-semibold text-fg-primary">{k.name}</p>
        <p className="truncate text-[10px] text-fg-muted">@{k.handle}</p>
      </div>

      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(k.wallet);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }}
        className="hidden items-center gap-1 font-mono text-[10px] text-fg-muted transition-colors hover:text-fg-secondary sm:inline-flex"
        title={k.wallet}
      >
        {shortenAddress(k.wallet, 4)}
        {copied ? <Check className="h-3 w-3 text-signal-bull" strokeWidth={2.5} /> : <Copy className="h-3 w-3 opacity-70" strokeWidth={1.8} />}
      </button>

      <div className="flex shrink-0 items-center gap-0.5">
        <StarGroupMenu address={k.wallet} />
        <button
          type="button"
          onClick={() => toggleHidden(k.wallet)}
          title="Hide KOL from chart bubbles"
          className={cn('flex h-6 w-6 items-center justify-center rounded-md transition-colors', hidden ? 'text-signal-bear' : 'text-fg-muted hover:text-fg-secondary')}
        >
          <EyeOff className="h-4 w-4" strokeWidth={2} />
        </button>
        <button
          type="button"
          onClick={() => openWallet({ address: k.wallet, chain: appChainForWalletAddress(k.wallet) })}
          title="Trade scanner — positions & top trades"
          className="flex h-6 w-6 items-center justify-center rounded-md text-fg-muted transition-colors hover:text-fg-secondary"
        >
          <LineChart className="h-4 w-4" strokeWidth={2} />
        </button>
        <a
          href={`https://x.com/${k.handle}`}
          target="_blank"
          rel="noreferrer"
          title="Open X profile"
          className="flex h-6 w-6 items-center justify-center rounded-md text-[13px] font-bold text-fg-muted transition-colors hover:text-fg-secondary"
        >
          𝕏
        </a>
        <MinBubbleMenu address={k.wallet} />
      </div>
    </div>
  );
}

/**
 * KOLs directory tab — searchable list with per-KOL actions: star (track into a
 * group), hide-from-bubbles, trade scanner (wallet dossier), X profile, and a
 * min-buy amount for chart bubbles. Sample data while the DB is unavailable.
 */
export function WalletTrackerKolsTab() {
  const preview = useWalletTrackerPreviewStore((s) => s.preview);
  const [q, setQ] = useState('');
  const list = preview ? DEMO_KOLS : [];
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter((k) => k.name.toLowerCase().includes(needle) || k.handle.toLowerCase().includes(needle) || k.wallet.toLowerCase().includes(needle));
  }, [list, q]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 px-2 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md border border-white/[0.1] bg-white/[0.03] px-2 py-1.5">
          <Search className="h-3.5 w-3.5 shrink-0 text-fg-muted" strokeWidth={2} aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search KOLs…"
            className="min-w-0 flex-1 bg-transparent text-[12px] text-fg-primary outline-none placeholder:text-fg-muted"
          />
        </div>
        <span className="shrink-0 text-[10px] tabular-nums text-fg-muted">{filtered.length} KOLs</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:thin]">
        {!preview ? (
          <p className="px-3 py-6 text-center text-[11px] leading-relaxed text-fg-muted">
            KOL directory loads here.
            <br />
            <span className="text-fg-muted/70">Turn on Preview (Trades) to see the sample list.</span>
          </p>
        ) : filtered.length === 0 ? (
          <p className="px-3 py-6 text-center text-[11px] text-fg-muted">No KOLs match “{q}”.</p>
        ) : (
          filtered.map((k) => <KolRow key={k.wallet} k={k} />)
        )}
      </div>
    </div>
  );
}
