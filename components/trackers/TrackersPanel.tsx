'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import {
  Activity,
  AlignJustify,
  BarChart3,
  Bell,
  BellOff,
  ExternalLink,
  Layers,
  Loader2,
  MessageCircle,
  Rss,
  Search,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { TrackerRulesSection } from '@/components/trackers/TrackerRulesSection';
import { WalletIdentityAnchor } from '@/components/wallet/identity/WalletIdentityAnchor';
import { CopyButton } from '@/components/shared/CopyButton';
import { useEntityHover } from '@/lib/hooks/useEntityHover';
import { useOverlayPresence } from '@/lib/hooks/useOverlayPresence';
import { isValidTrackedWalletAddress } from '@/lib/chains/mintKind';
import { shortenAddress } from '@/lib/utils/addresses';
import { formatAgeShort, formatLastActiveShort, formatNumber, rawToUi } from '@/lib/utils/formatters';
import { cn } from '@/lib/utils/cn';
import { overlayBackdropClasses, overlayPanelClasses } from '@/lib/ui/overlayMotion';
import type { AppChainId } from '@/lib/chains/appChain';
import { mintMatchesAppChain } from '@/lib/chains/mintKind';
import { nativeTicker } from '@/lib/chains/nativeCurrency';
import { useUIStore } from '@/store/ui';
import { useWalletIntelStore } from '@/store/walletIntelStore';
import { useActiveWalletStore } from '@/store/activeWallet';
import { generateEmbeddedWalletForChain } from '@/lib/wallets/embeddedCreate';
import { dispatchSolanaAccountRefresh } from '@/lib/client/portfolioRefreshEvents';
import {
  kolStorageKey,
  readStoredKolRows,
  writeStoredKolRows,
  type KolHandleRow as KolRow,
} from '@/lib/track/kolHandlesLocal';
import {
  chainSupportsStarterKolMint,
  starterKolEntriesForChain,
} from '@/lib/track/starterKolPacks';
import { xProfileUrl } from '@/lib/utils/xSearch';
import Link from 'next/link';
import { ConfirmModal, GlassModal } from '@/components/ui/GlassModal';
import { modalBtnPrimaryClass, modalBtnSecondaryClass } from '@/lib/ui/modalChrome';

type TrackerRow = {
  id: string;
  walletAddress: string;
  label: string | null;
  notify: boolean;
  groupId: string | null;
  createdAt: string;
};

type TrackerGroupSummary = {
  id: string;
  label: string;
  appChain: AppChainId;
  isStarter: boolean;
  sortOrder: number;
  walletCount: number;
};

type EnrichmentEntry = {
  nanoTon: string | null;
  lastActiveUnix: number | null;
};

type EnrichmentMap = Record<string, EnrichmentEntry>;

type ViewTab = 'all' | 'wallet_manager' | 'live_trades' | 'monitor' | 'kols';

