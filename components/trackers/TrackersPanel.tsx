'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { isValidTonTrackedAddress, shortenAddress } from '@/lib/utils/addresses';
import { formatAgeShort, formatLastActiveShort, formatNumber, rawToUi } from '@/lib/utils/formatters';
import { cn } from '@/lib/utils/cn';
import type { AppChainId } from '@/lib/chains/appChain';
import { useUIStore } from '@/store/ui';

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
  nanoTon: string | null;
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

type GroupId = 'all' | 'main' | 'test' | 'fast' | 'whales';

type KolRow = { id: string; name: string; handle: string; wallet: string; followers: string };

/** Demo KOLs: deterministic v4 wallet addresses on TON (valid `Address.parse`). */
const INITIAL_KOL_ROWS: KolRow[] = [
  { id: 'k1', name: 'Ozark', handle: '@ozarkm', wallet: 'EQDXWFihDsLUEJM5z2HPiFxjxBKvZuLcuY9alCu00i7vJaZa', followers: '3947' },
  { id: 'k2', name: 'Cupsey', handle: '@cupsey', wallet: 'EQBMPsBatosg8z8WFMAm4IKzzk9oNVDjVINaZJgKL7UKBphA', followers: '2188' },
  { id: 'k3', name: 'Kadenox', handle: '@kadenox', wallet: 'EQBPauSJUSd-lRxePlW-S3wxb1m4ZilvBFTaeytfMqmBj84c', followers: '1735' },
  { id: 'k4', name: '1simple', handle: '@simple_unique', wallet: 'EQCGECIaOBhYcTj77EqQmVC5qupOS2iJ7Ixzfj-tp0dPd2I8', followers: '1512' },
  { id: 'k5', name: 'LimoonLambo', handle: '@limoonlambo', wallet: 'EQDSsGG5WYliTh4n7bDKANc-mCqrHwsCJSr-oRNOe-xN49q1', followers: '1409' },
  { id: 'k6', name: 'dandiono45', handle: '@dandiono45', wallet: 'EQC-5bzneBaxgeIUoPUtTI-R3Tm_g-Pm87EctIyLbVdPRvdt', followers: '1288' },
  { id: 'k7', name: 'Tii', handle: '@tinnews', wallet: 'EQC4HnbbC_XOfJFblcEPQwikzr_eUGFJZIdwdfJSq2kNaXJe', followers: '1194' },
  { id: 'k8', name: 'Henn100x', handle: '@henn100x', wallet: 'EQDS36Lp3cbqvKBRqn0LNRKxKiqNTOj2se__DNgfLuh0RfF-', followers: '1091' },
  { id: 'k9', name: 'Danny', handle: '@danny', wallet: 'EQDVhxI-CWaTsPrZO1X58pSIETmMF4DPht6aiQlu88keu9y5', followers: '988' },
  { id: 'k10', name: 'YieldYolo', handle: '@yieldyolo', wallet: 'EQBv9lbU6I0eXg8UZuGxVwNeMsCQm4mQ9-KVuH4A1Qydloee', followers: '912' },
  { id: 'k11', name: 'Kev', handle: '@kev', wallet: 'EQDJgAtxmV0O6Py1jjbfeCzJ1l3vH3U2BRkcwiBEIh8VtN8p', followers: '854' },
  { id: 'k12', name: 'Ghostee', handle: '@ghostee', wallet: 'EQA-zLyMNoRdJ6hPraacQJwsVbo6wExGIR7-T9dj5coOnOGZ', followers: '801' },
];

