'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeftRight,
  Check,
  ChevronDown,
  GripVertical,
  Keyboard,
  Pencil,
  Settings2,
  Shield,
  Wallet,
  X,
} from 'lucide-react';
import { QuoteTokenIcon } from '@/components/tokens/ProtocolBrandIcon';
import { SAMPLE_WALLET_GROUPS, getRecentGroups } from '@/lib/trade/sampleWalletGroups';
import { BUY_PRESETS_SOL, BUY_PRESETS_USDC, DEFAULT_SLIPPAGE_BPS, USDC_DECIMALS } from '@/lib/utils/constants';
import type { SolSpendAsset } from '@/lib/trading/spendAsset';
import type { MevMode } from '@/lib/trading/mevMode';
import { shortenAddress } from '@/lib/utils/addresses';
import { cn } from '@/lib/utils/cn';
import { useSpotTradeExecution } from '@/lib/hooks/useSpotTradeExecution';
import { useTradingStore, type PresetSlot, INSTANT_TRADE_WALLET_CAP } from '@/store/trading';
import { useUIStore } from '@/store/ui';
import { nativeTicker } from '@/lib/chains/nativeCurrency';
import { CHAIN_ICON_PNG } from '@/lib/chains/chainAssets';
import { formatNumber, lamportsToSol, rawToUi } from '@/lib/utils/formatters';
import { InstantTradeSettingsModal } from '@/components/trading/InstantTradeSettingsModal';
import { PresetEditorModal } from '@/components/trading/PresetEditorModal';
import {
  AdvancedTradingSettingsModal,
  type AdvancedTradingPreset,
} from '@/components/trading/AdvancedTradingSettingsModal';
import {
  readInstantTradeUiSettings,
  defaultInstantTradeUiSettings,
  type InstantTradeUiSettings,
} from '@/lib/trading/instantTradeUiSettings';

const BOUNDS_KEY = 'pointer-instant-compact-trade-bounds-v2';
const LEGACY_BOUNDS_KEY = 'pointer-instant-compact-trade-bounds-v1';
const LEGACY_POS_KEY = 'pointer-instant-trade-pos-v1';
const SLOT_OVERRIDES_KEY = 'pointer-instant-trade-slot-overrides-v1';

/** Stops resize before internal overflow; pairing with viewport bottom inset avoids covering the SOL dock. */
const MIN_W = 284;
/** Tall enough for header + buy/sell 4×2 grids + PnL footer without clipping. */
const MIN_H = 352;
/** Axiom-style default — compact width, two preset rows at open. */
const DEFAULT_BOUNDS = { x: 56, y: 72, w: 318, h: 388 } as const;
/** Preset grid stays this wide in single-row compact mode so widening the shell does not stretch pills. */
const PRESET_GRID_MAX_W = 320;
/** Max pill width per cell in compact (single-row) mode. */
const PRESET_CHIP_MAX_W = 76;
/** Axiom-style bright blue “editing preset values” treatment. */
const EDIT_PRESET_CLASS =
  'rounded-full border-2 border-sky-400 bg-sky-500/25 py-1.5 text-center font-sans text-[10px] font-semibold tabular-nums text-sky-50 shadow-[0_0_18px_rgba(56,189,248,0.45)] ring-2 ring-sky-400/45 outline-none focus:border-sky-300 focus:ring-sky-400/70';
const DEFAULT_SELL_PCT = [0.5, 1, 2, 3, 5, 10, 25, 100] as const;
const DEFAULT_SELL_SOL = [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5] as const;
const INSTANT_FILL = [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5] as const;

/**
 * Two-row 4×2 preset grids at normal panel height (Axiom default).
 * Single-row (top 4 only) only when squished to minimum height.
 */
const PRESET_TWO_ROW_MIN_H = MIN_H;

const EDGE_INSET = 8;

/** Keep the floating shell above `--app-bottombar-h` (+ small gutter) like `InstantTradeButton`. */
function viewportBottomReservePx(): number {
  if (typeof window === 'undefined') return 72;
  try {
    const gutter = 12;
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--app-bottombar-h');
    let barPx = Number.parseFloat(raw);
    if (!Number.isFinite(barPx)) barPx = 52; // ~ `--app-bottombar-h` baseline (44px+) + fudge
    return gutter + barPx;
  } catch {
    return 72;
  }
}

type TradingPresetApi = {
  slot: PresetSlot;
  name: string;
  buy_amounts_sol: number[];
  slippage_bps: number;
  dynamic_slippage: boolean;
  mev_mode: MevMode;
  priority_fee_lamports: number;
  jito_tip_lamports: number;
  auto_fee: boolean;
  max_fee_sol: number;
};

export type SellMode = 'pct' | 'sol';

export type SlotPersistV2 = {
  buy: number[];
  buyUsdc?: number[];
  sellPct: number[];
  sellSol: number[];
  sellMode: SellMode;
};

function filterDecimalTyped(raw: string, maxFractionDigits: number): string {
  let s = raw.replace(/[^\d.]/g, '');
  const dot = s.indexOf('.');
  if (dot !== -1) {
    s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, '');
  }
  const parts = s.split('.');
  if (parts[1] != null && parts[1].length > maxFractionDigits) {
    s = `${parts[0]}.${parts[1].slice(0, maxFractionDigits)}`;
  }
  return s;
}

function capPctWhileTyping(s: string): string {
  if (s === '' || s === '.') return s;
  const n = parseFloat(s);
  if (!Number.isFinite(n) || n <= 100) return s;
  return '100';
}

function readSlotOverrides(): SlotPersistV2 | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SLOT_OVERRIDES_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as {
      buy?: unknown;
      buyUsdc?: unknown;
      sell?: unknown;
      sellPct?: unknown;
      sellSol?: unknown;
      sellMode?: unknown;
    };
    const buy = Array.isArray(j.buy)
      ? j.buy.filter((n): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0)
      : [];
    const sellLegacy = Array.isArray(j.sell)
      ? j.sell.filter((n): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0)
      : [];
    const sellPct = Array.isArray(j.sellPct)
      ? j.sellPct.filter((n): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0)
      : sellLegacy.length === 8
        ? sellLegacy
        : [];
    const sellSol = Array.isArray(j.sellSol)
      ? j.sellSol.filter((n): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0)
      : [];
    const buyUsdc = Array.isArray(j.buyUsdc)
      ? j.buyUsdc.filter((n): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0)
      : undefined;
    const sellMode: SellMode = j.sellMode === 'sol' ? 'sol' : 'pct';
    if (buy.length !== 8) return null;
    const pct = sellPct.length === 8 ? sellPct : [...DEFAULT_SELL_PCT];
    const sol = sellSol.length === 8 ? sellSol : [...DEFAULT_SELL_SOL];
    if (sellPct.length !== 8 && sellLegacy.length !== 8) return null;
    return {
      buy,
      ...(buyUsdc?.length === 8 ? { buyUsdc } : {}),
      sellPct: pct,
      sellSol: sol,
      sellMode,
    };
  } catch {
    /* ignore */
  }
  return null;
}

function migrateLegacySlots(): SlotPersistV2 | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SLOT_OVERRIDES_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as { buy?: unknown; sell?: unknown };
    const buy = Array.isArray(j.buy)
      ? j.buy.filter((n): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0)
      : [];
    const sell = Array.isArray(j.sell)
      ? j.sell.filter((n): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0)
      : [];
    if (buy.length !== 8 || sell.length !== 8) return null;
    if ('sellPct' in j || 'sellMode' in j) return null;
    const v2: SlotPersistV2 = {
      buy,
      sellPct: sell.map((n) => clamp(n, 0.0001, 100)),
      sellSol: [...DEFAULT_SELL_SOL],
      sellMode: 'pct',
    };
    localStorage.setItem(SLOT_OVERRIDES_KEY, JSON.stringify(v2));
    return v2;
  } catch {
    return null;
  }
}