const VIEW_TABS: { id: ViewTab; label: string }[] = [
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

type LegacyGroupId = 'main' | 'test' | 'fast' | 'whales';
type SelectedFilter = 'all' | LegacyGroupId | `grp:${string}`;

function filterTrackersByLegacyGroup(
  rows: TrackerRow[],
  group: LegacyGroupId | 'all',
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

function filterTrackersBySelection(
  rows: TrackerRow[],
  selection: SelectedFilter,
  enrichment: EnrichmentMap,
): TrackerRow[] {
  if (selection.startsWith('grp:')) {
    const groupId = selection.slice(4);
    return rows.filter((r) => r.groupId === groupId);
  }
  return filterTrackersByLegacyGroup(rows, selection as 'all' | LegacyGroupId, enrichment);
}

function legacyGroupLabel(g: LegacyGroupId | 'all'): string {
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

function legacyGroupIcon(g: LegacyGroupId | 'all'): string {
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

function AddWalletDialog({
  open,
  onClose,
  chainTicker,
  address,
  setAddress,
  label,
  setLabel,
  onSubmit,
  pending,
  addressPlaceholder,
}: {
  open: boolean;
  onClose: () => void;
  chainTicker: string;
  address: string;
  setAddress: (s: string) => void;
  label: string;
  setLabel: (s: string) => void;
  onSubmit: () => void;
  pending: boolean;
  addressPlaceholder?: string;
}) {
  return (
    <GlassModal
      open={open}
      onClose={onClose}
      title="Add wallet"
      chainTicker={chainTicker}
      zClass="z-[80]"
      maxWidthClass="max-w-md"
      footer={
        <>
          <button type="button" onClick={onClose} className={modalBtnSecondaryClass}>
            Cancel
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={onSubmit}
            className={modalBtnPrimaryClass}
          >
            {pending ? 'Adding…' : 'Add wallet'}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <label className="block space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-fg-muted">Address</span>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={addressPlaceholder ?? 'Wallet address'}
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 tabular-nums text-[13px] text-fg-primary outline-none ring-accent-primary/30 placeholder:text-fg-muted focus:ring-2"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-fg-muted">Label (optional)</span>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. whale #1"
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[13px] text-fg-primary outline-none ring-accent-primary/30 placeholder:text-fg-muted focus:ring-2"
          />
        </label>
      </div>
    </GlassModal>
  );
}

export type TrackersPanelSurface = 'default' | 'track_hub';

export function TrackersPanel({
  className,
  prefillWallet,
  surface = 'default',
}: {
  className?: string;
  /** When set (e.g. from `/trackers?wallet=EQ…`), pre-fills add-tracker and opens the dialog. */
  prefillWallet?: string;
  /** `/track` hub: split wallets + tracked X accounts (matches dock Social → Track). */
  surface?: TrackersPanelSurface;
}) {
  const { authenticated, getAccessToken } = usePointerAuth();
  const queryClient = useQueryClient();
  const activeChain = useUIStore((s) => s.activeChain);
  const openWalletIntel = useWalletIntelStore((s) => s.openWallet);
  const setActiveWalletAddress = useActiveWalletStore((s) => s.setActiveWalletAddress);

  const [viewTab, setViewTab] = useState<ViewTab>('wallet_manager');
  const [tableSearch, setTableSearch] = useState('');
  const [creatingEmbedded, setCreatingEmbedded] = useState(false);
  const [newWalletPrivateKey, setNewWalletPrivateKey] = useState<string | null>(null);
  const [newWalletAddress, setNewWalletAddress] = useState<string | null>(null);
  const [revealPrivateKey, setRevealPrivateKey] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importSingleGroup, setImportSingleGroup] = useState(false);
  const [address, setAddress] = useState('');
  const [label, setLabel] = useState('');
  const [expandedRuleId, setExpandedRuleId] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<SelectedFilter>('all');
  const [kolRows, setKolRows] = useState<KolRow[]>(() => readStoredKolRows(useUIStore.getState().activeChain));
  const [socialsOpen, setSocialsOpen] = useState(surface === 'track_hub');
  const [removeAllConfirmOpen, setRemoveAllConfirmOpen] = useState(false);
  const lastPrefillRef = useRef<string | null>(null);
  const kolHydratingRef = useRef(false);

  const keyRevealOpen = Boolean(newWalletPrivateKey && newWalletAddress);
  const { mounted: keyRevealMounted, visible: keyRevealVisible } = useOverlayPresence(keyRevealOpen);

  useEffect(() => {
    kolHydratingRef.current = true;
    const nextRows = readStoredKolRows(activeChain);
    queueMicrotask(() => setKolRows(nextRows));
  }, [activeChain]);

  useEffect(() => {
    if (kolHydratingRef.current) {
      kolHydratingRef.current = false;
      return;
    }
    try {
      localStorage.setItem(kolStorageKey(activeChain), JSON.stringify(kolRows));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('pointer-kol-rows-updated'));
      }
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
    if (!isValidTrackedWalletAddress(raw, activeChain)) return;
    if (lastPrefillRef.current === raw) return;
    lastPrefillRef.current = raw;
    setAddress(raw);
    setViewTab('wallet_manager');
    setAddOpen(true);
  }, [prefillWallet, activeChain]);

  const listQuery = useQuery({
    queryKey: ['trackers', 'enriched', activeChain],
    enabled: authenticated,
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const q = `enrich=1&app_chain=${encodeURIComponent(activeChain)}`;
      const res = await fetch(`/api/trackers?${q}`, {
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
      return json as {
        trackers: TrackerRow[];
        groups?: TrackerGroupSummary[];
        enrichment?: EnrichmentMap;
      };
    },
    staleTime: 60_000,
  });

  const savedGroups = listQuery.data?.groups ?? [];

  useEffect(() => {
    if (!selectedGroup.startsWith('grp:')) return;
    const groupId = selectedGroup.slice(4);
    if (!savedGroups.some((g) => g.id === groupId)) {
      setSelectedGroup('all');
    }
  }, [activeChain, savedGroups, selectedGroup]);

  const addMutation = useMutation({
    mutationFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const walletAddress = address.trim();
      if (!mintMatchesAppChain(walletAddress, activeChain)) {
        throw new Error(
          `Enter a valid ${nativeTicker(activeChain)} wallet address for the current header chain.`,
        );
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
          appChain: activeChain,
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
      const res = await fetch(
        `/api/trackers?all=1&app_chain=${encodeURIComponent(activeChain)}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!res.ok) throw new Error('remove all failed');
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['trackers'] });
      toast.success('All trackers removed');
      setRemoveAllConfirmOpen(false);
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

  const mintStarterKolsMutation = useMutation({
    mutationFn: async () => {
      const rows = starterKolEntriesForChain(activeChain);
      if (rows.length === 0) throw new Error('No starter KOL pack for this chain');

      const token = await getAccessToken();
      if (token) {
        const res = await fetch('/api/trackers/mint-starter-kols', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ appChain: activeChain }),
        });
        const json: unknown = await res.json();
        if (!res.ok) {
          throw new Error(
            typeof json === 'object' && json && 'message' in json
              ? String((json as { message: unknown }).message)
              : 'Mint failed',
          );
        }
        const kolRowsFromApi =
          typeof json === 'object' &&
          json &&
          'kolRows' in json &&
          Array.isArray((json as { kolRows: unknown }).kolRows)
            ? ((json as { kolRows: KolRow[] }).kolRows)
            : rows;
        return kolRowsFromApi;
      }

      writeStoredKolRows(activeChain, rows);
      return rows;
    },
    onSuccess: (rows) => {
      kolHydratingRef.current = true;
      setKolRows(rows);
      writeStoredKolRows(activeChain, rows);
      void queryClient.invalidateQueries({ queryKey: ['trackers'] });
      const label =
        activeChain === 'sol'
          ? 'SOL'
          : activeChain === 'eth'
            ? 'ETH'
            : activeChain === 'bnb'
              ? 'BNB'
              : 'Base';
      toast.success(`Starter KOL list loaded (${label})`, {
        description: `${rows.length} wallets added to track + KOL labels.`,
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sorted = useMemo(() => {
    const rows = listQuery.data?.trackers ?? [];
    return [...rows].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [listQuery.data?.trackers]);

  const enrichment = useMemo(() => listQuery.data?.enrichment ?? {}, [listQuery.data?.enrichment]);

  const groupFiltered = useMemo(
    () => filterTrackersBySelection(sorted, selectedGroup, enrichment),
    [sorted, selectedGroup, enrichment],
  );

  const groupCounts = useMemo(() => {
    const legacyIds: Array<'all' | LegacyGroupId> = ['all', 'main', 'test', 'fast', 'whales'];
    const legacy = Object.fromEntries(
      legacyIds.map((g) => [g, filterTrackersByLegacyGroup(sorted, g, enrichment).length]),
    ) as Record<'all' | LegacyGroupId, number>;
    const saved = Object.fromEntries(
      savedGroups.map((g) => [g.id, sorted.filter((t) => t.groupId === g.id).length]),
    ) as Record<string, number>;
    return { legacy, saved };
  }, [sorted, enrichment, savedGroups]);

  const filtered = useMemo(() => {
    const q = tableSearch.trim().toLowerCase();
    if (!q) return groupFiltered;
    return groupFiltered.filter(
      (t) =>
        t.walletAddress.toLowerCase().includes(q) ||
        (t.label ?? '').toLowerCase().includes(q),
    );
  }, [groupFiltered, tableSearch]);

  const isWalletView = viewTab === 'wallet_manager';
  const showSocialColumn = surface === 'track_hub' || socialsOpen;
  const openWallet = useCallback(
    (walletAddress: string) => openWalletIntel({ address: walletAddress, chain: activeChain }),
    [activeChain, openWalletIntel],
  );

  const onCreateEmbedded = useCallback(async () => {
    setCreatingEmbedded(true);
    try {
      const { address: createdAddress, privateKeyDisplay } = await generateEmbeddedWalletForChain(activeChain);
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const res = await fetch('/api/wallets/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          wallet_address: createdAddress,
          is_imported: true,
          label: 'Embedded',
        }),
      });
      const json: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message =
          json && typeof json === 'object' && 'message' in json
            ? String((json as { message: unknown }).message)
            : 'Could not create wallet';
        if (res.status === 409) {
          toast.info('This wallet is already on your account');
          return;
        }
        throw new Error(message);
      }
      setNewWalletAddress(createdAddress);
      setNewWalletPrivateKey(privateKeyDisplay);
      setRevealPrivateKey(false);
      setActiveWalletAddress(createdAddress);
      void queryClient.invalidateQueries({ queryKey: ['wallets-my'] });
      void queryClient.invalidateQueries({ queryKey: ['portfolio'] });
      dispatchSolanaAccountRefresh('tracker_wallet_create');
    } catch (e) {
      toast.error('Could not create embedded wallet', {
        description: e instanceof Error ? e.message : 'Unknown error',
      });
    } finally {
      setCreatingEmbedded(false);
    }
  }, [activeChain, getAccessToken, queryClient, setActiveWalletAddress]);

  const exportJson = useCallback(() => {
    const blob = new Blob([JSON.stringify({ trackers: sorted }, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pointer-trackers-${activeChain}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Exported');
  }, [sorted, activeChain]);

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

    const addresses = [...set].filter((a) => mintMatchesAppChain(a, activeChain));
    if (addresses.length === 0) {
      toast.error(`No valid ${nativeTicker(activeChain)} wallet addresses found`);
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
          appChain: activeChain,
        }),
      });
      if (res.ok) ok += 1;
    }

    void queryClient.invalidateQueries({ queryKey: ['trackers'] });
    setImportOpen(false);
    setImportText('');
    toast.success(`Imported ${ok}/${addresses.length} wallet(s)`);
  }, [getAccessToken, importSingleGroup, importText, queryClient, activeChain]);

  if (!authenticated) {
    return (
      <div
        className={cn(
          'rounded border border-border-subtle bg-bg-raised p-3 text-[12px] text-fg-secondary',
          className,
        )}
      >
        Sign in to manage wallet trackers.
      </div>
    );
  }

  return (
    <div className={cn('flex h-full min-h-0 min-w-0 flex-1 flex-col text-[12px] text-fg-secondary', className)}>
      {keyRevealMounted && newWalletPrivateKey && newWalletAddress ? (
        <div className="fixed inset-0 z-[700] flex items-center justify-center p-4" role="presentation">
          <button
            type="button"
            className={cn(
              'absolute inset-0 bg-black/70 backdrop-blur-sm',
              overlayBackdropClasses(keyRevealVisible),
              'fill-mode-forwards',
            )}
            aria-label="Dismiss"
            onClick={() => {
              setNewWalletPrivateKey(null);
              setNewWalletAddress(null);
              setRevealPrivateKey(false);
            }}
          />
          <div
            className={cn(
              'relative z-[1] max-h-[min(90dvh,640px)] w-full max-w-lg overflow-y-auto rounded-xl border border-border-subtle bg-bg-raised p-4 shadow-2xl fill-mode-forwards',
              overlayPanelClasses(keyRevealVisible),
            )}
            role="dialog"
            aria-modal
            aria-label="Save private key"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h2 className="text-[15px] font-semibold text-fg-primary">Save your private key</h2>
            <p className="mt-2 text-[12px] leading-snug text-fg-muted">
              This backs up{' '}
              <span className="tabular-nums text-fg-primary">{shortenAddress(newWalletAddress, 6)}</span>.
              Store it offline. Anyone with this key controls the wallet.
            </p>
            <div
              className={cn(
                'mt-3 rounded-lg border border-border-subtle bg-bg-sunken p-3 font-mono text-[11px] leading-relaxed text-fg-secondary transition-all duration-150',
                !revealPrivateKey && 'blur-md select-none',
              )}
            >
              {newWalletPrivateKey}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-md border border-border-subtle bg-bg-sunken px-3 py-1.5 text-[11px] font-semibold text-fg-secondary hover:bg-bg-hover"
                onClick={() => setRevealPrivateKey((v) => !v)}
              >
                {revealPrivateKey ? 'Hide key' : 'Reveal key'}
              </button>
              <button
                type="button"
                className="rounded-md bg-accent-primary px-3 py-1.5 text-[11px] font-semibold text-fg-inverse hover:brightness-110"
                onClick={() => {
                  void navigator.clipboard.writeText(newWalletPrivateKey);
                  toast.success('Private key copied');
                }}
              >
                Copy key
              </button>
              <button
                type="button"
                className="rounded-md border border-border-subtle bg-bg-sunken px-3 py-1.5 text-[11px] text-fg-secondary hover:bg-bg-hover"
                onClick={() => {
                  setNewWalletPrivateKey(null);
                  setNewWalletAddress(null);
                  setRevealPrivateKey(false);
                }}
              >
                I saved it
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <header className="mb-0 flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border-subtle/45 px-4 py-2.5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[16px] font-semibold leading-tight text-fg-primary">
              {surface === 'track_hub' ? 'Wallet Manager' : 'Wallets'}
            </h1>
            <span className="rounded-full border border-white/[0.07] bg-white/[0.035] px-2 py-0.5 text-[10px] text-[#9ca3af]">
              {sorted.length} tracked
            </span>
            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">
              {groupCounts.legacy.all} active
            </span>
            <span className="rounded-full border border-white/[0.07] bg-white/[0.035] px-2 py-0.5 text-[10px] text-[#9ca3af]">
              {kolRows.length} KOLs
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-fg-muted">
            {surface === 'track_hub'
              ? 'Tracked wallets on the left · X accounts on the right (dock Social opens here).'
              : 'Manage embedded, linked, and tracked wallets.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            disabled={creatingEmbedded}
            onClick={() => void onCreateEmbedded()}
            className="h-8 rounded border border-border-subtle bg-bg-sunken px-3 text-xs font-medium text-fg-secondary transition-colors hover:bg-bg-hover hover:text-fg-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creatingEmbedded ? 'Creating…' : 'Create Embedded'}
          </button>
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="h-8 rounded border border-border-subtle bg-bg-sunken px-3 text-xs font-medium text-fg-secondary transition-colors hover:bg-bg-hover hover:text-fg-primary"
          >
            Import
          </button>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="h-8 rounded bg-accent-primary px-3 text-xs font-medium text-fg-inverse transition-colors hover:brightness-110"
          >
            Add Wallet
          </button>
          <button
            type="button"
            onClick={exportJson}
            disabled={sorted.length === 0}
            className="h-8 rounded border border-border-subtle bg-bg-sunken px-3 text-xs font-medium text-fg-secondary transition-colors hover:bg-bg-hover hover:text-fg-primary disabled:cursor-not-allowed disabled:opacity-40"
          >
            Export
          </button>
          {surface !== 'track_hub' ? (
          <button
            type="button"
            onClick={() => setSocialsOpen((v) => !v)}
            data-active={socialsOpen ? 'true' : 'false'}
            className={cn(
              'ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-primary',
              socialsOpen && 'bg-bg-hover text-fg-primary',
            )}
            title={socialsOpen ? 'Hide X triggers' : 'Show X triggers'}
            aria-pressed={socialsOpen}
          >
            <MessageCircle className="h-4 w-4" strokeWidth={2} />
          </button>
          ) : null}
        </div>
      </header>

      {listQuery.isLoading ? (
        <div className="flex flex-1 items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-accent-primary" />
        </div>
      ) : (
        <div
          className={cn(
            'flex min-h-0 flex-1 border-t border-border-subtle bg-bg-base',
            surface === 'track_hub' && 'flex-col lg:flex-row',
          )}
        >
          <div
            className={cn(
              'flex min-h-0 min-w-0 flex-1',
              surface === 'track_hub' &&
                'min-h-[42vh] border-border-subtle lg:min-h-0 lg:border-r lg:border-border-subtle',
            )}
          >
          <aside className="flex w-[220px] shrink-0 flex-col border-r border-border-subtle bg-bg-raised">
            <div className="border-b border-border-subtle px-2 py-2">
              <button
                type="button"
                onClick={() => setSelectedGroup('all')}
                className={cn(
                  'flex w-full items-center justify-between rounded px-2 py-2 text-[11px] transition',
                  selectedGroup === 'all'
                    ? 'border border-accent-primary bg-bg-hover text-fg-primary'
                    : 'text-fg-secondary hover:bg-bg-hover',
                )}
              >
                <span className="inline-flex items-center gap-1.5">
                  <span>{legacyGroupIcon('all')}</span>All
                </span>
                <span className="text-fg-muted">{groupCounts.legacy.all}</span>
              </button>
            </div>
            <div className="px-2 py-2">
              <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-fg-muted">
                <span>Groups</span>
                <button
                  type="button"
                  className="text-fg-muted hover:text-fg-primary"
                  onClick={() =>
                    toast.message('Custom groups', { description: 'Saved groups ship in a later release.' })
                  }
                >
                  +
                </button>
              </div>
              {savedGroups.map((g) => {
                const filterId = `grp:${g.id}` as const;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setSelectedGroup(filterId)}
                    className={cn(
                      'mb-1 flex w-full items-center justify-between rounded px-2 py-2 text-[11px] transition',
                      selectedGroup === filterId
                        ? 'border border-accent-primary bg-bg-hover text-fg-primary'
                        : 'text-fg-secondary hover:bg-bg-hover',
                    )}
                  >
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                      <span>{g.isStarter ? '✦' : '📁'}</span>
                      <span className="truncate">{g.label}</span>
                    </span>
                    <span className="shrink-0 text-fg-muted">
                      {groupCounts.saved[g.id] ?? g.walletCount}
                    </span>
                  </button>
                );
              })}
              {savedGroups.length > 0 ? (
                <div className="mb-1 mt-2 px-1 text-[10px] font-semibold uppercase tracking-wide text-fg-muted/80">
                  Filters
                </div>
              ) : null}
              {(['main', 'test', 'fast', 'whales'] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setSelectedGroup(g)}
                  className={cn(
                    'mb-1 flex w-full items-center justify-between rounded px-2 py-2 text-[11px] transition',
                    selectedGroup === g
                      ? 'border border-accent-primary bg-bg-hover text-fg-primary'
                      : 'text-fg-secondary hover:bg-bg-hover',
                  )}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <span>{legacyGroupIcon(g)}</span>
                    {legacyGroupLabel(g)}
                  </span>
                  <span className="text-fg-muted">{groupCounts.legacy[g]}</span>
                </button>
              ))}
            </div>
          </aside>

          <main className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="flex flex-wrap items-center gap-2 border-b border-border-subtle px-4 py-2">
              <div className="flex min-w-0 flex-wrap items-center gap-1">
                <AlignJustify className="mr-1 hidden h-3.5 w-3.5 shrink-0 text-fg-muted sm:block" strokeWidth={2} />
                {VIEW_TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setViewTab(t.id)}
                    className="tracker-tab whitespace-nowrap"
                    data-active={viewTab === t.id ? 'true' : 'false'}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="flex min-w-[10rem] max-w-md flex-1">
                <div className="flex w-full items-center gap-2 rounded border border-border-subtle bg-bg-sunken px-2 py-1">
                  <Search className="h-3 w-3 shrink-0 text-fg-muted" strokeWidth={2} />
                  <input
                    value={tableSearch}
                    onChange={(e) => setTableSearch(e.target.value)}
                    placeholder="Search by name or addr…"
                    className="min-w-0 flex-1 border-0 bg-transparent py-0.5 text-xs text-fg-primary outline-none placeholder:text-fg-muted"
                  />
                </div>
              </div>

              <button
                type="button"
                disabled={sorted.length === 0 || removeAllMutation.isPending}
                onClick={() => setRemoveAllConfirmOpen(true)}
                className="shrink-0 rounded px-2 py-1 text-[10px] font-semibold tracking-wide text-signal-bear hover:underline disabled:cursor-not-allowed disabled:opacity-40"
              >
                Remove all
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
              {isWalletView ? (
                <WalletManagerTable
                  filtered={filtered}
                  enrichment={enrichment}
                  expandedRuleId={expandedRuleId}
                  setExpandedRuleId={setExpandedRuleId}
                  removeMutation={removeMutation}
                  notifyMutation={notifyMutation}
                  nativeSym={nativeTicker(activeChain)}
                  onOpenWallet={openWallet}
                />
              ) : viewTab === 'live_trades' ? (
                <LiveTradesEmptyState />
              ) : viewTab === 'monitor' ? (
                <MonitorEmptyState />
              ) : viewTab === 'kols' ? (
                <KolsManagerTable
                  rows={kolRows}
                  activeChain={activeChain}
                  canMintStarter={chainSupportsStarterKolMint(activeChain)}
                  mintPending={mintStarterKolsMutation.isPending}
                  starterCount={starterKolEntriesForChain(activeChain).length}
                  onMintStarter={() => mintStarterKolsMutation.mutate()}
                  onRemove={(id) => {
                    setKolRows((prev) => prev.filter((r) => r.id !== id));
                    toast.success('Removed from list');
                  }}
                  onWalletClick={openWallet}
                />
              ) : null}
            </div>
          </main>
          </div>

          {showSocialColumn ? (
            <aside
              className={cn(
                'flex min-h-0 flex-col overflow-hidden border-border-subtle bg-bg-raised',
                surface === 'track_hub'
                  ? 'min-h-[36vh] w-full min-w-0 flex-1 border-t lg:min-h-0 lg:w-auto lg:border-t-0 lg:border-l'
                  : 'w-[320px] shrink-0 border-l',
              )}
            >
              <TrackedAccountsPanel
                rows={kolRows}
                onWalletClick={openWallet}
                onClose={surface === 'track_hub' ? undefined : () => setSocialsOpen(false)}
                variant={surface === 'track_hub' ? 'track_split' : 'drawer'}
                onAddHandleClick={() => setViewTab('kols')}
              />
            </aside>
          ) : null}
        </div>
      )}

      <AddWalletDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        chainTicker={nativeTicker(activeChain)}
        address={address}
        setAddress={setAddress}
        label={label}
        setLabel={setLabel}
        pending={addMutation.isPending}
        onSubmit={() => addMutation.mutate()}
        addressPlaceholder={
          activeChain === 'ton'
            ? 'TON address (EQ… / UQ…)'
            : activeChain === 'sol'
              ? 'Solana address (base58)'
              : 'EVM address (0x…)'
        }
      />

      <GlassModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import wallets"
        chainTicker={nativeTicker(activeChain)}
        zClass="z-[82]"
        maxWidthClass="max-w-sm"
      >
        <div className="space-y-3">
          <textarea
            rows={6}
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder="Paste wallet addresses (one per line) or JSON export"
            className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 tabular-nums text-[12px] text-fg-primary outline-none ring-accent-primary/30 placeholder:text-fg-muted focus:ring-2"
          />
          <label className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] text-fg-secondary">
            <span>Add to single group</span>
            <button
              type="button"
              onClick={() => setImportSingleGroup((v) => !v)}
              className={cn(
                'h-5 w-9 rounded-full border transition',
                importSingleGroup ? 'border-accent-primary bg-accent-primary' : 'border-white/15 bg-bg-hover',
              )}
              aria-label="Toggle single group"
            >
              <span
                className={cn(
                  'block h-3.5 w-3.5 rounded-full bg-white shadow transition',
                  importSingleGroup ? 'translate-x-4' : 'translate-x-0.5',
                )}
              />
            </button>
          </label>
          <p className="text-[10px] leading-relaxed text-fg-muted">
            Paste addresses for the selected chain (see badge). JSON export from Pointer is supported.
          </p>
          <button
            type="button"
            onClick={() => void onImportWallets()}
            className={cn(modalBtnPrimaryClass, 'w-full py-2.5')}
          >
            Import
          </button>
        </div>
      </GlassModal>

      <ConfirmModal
        open={removeAllConfirmOpen}
        onClose={() => setRemoveAllConfirmOpen(false)}
        onConfirm={() => removeAllMutation.mutate()}
        title="Remove all trackers?"
        body={`This permanently removes every ${nativeTicker(activeChain)} wallet from your tracker list. You can’t undo this.`}
        confirmLabel="Remove all"
        destructive
        pending={removeAllMutation.isPending}
        chainTicker={nativeTicker(activeChain)}
        zClass="z-[85]"
      />
    </div>
  );
}

function LiveTradesEmptyState() {
  return (
    <div className="flex h-full min-h-[240px] flex-col items-center justify-center px-8 text-center">
      <Activity className="mb-3 h-8 w-8 text-fg-muted" strokeWidth={2} aria-hidden />
      <p className="text-sm text-fg-secondary">Live trades from tracked wallets will appear here</p>
      <p className="mt-1 text-xs text-fg-muted">Add wallets in Wallet Manager to start tracking</p>
    </div>
  );
}

function MonitorEmptyState() {
  return (
    <div className="flex h-full min-h-[240px] flex-col items-center justify-center px-8 text-center">
      <Activity className="mb-3 h-8 w-8 text-fg-muted" strokeWidth={2} aria-hidden />
      <p className="text-sm text-fg-secondary">Monitor view</p>
      <p className="mt-1 text-xs text-fg-muted">Real-time activity dashboard across all tracked wallets</p>
    </div>
  );
}

function FragmentRow({
  tracker,
  zebraClass,
  tonUi,
  lastUnix,
  expanded,
  onToggleRules,
  onRemove,
  onOpenWallet,
  removePending,
  onNotify,
  notifyPending,
}: {
  tracker: TrackerRow;
  zebraClass: string;
  tonUi: number | null;
  lastUnix: number | null;
  expanded: boolean;
  onToggleRules: () => void;
  onRemove: () => void;
  onOpenWallet: () => void;
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
        tabIndex={0}
        role="button"
        aria-label={`Open wallet analytics for ${displayName}`}
        onClick={onOpenWallet}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpenWallet();
          }
        }}
        className={cn(
          'cursor-pointer border-b border-border-subtle outline-none transition-colors hover:bg-bg-hover focus-tr-accent',
          zebraClass,
        )}
        {...hoverProps}
      >
        <td className="whitespace-nowrap px-3 py-2 align-middle text-xs text-fg-muted tabular-nums">
          {formatAgeShort(tracker.createdAt)}
        </td>
        <td className="max-w-[18rem] px-3 py-2 align-middle">
          <div className="flex min-w-0 items-center gap-1">
            <span className="shrink-0 text-[13px] leading-none" aria-hidden>
              {walletEmoji(tracker.walletAddress)}
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-fg-primary">{displayName}</div>
              <div className="flex min-w-0 items-center gap-0.5 tabular-nums text-[10px] text-fg-muted">
                <span
                  className="max-w-[14rem] truncate"
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <WalletIdentityAnchor
                    address={tracker.walletAddress}
                    href={`/wallet/${encodeURIComponent(tracker.walletAddress)}`}
                    preferIntelModal
                    truncate={5}
                  />
                </span>
                <CopyButton
                  value={tracker.walletAddress}
                  iconOnly
                  label="Copy address"
                  iconClassName="h-3 w-3 rounded text-fg-muted opacity-80 hover:bg-bg-hover hover:text-fg-primary"
                />
              </div>
            </div>
          </div>
        </td>
        <td className="whitespace-nowrap px-3 py-2 align-middle text-right">
          <span className="font-mono text-xs tabular-nums text-fg-primary">
            {tonUi != null ? formatNumber(tonUi, { decimals: tonUi < 1 ? 4 : 2 }) : '—'}
          </span>
        </td>
        <td className="whitespace-nowrap px-3 py-2 align-middle text-xs text-fg-muted tabular-nums">
          {lastUnix != null ? formatLastActiveShort(lastUnix) : '—'}
        </td>
        <td className="group/act whitespace-nowrap px-3 py-2 align-middle">
          <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              disabled={notifyPending}
              onClick={(e) => {
                e.stopPropagation();
                onNotify(!tracker.notify);
              }}
              className={cn(
                'rounded p-1 text-fg-muted hover:bg-bg-hover hover:text-fg-primary',
                tracker.notify ? 'text-signal-bull' : '',
              )}
              aria-label={tracker.notify ? 'Notifications on' : 'Notifications off'}
            >
              {tracker.notify ? (
                <Bell className="h-3.5 w-3.5 cursor-pointer" strokeWidth={2} />
              ) : (
                <BellOff className="h-3.5 w-3.5 cursor-pointer" strokeWidth={2} />
              )}
            </button>
            <a
              href={`https://x.com/search?q=${encodeURIComponent(tracker.walletAddress)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded p-1 text-fg-muted hover:bg-bg-hover hover:text-fg-primary"
              aria-label="Search wallet on X"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="h-3.5 w-3.5 cursor-pointer" strokeWidth={2} aria-hidden />
            </a>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toast.message('Feed subscriptions', { description: 'Wallet activity RSS is not wired yet.' });
              }}
              className="rounded p-1 text-fg-muted hover:bg-bg-hover hover:text-fg-primary"
              aria-label="RSS"
            >
              <Rss className="h-3.5 w-3.5 cursor-pointer" strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenWallet();
              }}
              className="rounded p-1 text-fg-muted hover:bg-bg-hover hover:text-fg-primary"
              aria-label="Wallet analytics"
            >
              <BarChart3 className="h-3.5 w-3.5 cursor-pointer" strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleRules();
              }}
              className={cn(
                'rounded p-1 text-fg-muted hover:bg-bg-hover hover:text-fg-primary',
                expanded && 'text-accent-glow',
              )}
              aria-label="Wallet rules"
            >
              <Layers className="h-3.5 w-3.5 cursor-pointer" strokeWidth={2} />
            </button>
            <button
              type="button"
              aria-label="Remove tracker"
              disabled={removePending}
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="rounded p-1 text-fg-muted hover:bg-bg-hover hover:text-signal-bear disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5 cursor-pointer" strokeWidth={2} />
            </button>
          </div>
        </td>
      </tr>
      {expanded ? (
        <tr className={zebraClass}>
          <td colSpan={5} className="border-b border-border-subtle px-2 py-1">
            <div className="max-h-64 overflow-y-auto rounded border border-border-subtle bg-bg-raised">
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
  nativeSym,
  onOpenWallet,
}: {
  filtered: TrackerRow[];
  enrichment: EnrichmentMap;
  expandedRuleId: string | null;
  setExpandedRuleId: (value: string | null | ((prev: string | null) => string | null)) => void;
  removeMutation: ReturnType<typeof useMutation<void, Error, string>>;
  notifyMutation: ReturnType<typeof useMutation<void, Error, { walletAddress: string; notify: boolean }>>;
  nativeSym: string;
  onOpenWallet: (walletAddress: string) => void;
}) {
  if (filtered.length === 0) {
    return (
      <div className="flex h-full min-h-[240px] flex-col items-center justify-center px-8 text-center">
        <Wallet className="mb-3 h-8 w-8 text-fg-muted" strokeWidth={2} aria-hidden />
        <p className="text-sm text-fg-secondary">No tracked wallets in this group</p>
        <p className="mt-1 max-w-sm text-xs text-fg-muted">
          Try another sidebar group, clear search, or add a wallet — rows list from your saved trackers for the
          active chain.
        </p>
      </div>
    );
  }

  return (
    <table className="w-full border-collapse text-left">
      <thead className="sticky top-0 z-[1] border-b border-border-subtle bg-bg-sunken">
        <tr>
          <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-fg-muted">
            Created
          </th>
          <th className="min-w-[8rem] px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-fg-muted">
            Name
          </th>
          <th className="px-3 py-2 text-right text-[10px] font-medium uppercase tracking-wider text-fg-muted">
            Balance ({nativeSym})
          </th>
          <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-fg-muted">
            Last Active
          </th>
          <th className="w-40 px-3 py-2 text-right text-[10px] font-medium uppercase tracking-wider text-fg-muted">
            Actions
          </th>
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
          const zebraClass = i % 2 === 0 ? 'bg-desk-a' : 'bg-desk-b';
          const addrDeleting = removeMutation.isPending && removeMutation.variables === t.walletAddress;
          return (
            <FragmentRow
              key={t.id}
              tracker={t}
              zebraClass={zebraClass}
              tonUi={tonUi}
              lastUnix={en?.lastActiveUnix ?? null}
              expanded={expandedRuleId === t.id}
              onToggleRules={() => setExpandedRuleId((id) => (id === t.id ? null : t.id))}
              onRemove={() => removeMutation.mutate(t.walletAddress)}
              onOpenWallet={() => onOpenWallet(t.walletAddress)}
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

function KolsManagerTable({
  rows,
  onRemove,
  onWalletClick,
  activeChain,
  canMintStarter,
  mintPending,
  starterCount,
  onMintStarter,
}: {
  rows: KolRow[];
  onRemove: (id: string) => void;
  onWalletClick: (walletAddress: string) => void;
  activeChain: AppChainId;
  canMintStarter: boolean;
  mintPending: boolean;
  starterCount: number;
  onMintStarter: () => void;
}) {
  const nativeSym = nativeTicker(activeChain);
  const chainLabel =
    activeChain === 'sol'
      ? 'SOL'
      : activeChain === 'eth'
        ? 'ETH'
        : activeChain === 'bnb'
          ? 'BNB'
          : activeChain === 'base'
            ? 'Base'
            : activeChain.toUpperCase();
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

  const mintButton =
    canMintStarter && starterCount > 0 ? (
      <button
        type="button"
        disabled={mintPending}
        onClick={onMintStarter}
        className="btn-press rounded bg-accent-primary px-4 py-2 text-xs font-semibold text-fg-inverse hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {mintPending
          ? 'Loading…'
          : rows.length > 0
            ? `Refresh starter KOLs (${chainLabel})`
            : `Mint starter KOLs (${chainLabel})`}
      </button>
    ) : null;

  if (rows.length === 0) {
    return (
      <div className="flex h-full min-h-[240px] flex-col items-center justify-center px-8 text-center">
        <Layers className="mb-3 h-8 w-8 text-fg-muted" strokeWidth={2} aria-hidden />
        <p className="text-sm text-fg-secondary">No KOLs in your list yet</p>
        <p className="mt-1 max-w-sm text-xs text-fg-muted">
          {canMintStarter
            ? activeChain === 'sol'
              ? `Load ${starterCount} curated Solana KOL wallets (GMGN + Axiom + Kolscan seeds).`
              : `Load ${starterCount} curated EVM KOL wallets — same list on ETH, BNB, and Base.`
            : 'Switch to SOL, ETH, BNB, or Base in the header to mint a starter KOL list.'}
        </p>
        {mintButton ? <div className="mt-4">{mintButton}</div> : null}
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="flex h-full min-h-[200px] flex-col items-center justify-center px-8 text-center">
        <Search className="mb-3 h-7 w-7 text-fg-muted" strokeWidth={2} />
        <p className="text-sm text-fg-secondary">No KOL matches this search</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-col gap-2 p-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 max-w-md flex-1 items-center gap-2 rounded border border-border-subtle bg-bg-sunken px-2 py-1">
          <Search className="h-3 w-3 shrink-0 text-fg-muted" strokeWidth={2} />
          <input
            value={kolSearch}
            onChange={(e) => setKolSearch(e.target.value)}
            placeholder="Search KOLs…"
            className="min-w-0 flex-1 border-0 bg-transparent py-0.5 text-xs text-fg-primary outline-none placeholder:text-fg-muted"
          />
        </div>
        {mintButton}
      </div>
      <table className="w-full border-collapse overflow-hidden rounded border border-border-subtle">
        <thead className="border-b border-border-subtle bg-bg-sunken">
          <tr>
            <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-fg-muted">KOL</th>
            <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-fg-muted">
              Handle
            </th>
            <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-fg-muted">
              Wallet ({nativeSym})
            </th>
            <th className="px-3 py-2 text-right text-[10px] font-medium uppercase tracking-wider text-fg-muted">
              Followers
            </th>
            <th className="px-3 py-2 text-right text-[10px] font-medium uppercase tracking-wider text-fg-muted">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((row, i) => (
            <tr
              key={row.id}
              className={cn(
                'border-b border-border-subtle hover:bg-bg-hover',
                i % 2 === 0 ? 'bg-desk-a' : 'bg-desk-b',
              )}
            >
              <td className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border-subtle bg-bg-sunken text-[10px] font-bold text-fg-muted">
                    {(row.name[0] ?? '?').toUpperCase()}
                  </span>
                  <span className="text-sm font-medium text-fg-primary">{row.name}</span>
                </div>
              </td>
              <td className="px-3 py-2">
                <a
                  href={`https://x.com/${encodeURIComponent(row.handle.replace(/^@/, ''))}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-medium text-accent-glow hover:underline"
                >
                  {row.handle.startsWith('@') ? row.handle : `@${row.handle}`}
                </a>
              </td>
              <td className="max-w-[12rem] px-3 py-2">
                <button
                  type="button"
                  onClick={() => onWalletClick(row.wallet)}
                  className="truncate text-left font-mono text-xs text-fg-muted hover:text-fg-primary hover:underline"
                >
                  {shortenAddress(row.wallet, 6)}
                </button>
              </td>
              <td className="px-3 py-2 text-right text-xs tabular-nums text-fg-secondary">{row.followers}</td>
              <td className="px-3 py-2">
                <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                  <a
                    href={`https://x.com/${encodeURIComponent(row.handle.replace(/^@/, ''))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded p-1 text-fg-muted hover:bg-bg-hover hover:text-fg-primary"
                    aria-label="Open on X"
                  >
                    <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
                  </a>
                  <button
                    type="button"
                    className="rounded p-1 text-fg-muted hover:bg-bg-hover hover:text-fg-primary"
                    aria-label="Alerts placeholder"
                    onClick={() =>
                      toast.message('KOL alerts', { description: 'Rule alerts for this handle ship with Track workspace.' })
                    }
                  >
                    <Bell className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    className="rounded p-1 text-fg-muted hover:bg-bg-hover hover:text-fg-primary"
                    aria-label="Wallet intel"
                    onClick={() => onWalletClick(row.wallet)}
                  >
                    <Layers className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    className="rounded p-1 text-fg-muted hover:bg-bg-hover hover:text-signal-bear"
                    aria-label="Remove KOL"
                    onClick={() => onRemove(row.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TrackedAccountsPanel({
  rows,
  onWalletClick,
  onClose,
  variant,
  onAddHandleClick,
}: {
  rows: KolRow[];
  onWalletClick: (walletAddress: string) => void;
  onClose?: () => void;
  variant: 'drawer' | 'track_split';
  onAddHandleClick?: () => void;
}) {
  const [listTab, setListTab] = useState<'mine' | 'popular'>('mine');
  const [sideSearch, setSideSearch] = useState('');

  const filteredRows = useMemo(() => {
    const s = sideSearch.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(s) ||
        r.handle.toLowerCase().includes(s) ||
        r.wallet.toLowerCase().includes(s),
    );
  }, [rows, sideSearch]);

  const trackSplit = variant === 'track_split';

  const rowCard = (row: KolRow) => (
    <div
      key={`${row.id}-side`}
      className="flex items-center justify-between border-b border-border-subtle px-3 py-2 transition-colors hover:bg-bg-hover"
    >
      <div className="min-w-0 flex flex-col gap-0.5">
        <a
          href={xProfileUrl(row.handle)}
          target="_blank"
          rel="noopener noreferrer"
          className="truncate text-xs font-medium text-accent-glow hover:underline"
        >
          @{row.handle.replace(/^@/, '')}
        </a>
        <button
          type="button"
          onClick={() => onWalletClick(row.wallet)}
          className="truncate text-left font-mono text-[10px] text-fg-muted hover:text-fg-primary"
        >
          {shortenAddress(row.wallet, 5)}
        </button>
      </div>
      <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <a
          href={xProfileUrl(row.handle)}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded p-1 text-fg-muted hover:bg-bg-hover hover:text-fg-primary"
          aria-label="X profile"
        >
          <ExternalLink className="h-3 w-3" strokeWidth={2} />
        </a>
        <button
          type="button"
          className="rounded p-1 text-fg-muted hover:bg-bg-hover hover:text-fg-primary"
          aria-label="Alerts"
          onClick={() =>
            toast.message('Alerts', {
              description: 'Configure alert rules under Track → Automation.',
            })
          }
        >
          <Bell className="h-3 w-3" strokeWidth={2} />
        </button>
        <button
          type="button"
          className="rounded p-1 text-fg-muted hover:bg-bg-hover hover:text-fg-primary"
          aria-label="Wallet layers"
          onClick={() => onWalletClick(row.wallet)}
        >
          <Layers className="h-3 w-3" strokeWidth={2} />
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-col gap-2 border-b border-border-subtle bg-bg-raised/60 px-3 py-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-[13px] font-semibold leading-tight text-fg-primary">Tracked Accounts</h2>
            {trackSplit ? (
              <div className="mt-1.5 inline-flex rounded-lg border border-border-subtle bg-bg-sunken p-0.5">
                <span className="rounded-md bg-accent-primary/18 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-fg-primary">
                  X Feed
                </span>
              </div>
            ) : null}
          </div>
          {onClose ? (
            <button
              type="button"
              className="rounded p-1 text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-primary"
              aria-label="Close panel"
              onClick={onClose}
            >
              <X className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          ) : null}
        </div>

        {trackSplit ? (
          <>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setListTab('mine')}
                className={cn(
                  'rounded-md px-2.5 py-1 text-[11px] font-semibold transition',
                  listTab === 'mine'
                    ? 'bg-bg-hover text-fg-primary'
                    : 'text-fg-muted hover:bg-bg-hover hover:text-fg-secondary',
                )}
              >
                My list
              </button>
              <button
                type="button"
                onClick={() => setListTab('popular')}
                className={cn(
                  'rounded-md px-2.5 py-1 text-[11px] font-semibold transition',
                  listTab === 'popular'
                    ? 'bg-bg-hover text-fg-primary'
                    : 'text-fg-muted hover:bg-bg-hover hover:text-fg-secondary',
                )}
              >
                Popular
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex min-w-[8rem] flex-1 items-center gap-2 rounded border border-border-subtle bg-bg-sunken px-2 py-1">
                <Search className="h-3 w-3 shrink-0 text-fg-muted" strokeWidth={2} />
                <input
                  value={sideSearch}
                  onChange={(e) => setSideSearch(e.target.value)}
                  placeholder="Search by name or address"
                  className="min-w-0 flex-1 border-0 bg-transparent py-0.5 text-xs text-fg-primary outline-none placeholder:text-fg-muted"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  toast.message('Import handles', {
                    description: 'Use the KOLs tab on the left to add or paste handles.',
                  });
                  onAddHandleClick?.();
                }}
                className="h-8 shrink-0 rounded border border-border-subtle bg-bg-sunken px-3 text-[11px] font-medium text-fg-secondary transition-colors hover:bg-bg-hover hover:text-fg-primary"
              >
                Import
              </button>
              <button
                type="button"
                onClick={() => onAddHandleClick?.()}
                className="h-8 shrink-0 rounded bg-accent-primary px-3 text-[11px] font-semibold text-fg-inverse transition hover:brightness-110"
              >
                Add handle
              </button>
            </div>
          </>
        ) : (
          <Link
            href="/track"
            prefetch
            className="flex h-8 w-full items-center justify-center rounded-lg bg-accent-primary/15 text-[11px] font-semibold text-accent-primary transition-colors hover:bg-accent-primary/25"
          >
            Open Track hub
          </Link>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto overflow-x-hidden">
        {trackSplit && listTab === 'popular' ? (
          <p className="px-4 py-10 text-center text-[12px] text-fg-muted">Popular handles are coming soon.</p>
        ) : (
          <>
            {filteredRows.map((row) => rowCard(row))}
            {filteredRows.length === 0 ? (
              <p className="px-4 py-12 text-center text-[13px] text-fg-secondary">
                {trackSplit ? "You don't have tracked accounts" : 'No handles — add KOLs in the KOLs tab.'}
              </p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
