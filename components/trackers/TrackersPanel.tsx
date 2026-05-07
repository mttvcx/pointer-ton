'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import {
  Activity,
  AlignJustify,
  Bell,
  BellOff,
  Layers,
  Loader2,
  Radio,
  Search,
  Settings2,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { TrackerRulesSection } from '@/components/trackers/TrackerRulesSection';
import { CopyButton } from '@/components/shared/CopyButton';
import { useEntityHover } from '@/lib/hooks/useEntityHover';
import { isValidPublicKey, shortenAddress } from '@/lib/utils/addresses';
import { formatAgeShort, formatLastActiveShort, formatNumber, lamportsToSol } from '@/lib/utils/formatters';
import { cn } from '@/lib/utils/cn';

const AX_BG = '#0b0d12';
const AX_ROW_A = '#0b0d12';
const AX_ROW_B = '#151826';
const AX_BORDER = '#1b1f2a';
const AX_PANEL = '#12141b';

type TrackerRow = {
  id: string;
  walletAddress: string;
  label: string | null;
  notify: boolean;
  createdAt: string;
};

type EnrichmentEntry = {
  lamports: string | null;
  lastActiveUnix: number | null;
};

type EnrichmentMap = Record<string, EnrichmentEntry>;

type ViewTab = 'all' | 'wallet_manager' | 'live_trades' | 'monitor' | 'kols';

const VIEW_TABS: { id: ViewTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'wallet_manager', label: 'Wallet Manager' },
  { id: 'live_trades', label: 'Live Trades' },
  { id: 'monitor', label: 'Monitor' },
  { id: 'kols', label: 'KOLs' },
];

function walletEmoji(addr: string): string {
  const emojis = ['🐋', '🦈', '🎯', '💼', '🔥', '⚡', '🧠', '🌊'];
  let h = 0;
  for (let i = 0; i < addr.length; i++) {
    h = (h + addr.charCodeAt(i) * (i + 1)) % 997;
  }
  return emojis[h % emojis.length] ?? '💼';
}

const MOCK_TRACKERS: TrackerRow[] = [
  { id: 'mock-1', walletAddress: '7PQCWEfa9H1xZQwPq3rW6VYqJZB9s6h8uQk4nYd2pA11', label: 'Wallet', notify: true, createdAt: new Date(Date.now() - 21_000).toISOString() },
  { id: 'mock-2', walletAddress: '95EmJnHY9k2KqVY4u8JmFbE8jQx5JgVn3fZ9bK6oLwE2', label: 'Blast wallet 1', notify: true, createdAt: new Date(Date.now() - 62_000).toISOString() },
  { id: 'mock-3', walletAddress: 'XU6eC7fkDYQk5s2YgN8p4LqZr8Wm1Pa3cVb9HdE3tA2', label: 'Blast wallet 3', notify: false, createdAt: new Date(Date.now() - 124_000).toISOString() },
];

const MONITOR_CARDS = [
  { name: 'KING', subtitle: 'Official', icon: '👑', age: '29s', mc: '$3.69K', liq: '$7.5K', tx: '3', last: '7s', buys: '3', bought: '$280.7', sells: '0', sold: '$0', pnl: '-$31.28', remaining: '$249.9', wallet: 'otta' },
  { name: 'Apple', subtitle: 'Apple', icon: '🍎', age: '19h', mc: '$1.95M', liq: '$127K', tx: '1', last: '19s', buys: '1', bought: '$170.2', sells: '0', sold: '$0', pnl: '-$0.203', remaining: '$16.81', wallet: 'YENNI' },
  { name: 'PEPPER', subtitle: 'CatGPT', icon: '🌶️', age: '8m', mc: '$8.46K', liq: '$8.61K', tx: '8', last: '1m', buys: '1', bought: '$277.4', sells: '7', sold: '$316.1', pnl: '-$24.09', remaining: '$0', wallet: 'Unprof...' },
  { name: 'toly', subtitle: 'toly', icon: '🟩', age: '2m', mc: '$1B', liq: '$5.11K', tx: '1', last: '2m', buys: '0', bought: '$0', sells: '1', sold: '$2.55K', pnl: '+$1.07B', remaining: '$1.07B', wallet: 'Unprof...' },
  { name: 'bruh', subtitle: 'bruh is', icon: '🧟', age: '5m', mc: '$463.5', liq: '$904.5', tx: '23', last: '3m', buys: '21', bought: '$42.26', sells: '2', sold: '$59.67', pnl: '-$24.09', remaining: '$0', wallet: 'Unprof...' },
  { name: 'ELMER', subtitle: 'underdog', icon: '🐶', age: '3m', mc: '$157K', liq: '$22.8K', tx: '8', last: '3m', buys: '1', bought: '$1.38K', sells: '7', sold: '$1.36K', pnl: '-$18.61', remaining: '$0', wallet: 'YENNI' },
];