function persistSlotOverrides(payload: SlotPersistV2) {
  try {
    localStorage.setItem(SLOT_OVERRIDES_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** Enforce instant-trade mins and keep on-screen (matches resize clamps — avoids saved tiny bounds + inner scroll). */
function clampInstantTradeBounds(b: { x: number; y: number; w: number; h: number }): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  if (typeof window === 'undefined') {
    return { ...b, w: Math.max(MIN_W, b.w), h: Math.max(MIN_H, b.h) };
  }
  const maxR = window.innerWidth - EDGE_INSET;
  const maxB = window.innerHeight - viewportBottomReservePx();
  const w = Math.max(MIN_W, Math.min(b.w, maxR - EDGE_INSET));
  const h = Math.max(MIN_H, Math.min(b.h, maxB - EDGE_INSET));
  const x = clamp(b.x, EDGE_INSET, Math.max(EDGE_INSET, maxR - w));
  const y = clamp(b.y, EDGE_INSET, Math.max(EDGE_INSET, maxB - h));
  return { x, y, w, h };
}

function parseBoundsJson(raw: string | null): { x: number; y: number; w: number; h: number } | null {
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as Record<string, unknown>;
    if (
      typeof j.x === 'number' &&
      typeof j.y === 'number' &&
      typeof j.w === 'number' &&
      typeof j.h === 'number'
    ) {
      return { x: j.x, y: j.y, w: j.w, h: j.h };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function normalizeInstantTradeBounds(b: { x: number; y: number; w: number; h: number }): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  let { x, y, w, h } = b;
  // Saved wide + short panels stretched single-row pills — snap back to Axiom width.
  if (h < PRESET_TWO_ROW_MIN_H + 8 && w > PRESET_GRID_MAX_W + 24) {
    w = DEFAULT_BOUNDS.w;
  }
  // Old saves below two-row threshold — bump height so 8 presets show at normal open.
  if (h >= MIN_H && h < PRESET_TWO_ROW_MIN_H + 40) {
    h = Math.max(h, DEFAULT_BOUNDS.h);
  }
  return clampInstantTradeBounds({ x, y, w, h });
}

/** Per-wallet remembered panel bounds; falls back to legacy global key. */
function readBoundsForWallet(walletAddress: string | null): { x: number; y: number; w: number; h: number } {
  if (typeof window === 'undefined') return { ...DEFAULT_BOUNDS };
  const def = { ...DEFAULT_BOUNDS };
  try {
    const keys = walletAddress
      ? [`${BOUNDS_KEY}:${walletAddress}`, `${LEGACY_BOUNDS_KEY}:${walletAddress}`, BOUNDS_KEY, LEGACY_BOUNDS_KEY]
      : [BOUNDS_KEY, LEGACY_BOUNDS_KEY];
    for (const key of keys) {
      const parsed = parseBoundsJson(localStorage.getItem(key));
      if (parsed) return normalizeInstantTradeBounds(parsed);
    }
    const leg = localStorage.getItem(LEGACY_POS_KEY);
    if (leg) {
      const o = JSON.parse(leg) as Record<string, unknown>;
      if (typeof o.x === 'number' && typeof o.y === 'number') {
        return normalizeInstantTradeBounds({ ...def, x: o.x, y: o.y });
      }
    }
  } catch {
    /* ignore */
  }
  return def;
}

function persistBoundsForWallet(
  b: { x: number; y: number; w: number; h: number },
  walletAddress: string | null,
) {
  try {
    if (walletAddress) {
      localStorage.setItem(`${BOUNDS_KEY}:${walletAddress}`, JSON.stringify(b));
    } else {
      localStorage.setItem(BOUNDS_KEY, JSON.stringify(b));
    }
  } catch {
    /* ignore */
  }
}

function fmtUsdcChip(n: number): string {
  if (Number.isInteger(n)) return String(n);
  const t = n.toFixed(2).replace(/\.?0+$/, '');
  return t || String(n);
}

function eightBuyUsdcAmounts(preset: readonly number[]): number[] {
  const ordered = new Set<number>();
  for (const n of preset) {
    if (Number.isFinite(n) && n > 0) ordered.add(n);
  }
  for (const n of BUY_PRESETS_USDC) {
    if (ordered.size >= 8) break;
    ordered.add(n);
  }
  return Array.from(ordered)
    .sort((a, b) => a - b)
    .slice(0, 8);
}

function fmtSolChip(n: number): string {
  const t = n.toFixed(4).replace(/\.?0+$/, '');
  return t || String(n);
}

function fmtPctChip(n: number): string {
  const t = n < 10 ? n.toFixed(2).replace(/\.?0+$/, '') : String(Math.round(n));
  return t || String(n);
}

function eightBuyAmounts(preset: number[]): number[] {
  const ordered = new Set<number>();
  for (const n of preset) {
    if (Number.isFinite(n) && n > 0) ordered.add(n);
  }
  for (const n of INSTANT_FILL) {
    if (ordered.size >= 8) break;
    ordered.add(n);
  }
  return Array.from(ordered)
    .sort((a, b) => a - b)
    .slice(0, 8);
}

function fullPresetForSlot(list: TradingPresetApi[], slot: PresetSlot) {
  const p = list.find((x) => x.slot === slot);
  if (p) {
    return {
      slot: p.slot,
      name: p.name,
      buy_amounts_sol: p.buy_amounts_sol,
      slippage_bps: p.slippage_bps,
      dynamic_slippage: p.dynamic_slippage,
      mev_mode: p.mev_mode,
    };
  }
  return {
    slot,
    name: `Preset ${slot}`,
    buy_amounts_sol: eightBuyAmounts([...BUY_PRESETS_SOL]),
    slippage_bps: DEFAULT_SLIPPAGE_BPS,
    dynamic_slippage: true,
    mev_mode: 'reduced' as MevMode,
  };
}

function advancedPresetForSlot(list: TradingPresetApi[], slot: PresetSlot): AdvancedTradingPreset {
  const p = list.find((x) => x.slot === slot);
  if (p) {
    return {
      slot: p.slot,
      name: p.name,
      priority_fee_lamports: p.priority_fee_lamports,
      jito_tip_lamports: p.jito_tip_lamports,
      auto_fee: p.auto_fee,
      max_fee_sol: p.max_fee_sol,
    };
  }
  return {
    slot,
    name: `Preset ${slot}`,
    priority_fee_lamports: 0,
    jito_tip_lamports: 0,
    auto_fee: false,
    max_fee_sol: 0.1,
  };
}

function applyResize(
  edge: ResizeEdge,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
  dx: number,
  dy: number,
): { x: number; y: number; w: number; h: number } {
  let x = rx;
  let y = ry;
  let w = rw;
  let h = rh;

  switch (edge) {
    case 'e':
      w = rw + dx;
      break;
    case 'w':
      x = rx + dx;
      w = rw - dx;
      break;
    case 's':
      h = rh + dy;
      break;
    case 'n':
      y = ry + dy;
      h = rh - dy;
      break;
    case 'se':
      w = rw + dx;
      h = rh + dy;
      break;
    case 'sw':
      x = rx + dx;
      w = rw - dx;
      h = rh + dy;
      break;
    case 'ne':
      y = ry + dy;
      h = rh - dy;
      w = rw + dx;
      break;
    case 'nw':
      x = rx + dx;
      y = ry + dy;
      w = rw - dx;
      h = rh - dy;
      break;
    default:
      break;
  }

  if (w < MIN_W) {
    if (edge === 'w' || edge === 'nw' || edge === 'sw') {
      x = rx + rw - MIN_W;
    }
    w = MIN_W;
  }
  if (h < MIN_H) {
    if (edge === 'n' || edge === 'nw' || edge === 'ne') {
      y = ry + rh - MIN_H;
    }
    h = MIN_H;
  }

  const insetB = viewportBottomReservePx();
  const maxR = window.innerWidth - EDGE_INSET;
  const maxB = window.innerHeight - insetB;

  x = clamp(x, EDGE_INSET, maxR - MIN_W);
  y = clamp(y, EDGE_INSET, maxB - MIN_H);
  w = clamp(w, MIN_W, maxR - x);
  h = clamp(h, MIN_H, maxB - y);
  if (x + w > maxR) w = maxR - x;
  if (y + h > maxB) h = maxB - y;
  w = Math.max(MIN_W, w);
  h = Math.max(MIN_H, h);
  return { x, y, w, h };
}

export type ResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

type Props = {
  mint: string;
  symbol: string | null;
  decimals: number;
  open: boolean;
  onClose: () => void;
  onOpenFullTradeSettings?: () => void;
};

export function CompactInstantTradePanel({
  mint,
  symbol,
  decimals,
  open,
  onClose,
  onOpenFullTradeSettings,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [bounds, setBounds] = useState(() => readBoundsForWallet(null));
  const boundsRef = useRef(bounds);
  useEffect(() => {
    boundsRef.current = bounds;
  }, [bounds]);
  const [slotBundle, setSlotBundle] = useState<SlotPersistV2 | null>(null);
  const [editSlots, setEditSlots] = useState(false);
  const [draftBuy, setDraftBuy] = useState<string[]>([]);
  const [draftSell, setDraftSell] = useState<string[]>([]);
  const [grabbed, setGrabbed] = useState(false);
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);
  const [advChecked, setAdvChecked] = useState(false);
  const [instantSettingsOpen, setInstantSettingsOpen] = useState(false);
  const [instantUi, setInstantUi] = useState<InstantTradeUiSettings>(defaultInstantTradeUiSettings);
  const walletMenuRef = useRef<HTMLDivElement>(null);
  const walletPopoverRef = useRef<HTMLDivElement>(null);
  const [walletPopoverPos, setWalletPopoverPos] = useState<{ top: number; right: number } | null>(
    null,
  );

  const [presetEditorSlot, setPresetEditorSlot] = useState<PresetSlot | null>(null);
  const [advancedModalSlot, setAdvancedModalSlot] = useState<PresetSlot | null>(null);

  /**
   * Task BB — wallet-group switcher (top row).
   * Sample data only; real persistence lands in a follow-up task.
   */
  const [activeWalletGroupId, setActiveWalletGroupId] = useState<string>(
    SAMPLE_WALLET_GROUPS[0]?.id ?? 'g1',
  );
  const [walletGroupMenuOpen, setWalletGroupMenuOpen] = useState(false);
  const recentWalletGroups = useMemo(() => getRecentGroups(SAMPLE_WALLET_GROUPS, 5), []);
  const overflowWalletGroups = useMemo(
    () => SAMPLE_WALLET_GROUPS.filter((g) => !recentWalletGroups.find((r) => r.id === g.id)),
    [recentWalletGroups],
  );
  const walletGroupMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!walletGroupMenuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (walletGroupMenuRef.current?.contains(e.target as Node)) return;
      setWalletGroupMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [walletGroupMenuOpen]);

  const dragStart = useRef<{
    kind: 'move' | 'resize';
    edge?: ResizeEdge;
    rx: number;
    ry: number;
    rw: number;
    rh: number;
    px: number;
    py: number;
  } | null>(null);

  const { getAccessToken } = usePointerAuth();
  const {
    activePresetSlot,
    setActivePresetSlot,
    instantTradeWalletShortlist,
    toggleInstantTradeWallet,
    clearInstantTradeWalletShortlist,
  } = useTradingStore();

  const {
    wallet,
    walletsReady,
    authenticated,
    balanceRaw,
    activePreset,
    effectiveSlippageBps,
    runBuy,
    runSell,
    runSellSolOut,
    runSellInitial,
    costBasisTonSol,
    lifetimeStats,
    spendAsset,
    setSpendAsset,
    usdcBalanceRaw,
    walletRows,
    activeWalletAddress,
    setActiveWalletAddress,
    signingWalletAddresses,
  } = useSpotTradeExecution(mint);

  const activeChain = useUIStore((s) => s.activeChain);

  const { data: presetsPayload } = useQuery({
    queryKey: ['trading-presets'],
    queryFn: async (): Promise<{ presets: TradingPresetApi[] } | null> => {
      const token = await getAccessToken();
      if (!token) return null;
      const res = await fetch('/api/presets', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return null;
      return res.json() as Promise<{ presets: TradingPresetApi[] }>;
    },
    enabled: authenticated && open,
    staleTime: 60_000,
  });
  const presetList = presetsPayload?.presets ?? [];

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);
  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => {
      const normalized = readBoundsForWallet(wallet?.address ?? null);
      setBounds(normalized);
      persistBoundsForWallet(normalized, wallet?.address ?? null);
      setSlotBundle(readSlotOverrides() ?? migrateLegacySlots());
      setInstantUi(readInstantTradeUiSettings());
    });
    return () => cancelAnimationFrame(raf);
  }, [open, wallet?.address]);

  useEffect(() => {
    if (open) return;
    const raf = requestAnimationFrame(() => setWalletMenuOpen(false));
    return () => cancelAnimationFrame(raf);
  }, [open]);

  useEffect(() => {
    if (!walletMenuOpen) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (walletMenuRef.current?.contains(t)) return;
      if (walletPopoverRef.current?.contains(t)) return;
      setWalletMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [walletMenuOpen]);

  useLayoutEffect(() => {
    if (!walletMenuOpen || !walletMenuRef.current) {
      setWalletPopoverPos(null);
      return;
    }
    const anchor = walletMenuRef.current;
    const update = () => {
      const r = anchor.getBoundingClientRect();
      setWalletPopoverPos({ top: r.bottom + 6, right: window.innerWidth - r.right });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [walletMenuOpen, bounds.x, bounds.y, bounds.w, bounds.h]);

  const buyFromPreset = useMemo(() => {
    const from = activePreset?.buy_amounts_sol?.length
      ? activePreset.buy_amounts_sol
      : [...BUY_PRESETS_SOL];
    return eightBuyAmounts(from);
  }, [activePreset]);

  const sellMode = slotBundle?.sellMode ?? 'pct';

  const buyFromPresetUsdc = useMemo(
    () => eightBuyUsdcAmounts(BUY_PRESETS_USDC),
    [],
  );

  const buyValuesSol =
    slotBundle?.buy && slotBundle.buy.length === 8 ? slotBundle.buy : buyFromPreset;
  const buyValuesUsdc =
    slotBundle?.buyUsdc && slotBundle.buyUsdc.length === 8
      ? slotBundle.buyUsdc
      : buyFromPresetUsdc;
  const buySpendAsset: SolSpendAsset | 'usol' =
    activeChain === 'sol' ? spendAsset : 'sol';
  const buyValues = buySpendAsset === 'usdc' ? buyValuesUsdc : buyValuesSol;
  const fmtBuyChip = buySpendAsset === 'usdc' ? fmtUsdcChip : fmtSolChip;

  const sellPctArr =
    slotBundle?.sellPct && slotBundle.sellPct.length === 8
      ? slotBundle.sellPct
      : [...DEFAULT_SELL_PCT];
  const sellSolArr =
    slotBundle?.sellSol && slotBundle.sellSol.length === 8
      ? slotBundle.sellSol
      : [...DEFAULT_SELL_SOL];

  const sellValues = sellMode === 'pct' ? sellPctArr : sellSolArr;

  const setSellMode = useCallback(
    (m: SellMode) => {
      setSlotBundle((prev) => {
        const next: SlotPersistV2 = {
          buy: prev?.buy && prev.buy.length === 8 ? prev.buy : buyFromPreset,
          sellPct: prev?.sellPct && prev.sellPct.length === 8 ? prev.sellPct : [...DEFAULT_SELL_PCT],
          sellSol: prev?.sellSol && prev.sellSol.length === 8 ? prev.sellSol : [...DEFAULT_SELL_SOL],
          sellMode: m,
        };
        persistSlotOverrides(next);
        return next;
      });
    },
    [buyFromPreset],
  );

  const toggleSlotEdit = useCallback(() => {
    if (editSlots) {
      const buy8 = draftBuy.map((s, i) => {
        const t = filterDecimalTyped(String(s).replace(/,/g, ''), 8);
        const n = parseFloat(t);
        return Number.isFinite(n) && n > 0 ? n : buyValues[i] ?? 0.1;
      });
      const parseSellOne = (raw: string, i: number, asPct: boolean) => {
        const t = filterDecimalTyped(String(raw).replace(/%/g, '').trim(), asPct ? 4 : 9);
        const n = parseFloat(t);
        const fallback = asPct ? sellPctArr[i] ?? 1 : sellSolArr[i] ?? 0.01;
        if (!Number.isFinite(n) || n <= 0) return fallback;
        return asPct ? clamp(n, 0.0001, 100) : clamp(n, 1e-12, 1e12);
      };
      const sellPctNext =
        sellMode === 'pct'
          ? draftSell.map((s, i) => parseSellOne(s, i, true))
          : sellPctArr;
      const sellSolNext =
        sellMode === 'sol'
          ? draftSell.map((s, i) => parseSellOne(s, i, false))
          : sellSolArr;
      if (buy8.length === 8) {
        const payload: SlotPersistV2 = {
          buy: buySpendAsset === 'usdc' ? buyValuesSol : buy8,
          buyUsdc: buySpendAsset === 'usdc' ? buy8 : buyValuesUsdc,
          sellPct: sellPctNext,
          sellSol: sellSolNext,
          sellMode,
        };
        persistSlotOverrides(payload);
        setSlotBundle(payload);
      }
      setEditSlots(false);
      return;
    }
    setDraftBuy(buyValues.map((n) => fmtBuyChip(n)));
    setDraftSell(
      sellValues.map((n) => (sellMode === 'pct' ? fmtPctChip(n) : fmtSolChip(n))),
    );
    setEditSlots(true);
  }, [
    editSlots,
    draftBuy,
    draftSell,
    buyValues,
    buyValuesSol,
    buyValuesUsdc,
    buySpendAsset,
    sellValues,
    sellMode,
    sellPctArr,
    sellSolArr,
  ]);

  const tradableWalletRows = useMemo(() => {
    if (!walletRows) return [];
    return walletRows.filter(
      (w) =>
        !w.is_archived &&
        w.is_active &&
        signingWalletAddresses.has(w.wallet_address),
    );
  }, [walletRows, signingWalletAddresses]);

  const activeWalletRow = useMemo(
    () => walletRows?.find((w) => w.wallet_address === wallet?.address),
    [walletRows, wallet?.address],
  );

  const tick = (symbol ?? 'TOKEN').replace(/^\$+/, '').slice(0, 8) || 'TOKEN';
  const uiBal = formatNumber(rawToUi(balanceRaw, decimals), { decimals: 4 });
  const uiUsdcBal = formatNumber(rawToUi(usdcBalanceRaw, USDC_DECIMALS), { decimals: 2 });
  const nativeSym = nativeTicker(activeChain);

  const presetLayout = useMemo(() => {
    const w = bounds.w;
    const h = bounds.h;
    const twoRowGrid = h >= PRESET_TWO_ROW_MIN_H;
    const topRowOnlyCompact = !twoRowGrid;
    const gridCols = 'grid-cols-4';
    const gridGapCls = 'gap-1';
    const gridRowsCls = twoRowGrid ? 'grid-rows-2' : 'grid-rows-1';

    const gridMaxWidth = twoRowGrid ? undefined : Math.min(PRESET_GRID_MAX_W, w - 16);
    const gridGapPx = 4;
    const usableGridW = twoRowGrid ? w - 16 : Math.min(PRESET_GRID_MAX_W, w - 16);
    const rawCellW = (usableGridW - gridGapPx * 3) / 4;
    const cellW = twoRowGrid
      ? Math.max(48, rawCellW)
      : Math.max(48, Math.min(PRESET_CHIP_MAX_W, rawCellW));

    const chromeH = 118;
    const pnlRowH = 36;
    const innerH = Math.max(140, h - chromeH - pnlRowH);
    const sectionH = innerH / 2;
    const rowCount = twoRowGrid ? 2 : 1;
    const metaBand = 24;
    const buyGridH = Math.max(twoRowGrid ? 52 : 30, sectionH - metaBand);
    const cellH = (buyGridH - gridGapPx * Math.max(0, rowCount - 1)) / rowCount;
    const chipDim = Math.min(cellW, cellH);
    const chipFontPx = twoRowGrid
      ? clamp(Math.round(chipDim * 0.34), 12, 16)
      : clamp(Math.round(Math.min(cellW, 32) * 0.38), 11, 13);

    const chipBox = cn(
      'h-full w-full px-0.5',
      twoRowGrid ? 'min-h-[26px] rounded-full' : 'min-h-[28px] max-h-[32px] rounded-full',
    );
    const chipStyle = {
      fontSize: chipFontPx,
      lineHeight: 1.05,
      ...(twoRowGrid ? {} : { maxWidth: PRESET_CHIP_MAX_W }),
    } as const;

    let metaText = 'text-[10px] leading-snug';
    let metaIcon = 'h-3 w-3';
    if (h >= 372) {
      metaText = 'text-[11px] leading-snug';
      metaIcon = 'h-3.5 w-3.5';
    }

    return {
      twoRowGrid,
      topRowOnlyCompact,
      gridCols,
      gridGapCls,
      gridRowsCls,
      gridMaxWidth,
      chipCls: chipBox,
      chipStyle,
      chipFontPx,
      metaText,
      metaIcon,
      gridMinH: twoRowGrid ? 48 : 30,
    };
  }, [bounds.w, bounds.h]);

  const buyChips =
    editSlots || !presetLayout.topRowOnlyCompact ? buyValues : buyValues.slice(0, 4);
  const sellChips =
    editSlots || !presetLayout.topRowOnlyCompact ? sellValues : sellValues.slice(0, 4);

  const netSessionPnl = lifetimeStats.sellTon - lifetimeStats.buyTon;
  const netPctForTitle =
    lifetimeStats.buyTon > 0 ? (netSessionPnl / lifetimeStats.buyTon) * 100 : null;
  const remainingTon = Math.max(0, lifetimeStats.buyTon - lifetimeStats.sellTon);

  const spendAssetOptions = useMemo(() => {
    const t = nativeTicker(activeChain);
    if (activeChain === 'ton') {
      return [
        { k: 'sol' as const, label: nativeSym, disabled: false },
        { k: 'usdc' as const, label: 'USDC', disabled: true },
        { k: 'usol' as const, label: 'wTON', disabled: true },
      ];
    }
    if (activeChain === 'sol') {
      return [
        { k: 'sol' as const, label: 'SOL', disabled: false },
        { k: 'usdc' as const, label: 'USDC', disabled: false },
        { k: 'usol' as const, label: 'uSOL', disabled: true },
      ];
    }
    return [
      { k: 'sol' as const, label: t, disabled: false },
      { k: 'usdc' as const, label: 'USDC', disabled: true },
      { k: 'usol' as const, label: `w${t}`, disabled: true },
    ];
  }, [activeChain]);

  const onMoveDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      setGrabbed(true);
      dragStart.current = {
        kind: 'move',
        rx: bounds.x,
        ry: bounds.y,
        rw: bounds.w,
        rh: bounds.h,
        px: e.clientX,
        py: e.clientY,
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [bounds],
  );

  const onResizeDown = useCallback(
    (edge: ResizeEdge) => (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      setGrabbed(true);
      dragStart.current = {
        kind: 'resize',
        edge,
        rx: bounds.x,
        ry: bounds.y,
        rw: bounds.w,
        rh: bounds.h,
        px: e.clientX,
        py: e.clientY,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [bounds],
  );

  const onDragMove = useCallback((e: React.PointerEvent) => {
    const d = dragStart.current;
    if (!d) return;
    const dx = e.clientX - d.px;
    const dy = e.clientY - d.py;
    const maxW = window.innerWidth - EDGE_INSET;
    const maxBottomY = window.innerHeight - viewportBottomReservePx();
    setBounds((prev) => {
      let next = prev;
      if (d.kind === 'move') {
        const nx = clamp(d.rx + dx, EDGE_INSET, maxW - d.rw);
        const ny = clamp(d.ry + dy, EDGE_INSET, maxBottomY - d.rh);
        next = { ...prev, x: nx, y: ny };
      } else if (d.edge) {
        next = applyResize(d.edge, d.rx, d.ry, d.rw, d.rh, dx, dy);
      }
      boundsRef.current = next;
      return next;
    });
  }, []);

  const onDragUp = useCallback((e: React.PointerEvent) => {
    if (!dragStart.current) return;
    dragStart.current = null;
    setGrabbed(false);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    persistBoundsForWallet(boundsRef.current, wallet?.address ?? null);
  }, [wallet?.address]);

  /** Must run before any early return — otherwise opening the panel changes hook count (React crashes). */
  const selectAllWallets = useCallback(() => {
    if (!walletRows) return;
    clearInstantTradeWalletShortlist();
    let count = 0;
    for (const w of walletRows) {
      if (count >= INSTANT_TRADE_WALLET_CAP) break;
      const canSign = signingWalletAddresses.has(w.wallet_address);
      if (w.is_archived || !w.is_active || !canSign) continue;
      toggleInstantTradeWallet(w.wallet_address);
      count += 1;
    }
  }, [walletRows, signingWalletAddresses, clearInstantTradeWalletShortlist, toggleInstantTradeWallet]);

  const selectAllWalletsWithBalance = useCallback(() => {
    if (!walletRows) return;
    clearInstantTradeWalletShortlist();
    let count = 0;
    for (const w of walletRows) {
      if (count >= INSTANT_TRADE_WALLET_CAP) break;
      const canSign = signingWalletAddresses.has(w.wallet_address);
      if (w.is_archived || !w.is_active || !canSign) continue;
      const sol =
        w.balance_lamports != null && w.balance_lamports !== ''
          ? lamportsToSol(BigInt(w.balance_lamports))
          : 0;
      if (sol > 0) {
        toggleInstantTradeWallet(w.wallet_address);
        count += 1;
      }
    }
  }, [walletRows, signingWalletAddresses, clearInstantTradeWalletShortlist, toggleInstantTradeWallet]);

  if (!mounted || !open) return null;

  const feeHint = activePreset
    ? `${lamportsToSol(BigInt(activePreset.priority_fee_lamports)).toFixed(3)} / ${lamportsToSol(BigInt(activePreset.jito_tip_lamports)).toFixed(3)}`
    : '-';

  const EDGE_HIT = 6;
  const CORNER = 10;

  const panel = (
    <div
      className={cn(
        'fixed z-[240] flex flex-col overflow-hidden rounded-xl border border-border-subtle bg-bg-raised font-sans shadow-[0_24px_48px_-16px_rgba(0,0,0,0.65)] transition-[opacity,transform,box-shadow] duration-150 ease-out',
        grabbed && 'scale-[1.015] opacity-[0.88] shadow-[0_28px_64px_-12px_rgba(0,0,0,0.75)] ring-1 ring-border-subtle',
      )}
      style={{ left: bounds.x, top: bounds.y, width: bounds.w, height: bounds.h }}
      role="dialog"
      aria-label="Instant trade"
    >
      {/* Resize: edges */}
      <div
        role="presentation"
        className="absolute left-[10px] right-[10px] top-0 z-30 cursor-ns-resize"
        style={{ height: EDGE_HIT }}
        onPointerDown={onResizeDown('n')}
        onPointerMove={onDragMove}
        onPointerUp={onDragUp}
        onPointerCancel={onDragUp}
      />
      <div
        role="presentation"
        className="absolute bottom-0 left-0 right-0 z-30 cursor-ns-resize"
        style={{ height: EDGE_HIT }}
        onPointerDown={onResizeDown('s')}
        onPointerMove={onDragMove}
        onPointerUp={onDragUp}
        onPointerCancel={onDragUp}
      />
      <div
        role="presentation"
        className="absolute bottom-0 left-0 top-0 z-30 cursor-ew-resize"
        style={{ width: EDGE_HIT }}
        onPointerDown={onResizeDown('w')}
        onPointerMove={onDragMove}
        onPointerUp={onDragUp}
        onPointerCancel={onDragUp}
      />
      <div
        role="presentation"
        className="absolute bottom-0 right-0 top-0 z-30 cursor-ew-resize"
        style={{ width: EDGE_HIT }}
        onPointerDown={onResizeDown('e')}
        onPointerMove={onDragMove}
        onPointerUp={onDragUp}
        onPointerCancel={onDragUp}
      />
      {/* Corners */}
      <div
        role="presentation"
        className="absolute left-0 top-0 z-40 cursor-nwse-resize"
        style={{ width: CORNER, height: CORNER }}
        onPointerDown={onResizeDown('nw')}
        onPointerMove={onDragMove}
        onPointerUp={onDragUp}
        onPointerCancel={onDragUp}
      />
      <div
        role="presentation"
        className="absolute right-0 top-0 z-40 cursor-nesw-resize"
        style={{ width: CORNER, height: CORNER }}
        onPointerDown={onResizeDown('ne')}
        onPointerMove={onDragMove}
        onPointerUp={onDragUp}
        onPointerCancel={onDragUp}
      />
      <div
        role="presentation"
        className="absolute bottom-0 left-0 z-40 cursor-nesw-resize"
        style={{ width: CORNER, height: CORNER }}
        onPointerDown={onResizeDown('sw')}
        onPointerMove={onDragMove}
        onPointerUp={onDragUp}
        onPointerCancel={onDragUp}
      />
      <div
        role="presentation"
        className="absolute bottom-0 right-0 z-40 cursor-nwse-resize"
        style={{ width: CORNER, height: CORNER }}
        onPointerDown={onResizeDown('se')}
        onPointerMove={onDragMove}
        onPointerUp={onDragUp}
        onPointerCancel={onDragUp}
      />

      {/**
       * Task BB — wallet-group switcher (top row).
       * Top 5 by recency render as inline pills; the rest fall into a
       * chevron dropdown anchored to the right. Sample data only.
       */}
      <div className="relative z-10 flex shrink-0 items-center gap-1 border-b border-border-subtle px-1.5 py-1">
        <div
          className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Recent wallet groups"
        >
          {recentWalletGroups.map((g) => {
            const active = activeWalletGroupId === g.id;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => setActiveWalletGroupId(g.id)}
                title={`${g.label} · ${g.walletCount} wallet${g.walletCount === 1 ? '' : 's'}`}
                className={cn(
                  'btn-press h-6 shrink-0 rounded-md border px-2 text-[10px] font-semibold transition-colors',
                  active
                    ? 'border-accent-primary/55 bg-accent-primary/15 text-accent-primary'
                    : 'border-border-subtle bg-transparent text-fg-secondary hover:bg-bg-hover hover:text-fg-primary',
                )}
              >
                {g.label}
              </button>
            );
          })}
        </div>
        {overflowWalletGroups.length > 0 ? (
          <div className="relative shrink-0" ref={walletGroupMenuRef}>
            <button
              type="button"
              onClick={() => setWalletGroupMenuOpen((v) => !v)}
              className={cn(
                'btn-press flex h-6 w-6 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-primary',
                walletGroupMenuOpen && 'bg-bg-hover text-fg-primary',
              )}
              aria-expanded={walletGroupMenuOpen}
              aria-haspopup="listbox"
              title="More wallet groups"
            >
              <ChevronDown className="h-3 w-3" strokeWidth={2} />
            </button>
            {walletGroupMenuOpen ? (
              <div
                role="listbox"
                className="absolute right-0 top-full z-50 mt-1 w-40 overflow-hidden rounded-md border border-border-subtle bg-bg-raised p-1 shadow-2xl"
              >
                {overflowWalletGroups.map((g) => {
                  const active = activeWalletGroupId === g.id;
                  return (
                    <button
                      key={g.id}
                      role="option"
                      aria-selected={active}
                      type="button"
                      onClick={() => {
                        setActiveWalletGroupId(g.id);
                        setWalletGroupMenuOpen(false);
                      }}
                      className={cn(
                        'flex h-7 w-full items-center justify-between gap-2 rounded px-2 text-left text-[11px] transition-colors',
                        active
                          ? 'bg-accent-primary/15 text-accent-primary'
                          : 'text-fg-secondary hover:bg-bg-hover hover:text-fg-primary',
                      )}
                    >
                      <span className="truncate">{g.label}</span>
                      <span className="shrink-0 tabular-nums text-[9px] text-fg-muted">
                        {g.walletCount}w
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="relative z-10 flex shrink-0 items-center gap-0.5 border-b border-border-subtle px-1.5 py-1 pl-2">
        <Keyboard className="h-3 w-3 shrink-0 text-fg-muted/70" aria-hidden />
        {([1, 2, 3] as const).map((slot) => (
          <button
            key={slot}
            type="button"
            title="Select preset · Shift+click: priority & tip · Ctrl+click: slippage & MEV"
            onClick={(e) => {
              if (e.shiftKey) {
                e.preventDefault();
                setAdvancedModalSlot(slot as PresetSlot);
                return;
              }
              if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                setPresetEditorSlot(slot as PresetSlot);
                return;
              }
              setActivePresetSlot(slot as PresetSlot);
            }}
            className={cn(
              'btn-press rounded px-1.5 py-0.5 text-[9px] font-semibold transition',
              activePresetSlot === slot
                ? 'bg-accent-primary/25 text-accent-primary'
                : 'text-fg-muted hover:text-fg-secondary',
            )}
          >
            P{slot}
          </button>
        ))}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleSlotEdit();
          }}
          className={cn(
            'btn-press rounded p-0.5 transition',
            editSlots
              ? 'bg-sky-500/40 text-sky-50 shadow-[0_0_16px_rgba(56,189,248,0.55)] ring-2 ring-sky-400'
              : 'text-fg-muted hover:text-fg-secondary',
          )}
          aria-label={editSlots ? 'Finish editing amounts' : 'Edit buy and sell amounts'}
          aria-pressed={editSlots}
          title="Edit grid amounts"
        >
          <Pencil className="h-2.5 w-2.5" strokeWidth={2} />
        </button>
        <div
          className="mx-0.5 flex min-w-0 flex-1 cursor-grab touch-none items-center justify-center rounded py-0.5 active:cursor-grabbing"
          onPointerDown={onMoveDown}
          onPointerMove={onDragMove}
          onPointerUp={onDragUp}
          onPointerCancel={onDragUp}
          aria-label="Drag"
        >
          <GripVertical className="h-3.5 w-3.5 text-fg-muted/40" strokeWidth={2} />
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setInstantSettingsOpen(true);
          }}
          className="btn-press rounded p-0.5 text-fg-muted hover:text-fg-secondary"
          aria-label="Instant trade settings"
          title="Instant trade settings"
        >
          <Settings2 className="h-3 w-3" />
        </button>
        <div className="relative shrink-0" ref={walletMenuRef}>
          <button
            type="button"
            onClick={() => setWalletMenuOpen((o) => !o)}
            disabled={!authenticated || !(walletRows?.length)}
            className={cn(
              'btn-press relative rounded p-0.5',
              walletMenuOpen ? 'text-accent-primary' : 'text-fg-muted hover:text-fg-secondary',
              (!authenticated || !walletRows?.length) && 'cursor-not-allowed opacity-40',
            )}
            aria-expanded={walletMenuOpen}
            aria-haspopup="listbox"
            title="Wallets — check up to 100 · Shift / Ctrl + P1–P3 for preset editors"
          >
            <Wallet className="h-3 w-3" strokeWidth={2} />
            {instantTradeWalletShortlist.length > 0 ? (
              <span className="absolute -right-1 -top-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-accent-primary px-0.5 tabular-nums text-[7px] font-semibold leading-none text-fg-inverse">
                {instantTradeWalletShortlist.length > 99 ? '99+' : instantTradeWalletShortlist.length}
              </span>
            ) : null}
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="btn-press rounded p-0.5 text-fg-muted hover:text-signal-bear"
          aria-label="Close instant trade"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden">
        {!walletsReady ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-2 pb-1.5 pt-1 text-[10px]">
            <p className="text-fg-muted">Loading...</p>
          </div>
        ) : !authenticated || !wallet ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-2 pb-1.5 pt-1 text-[10px]">
            <p className="text-signal-warn">Sign in with an embedded wallet to trade.</p>
          </div>
        ) : (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-2 pt-1 text-[10px]">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden pb-1.5">
              <div className="flex min-h-0 flex-[1_1_0] flex-col">
            <div className="flex shrink-0 items-center justify-between gap-2">
              <span className="font-semibold uppercase tracking-wide text-fg-muted">Buy</span>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 tabular-nums text-fg-muted">
                  {buySpendAsset === 'usdc' ? (
                    <>
                      <QuoteTokenIcon kind="usdc" className="h-3 w-3" />
                      {uiUsdcBal}
                    </>
                  ) : (
                    <>
                      <img
                        src={CHAIN_ICON_PNG[activeChain]}
                        alt=""
                        className="h-3 w-3 shrink-0 object-contain"
                        draggable={false}
                        aria-hidden
                      />
                      {formatNumber(
                        wallet?.address && activeWalletRow?.balance_lamports
                          ? lamportsToSol(BigInt(activeWalletRow.balance_lamports))
                          : 0,
                        { decimals: 4 },
                      )}
                    </>
                  )}
                </span>
                <div className="flex items-center gap-0.5 rounded-md border border-border-subtle p-0.5">
                {spendAssetOptions.map(({ k, label, disabled }) => (
                  <button
                    key={k}
                    type="button"
                    disabled={disabled}
                    title={
                      disabled
                        ? 'Coming soon'
                        : k === 'usdc'
                          ? 'Trading with USDC'
                          : undefined
                    }
                    onClick={() => {
                      if (disabled || k === 'usol') return;
                      setSpendAsset(k);
                    }}
                    className={cn(
                      'rounded-sm px-1.5 py-0 text-[9px] font-semibold transition',
                      buySpendAsset === k
                        ? 'bg-accent-primary/20 text-accent-primary'
                        : 'text-fg-muted',
                      disabled
                        ? 'cursor-not-allowed opacity-45'
                        : 'hover:text-fg-secondary',
                    )}
                  >
                    {label}
                  </button>
                ))}
                </div>
              </div>
            </div>
            <div
              className={cn(
                'mt-0.5 grid flex-[1_1_0]',
                presetLayout.gridCols,
                presetLayout.gridGapCls,
                presetLayout.gridRowsCls,
                !presetLayout.twoRowGrid && 'mx-auto w-full',
              )}
              style={{
                minHeight: presetLayout.gridMinH,
                maxWidth: presetLayout.gridMaxWidth,
              }}
            >
              {buyChips.map((sol, i) =>
                editSlots ? (
                  <input
                    key={`b-in-${i}`}
                    type="text"
                    inputMode="decimal"
                    value={draftBuy[i] ?? ''}
                    onChange={(e) => {
                      const v = filterDecimalTyped(e.target.value, 8);
                      setDraftBuy((prev) => {
                        const next = [...(prev.length === 8 ? prev : buyValues.map((n) => fmtSolChip(n)))];
                        next[i] = v;
                        return next;
                      });
                    }}
                    className={cn('h-full min-h-[24px] w-full min-w-0', EDIT_PRESET_CLASS)}
                    style={presetLayout.chipStyle}
                  />
                ) : (
                  <button
                    key={`b-${i}-${sol}`}
                    type="button"
                    onClick={() => void runBuy(sol, buySpendAsset === 'usdc' ? 'usdc' : 'sol')}
                    className={cn(
                      // Task BB: Buy = green outline, transparent fill.
                      'btn-press flex items-center justify-center border border-signal-bull/45 bg-transparent text-center font-sans font-semibold tabular-nums text-signal-bull transition hover:border-signal-bull hover:bg-signal-bull/10 active:bg-signal-bull/15',
                      presetLayout.chipCls,
                    )}
                    style={presetLayout.chipStyle}
                  >
                    {fmtBuyChip(sol)}
                  </button>
                ),
              )}
            </div>
            <div
              className={cn(
                'mt-1 flex shrink-0 flex-wrap items-center gap-x-2.5 gap-y-1 font-medium text-fg-secondary',
                presetLayout.metaText,
              )}
            >
              <span className="font-medium tabular-nums">
                {(effectiveSlippageBps / 100).toFixed(2)}% slip
              </span>
              <span className="tabular-nums text-fg-muted">{feeHint}</span>
              <span className="inline-flex items-center gap-1">
                <Shield
                  className={cn(presetLayout.metaIcon, 'shrink-0 text-fg-muted')}
                  aria-hidden
                />{' '}
                On
              </span>
              <label className="ml-auto inline-flex cursor-pointer items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={advChecked}
                  onChange={(e) => setAdvChecked(e.target.checked)}
                  className="h-3 w-3 rounded border-border-subtle accent-accent-primary"
                />
                Adv.
              </label>
            </div>
              </div>

              <div className="mt-2 flex min-h-0 flex-[1_1_0] flex-col border-t border-border-subtle pt-2">
            <div className="flex shrink-0 items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1 font-semibold uppercase tracking-wide text-fg-muted">
                Sell
                <span
                  className={cn(
                    'tabular-nums text-[9px]',
                    sellMode === 'pct' ? 'text-accent-primary' : 'text-fg-muted',
                  )}
                >
                  %
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (editSlots) setEditSlots(false);
                    setSellMode(sellMode === 'pct' ? 'sol' : 'pct');
                  }}
                  className="btn-press rounded p-0.5 text-fg-muted hover:text-fg-secondary"
                  title={`Switch: % of balance vs fixed ${nativeSym} received`}
                  aria-label="Toggle sell mode"
                >
                  <ArrowLeftRight className="h-2.5 w-2.5" strokeWidth={2} />
                </button>
                <span
                  className={cn(
                    'tabular-nums text-[9px]',
                    sellMode === 'sol' ? 'text-accent-primary' : 'text-fg-muted',
                  )}
                >
                  {nativeSym}
                </span>
              </span>
              <span className="truncate tabular-nums text-[9px] text-fg-secondary">
                {uiBal} {tick}
              </span>
            </div>
            <div
              className={cn(
                'mt-0.5 grid flex-[1_1_0]',
                presetLayout.gridCols,
                presetLayout.gridGapCls,
                presetLayout.gridRowsCls,
                !presetLayout.twoRowGrid && 'mx-auto w-full',
              )}
              style={{
                minHeight: presetLayout.gridMinH,
                maxWidth: presetLayout.gridMaxWidth,
              }}
            >
              {sellChips.map((pct, i) =>
                editSlots ? (
                  <input
                    key={`s-in-${i}`}
                    type="text"
                    inputMode="decimal"
                    value={draftSell[i] ?? ''}
                    onChange={(e) => {
                      const raw = e.target.value;
                      let v = filterDecimalTyped(raw, sellMode === 'pct' ? 4 : 9);
                      if (sellMode === 'pct') v = capPctWhileTyping(v);
                      setDraftSell((prev) => {
                        const next = [
                          ...(prev.length === 8
                            ? prev
                            : sellValues.map((n) =>
                                sellMode === 'pct' ? fmtPctChip(n) : fmtSolChip(n),
                              )),
                        ];
                        next[i] = v;
                        return next;
                      });
                    }}
                    className={cn('h-full min-h-[24px] w-full min-w-0', EDIT_PRESET_CLASS)}
                    style={presetLayout.chipStyle}
                    placeholder={sellMode === 'pct' ? '0–100' : nativeSym}
                    aria-label={sellMode === 'pct' ? 'Sell percent' : `${nativeSym} out`}
                  />
                ) : (
                  <button
                    key={`s-${i}-${pct}`}
                    type="button"
                    onClick={() =>
                      void (sellMode === 'pct' ? runSell(pct) : runSellSolOut(pct))
                    }
                    className={cn(
                      // Task BB: Sell = red outline, transparent fill.
                      'btn-press flex items-center justify-center border border-signal-bear/45 bg-transparent text-center font-sans font-semibold tabular-nums text-signal-bear transition hover:border-signal-bear hover:bg-signal-bear/10 active:bg-signal-bear/15',
                      presetLayout.chipCls,
                    )}
                    style={presetLayout.chipStyle}
                  >
                    {sellMode === 'pct' ? `${fmtPctChip(pct)}%` : fmtSolChip(pct)}
                  </button>
                ),
              )}
            </div>
            <div
              className={cn(
                'mt-1 flex shrink-0 flex-wrap items-center gap-x-2.5 gap-y-1 font-medium text-fg-secondary',
                presetLayout.metaText,
              )}
            >
              <span className="font-medium tabular-nums">
                {(effectiveSlippageBps / 100).toFixed(2)}% slip
              </span>
              <span className="tabular-nums text-fg-muted">{feeHint}</span>
              <span className="inline-flex items-center gap-1">
                <Shield
                  className={cn(presetLayout.metaIcon, 'shrink-0 text-fg-muted')}
                  aria-hidden
                />{' '}
                On
              </span>
              <button
                type="button"
                title={`Sell enough to recover tracked ${nativeSym} in (principal); profit stays in tokens`}
                disabled={!costBasisTonSol || costBasisTonSol <= 0}
                onClick={() => void runSellInitial()}
                className={cn(
                  'btn-press ml-auto rounded-md border px-1.5 py-0.5 font-semibold transition',
                  presetLayout.metaText,
                  costBasisTonSol > 0
                    ? 'border-rose-400/35 text-rose-300/95 hover:border-rose-400/55 hover:bg-rose-500/[0.08]'
                    : 'cursor-not-allowed border-border-subtle text-fg-muted opacity-50',
                )}
              >
                Sell Init.{costBasisTonSol > 0 ? ` ${fmtSolChip(costBasisTonSol)}` : ''}
              </button>
            </div>
              </div>
            {instantUi.showPnlRow ? (
              <div
                className="grid shrink-0 grid-cols-4 divide-x divide-border-subtle border-t border-border-subtle px-0 py-2 text-[11px]"
                role="group"
                aria-label={`Instant trade stats · ${nativeSym}`}
              >
                <div className="flex min-w-0 flex-col items-center justify-center px-1.5 py-px">
                  <span
                    className="inline-flex items-center gap-1 tabular-nums font-semibold text-emerald-400"
                    title="Bought"
                  >
                    <span className="sr-only">Bought </span>
                    <img
                      src={CHAIN_ICON_PNG[activeChain]}
                      alt=""
                      width={14}
                      height={14}
                      className="h-3.5 w-3.5 shrink-0 object-contain opacity-95"
                      draggable={false}
                    />
                    {formatNumber(lifetimeStats.buyTon, { decimals: 4 })}
                  </span>
                </div>
                <div className="flex min-w-0 flex-col items-center justify-center px-1.5 py-px">
                  <span
                    className="inline-flex items-center gap-1 tabular-nums font-semibold text-rose-400"
                    title="Sold"
                  >
                    <span className="sr-only">Sold </span>
                    <img
                      src={CHAIN_ICON_PNG[activeChain]}
                      alt=""
                      width={14}
                      height={14}
                      className="h-3.5 w-3.5 shrink-0 object-contain opacity-95"
                      draggable={false}
                    />
                    {formatNumber(lifetimeStats.sellTon, { decimals: 4 })}
                  </span>
                </div>
                <div className="flex min-w-0 flex-col items-center justify-center px-1.5 py-px">
                  <span
                    className="inline-flex items-center gap-1 tabular-nums font-semibold text-amber-400"
                    title="Remaining"
                  >
                    <span className="sr-only">Remaining </span>
                    <img
                      src={CHAIN_ICON_PNG[activeChain]}
                      alt=""
                      width={14}
                      height={14}
                      className="h-3.5 w-3.5 shrink-0 object-contain opacity-95"
                      draggable={false}
                    />
                    {formatNumber(remainingTon, { decimals: 4 })}
                  </span>
                </div>
                <div className="flex min-w-0 flex-col items-center justify-center px-1.5 py-px">
                  <span
                    className={cn(
                      'inline-flex min-w-0 max-w-full items-center justify-center gap-1 truncate tabular-nums font-semibold',
                      netSessionPnl >= 0 ? 'text-emerald-400' : 'text-rose-400',
                    )}
                    title={
                      netPctForTitle != null
                        ? `PnL — ${netPctForTitle >= 0 ? '+' : ''}${formatNumber(netPctForTitle, { decimals: 1 })}%`
                        : 'PnL'
                    }
                  >
                    <span className="sr-only">PnL </span>
                    <img
                      src={CHAIN_ICON_PNG[activeChain]}
                      alt=""
                      width={14}
                      height={14}
                      className="h-3.5 w-3.5 shrink-0 object-contain opacity-95"
                      draggable={false}
                    />
                    <span className="min-w-0 truncate tracking-tight">
                      {netSessionPnl >= 0 ? '+' : ''}
                      {formatNumber(netSessionPnl, { decimals: 4 })}
                    </span>
                  </span>
                </div>
              </div>
            ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  /** Wallet popover markup (callbacks are declared above early return — see Task BC wallet menu). */
  const walletMenuDrop =
    walletMenuOpen && (walletRows?.length ?? 0) > 0 && walletPopoverPos
      ? createPortal(
          <div
            ref={walletPopoverRef}
            role="dialog"
            aria-label="Select wallets"
            style={{
              position: 'fixed',
              top: walletPopoverPos.top,
              right: walletPopoverPos.right,
              width: 'min(20rem, calc(100vw - 16px))',
              zIndex: 520,
            }}
            className="overflow-hidden rounded-lg border border-border-subtle bg-bg-raised p-3 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="mb-3 flex gap-2">
              <button
                type="button"
                onClick={selectAllWallets}
                disabled={!walletRows || walletRows.length === 0}
                className="btn-press focus-ring h-7 flex-1 rounded bg-bg-sunken px-2 text-[11px] font-medium text-fg-secondary transition-colors hover:bg-bg-hover hover:text-fg-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={selectAllWalletsWithBalance}
                disabled={!walletRows || walletRows.length === 0}
                className="btn-press focus-ring h-7 flex-1 rounded bg-bg-sunken px-2 text-[11px] font-medium text-fg-secondary transition-colors hover:bg-bg-hover hover:text-fg-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                Select All with Balance
              </button>
            </div>

            <div className="max-h-[min(48vh,288px)] space-y-1 overflow-y-auto pr-1">
              {walletRows!.map((w) => {
                const canSign = signingWalletAddresses.has(w.wallet_address);
                const unusable = w.is_archived || !w.is_active || !canSign;
                const isActive = w.wallet_address === (activeWalletAddress ?? wallet?.address);
                const inShort = instantTradeWalletShortlist.includes(w.wallet_address);
                const shortlistFull = instantTradeWalletShortlist.length >= INSTANT_TRADE_WALLET_CAP;
                const checkDisabled = (unusable || (shortlistFull && !inShort)) && !inShort;
                const solUi =
                  w.balance_lamports != null && w.balance_lamports !== ''
                    ? lamportsToSol(BigInt(w.balance_lamports))
                    : null;
                const label = w.label?.trim() || `Wallet ${w.slot ?? ''}`.trim();
                return (
                  <button
                    key={w.id}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    disabled={unusable && !isActive}
                    onClick={() => {
                      if (unusable && !isActive) return;
                      setActiveWalletAddress(w.wallet_address);
                      setWalletMenuOpen(false);
                    }}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded px-2 py-1.5 text-left transition-colors',
                      isActive && 'bg-accent-primary/[0.06]',
                      unusable && !isActive
                        ? 'cursor-not-allowed opacity-50'
                        : 'hover:bg-bg-hover',
                    )}
                  >
                    <span
                      role="checkbox"
                      aria-checked={inShort}
                      aria-disabled={checkDisabled || undefined}
                      tabIndex={-1}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (checkDisabled) return;
                        toggleInstantTradeWallet(w.wallet_address);
                      }}
                      title={
                        shortlistFull && !inShort
                          ? `Max ${INSTANT_TRADE_WALLET_CAP} wallets`
                          : 'Shortlist for multi-wallet'
                      }
                      className={cn(
                        'flex h-4 w-4 shrink-0 items-center justify-center rounded transition-colors',
                        inShort
                          ? 'bg-accent-primary text-fg-inverse'
                          : 'border border-border-subtle bg-bg-sunken',
                        checkDisabled && 'opacity-40',
                      )}
                    >
                      {inShort ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <span className="truncate text-xs font-medium text-fg-primary">
                          {label || shortenAddress(w.wallet_address, 4)}
                        </span>
                        {isActive ? (
                          <span className="rounded-sm bg-accent-primary/15 px-1 py-px text-[8px] font-semibold uppercase tracking-wide text-accent-primary">
                            Active
                          </span>
                        ) : null}
                      </div>
                      <div className="truncate font-mono text-[10px] text-fg-muted">
                        {shortenAddress(w.wallet_address, 4)}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-xs tabular-nums text-fg-secondary">
                        {solUi != null ? formatNumber(solUi, { decimals: 3 }) : '\u2014'}
                      </div>
                      <div className="text-[9px] uppercase tracking-wide text-fg-muted">
                        {nativeSym}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-2 flex items-center justify-between border-t border-border-subtle pt-2 text-[10px] text-fg-muted">
              <span className="inline-flex items-center gap-1">
                <Wallet className="h-3 w-3" strokeWidth={2} />
                {instantTradeWalletShortlist.length} selected
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => clearInstantTradeWalletShortlist()}
                  disabled={instantTradeWalletShortlist.length === 0}
                  className="text-fg-muted hover:text-fg-secondary disabled:opacity-40"
                >
                  Clear
                </button>
                <Link
                  href="/wallets"
                  className="text-accent-primary hover:underline"
                  onClick={() => setWalletMenuOpen(false)}
                >
                  Manage
                </Link>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <PresetEditorModal
        open={presetEditorSlot != null}
        onClose={() => setPresetEditorSlot(null)}
        preset={presetEditorSlot != null ? fullPresetForSlot(presetList, presetEditorSlot) : null}
      />
      <AdvancedTradingSettingsModal
        open={advancedModalSlot != null}
        onClose={() => setAdvancedModalSlot(null)}
        preset={advancedModalSlot != null ? advancedPresetForSlot(presetList, advancedModalSlot) : null}
      />
      <InstantTradeSettingsModal
        open={instantSettingsOpen}
        onClose={() => {
          setInstantSettingsOpen(false);
          setInstantUi(readInstantTradeUiSettings());
        }}
        onOpenFullTradeColumn={
          onOpenFullTradeSettings
            ? () => {
                setInstantSettingsOpen(false);
                setInstantUi(readInstantTradeUiSettings());
                onOpenFullTradeSettings();
              }
            : undefined
        }
      />
      {createPortal(panel, document.body)}
      {walletMenuDrop}
    </>
  );
}