/** Demo Solana KOL placeholders — distinct list from TON; replaces when you switch chain. */
const INITIAL_KOL_ROWS_SOL: KolRow[] = [
  { id: 's1', name: 'SOL KOL A', handle: '@sol_a', wallet: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', followers: '2100' },
  { id: 's2', name: 'SOL KOL B', handle: '@sol_b', wallet: '5ZWj7a1f8tWkjBESHKgrLmXshuXx6mvKULojCCA3hg8d', followers: '1840' },
  { id: 's3', name: 'SOL KOL C', handle: '@sol_c', wallet: 'GKNeKHqYJZwVMCfvA4n6mJTH3pZvd3f6VK5N9yRQnaXm', followers: '1200' },
  { id: 's4', name: 'SOL KOL D', handle: '@sol_d', wallet: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', followers: '980' },
  { id: 's5', name: 'SOL KOL E', handle: '@sol_e', wallet: 'Vote111111111111111111111111111111111111111', followers: '760' },
  { id: 's6', name: 'SOL KOL F', handle: '@sol_f', wallet: 'So11111111111111111111111111111111111111112', followers: '540' },
];

const INITIAL_KOL_ROWS_EVM: KolRow[] = [
  { id: 'e1', name: 'EVM KOL A', handle: '@evm_a', wallet: '0xd8dA6BF26964af9D7eEd9e03E53415D37aA96045', followers: '3200' },
  { id: 'e2', name: 'EVM KOL B', handle: '@evm_b', wallet: '0x28C6c06298d514Db089934071355E5743bf21d60', followers: '2100' },
  { id: 'e3', name: 'EVM KOL C', handle: '@evm_c', wallet: '0x47ac0Fb4F2D84898e4D9E7bDaDaBb6c6CFe9b794', followers: '1500' },
];

function kolStorageKey(chain: AppChainId): string {
  return `pointer-kol-feed-list-${chain}`;
}

function defaultKolRows(chain: AppChainId): KolRow[] {
  if (chain === 'ton') return INITIAL_KOL_ROWS.map((r) => ({ ...r }));
  if (chain === 'sol') return INITIAL_KOL_ROWS_SOL.map((r) => ({ ...r }));
  return INITIAL_KOL_ROWS_EVM.map((r) => ({ ...r }));
}

function readStoredKolRows(chain: AppChainId): KolRow[] {
  if (typeof window === 'undefined') return defaultKolRows(chain);
  try {
    const raw = localStorage.getItem(kolStorageKey(chain));
    if (!raw) return defaultKolRows(chain);
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return defaultKolRows(chain);
    return parsed
      .filter((x): x is KolRow => {
        if (!x || typeof x !== 'object') return false;
        const o = x as Record<string, unknown>;
        return typeof o.id === 'string' && typeof o.wallet === 'string';
      })
      .map((r) => ({
        id: r.id,
        name: typeof r.name === 'string' ? r.name : shortenAddress(r.wallet, 4),
        handle: typeof r.handle === 'string' ? r.handle : '',
        wallet: r.wallet,
        followers: typeof r.followers === 'string' ? r.followers : '0',
      }));
  } catch {
    return defaultKolRows(chain);
  }
}

function filterTrackersByGroup(
  rows: TrackerRow[],
  group: GroupId,
  enrichment: EnrichmentMap,
): TrackerRow[] {
  if (group === 'all') return rows;
  /** “Main” = everything that isn’t tagged as a test wallet (group still filters). */
  if (group === 'main') {
    return rows.filter((r) => !(r.label ?? '').toLowerCase().includes('test'));
  }
  if (group === 'test') {
    return rows.filter((r) => (r.label ?? '').toLowerCase().includes('test'));
  }
  if (group === 'fast') {
    const dayAgo = Date.now() - 86_400_000;
    return rows.filter((r) => new Date(r.createdAt).getTime() > dayAgo);
  }
  if (group === 'whales') {
    return rows.filter((r) => {
      const raw = enrichment[r.walletAddress]?.nanoTon;
      if (!raw) return false;
      try {
        return rawToUi(raw, 9) >= 50;
      } catch {
        return false;
      }
    });
  }
  return rows;
}

function groupLabel(g: GroupId): string {
  switch (g) {
    case 'all':
      return 'All';
    case 'main':
      return 'Main';
    case 'test':
      return 'test';
    case 'fast':
      return 'Fast movers';
    case 'whales':
      return 'Whales';
    default:
      return 'All';
  }
}

function groupIcon(g: GroupId): string {
  switch (g) {
    case 'all':
      return '◆';
    case 'main':
      return '🌸';
    case 'test':
      return '⭐';
    case 'fast':
      return '🔥';
    case 'whales':
      return '🐋';
    default:
      return '◆';
  }
}

const MONITOR_CARDS = [
  { name: 'KING', subtitle: 'Official', icon: '👑', age: '29s', mc: '$3.69K', liq: '$7.5K', tx: '3', last: '7s', buys: '3', bought: '$280.7', sells: '0', sold: '$0', pnl: '-$31.28', remaining: '$249.9', wallet: 'otta' },
  { name: 'Apple', subtitle: 'Apple', icon: '🍎', age: '19h', mc: '$1.95M', liq: '$127K', tx: '1', last: '19s', buys: '1', bought: '$170.2', sells: '0', sold: '$0', pnl: '-$0.203', remaining: '$16.81', wallet: 'YENNI' },
  { name: 'PEPPER', subtitle: 'CatGPT', icon: '🌶️', age: '8m', mc: '$8.46K', liq: '$8.61K', tx: '8', last: '1m', buys: '1', bought: '$277.4', sells: '7', sold: '$316.1', pnl: '-$24.09', remaining: '$0', wallet: 'Unprof...' },
  { name: 'toly', subtitle: 'toly', icon: '🟩', age: '2m', mc: '$1B', liq: '$5.11K', tx: '1', last: '2m', buys: '0', bought: '$0', sells: '1', sold: '$2.55K', pnl: '+$1.07B', remaining: '$1.07B', wallet: 'Unprof...' },
  { name: 'bruh', subtitle: 'bruh is', icon: '🧟', age: '5m', mc: '$463.5', liq: '$904.5', tx: '23', last: '3m', buys: '21', bought: '$42.26', sells: '2', sold: '$59.67', pnl: '-$24.09', remaining: '$0', wallet: 'Unprof...' },
  { name: 'ELMER', subtitle: 'underdog', icon: '🐶', age: '3m', mc: '$157K', liq: '$22.8K', tx: '8', last: '3m', buys: '1', bought: '$1.38K', sells: '7', sold: '$1.36K', pnl: '-$18.61', remaining: '$0', wallet: 'YENNI' },
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
              placeholder="TON wallet address"
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

export function TrackersPanel({
  className,
  prefillWallet,
}: {
  className?: string;
  /** When set (e.g. from `/trackers?wallet=EQ…`), pre-fills add-tracker and opens the dialog. */
  prefillWallet?: string;
}) {
  const { authenticated, getAccessToken } = usePointerAuth();
  const queryClient = useQueryClient();
  const activeChain = useUIStore((s) => s.activeChain);

  const [viewTab, setViewTab] = useState<ViewTab>('wallet_manager');
  const [tableSearch, setTableSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importSingleGroup, setImportSingleGroup] = useState(false);
  const [address, setAddress] = useState('');
  const [label, setLabel] = useState('');
  const [expandedRuleId, setExpandedRuleId] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<GroupId>('main');
  const [kolRows, setKolRows] = useState<KolRow[]>(() => defaultKolRows('ton'));
  const [kolWalletFocus, setKolWalletFocus] = useState<string | null>(null);
  const lastPrefillRef = useRef<string | null>(null);

  useEffect(() => {
    setKolRows(readStoredKolRows(activeChain));
  }, [activeChain]);

  useEffect(() => {
    try {
      localStorage.setItem(kolStorageKey(activeChain), JSON.stringify(kolRows));
    } catch {
      /* ignore quota */
    }
  }, [kolRows, activeChain]);

  useEffect(() => {
    const raw = prefillWallet?.trim() ?? '';
    if (!raw) {
      lastPrefillRef.current = null;
      return;
    }
    if (!isValidTonTrackedAddress(raw)) return;
    if (lastPrefillRef.current === raw) return;
    lastPrefillRef.current = raw;
    setAddress(raw);
    setViewTab('wallet_manager');
    setAddOpen(true);
  }, [prefillWallet]);

  const listQuery = useQuery({
    queryKey: ['trackers', 'enriched', activeChain],
    enabled: authenticated && activeChain === 'ton',
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
      if (activeChain !== 'ton') {
        throw new Error('Wallet trackers are saved for TON first. Switch the header network to TON, or use KOLs (chain-specific list) on this network.');
      }
      if (!isValidTonTrackedAddress(walletAddress)) {
        throw new Error('Invalid TON address (use EQ/UQ format)');
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
    if (activeChain !== 'ton') return [];
    const rows = listQuery.data?.trackers ?? [];
    return [...rows].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [listQuery.data?.trackers, activeChain]);

  const enrichment = listQuery.data?.enrichment ?? {};

  const groupFiltered = useMemo(
    () => filterTrackersByGroup(sorted, selectedGroup, enrichment),
    [sorted, selectedGroup, enrichment],
  );

  const groupCounts = useMemo(() => {
    const ids: GroupId[] = ['all', 'main', 'test', 'fast', 'whales'];
    return Object.fromEntries(
      ids.map((g) => [g, filterTrackersByGroup(sorted, g, enrichment).length]),
    ) as Record<GroupId, number>;
  }, [sorted, enrichment]);

  const filtered = useMemo(() => {
    const q = tableSearch.trim().toLowerCase();
    if (!q) return groupFiltered;
    return groupFiltered.filter(
      (t) =>
        t.walletAddress.toLowerCase().includes(q) ||
        (t.label ?? '').toLowerCase().includes(q),
    );
  }, [groupFiltered, tableSearch]);

  const isWalletView = viewTab === 'all' || viewTab === 'wallet_manager';

  const exportJson = useCallback(() => {
    const blob = new Blob([JSON.stringify({ trackers: sorted }, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pointer-trackers-ton.json';
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
      // treat as plaintext list and extract address-like lines (TON or legacy base58)
      for (const line of raw.split(/\r?\n/)) {
        const addr = line.trim().split(/\s+/)[0] ?? '';
        if (addr) set.add(addr);
      }
    }

    const addresses = [...set].filter(isValidTonTrackedAddress);
    if (addresses.length === 0) {
      toast.error('No valid TON wallet addresses found');
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
        className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-b px-2 py-1.5"
        style={{ borderColor: AX_BORDER, backgroundColor: AX_BG }}
      >
        <div className="flex min-w-0 max-w-[100%] flex-[1_1_auto] flex-wrap items-center gap-0.5 sm:max-w-[55%] md:max-w-[50%]">
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

        <div className="order-3 flex min-w-0 w-full flex-[1_1_200px] sm:order-none sm:w-auto sm:max-w-md">
          <div
            className="flex w-full items-center gap-1 rounded border px-2 py-0.5"
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

        <div className="ml-auto flex flex-[0_0_auto] flex-wrap items-center gap-1">
          <button
            type="button"
            disabled={sorted.length === 0 || removeAllMutation.isPending}
            onClick={() => {
              if (!window.confirm('Remove all tracked wallets? This cannot be undone.')) return;
              removeAllMutation.mutate();
            }}
            className="rounded px-1.5 py-1 text-[10px] font-semibold tracking-wide text-[#f87171] hover:underline disabled:opacity-40"
          >
            Remove all
          </button>
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

      {activeChain !== 'ton' ? (
        <div
          className="mx-3 mt-2 rounded-lg border px-3 py-2 text-[11px] text-[#9ca3af]"
          style={{ borderColor: '#2a3644', backgroundColor: '#10141c' }}
        >
          Saved trackers load for <span className="font-semibold text-white">TON</span> right now. Switch the header to TON to see them, or use{' '}
          <span className="text-white">KOLs</span> for Solana / EVM previews.
        </div>
      ) : null}

      {activeChain === 'ton' && listQuery.isLoading ? (
        <div className="flex flex-1 items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[#5865F2]" />
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-12 overflow-hidden" style={{ backgroundColor: AX_BG }}>
          <aside className="relative z-10 col-span-12 min-h-0 border-r md:col-span-2" style={{ borderColor: AX_BORDER, backgroundColor: AX_PANEL }}>
            <div className="border-b px-2 py-2" style={{ borderColor: AX_BORDER }}>
              <button
                type="button"
                onClick={() => setSelectedGroup('all')}
                className={cn(
                  'flex w-full items-center justify-between rounded px-2 py-2 text-[11px] transition',
                  selectedGroup === 'all' ? 'border bg-[#1c2030] text-white' : 'text-[#9ca3af] hover:bg-white/5',
                )}
                style={{ borderColor: selectedGroup === 'all' ? '#5865F2' : 'transparent' }}
              >
                <span className="inline-flex items-center gap-1.5">
                  <span>{groupIcon('all')}</span>All
                </span>
                <span className="text-[#6b7280]">{groupCounts.all}</span>
              </button>
            </div>
            <div className="px-2 py-2">
              <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-[#9ca3af]">
                <span>Groups</span>
                <button
                  type="button"
                  className="text-[#9ca3af] hover:text-white"
                  onClick={() => toast.message('Custom groups', { description: 'Saved groups ship in a later release.' })}
                >
                  +
                </button>
              </div>
              {(['main', 'test', 'fast', 'whales'] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setSelectedGroup(g)}
                  className={cn(
                    'mb-1 flex w-full items-center justify-between rounded px-2 py-2 text-[11px] transition',
                    selectedGroup === g ? 'border bg-[#1c2030] text-white' : 'text-[#9ca3af] hover:bg-white/5',
                  )}
                  style={{ borderColor: selectedGroup === g ? '#5865F2' : 'transparent' }}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <span>{groupIcon(g)}</span>
                    {groupLabel(g)}
                  </span>
                  <span className="text-[#6b7280]">{groupCounts[g]}</span>
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
              <KolsList
                rows={kolRows}
                onRemove={(id) => {
                  setKolRows((prev) => prev.filter((r) => r.id !== id));
                  toast.success('Removed from list');
                }}
                onWalletClick={(addr) => setKolWalletFocus(addr)}
              />
            ) : (
              <MonitorGrid />
            )}
          </main>

          <aside className="col-span-12 min-h-0 border-l md:col-span-3" style={{ borderColor: AX_BORDER, backgroundColor: AX_PANEL }}>
            <SecondaryPanel
              viewTab={viewTab}
              rows={kolRows}
              onRemove={(id) => {
                setKolRows((prev) => prev.filter((r) => r.id !== id));
                toast.success('Removed from list');
              }}
              onWalletClick={(addr) => setKolWalletFocus(addr)}
            />
          </aside>
        </div>
      )}

      {kolWalletFocus ? (
        <KolWalletPopup address={kolWalletFocus} onClose={() => setKolWalletFocus(null)} />
      ) : null}

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
            <span className="text-[13px] font-semibold text-white">Import TON Wallets</span>
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
            <p className="text-[10px] text-[#6b7280]">
              Paste EQ/UQ TON wallet addresses (one per line) or a JSON export from this app.
            </p>
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

function KolWalletPopup({ address, onClose }: { address: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/70" aria-label="Close" onClick={onClose} />
      <div
        className="relative z-[1] w-full max-w-md rounded-lg border p-4 shadow-2xl"
        style={{ backgroundColor: AX_PANEL, borderColor: AX_BORDER }}
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[13px] font-semibold text-white">KOL wallet</span>
          <button type="button" onClick={onClose} className="rounded p-1 text-[#6b7280] hover:bg-white/5 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-4 break-all font-mono text-[11px] leading-relaxed text-[#d1d5db]">{address}</p>
        <div className="flex flex-wrap gap-2">
          <CopyButton
            value={address}
            label="Copy address"
            className="rounded border border-[#2a2f3a] px-3 py-1.5 text-[11px] text-[#d1d5db]"
          >
            Copy
          </CopyButton>
          <Link
            href={`/wallet/${encodeURIComponent(address)}`}
            className="inline-flex items-center rounded bg-[#5865F2] px-3 py-1.5 text-[11px] font-semibold text-[#0a0a0f] hover:brightness-105"
          >
            Open in Pointer
          </Link>
        </div>
      </div>
    </div>
  );
}

function FragmentRow({
  tracker,
  rowBg,
  tonUi,
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
  tonUi: number | null;
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
        <td className="whitespace-nowrap px-1.5 py-1.5 align-middle tabular-nums text-[#6b7280]">
          {formatAgeShort(tracker.createdAt)}
        </td>
        <td className="max-w-[14rem] px-1.5 py-1.5 align-middle">
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
        <td className="whitespace-nowrap px-1.5 py-1.5 align-middle tabular-nums font-medium text-[#5eead4]">
          {tonUi != null ? formatNumber(tonUi, { decimals: tonUi < 1 ? 4 : 2 }) : '—'}
        </td>
        <td className="whitespace-nowrap px-1.5 py-1.5 align-middle tabular-nums text-[#6b7280]">
          {lastUnix != null ? formatLastActiveShort(lastUnix) : '—'}
        </td>
        <td className="px-1.5 py-1.5 align-middle">
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
          <th className="whitespace-nowrap px-1.5 py-2 font-semibold uppercase tracking-wide text-[#6b7280]">Balance (TON)</th>
          <th className="whitespace-nowrap px-1.5 py-1 font-semibold uppercase tracking-wide text-[#6b7280]">Last Active</th>
          <th className="w-24 px-1.5 py-1 text-right font-semibold uppercase tracking-wide text-[#6b7280]">Actions</th>
        </tr>
      </thead>
      <tbody>
        {filtered.map((t, i) => {
          const en = enrichment[t.walletAddress];
          let tonUi: number | null = null;
          if (en?.nanoTon != null) {
            try {
              tonUi = rawToUi(en.nanoTon, 9);
            } catch {
              tonUi = null;
            }
          }
          const rowBg = i % 2 === 0 ? AX_ROW_A : AX_ROW_B;
          const addrDeleting = removeMutation.isPending && removeMutation.variables === t.walletAddress;
          return (
            <FragmentRow
              key={t.id}
              tracker={t}
              rowBg={rowBg}
              tonUi={tonUi}
              lastUnix={en?.lastActiveUnix ?? null}
              expanded={expandedRuleId === t.id}
              onToggleRules={() => setExpandedRuleId((id) => (id === t.id ? null : t.id))}
              onRemove={() => removeMutation.mutate(t.walletAddress)}
              removePending={addrDeleting}
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

function KolsList({
  rows,
  onRemove,
  onWalletClick,
}: {
  rows: KolRow[];
  onRemove: (id: string) => void;
  onWalletClick: (walletAddress: string) => void;
}) {
  const [kolSearch, setKolSearch] = useState('');
  const filtered = useMemo(() => {
    const s = kolSearch.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(s) ||
        r.handle.toLowerCase().includes(s) ||
        r.wallet.toLowerCase().includes(s),
    );
  }, [rows, kolSearch]);

  return (
    <div className="grid min-h-0 grid-cols-12">
      <div className="col-span-5 border-r p-2" style={{ borderColor: AX_BORDER }}>
        <div className="mb-2 rounded border px-2 py-1.5" style={{ borderColor: AX_BORDER, backgroundColor: AX_PANEL }}>
          <input
            value={kolSearch}
            onChange={(e) => setKolSearch(e.target.value)}
            className="w-full bg-transparent text-[11px] outline-none placeholder:text-[#4b5563]"
            placeholder="Search KOLs…"
          />
        </div>
        <div className="space-y-0.5">
          {filtered.map((row, i) => (
            <button
              key={row.id}
              type="button"
              onClick={() => onWalletClick(row.wallet)}
              className="flex w-full items-center gap-2 rounded px-2 py-2.5 text-left transition hover:bg-white/5"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#20263a] text-[11px] text-[#9ca3af]">
                {(row.name[0] ?? '?').toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold text-white">{row.name}</div>
                <div className="truncate text-[11px] text-[#6b7280]">{row.handle}</div>
              </div>
              <span className="shrink-0 text-[11px] text-[#6b7280]">#{i + 1}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="col-span-7 min-h-0 overflow-auto">
        <table className="w-full text-[11px]">
          <tbody>
            {filtered.map((row, i) => (
              <tr
                key={`${row.id}-addr`}
                className="border-b"
                style={{ borderColor: AX_BORDER, backgroundColor: i % 2 === 0 ? AX_ROW_A : AX_ROW_B }}
              >
                <td className="px-2 py-2.5">
                  <button
                    type="button"
                    onClick={() => onWalletClick(row.wallet)}
                    className="max-w-[14rem] truncate text-left font-mono text-white hover:text-[#7dd3fc] hover:underline"
                  >
                    {shortenAddress(row.wallet, 6)}
                  </button>
                </td>
                <td className="whitespace-nowrap px-2 py-2.5 text-right text-[#9ca3af]">—</td>
                <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums text-[#d1d5db]">{row.followers}</td>
                <td className="px-2 py-2.5 text-right">
                  <button
                    type="button"
                    onClick={() => onRemove(row.id)}
                    className="font-semibold text-[#fb7185] hover:underline"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SecondaryPanel({
  viewTab,
  rows,
  onRemove,
  onWalletClick,
}: {
  viewTab: ViewTab;
  rows: KolRow[];
  onRemove: (id: string) => void;
  onWalletClick: (walletAddress: string) => void;
}) {
  const [headerTab, setHeaderTab] = useState(0);
  const [listTab, setListTab] = useState<'my' | 'top'>('my');

  const showRows = viewTab === 'kols' ? rows : rows.slice(0, Math.min(8, rows.length));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex border-b text-[11px]" style={{ borderColor: AX_BORDER }}>
        {(['Customize Feed', 'Twitter Alerts', 'Socials'] as const).map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => setHeaderTab(i)}
            className={cn(
              'px-2 py-2 font-semibold transition',
              headerTab === i ? 'text-white' : 'text-[#6b7280] hover:text-white',
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {headerTab === 0 ? (
        <>
          <div className="border-b p-2 text-[10px] text-[#9ca3af]" style={{ borderColor: AX_BORDER }}>
            Tracked X handles for this TON build. Click a handle or use Remove to edit your list (saved in this browser).
          </div>
          <div className="flex items-center gap-2 border-b p-2" style={{ borderColor: AX_BORDER }}>
            <button
              type="button"
              onClick={() => setListTab('my')}
              className={cn(
                'rounded px-2 py-1.5 text-[10px] font-semibold transition',
                listTab === 'my' ? 'bg-white/10 text-white' : 'text-[#6b7280] hover:text-white',
              )}
            >
              My List
            </button>
            <button
              type="button"
              onClick={() => setListTab('top')}
              className={cn(
                'rounded px-2 py-1.5 text-[10px] font-semibold transition',
                listTab === 'top' ? 'bg-white/10 text-white' : 'text-[#6b7280] hover:text-white',
              )}
            >
              Top Subscriptions
            </button>
            <span className="ml-auto text-[10px] text-[#9ca3af]">{rows.length} saved</span>
          </div>
          <div
            className="grid grid-cols-4 border-b px-2 py-2 text-[10px] font-medium text-[#6b7280]"
            style={{ borderColor: AX_BORDER }}
          >
            <span>Handle</span>
            <span>Tweets</span>
            <span>Profile</span>
            <span className="text-right">Actions</span>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            {listTab === 'my'
              ? showRows.map((row, i) => (
                  <div
                    key={`${row.id}-feed`}
                    className="grid grid-cols-4 border-b px-2 py-2.5 text-[10px] leading-snug"
                    style={{ borderColor: AX_BORDER, backgroundColor: i % 2 === 0 ? AX_ROW_A : AX_ROW_B }}
                  >
                    <button
                      type="button"
                      onClick={() => onWalletClick(row.wallet)}
                      className="truncate text-left text-white hover:text-[#7dd3fc] hover:underline"
                    >
                      {row.handle}
                    </button>
                    <span className="text-[#9ca3af]">—</span>
                    <span className="text-[#5eead4]">Live</span>
                    <div className="text-right">
                      <button
                        type="button"
                        onClick={() => onRemove(row.id)}
                        className="font-semibold text-[#fb7185] hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))
              : null}
            {listTab === 'top' ? (
              <div className="p-3 text-[11px] text-[#6b7280]">Browse top subscriptions in a future update.</div>
            ) : null}
          </div>
        </>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto p-3 text-[11px] text-[#6b7280]">
          {headerTab === 1
            ? 'Twitter alert routing for new TON listings is wired from the Alert Builder.'
            : 'Social connectors (Telegram, etc.) ship in a later release.'}
        </div>
      )}
    </div>
  );
}