const KOL_ROWS = [
  ['Ozark', '@ozarkm', 'DZAa...Yxm', '3947'],
  ['Cupsey', '@cupsey', 'sujh...HQK', '2188'],
  ['Kadenox', '@kadenox', '2tg5...x6f', '1735'],
  ['1simple', '@simple_unique', '3p7S...mGJ', '1512'],
  ['LimoonLambo', '@limoonlambo', 'AeLa...PFe3', '1409'],
  ['dandiono45', '@dandiono45', 'Gjvh...7wB', '1288'],
  ['Tii', '@tinnews', '3LY...WxP', '1194'],
  ['Henn100x', '@henn100x', 'Ehg5...Myr', '1091'],
  ['Danny', '@danny', 'FRbL...yCS', '988'],
  ['YieldYolo', '@yieldyolo', '9fNz...13r', '912'],
  ['Kev', '@kev', 'BTT4...sad', '854'],
  ['Ghostee', '@ghostee', '2rvL...Pua9', '801'],
];

function AddWalletDialog({
  open,
  onClose,
  address,
  setAddress,
  label,
  setLabel,
  onSubmit,
  pending,
}: {
  open: boolean;
  onClose: () => void;
  address: string;
  setAddress: (s: string) => void;
  label: string;
  setLabel: (s: string) => void;
  onSubmit: () => void;
  pending: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/70" aria-label="Close" onClick={onClose} />
      <div
        className="relative z-[1] w-full max-w-md rounded-lg border p-3 shadow-2xl"
        style={{ backgroundColor: AX_PANEL, borderColor: AX_BORDER }}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: AX_BORDER }}>
          <span className="text-[13px] font-semibold text-white">Add wallet</span>
          <button type="button" onClick={onClose} className="rounded p-1 text-[#6b7280] hover:bg-white/5 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-2 space-y-2">
          <label className="block space-y-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-[#6b7280]">Address</span>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Solana wallet address"
              className="w-full rounded border bg-[#0b0d12] px-2 py-1.5 tabular-nums text-[12px] text-white outline-none focus:ring-1 focus:ring-[#5865F2]"
              style={{ borderColor: AX_BORDER }}
            />
          </label>
          <label className="block space-y-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-[#6b7280]">Label (optional)</span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. whale #1"
              className="w-full rounded border bg-[#0b0d12] px-2 py-1.5 text-[12px] text-white outline-none focus:ring-1 focus:ring-[#5865F2]"
              style={{ borderColor: AX_BORDER }}
            />
          </label>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border px-3 py-1.5 text-[11px] font-semibold text-[#9ca3af]"
            style={{ borderColor: AX_BORDER }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={onSubmit}
            className="rounded bg-[#5865F2] px-3 py-1.5 text-[11px] font-semibold text-[#0a0a0f] hover:brightness-105 disabled:opacity-50"
          >
            {pending ? 'Adding…' : 'Add wallet'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function TrackersPanel({ className }: { className?: string }) {
  const { authenticated, getAccessToken } = usePointerAuth();
  const queryClient = useQueryClient();

  const [viewTab, setViewTab] = useState<ViewTab>('wallet_manager');
  const [tableSearch, setTableSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importSingleGroup, setImportSingleGroup] = useState(false);
  const [address, setAddress] = useState('');
  const [label, setLabel] = useState('');
  const [expandedRuleId, setExpandedRuleId] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ['trackers', 'enriched'],
    enabled: authenticated,
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const res = await fetch('/api/trackers?enrich=1', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json: unknown = await res.json();
      if (!res.ok) {
        throw new Error(
          typeof json === 'object' && json && 'message' in json
            ? String((json as { message: unknown }).message)
            : 'list failed',
        );
      }
      return json as { trackers: TrackerRow[]; enrichment?: EnrichmentMap };
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const walletAddress = address.trim();
      if (!isValidPublicKey(walletAddress)) {
        throw new Error('Invalid Solana address');
      }
      const res = await fetch('/api/trackers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          walletAddress,
          label: label.trim() || null,
        }),
      });
      const json: unknown = await res.json();
      if (!res.ok) {
        throw new Error(
          typeof json === 'object' && json && 'message' in json
            ? String((json as { message: unknown }).message)
            : 'add failed',
        );
      }
    },
    onSuccess: () => {
      setAddress('');
      setLabel('');
      setAddOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['trackers'] });
      toast.success('Tracker added');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMutation = useMutation({
    mutationFn: async (walletAddress: string) => {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const res = await fetch(`/api/trackers?address=${encodeURIComponent(walletAddress)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const json: unknown = await res.json().catch(() => ({}));
        throw new Error(
          typeof json === 'object' && json && 'message' in json
            ? String((json as { message: unknown }).message)
            : 'remove failed',
        );
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['trackers'] });
      toast.success('Tracker removed');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeAllMutation = useMutation({
    mutationFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const res = await fetch('/api/trackers?all=1', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('remove all failed');
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['trackers'] });
      toast.success('All trackers removed');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const notifyMutation = useMutation({
    mutationFn: async ({ walletAddress, notify }: { walletAddress: string; notify: boolean }) => {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const res = await fetch('/api/trackers', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ walletAddress, notify }),
      });
      if (!res.ok) throw new Error('notify update failed');
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['trackers'] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const sorted = useMemo(() => {
    const rows = listQuery.data?.trackers?.length ? listQuery.data.trackers : MOCK_TRACKERS;
    return [...rows].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [listQuery.data?.trackers]);

  const enrichment = listQuery.data?.enrichment ?? {};

  const filtered = useMemo(() => {
    const q = tableSearch.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(
      (t) =>
        t.walletAddress.toLowerCase().includes(q) ||
        (t.label ?? '').toLowerCase().includes(q),
    );
  }, [sorted, tableSearch]);

  const isWalletView = viewTab === 'all' || viewTab === 'wallet_manager';

  const exportJson = useCallback(() => {
    const blob = new Blob([JSON.stringify({ trackers: sorted }, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pointer-trackers.json';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Exported');
  }, [sorted]);

  const onImportWallets = useCallback(async () => {
    const raw = importText.trim();
    if (!raw) {
      toast.error('Paste at least one wallet address');
      return;
    }
    const set = new Set<string>();
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const trackers = parsed.trackers;
      const wallets = parsed.wallets;
      const list = Array.isArray(trackers)
        ? (trackers as { walletAddress?: string; address?: string }[])
        : Array.isArray(wallets)
          ? (wallets as { walletAddress?: string; address?: string }[])
          : [];
      for (const row of list) {
        const addr = (row.walletAddress ?? row.address ?? '').trim();
        if (addr) set.add(addr);
      }
    } catch {
      // treat as plaintext list and extract base58-like wallet lines
      for (const line of raw.split(/\r?\n/)) {
        const addr = line.trim().split(/\s+/)[0] ?? '';
        if (addr) set.add(addr);
      }
    }

    const addresses = [...set].filter(isValidPublicKey);
    if (addresses.length === 0) {
      toast.error('No valid Solana wallet addresses found');
      return;
    }

    let ok = 0;
    const token = await getAccessToken();
    if (!token) throw new Error('no_token');
    for (const addr of addresses) {
      const res = await fetch('/api/trackers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          walletAddress: addr,
          label: importSingleGroup ? 'Imported group' : null,
        }),
      });
      if (res.ok) ok += 1;
    }

    void queryClient.invalidateQueries({ queryKey: ['trackers'] });
    setImportOpen(false);
    setImportText('');
    toast.success(`Imported ${ok}/${addresses.length} wallet(s)`);
  }, [getAccessToken, importSingleGroup, importText, queryClient]);

  if (!authenticated) {
    return (
      <div
        className={cn('rounded border p-3 text-[12px] text-[#9ca3af]', className)}
        style={{ backgroundColor: AX_PANEL, borderColor: AX_BORDER }}
      >
        Sign in to manage wallet trackers.
      </div>
    );
  }

  return (
    <div
      className={cn('flex min-h-0 min-w-0 flex-1 flex-col text-[12px]', className)}
      style={{ color: '#e5e7eb' }}
    >
      {/* Sub-header control bar */}
      <div
        className="flex shrink-0 flex-wrap items-center gap-x-1 gap-y-1 border-b px-1 py-1 sm:px-2"
        style={{ borderColor: AX_BORDER, backgroundColor: AX_BG }}
      >
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-0.5">
          <AlignJustify className="mr-1 hidden h-3.5 w-3.5 shrink-0 text-[#6b7280] sm:block" strokeWidth={2} />
          {VIEW_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setViewTab(t.id)}
              className={cn(
                'whitespace-nowrap rounded px-2 py-1 text-[11px] font-semibold transition',
                viewTab === t.id ? 'bg-white/10 text-white' : 'text-[#6b7280] hover:bg-white/5 hover:text-[#d1d5db]',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex min-w-0 flex-[2] justify-end sm:mx-2 sm:max-w-[14rem] md:max-w-[18rem]">
          <div
            className="flex w-full max-w-full items-center gap-1 rounded border px-2 py-0.5"
            style={{ borderColor: AX_BORDER, backgroundColor: AX_PANEL }}
          >
            <Search className="h-3 w-3 shrink-0 text-[#6b7280]" strokeWidth={2} />
            <input
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              placeholder="Search by name or addr…"
              className="min-w-0 flex-1 border-0 bg-transparent py-1 text-[11px] text-white outline-none placeholder:text-[#4b5563]"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#d1d5db]"
            style={{ borderColor: AX_BORDER, backgroundColor: AX_PANEL }}
          >
            Import
          </button>
          <button
            type="button"
            onClick={exportJson}
            disabled={sorted.length === 0}
            className="rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#d1d5db] disabled:opacity-40"
            style={{ borderColor: AX_BORDER, backgroundColor: AX_PANEL }}
          >
            Export
          </button>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="rounded bg-[#5865F2] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#0a0a0f] hover:brightness-105"
          >
            Add Wallet
          </button>
          <Link
            href="/wallets"
            className="inline-flex h-7 w-7 items-center justify-center rounded border text-[#6b7280] hover:bg-white/5 hover:text-white"
            style={{ borderColor: AX_BORDER }}
            title="Settings"
          >
            <Settings2 className="h-3.5 w-3.5" strokeWidth={2} />
          </Link>
          <button
            type="button"
            onClick={() => toast.message('Notifications', { description: 'Tracker digest settings ship next.' })}
            className="inline-flex h-7 w-7 items-center justify-center rounded border text-[#6b7280] hover:bg-white/5 hover:text-white"
            style={{ borderColor: AX_BORDER }}
            title="Notifications"
          >
            <Bell className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={() => toast.message('Feed', { description: 'Signal routing is Pulse + webhooks in later phases.' })}
            className="inline-flex h-7 w-7 items-center justify-center rounded border text-[#f87171] hover:bg-white/5"
            style={{ borderColor: AX_BORDER }}
            title="Feed / signals"
          >
            <Radio className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-end border-b px-2 py-0.5" style={{ borderColor: AX_BORDER }}>
        <button
          type="button"
          disabled={sorted.length === 0 || removeAllMutation.isPending}
          onClick={() => {
            if (!window.confirm('Remove all tracked wallets? This cannot be undone.')) return;
            removeAllMutation.mutate();
          }}
          className="text-[10px] font-semibold text-[#f87171] hover:underline disabled:opacity-40"
        >
          Remove All
        </button>
      </div>

      {listQuery.isLoading ? (
        <div className="flex flex-1 items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[#5865F2]" />
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-12 overflow-hidden" style={{ backgroundColor: AX_BG }}>
          <aside className="col-span-12 min-h-0 border-r md:col-span-2" style={{ borderColor: AX_BORDER, backgroundColor: AX_PANEL }}>
            <div className="border-b px-2 py-2" style={{ borderColor: AX_BORDER }}>
              <button className="flex w-full items-center justify-between rounded px-2 py-1 text-[11px] text-white hover:bg-white/5">
                <span>All</span>
                <span className="text-[#6b7280]">{sorted.length + 95}</span>
              </button>
            </div>
            <div className="px-2 py-2">
              <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-[#9ca3af]">
                <span>Groups</span>
                <button className="text-[#9ca3af] hover:text-white">+</button>
              </div>
              {[
                { icon: '🌸', name: 'Main', count: '98', active: true },
                { icon: '⭐', name: 'test', count: '0', active: false },
                { icon: '🔥', name: 'Fast movers', count: '12', active: false },
                { icon: '🐋', name: 'Whales', count: '7', active: false },
              ].map(({ icon, name, count, active }) => (
                <button
                  key={name}
                  className={cn(
                    'mb-1 flex w-full items-center justify-between rounded px-2 py-1.5 text-[11px]',
                    active ? 'border bg-[#1c2030] text-white' : 'text-[#9ca3af] hover:bg-white/5',
                  )}
                  style={{ borderColor: active ? '#5865F2' : 'transparent' }}
                >
                  <span className="inline-flex items-center gap-1.5"><span>{icon}</span>{name}</span>
                  <span className="text-[#6b7280]">{count}</span>
                </button>
              ))}
            </div>
          </aside>

          <main className="col-span-12 min-h-0 overflow-auto md:col-span-7">
            {isWalletView ? (
              <WalletManagerTable
                filtered={filtered}
                enrichment={enrichment}
                expandedRuleId={expandedRuleId}
                setExpandedRuleId={setExpandedRuleId}
                removeMutation={removeMutation}
                notifyMutation={notifyMutation}
              />
            ) : viewTab === 'kols' ? (
              <KolsList />
            ) : (
              <MonitorGrid />
            )}
          </main>

          <aside className="col-span-12 min-h-0 border-l md:col-span-3" style={{ borderColor: AX_BORDER, backgroundColor: AX_PANEL }}>
            <SecondaryPanel viewTab={viewTab} />
          </aside>
        </div>
      )}

      <AddWalletDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        address={address}
        setAddress={setAddress}
        label={label}
        setLabel={setLabel}
        pending={addMutation.isPending}
        onSubmit={() => addMutation.mutate()}
      />
      <div className={cn(importOpen ? 'fixed inset-0 z-[82] flex items-center justify-center p-4' : 'hidden')}>
        <button
          type="button"
          className="absolute inset-0 bg-black/70"
          aria-label="Close import wallets"
          onClick={() => setImportOpen(false)}
        />
        <div
          className="relative z-[1] w-full max-w-sm rounded-lg border p-3 shadow-2xl"
          style={{ backgroundColor: AX_PANEL, borderColor: AX_BORDER }}
          role="dialog"
          aria-modal="true"
        >
          <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: AX_BORDER }}>
            <span className="text-[13px] font-semibold text-white">Import Solana Wallets</span>
            <button
              type="button"
              onClick={() => setImportOpen(false)}
              className="rounded p-1 text-[#6b7280] hover:bg-white/5 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-2 space-y-2">
            <textarea
              rows={6}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="Paste wallet addresses (one per line) or JSON export"
              className="w-full resize-none rounded border bg-[#0b0d12] px-2 py-1.5 tabular-nums text-[11px] text-white outline-none focus:ring-1 focus:ring-[#5865F2]"
              style={{ borderColor: AX_BORDER }}
            />
            <label className="flex items-center justify-between rounded border px-2 py-1 text-[10px] text-[#9ca3af]" style={{ borderColor: AX_BORDER }}>
              <span>Add to single group</span>
              <button
                type="button"
                onClick={() => setImportSingleGroup((v) => !v)}
                className={cn(
                  'h-4 w-8 rounded-full border transition',
                  importSingleGroup ? 'border-[#5865F2] bg-[#5865F2]' : 'border-[#374151] bg-[#111827]',
                )}
                aria-label="Toggle single group"
              >
                <span
                  className={cn(
                    'block h-3 w-3 rounded-full bg-white transition',
                    importSingleGroup ? 'translate-x-4' : 'translate-x-0.5',
                  )}
                />
              </button>
            </label>
            <p className="text-[10px] text-[#6b7280]">Blox / GMGN / Raydium wallet imports are supported via pasted addresses.</p>
          </div>
          <div className="mt-3 border-t pt-2" style={{ borderColor: AX_BORDER }}>
            <button
              type="button"
              onClick={() => void onImportWallets()}
              className="w-full rounded bg-[#5865F2] py-2 text-[12px] font-semibold text-[#0a0a0f] hover:brightness-105"
            >
              Import
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FragmentRow({
  tracker,
  rowBg,
  sol,
  lastUnix,
  expanded,
  onToggleRules,
  onRemove,
  removePending,
  onNotify,
  notifyPending,
}: {
  tracker: TrackerRow;
  rowBg: string;
  sol: number | null;
  lastUnix: number | null;
  expanded: boolean;
  onToggleRules: () => void;
  onRemove: () => void;
  removePending: boolean;
  onNotify: (n: boolean) => void;
  notifyPending: boolean;
}) {
  const hoverProps = useEntityHover(
    useMemo(
      () => ({
        type: 'wallet' as const,
        id: tracker.walletAddress,
        label: tracker.label ?? undefined,
      }),
      [tracker.walletAddress, tracker.label],
    ),
  );

  const displayName = tracker.label?.trim() || shortenAddress(tracker.walletAddress, 6);

  return (
    <>
      <tr
        className="border-b transition-colors hover:bg-white/[0.03]"
        style={{ borderColor: AX_BORDER, backgroundColor: rowBg }}
        {...hoverProps}
      >
        <td className="whitespace-nowrap px-1.5 py-1 align-middle tabular-nums text-[#6b7280]">
          {formatAgeShort(tracker.createdAt)}
        </td>
        <td className="max-w-[14rem] px-1.5 py-1 align-middle">
          <div className="flex min-w-0 items-center gap-1">
            <span className="shrink-0 text-[13px] leading-none" aria-hidden>
              {walletEmoji(tracker.walletAddress)}
            </span>
            <div className="min-w-0">
              <div className="truncate font-medium text-white">{displayName}</div>
              <div className="flex items-center gap-0.5 tabular-nums text-[10px] text-[#6b7280]">
                <span className="truncate">{shortenAddress(tracker.walletAddress, 5)}</span>
                <CopyButton
                  value={tracker.walletAddress}
                  iconOnly
                  label="Copy address"
                  iconClassName="h-5 w-5 rounded text-[#6b7280] opacity-80 hover:bg-white/5 hover:text-white"
                />
              </div>
            </div>
          </div>
        </td>
        <td className="whitespace-nowrap px-1.5 py-1 align-middle tabular-nums font-medium text-[#5eead4]">
          <span className="mr-0.5 text-[10px] text-[#c4b5fd]" aria-hidden>
            ◎
          </span>
          {sol != null ? formatNumber(sol, { decimals: sol < 1 ? 4 : 2 }) : '—'}
        </td>
        <td className="whitespace-nowrap px-1.5 py-1 align-middle tabular-nums text-[#6b7280]">
          {lastUnix != null ? formatLastActiveShort(lastUnix) : '—'}
        </td>
        <td className="px-1.5 py-1 align-middle">
          <div className="flex items-center justify-end gap-0">
            <button
              type="button"
              disabled={notifyPending}
              onClick={() => onNotify(!tracker.notify)}
              className={cn(
                'rounded p-1 text-[#f87171] hover:bg-white/5',
                tracker.notify ? 'text-[#5eead4]' : 'text-[#f87171]/80',
              )}
              title={tracker.notify ? 'Notifications on' : 'Notifications off'}
            >
              {tracker.notify ? <Bell className="h-3.5 w-3.5" strokeWidth={2} /> : <BellOff className="h-3.5 w-3.5" strokeWidth={2} />}
            </button>
            <CopyButton
              value={tracker.walletAddress}
              iconOnly
              label="Copy"
              iconClassName="h-7 w-7 rounded p-1 text-[#f87171] hover:bg-white/5"
            />
            <Link
              href={`/wallet/${tracker.walletAddress}`}
              className="inline-flex h-7 w-7 items-center justify-center rounded p-1 text-[#f87171] hover:bg-white/5"
              title="Wallet profile / activity"
            >
              <Activity className="h-3.5 w-3.5" strokeWidth={2} />
            </Link>
            <button
              type="button"
              onClick={onToggleRules}
              className={cn('inline-flex h-7 w-7 items-center justify-center rounded p-1 hover:bg-white/5', expanded ? 'text-[#7dd3fc]' : 'text-[#6b7280]')}
              title="Wallet rules"
            >
              <Layers className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
            <button
              type="button"
              aria-label="Remove tracker"
              disabled={removePending}
              onClick={onRemove}
              className="inline-flex h-7 w-7 items-center justify-center rounded p-1 text-[#f87171] hover:bg-white/5 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          </div>
        </td>
      </tr>
      {expanded ? (
        <tr style={{ backgroundColor: rowBg }}>
          <td colSpan={5} className="border-b px-2 py-1" style={{ borderColor: AX_BORDER }}>
            <div className="max-h-64 overflow-y-auto rounded border" style={{ borderColor: AX_BORDER, backgroundColor: AX_PANEL }}>
              <TrackerRulesSection tracker={tracker} />
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function WalletManagerTable({
  filtered,
  enrichment,
  expandedRuleId,
  setExpandedRuleId,
  removeMutation,
  notifyMutation,
}: {
  filtered: TrackerRow[];
  enrichment: EnrichmentMap;
  expandedRuleId: string | null;
  setExpandedRuleId: (value: string | null | ((prev: string | null) => string | null)) => void;
  removeMutation: ReturnType<typeof useMutation<void, Error, string>>;
  notifyMutation: ReturnType<typeof useMutation<void, Error, { walletAddress: string; notify: boolean }>>;
}) {
  return (
    <table className="w-full border-collapse text-left text-[11px]">
      <thead className="sticky top-0 z-[1]" style={{ backgroundColor: AX_PANEL }}>
        <tr className="border-b" style={{ borderColor: AX_BORDER }}>
          <th className="whitespace-nowrap px-1.5 py-1 font-semibold uppercase tracking-wide text-[#6b7280]">Created</th>
          <th className="min-w-[8rem] px-1.5 py-1 font-semibold uppercase tracking-wide text-[#6b7280]">Name</th>
          <th className="whitespace-nowrap px-1.5 py-1 font-semibold uppercase tracking-wide text-[#6b7280]">Balance</th>
          <th className="whitespace-nowrap px-1.5 py-1 font-semibold uppercase tracking-wide text-[#6b7280]">Last Active</th>
          <th className="w-24 px-1.5 py-1 text-right font-semibold uppercase tracking-wide text-[#6b7280]">Actions</th>
        </tr>
      </thead>
      <tbody>
        {filtered.map((t, i) => {
          const en = enrichment[t.walletAddress];
          const sol = en?.lamports != null ? lamportsToSol(BigInt(en.lamports)) : (i + 1) * 0.0137;
          const rowBg = i % 2 === 0 ? AX_ROW_A : AX_ROW_B;
          return (
            <FragmentRow
              key={t.id}
              tracker={t}
              rowBg={rowBg}
              sol={sol}
              lastUnix={en?.lastActiveUnix ?? 1_700_000_000 - (i + 1) * 71}
              expanded={expandedRuleId === t.id}
              onToggleRules={() => setExpandedRuleId((id) => (id === t.id ? null : t.id))}
              onRemove={() => removeMutation.mutate(t.walletAddress)}
              removePending={removeMutation.isPending}
              onNotify={(n) => notifyMutation.mutate({ walletAddress: t.walletAddress, notify: n })}
              notifyPending={notifyMutation.isPending}
            />
          );
        })}
      </tbody>
    </table>
  );
}

function MonitorGrid() {
  return (
    <div className="grid grid-cols-1 gap-2 p-2 xl:grid-cols-2">
      {MONITOR_CARDS.map((card) => (
        <article key={`${card.name}-${card.wallet}`} className="rounded border" style={{ borderColor: AX_BORDER, backgroundColor: AX_PANEL }}>
          <div className="flex items-start justify-between border-b p-2" style={{ borderColor: AX_BORDER }}>
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded bg-[#20263a] text-[17px]">{card.icon}</span>
              <div className="min-w-0">
                <div className="truncate text-[12px] font-semibold text-white">{card.name} <span className="font-medium text-[#6b7280]">{card.subtitle}</span></div>
                <div className="text-[10px] text-[#5eead4]">● {card.age}</div>
              </div>
            </div>
            <div className="text-right text-[11px]">
              <span className="text-[#5eead4]">{card.buys} / {card.bought}</span>
              <span className="mx-1 text-[#6b7280]">·</span>
              <span className="text-[#fb7185]">{card.sells} / {card.sold}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 px-2 py-1 text-[10px] text-[#9ca3af]">
            <span>H 1</span>
            <span>MC <b className="font-semibold text-[#5eead4]">{card.mc}</b></span>
            <span>L <b className="font-semibold text-white">{card.liq}</b></span>
            <span>TX <b className="font-semibold text-white">{card.tx}</b></span>
            <span>Last TX <b className="font-semibold text-white">{card.last}</b></span>
          </div>
          <table className="w-full text-[10px]">
            <thead style={{ backgroundColor: AX_ROW_B }}>
              <tr className="text-[#6b7280]">
                <th className="px-2 py-1 text-left font-medium">Wallet</th>
                <th className="px-2 py-1 text-left font-medium">Time in Trade</th>
                <th className="px-2 py-1 text-right font-medium">Bought</th>
                <th className="px-2 py-1 text-right font-medium">Sold</th>
                <th className="px-2 py-1 text-right font-medium">PNL</th>
                <th className="px-2 py-1 text-right font-medium">Remaining</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-2 py-2 text-white">{card.wallet}</td>
                <td className="px-2 py-2 text-[#9ca3af]">{card.age}</td>
                <td className="px-2 py-2 text-right text-[#5eead4]">{card.bought}</td>
                <td className="px-2 py-2 text-right text-[#fb7185]">{card.sold}</td>
                <td className={cn('px-2 py-2 text-right', card.pnl.startsWith('+') ? 'text-[#5eead4]' : 'text-[#fb7185]')}>{card.pnl}</td>
                <td className="px-2 py-2 text-right text-white">{card.remaining}</td>
              </tr>
            </tbody>
          </table>
        </article>
      ))}
    </div>
  );
}

function KolsList() {
  return (
    <div className="grid min-h-0 grid-cols-12">
      <div className="col-span-5 border-r p-2" style={{ borderColor: AX_BORDER }}>
        <div className="mb-2 rounded border px-2 py-1" style={{ borderColor: AX_BORDER, backgroundColor: AX_PANEL }}>
          <input className="w-full bg-transparent text-[11px] outline-none placeholder:text-[#4b5563]" placeholder="Search KOLs..." />
        </div>
        <div className="space-y-1">
          {KOL_ROWS.map(([name, handle], i) => (
            <div key={name} className="flex items-center gap-2 rounded px-2 py-1 hover:bg-white/5">
              <span className="h-7 w-7 rounded-full bg-[#20263a]" />
              <div className="min-w-0">
                <div className="truncate text-[12px] font-semibold text-white">{name}</div>
                <div className="truncate text-[10px] text-[#6b7280]">{handle}</div>
              </div>
              <span className="ml-auto text-[10px] text-[#6b7280]">#{i + 1}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="col-span-7 min-h-0 overflow-auto">
        <table className="w-full text-[10px]">
          <tbody>
            {KOL_ROWS.map(([name, , wallet, followers], i) => (
              <tr key={`${name}-${wallet}`} className="border-b" style={{ borderColor: AX_BORDER, backgroundColor: i % 2 === 0 ? AX_ROW_A : AX_ROW_B }}>
                <td className="px-2 py-1.5 text-white">{wallet}</td>
                <td className="px-2 py-1.5 text-right text-[#9ca3af]">☆ 🔔 𝕏 ⛓</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-[#d1d5db]">{followers}</td>
                <td className="px-2 py-1.5 text-right text-[#fb7185]">Remove</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SecondaryPanel({ viewTab }: { viewTab: ViewTab }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex border-b text-[11px]" style={{ borderColor: AX_BORDER }}>
        {['Customize Feed', 'Twitter Alerts', 'Socials'].map((label, i) => (
          <button key={label} className={cn('px-2 py-1.5 font-semibold', i === 0 ? 'text-white' : 'text-[#6b7280] hover:text-white')}>
            {label}
          </button>
        ))}
      </div>
      <div className="border-b p-2 text-[10px] text-[#9ca3af]" style={{ borderColor: AX_BORDER }}>
        Twitter handles are actively tracked when they appear in Top Subscriptions list. You can add popular handles directly from this panel.
      </div>
      <div className="flex items-center gap-2 border-b p-2" style={{ borderColor: AX_BORDER }}>
        <button className="rounded bg-white/10 px-2 py-1 text-[10px] font-semibold text-white">My List</button>
        <button className="rounded px-2 py-1 text-[10px] font-semibold text-[#6b7280]">Top Subscriptions</button>
        <span className="ml-auto text-[10px] text-[#9ca3af]">3947</span>
      </div>
      <div className="grid grid-cols-4 border-b px-2 py-1 text-[10px] text-[#6b7280]" style={{ borderColor: AX_BORDER }}>
        <span>Handle</span><span>Tweets</span><span>Profile updates</span><span className="text-right">Actions</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {(viewTab === 'kols' ? KOL_ROWS : KOL_ROWS.slice(0, 8)).map(([name, handle, , followers], i) => (
          <div key={`${name}-${handle}-secondary`} className="grid grid-cols-4 border-b px-2 py-1.5 text-[10px]" style={{ borderColor: AX_BORDER, backgroundColor: i % 2 === 0 ? AX_ROW_A : AX_ROW_B }}>
            <span className="truncate text-white">{handle}</span>
            <span className="text-[#9ca3af]">{followers}</span>
            <span className="text-[#5eead4]">Live</span>
            <span className="text-right text-[#fb7185]">Remove</span>
          </div>
        ))}
      </div>
    </div>
  );
}
