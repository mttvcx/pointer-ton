'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { useQuery, useQueries } from '@tanstack/react-query';
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
import {
  UNGROUPED_GROUP_ID,
  addressesForGroupSelection,
  getRecentGroups,
  groupViewsFromStore,
  ungroupedWalletAddresses,
} from '@/lib/trade/walletGroups';
import { useWalletGroupsStore } from '@/store/walletGroups';
import { BUY_PRESETS_USDC, DEFAULT_SLIPPAGE_BPS, USDC_DECIMALS } from '@/lib/utils/constants';
import { resolveBuyPresetsSol } from '@/lib/beta/founderBeta';
import type { SolSpendAsset } from '@/lib/trading/spendAsset';
import type { MevMode } from '@/lib/trading/mevMode';
import { shortenAddress } from '@/lib/utils/addresses';
import { cn } from '@/lib/utils/cn';
import { balanceRawFromQueryData } from '@/lib/trading/tradeBalanceQuery';
import { useSpotTradeExecution } from '@/lib/hooks/useSpotTradeExecution';
import { useTradingStore, type PresetSlot, INSTANT_TRADE_WALLET_CAP } from '@/store/trading';
import { useUIStore } from '@/store/ui';
import { nativeTicker } from '@/lib/chains/nativeCurrency';
import { CHAIN_ICON_PNG } from '@/lib/chains/chainAssets';
import { formatNumber, lamportsToSol, rawToUi } from '@/lib/utils/formatters';
import { BlitzWalletChip } from '@/components/trading/BlitzWalletChip';
import { WalletMenuNativeBalance } from '@/components/wallets/WalletMenuNativeBalance';
import { WalletMenuTokenBalance } from '@/components/wallets/WalletMenuTokenBalance';
import { TerminalNativeBalance, TerminalNativeTradePnl } from '@/lib/utils/terminalBalanceFormat';
import { formatTerminalNativeString } from '@/lib/utils/terminalNativeFormat';
import { InstantTradeSettingsModal } from '@/components/trading/InstantTradeSettingsModal';
import { PresetEditorModal } from '@/components/trading/PresetEditorModal';
import {
  AdvancedTradingSettingsModal,
  type AdvancedTradingPreset,
} from '@/components/trading/AdvancedTradingSettingsModal';
import {
  readInstantTradeUiSettings,
  persistInstantTradeUiSettings,
  defaultInstantTradeUiSettings,
  type InstantTradeUiSettings,
} from '@/lib/trading/instantTradeUiSettings';

const BOUNDS_KEY = 'pointer-instant-compact-trade-bounds-v2';
const LEGACY_BOUNDS_KEY = 'pointer-instant-compact-trade-bounds-v1';
const LEGACY_POS_KEY = 'pointer-instant-trade-pos-v1';
const SLOT_OVERRIDES_KEY = 'pointer-instant-trade-slot-overrides-v1';

/** Stops resize before internal overflow; pairing with viewport bottom inset avoids covering the SOL dock. */
const MIN_W = 284;
/** Compact single-row chrome + buy/sell 4×1 + PnL. */
const MIN_H_ONE_ROW = 268;
/** Axiom-style default — compact width, two preset rows at open. */
const DEFAULT_BOUNDS = { x: 56, y: 72, w: 318, h: 388 } as const;
/** Two-row 4×2 grids when panel is wide AND tall enough (Axiom resize logic). */
const PRESET_TWO_ROW_MIN_W = 296;
const PRESET_TWO_ROW_MIN_H = 352;
/** Fixed preset grid height in single-row mode — no flex stretch / dead space. */
const ONE_ROW_GRID_H = 32;
/** Axiom-parity toolbar — ~32px touch targets, still easy to tap. */
const INSTANT_TOOLBAR_ROW = 'flex shrink-0 items-center gap-1 border-b border-border-subtle bg-bg-raised px-2 py-1.5';
const INSTANT_TOOLBAR_BTN =
  'btn-press focus-ring flex h-8 min-w-8 cursor-pointer items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-primary';
const INSTANT_CLOSE_BTN =
  'btn-press focus-ring flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md border border-border-subtle/80 bg-bg-sunken text-fg-secondary transition-colors hover:border-border-default hover:bg-bg-hover hover:text-fg-primary';

/** Keep toolbar buttons from bubbling pointerdown to drag spacers / row chrome. */
function blockToolbarDrag(e: React.PointerEvent) {
  e.stopPropagation();
}
const INSTANT_PRESET_TAB =
  'btn-press focus-ring h-8 min-w-[2.25rem] cursor-pointer rounded-md px-2.5 text-[11px] font-bold transition';
/** Inline Buy-row asset pills (Axiom — not a full-width second row). */
const INSTANT_ASSET_PILL =
  'btn-press focus-ring flex h-6 items-center gap-1 rounded px-2 text-[10px] font-semibold transition';
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

const INSTANT_FILL_USDC = [10, 25, 50, 100, 200, 400, 600, 800] as const;
const DEFAULT_SELL_USDC = [25, 50, 100, 200, 400, 600, 800, 1000] as const;

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
  sellUsdc?: number[];
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
      sellUsdc?: unknown;
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
    const sellUsdc = Array.isArray(j.sellUsdc)
      ? j.sellUsdc.filter((n): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0)
      : undefined;
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
      ...(sellUsdc?.length === 8 ? { sellUsdc } : {}),
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

function minPanelHeightFor(_h: number): number {
  return MIN_H_ONE_ROW;
}

function isTwoRowPanelSize(w: number, h: number): boolean {
  return w >= PRESET_TWO_ROW_MIN_W && h >= PRESET_TWO_ROW_MIN_H;
}

/** Enforce instant-trade mins and keep on-screen (matches resize clamps — avoids saved tiny bounds + inner scroll). */
function clampInstantTradeBounds(b: { x: number; y: number; w: number; h: number }): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  if (typeof window === 'undefined') {
    return { ...b, w: Math.max(MIN_W, b.w), h: Math.max(MIN_H_ONE_ROW, b.h) };
  }
  const maxR = window.innerWidth - EDGE_INSET;
  const maxB = window.innerHeight - viewportBottomReservePx();
  const w = Math.max(MIN_W, Math.min(b.w, maxR - EDGE_INSET));
  const h = Math.max(minPanelHeightFor(b.h), Math.min(b.h, maxB - EDGE_INSET));
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

function eightPresetAmounts(preset: readonly number[], fill: readonly number[]): number[] {
  const ordered = new Set<number>();
  for (const n of preset) {
    if (Number.isFinite(n) && n > 0) ordered.add(n);
  }
  for (const n of fill) {
    if (ordered.size >= 8) break;
    ordered.add(n);
  }
  return Array.from(ordered)
    .sort((a, b) => a - b)
    .slice(0, 8);
}

function eightBuyUsdcAmounts(preset: readonly number[]): number[] {
  return eightPresetAmounts(preset, INSTANT_FILL_USDC);
}

function fmtSolChip(n: number): string {
  const t = n.toFixed(4).replace(/\.?0+$/, '');
  return t || String(n);
}

/** PnL footer title — subscript native string (Axiom parity). */
function fmtInstantPnlTitle(pnl: number, pct: number | null): string {
  const pctRounded =
    pct == null || !Number.isFinite(pct) ? 0 : Math.abs(pct) < 0.05 ? 0 : Math.round(pct);
  const pctSign = pctRounded >= 0 ? '+' : '';
  if (pnl < 0) {
    return `${formatTerminalNativeString(pnl)}(${pctSign}${pctRounded}%)`;
  }
  return `+${formatTerminalNativeString(pnl)}(${pctSign}${pctRounded}%)`;
}

function fmtPctChip(n: number): string {
  const t = n < 10 ? n.toFixed(2).replace(/\.?0+$/, '') : String(Math.round(n));
  return t || String(n);
}

function eightBuyAmounts(preset: number[]): number[] {
  return eightPresetAmounts(preset, INSTANT_FILL);
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
    buy_amounts_sol: eightBuyAmounts([...resolveBuyPresetsSol()]),
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
  const minH = minPanelHeightFor(h);
  if (h < minH) {
    if (edge === 'n' || edge === 'nw' || edge === 'ne') {
      y = ry + rh - minH;
    }
    h = minH;
  }

  const insetB = viewportBottomReservePx();
  const maxR = window.innerWidth - EDGE_INSET;
  const maxB = window.innerHeight - insetB;
  const minHFinal = minPanelHeightFor(h);

  x = clamp(x, EDGE_INSET, maxR - MIN_W);
  y = clamp(y, EDGE_INSET, maxB - minHFinal);
  w = clamp(w, MIN_W, maxR - x);
  h = clamp(h, minHFinal, maxB - y);
  if (x + w > maxR) w = maxR - x;
  if (y + h > maxB) h = maxB - y;
  w = Math.max(MIN_W, w);
  h = Math.max(minPanelHeightFor(h), h);
  return { x, y, w, h };
}

export type ResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

type Props = {
  mint: string;
  symbol: string | null;
  decimals: number;
  priceUsd?: number | null;
  open: boolean;
  onClose: () => void;
  onOpenFullTradeSettings?: () => void;
};

export function CompactInstantTradePanel({
  mint,
  symbol,
  decimals,
  priceUsd = null,
  open,
  onClose,
  onOpenFullTradeSettings,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [bounds, setBounds] = useState(() => readBoundsForWallet(null));
  const boundsRef = useRef(bounds);
  /** Panel position loads once per open — wallet switches must not jump/reshape the shell. */
  const boundsInitForOpenRef = useRef(false);
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

  const walletGroups = useWalletGroupsStore((s) => s.groups);
  const activeWalletGroupId = useWalletGroupsStore((s) => s.activeGroupId);
  const setActiveWalletGroupId = useWalletGroupsStore((s) => s.setActiveGroupId);
  const touchWalletGroup = useWalletGroupsStore((s) => s.touchGroup);

  const [walletGroupMenuOpen, setWalletGroupMenuOpen] = useState(false);
  const walletGroupMenuRef = useRef<HTMLDivElement>(null);
  const walletGroupMenuBtnRef = useRef<HTMLButtonElement>(null);
  const walletGroupMenuPopoverRef = useRef<HTMLDivElement>(null);
  const [walletGroupMenuPos, setWalletGroupMenuPos] = useState<{
    top: number;
    left: number;
  } | null>(null);
  useEffect(() => {
    if (!walletGroupMenuOpen) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (walletGroupMenuRef.current?.contains(t)) return;
      if (walletGroupMenuPopoverRef.current?.contains(t)) return;
      setWalletGroupMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [walletGroupMenuOpen]);

  useLayoutEffect(() => {
    if (!walletGroupMenuOpen || !walletGroupMenuBtnRef.current) {
      setWalletGroupMenuPos(null);
      return;
    }
    const update = () => {
      const r = walletGroupMenuBtnRef.current?.getBoundingClientRect();
      if (!r) return;
      setWalletGroupMenuPos({ top: r.bottom + 6, left: Math.max(8, r.right - 160) });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [walletGroupMenuOpen, bounds.x, bounds.y, bounds.w, bounds.h]);

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
  const activePresetSlot = useTradingStore((s) => s.activePresetSlot);
  const setActivePresetSlot = useTradingStore((s) => s.setActivePresetSlot);
  const instantTradeWalletShortlist = useTradingStore((s) => s.instantTradeWalletShortlist);
  const toggleInstantTradeWallet = useTradingStore((s) => s.toggleInstantTradeWallet);
  const setInstantTradeWalletShortlist = useTradingStore((s) => s.setInstantTradeWalletShortlist);
  const clearInstantTradeWalletShortlist = useTradingStore((s) => s.clearInstantTradeWalletShortlist);

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
    tradeDeskStats,
    spendAsset,
    setSpendAsset,
    usdcBalanceRaw,
    walletRows,
    activeWalletAddress,
    setActiveWalletAddress,
    signingWalletAddresses,
  } = useSpotTradeExecution(mint, { decimals, priceUsd });

  const walletTokenBalanceQueries = useQueries({
    queries: (walletRows ?? []).map((w) => ({
      queryKey: ['trade-balance', mint, w.wallet_address] as const,
      queryFn: async (): Promise<{ rawAmount: string }> => {
        const token = await getAccessToken();
        if (!token) return { rawAmount: '0' };
        const res = await fetch(
          `/api/trade/balance?mint=${encodeURIComponent(mint)}&wallet=${encodeURIComponent(w.wallet_address)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!res.ok) return { rawAmount: '0' };
        const json: unknown = await res.json();
        const raw =
          typeof json === 'object' && json && 'rawAmount' in json
            ? String((json as { rawAmount: unknown }).rawAmount)
            : '0';
        return { rawAmount: raw };
      },
      enabled: walletMenuOpen && Boolean(mint && authenticated),
      staleTime: 15_000,
    })),
  });

  const walletTokenBalanceByAddress = useMemo(() => {
    const map = new Map<string, string>();
    (walletRows ?? []).forEach((w, i) => {
      map.set(w.wallet_address, balanceRawFromQueryData(walletTokenBalanceQueries[i]?.data));
    });
    return map;
  }, [walletRows, walletTokenBalanceQueries]);

  const activeChain = useUIStore((s) => s.activeChain);

  const tradableWalletAddresses = useMemo(() => {
    return (walletRows ?? [])
      .filter((w) => !w.is_archived && w.is_active && signingWalletAddresses.has(w.wallet_address))
      .map((w) => w.wallet_address);
  }, [walletRows, signingWalletAddresses]);

  const knownWalletAddressSet = useMemo(
    () => new Set(tradableWalletAddresses),
    [tradableWalletAddresses],
  );

  const ungroupedCount = useMemo(
    () => ungroupedWalletAddresses(tradableWalletAddresses, walletGroups).length,
    [tradableWalletAddresses, walletGroups],
  );

  const walletGroupViews = useMemo(
    () =>
      groupViewsFromStore(walletGroups, knownWalletAddressSet, ungroupedCount > 0, ungroupedCount).filter(
        (g) => g.walletCount > 0,
      ),
    [walletGroups, knownWalletAddressSet, ungroupedCount],
  );

  const recentWalletGroups = useMemo(
    () => getRecentGroups(walletGroupViews, 5),
    [walletGroupViews],
  );

  const overflowWalletGroups = useMemo(
    () => walletGroupViews.filter((g) => !recentWalletGroups.some((r) => r.id === g.id)),
    [walletGroupViews, recentWalletGroups],
  );

  const selectWalletGroup = useCallback(
    (groupId: string) => {
      setActiveWalletGroupId(groupId);
      if (groupId !== UNGROUPED_GROUP_ID) touchWalletGroup(groupId);
      const addrs = addressesForGroupSelection(groupId, walletGroups, tradableWalletAddresses);
      setInstantTradeWalletShortlist(addrs);
      if (addrs[0]) setActiveWalletAddress(addrs[0], true);
    },
    [
      walletGroups,
      tradableWalletAddresses,
      setActiveWalletGroupId,
      touchWalletGroup,
      setInstantTradeWalletShortlist,
      setActiveWalletAddress,
    ],
  );

  useEffect(() => {
    if (!open || walletGroupViews.length === 0) return;
    if (activeWalletGroupId && walletGroupViews.some((g) => g.id === activeWalletGroupId)) return;
    selectWalletGroup(walletGroupViews[0]!.id);
  }, [open, walletGroupViews, activeWalletGroupId, selectWalletGroup]);

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
    if (!open) {
      boundsInitForOpenRef.current = false;
      return;
    }
    const raf = requestAnimationFrame(() => {
      if (!boundsInitForOpenRef.current) {
        boundsInitForOpenRef.current = true;
        const normalized = readBoundsForWallet(wallet?.address ?? null);
        setBounds(normalized);
        boundsRef.current = normalized;
      }
      setSlotBundle(readSlotOverrides() ?? migrateLegacySlots());
      setInstantUi(readInstantTradeUiSettings());
    });
    return () => cancelAnimationFrame(raf);
  }, [open, wallet?.address]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

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
      : [...resolveBuyPresetsSol()];
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
  const sellUsdcArr =
    slotBundle?.sellUsdc && slotBundle.sellUsdc.length === 8
      ? slotBundle.sellUsdc
      : eightPresetAmounts(DEFAULT_SELL_USDC, INSTANT_FILL_USDC);

  const sellFixedAsset: SolSpendAsset = buySpendAsset === 'usdc' ? 'usdc' : 'sol';
  const sellFixedSym = sellFixedAsset === 'usdc' ? 'USDC' : nativeTicker(activeChain);
  const sellValues =
    sellMode === 'pct'
      ? sellPctArr
      : sellFixedAsset === 'usdc'
        ? sellUsdcArr
        : sellSolArr;
  const fmtSellFixedChip = sellFixedAsset === 'usdc' ? fmtUsdcChip : fmtSolChip;

  const setSellMode = useCallback(
    (m: SellMode) => {
      setSlotBundle((prev) => {
        const next: SlotPersistV2 = {
          buy: prev?.buy && prev.buy.length === 8 ? prev.buy : buyFromPreset,
          sellPct: prev?.sellPct && prev.sellPct.length === 8 ? prev.sellPct : [...DEFAULT_SELL_PCT],
          sellSol: prev?.sellSol && prev.sellSol.length === 8 ? prev.sellSol : [...DEFAULT_SELL_SOL],
          sellUsdc:
            prev?.sellUsdc && prev.sellUsdc.length === 8
              ? prev.sellUsdc
              : eightPresetAmounts(DEFAULT_SELL_USDC, INSTANT_FILL_USDC),
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
        const fallback = asPct
          ? sellPctArr[i] ?? 1
          : sellFixedAsset === 'usdc'
            ? sellUsdcArr[i] ?? 25
            : sellSolArr[i] ?? 0.01;
        if (!Number.isFinite(n) || n <= 0) return fallback;
        return asPct ? clamp(n, 0.0001, 100) : clamp(n, 1e-12, 1e12);
      };
      const sellPctNext =
        sellMode === 'pct'
          ? draftSell.map((s, i) => parseSellOne(s, i, true))
          : sellPctArr;
      const sellSolNext =
        sellMode === 'sol' && sellFixedAsset === 'sol'
          ? draftSell.map((s, i) => parseSellOne(s, i, false))
          : sellSolArr;
      const sellUsdcNext =
        sellMode === 'sol' && sellFixedAsset === 'usdc'
          ? draftSell.map((s, i) => parseSellOne(s, i, false))
          : sellUsdcArr;
      if (buy8.length === 8) {
        const payload: SlotPersistV2 = {
          buy: buySpendAsset === 'usdc' ? buyValuesSol : buy8,
          buyUsdc: buySpendAsset === 'usdc' ? buy8 : buyValuesUsdc,
          sellPct: sellPctNext,
          sellSol: sellSolNext,
          sellUsdc: sellUsdcNext,
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
      sellValues.map((n) => (sellMode === 'pct' ? fmtPctChip(n) : fmtSellFixedChip(n))),
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
    sellUsdcArr,
    sellFixedAsset,
    fmtSellFixedChip,
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
  const uiBal = formatTerminalNativeString(rawToUi(balanceRaw, decimals));
  const uiUsdcBal = formatTerminalNativeString(rawToUi(usdcBalanceRaw, USDC_DECIMALS));
  const nativeSym = nativeTicker(activeChain);

  const presetLayout = useMemo(() => {
    const w = bounds.w;
    const h = bounds.h;
    const twoRowGrid = isTwoRowPanelSize(w, h);
    const topRowOnlyCompact = !twoRowGrid;
    const gridCols = 'grid-cols-4';
    const gridGapCls = 'gap-1';
    const gridRowsCls = twoRowGrid ? 'grid-rows-2' : 'grid-rows-1';
    const gridGapPx = 4;

    const gridMaxWidth = twoRowGrid ? undefined : Math.min(PRESET_GRID_MAX_W, w - 16);
    const usableGridW = twoRowGrid ? w - 16 : Math.min(PRESET_GRID_MAX_W, w - 16);
    const rawCellW = (usableGridW - gridGapPx * 3) / 4;
    const cellW = twoRowGrid
      ? Math.max(48, rawCellW)
      : Math.max(48, Math.min(PRESET_CHIP_MAX_W, rawCellW));

    const chromeH = 128;
    const pnlRowH = 36;
    const innerH = Math.max(120, h - chromeH - pnlRowH);
    const sectionH = innerH / 2;
    const rowCount = twoRowGrid ? 2 : 1;
    const metaBand = 26;
    const buyGridH = twoRowGrid
      ? Math.max(52, sectionH - metaBand)
      : ONE_ROW_GRID_H;
    const cellH = twoRowGrid
      ? (buyGridH - gridGapPx * Math.max(0, rowCount - 1)) / rowCount
      : ONE_ROW_GRID_H;
    const chipDim = Math.min(cellW, cellH);
    const chipFontPx = twoRowGrid
      ? clamp(Math.round(chipDim * 0.34), 12, 16)
      : clamp(Math.round(Math.min(cellW, ONE_ROW_GRID_H) * 0.38), 11, 13);

    const chipBox = twoRowGrid
      ? cn('h-full w-full min-h-[26px] rounded-full px-0.5')
      : cn('h-8 w-full max-w-[76px] rounded-full px-0.5');
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
      sectionClass: twoRowGrid
        ? 'flex min-h-0 flex-[1_1_0] flex-col'
        : 'flex shrink-0 flex-col',
      bodyClass: 'min-h-0 flex-1',
      gridClass: cn(
        'mt-0.5 grid',
        gridCols,
        gridGapCls,
        gridRowsCls,
        twoRowGrid ? 'min-h-[48px] flex-[1_1_0]' : 'mx-auto w-full shrink-0 place-items-center',
      ),
      gridStyle: twoRowGrid
        ? undefined
        : ({ height: ONE_ROW_GRID_H, maxWidth: gridMaxWidth } as const),
      chipCls: chipBox,
      chipStyle,
      chipFontPx,
      metaText,
      metaIcon,
    };
  }, [bounds.w, bounds.h]);

  const buyChips =
    editSlots || !presetLayout.topRowOnlyCompact ? buyValues : buyValues.slice(0, 4);
  const sellChips =
    editSlots || !presetLayout.topRowOnlyCompact ? sellValues : sellValues.slice(0, 4);

  const netSessionPnl = tradeDeskStats.netPnlSol;
  const netPctForTitle = tradeDeskStats.netPnlPct;
  const remainingTon = tradeDeskStats.holdingSol;

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
  }, [activeChain, nativeSym]);

  const spendAssetOptionsVisible = useMemo(
    () => spendAssetOptions.filter((o) => !o.disabled),
    [spendAssetOptions],
  );

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
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
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

  const applyPointerDrag = useCallback((clientX: number, clientY: number) => {
    const d = dragStart.current;
    if (!d) return;
    const dx = clientX - d.px;
    const dy = clientY - d.py;
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

  const endPointerDrag = useCallback(() => {
    if (!dragStart.current) return;
    dragStart.current = null;
    setGrabbed(false);
    persistBoundsForWallet(boundsRef.current, wallet?.address ?? null);
  }, [wallet?.address]);

  useEffect(() => {
    if (!grabbed) return;
    const onMove = (e: PointerEvent) => applyPointerDrag(e.clientX, e.clientY);
    const onUp = () => endPointerDrag();
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [grabbed, applyPointerDrag, endPointerDrag]);

  const isToolbarInteractiveTarget = (target: EventTarget | null): boolean => {
    if (!(target instanceof HTMLElement)) return false;
    return Boolean(
      target.closest(
        'button,a,input,textarea,select,[role="checkbox"],[role="switch"],[role="menuitem"]',
      ),
    );
  };

  const onToolbarPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (isToolbarInteractiveTarget(e.target)) return;
      onMoveDown(e);
    },
    [onMoveDown],
  );

  /** Empty chrome only — never wrap buttons/inputs (they must keep pointer events). */
  const panelDragSurfaceClass =
    'cursor-grab touch-none active:cursor-grabbing select-none';

  const toggleHotkeys = useCallback(() => {
    setInstantUi((prev) => {
      const next = { ...prev, hotkeysEnabled: !prev.hotkeysEnabled };
      persistInstantTradeUiSettings(next);
      return next;
    });
  }, []);

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

  /** Resize handles sit above toolbar (z-50) but below wallet popovers. */
  const RESIZE_Z = 'z-[60]';
  const EDGE_HIT = 10;
  const CORNER = 14;
  /** Side handles start below the main toolbar so they don't fight hotkey/preset clicks. */
  const SIDE_RESIZE_TOP = 44;

  const panel = (
    <div
      className={cn(
        'fixed z-[240] isolate flex flex-col overflow-hidden rounded-xl border border-border-subtle bg-bg-raised font-sans shadow-[0_24px_48px_-16px_rgba(0,0,0,0.65)] transition-[transform,box-shadow] duration-150 ease-out',
        grabbed && 'scale-[1.015] shadow-[0_28px_64px_-12px_rgba(0,0,0,0.75)] ring-1 ring-border-subtle',
      )}
      style={{ left: bounds.x, top: bounds.y, width: bounds.w, height: bounds.h }}
      role="dialog"
      aria-label="Instant trade"
    >
      {/* Resize: edges + corners (above toolbar chrome) */}
      <div
        role="presentation"
        className={cn('absolute bottom-0 left-0 right-0 cursor-ns-resize', RESIZE_Z)}
        style={{ height: EDGE_HIT }}
        onPointerDown={onResizeDown('s')}
      />
      <div
        role="presentation"
        className={cn('absolute bottom-0 left-0 cursor-ew-resize', RESIZE_Z)}
        style={{ width: EDGE_HIT, top: SIDE_RESIZE_TOP }}
        onPointerDown={onResizeDown('w')}
      />
      <div
        role="presentation"
        className={cn('absolute bottom-0 right-0 cursor-ew-resize', RESIZE_Z)}
        style={{ width: EDGE_HIT, top: SIDE_RESIZE_TOP }}
        onPointerDown={onResizeDown('e')}
      />
      <div
        role="presentation"
        className={cn('absolute left-0 top-0 cursor-nwse-resize', RESIZE_Z)}
        style={{ width: CORNER, height: CORNER }}
        onPointerDown={onResizeDown('nw')}
      />
      <div
        role="presentation"
        className={cn('absolute right-0 top-0 cursor-nesw-resize', RESIZE_Z)}
        style={{ width: CORNER, height: CORNER }}
        onPointerDown={onResizeDown('ne')}
      />
      <div
        role="presentation"
        className={cn('absolute bottom-0 left-0 cursor-nesw-resize', RESIZE_Z)}
        style={{ width: CORNER, height: CORNER }}
        onPointerDown={onResizeDown('sw')}
      />
      <div
        role="presentation"
        className={cn('absolute bottom-0 right-0 cursor-nwse-resize', RESIZE_Z)}
        style={{ width: CORNER, height: CORNER }}
        onPointerDown={onResizeDown('se')}
      />
      <div
        role="presentation"
        className={cn('absolute left-0 right-0 cursor-ns-resize', RESIZE_Z)}
        style={{ top: SIDE_RESIZE_TOP, height: EDGE_HIT }}
        onPointerDown={onResizeDown('n')}
      />

      {walletGroupViews.length > 0 ? (
      <div className={cn(INSTANT_TOOLBAR_ROW, 'relative z-50 gap-2 py-1.5')}>
        <div
          className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Wallet groups"
          onPointerDown={onToolbarPointerDown}
        >
          {recentWalletGroups.map((g) => {
            const active = activeWalletGroupId === g.id;
            return (
              <button
                key={g.id}
                type="button"
                onPointerDown={blockToolbarDrag}
                onClick={() => selectWalletGroup(g.id)}
                title={`${g.label} · ${g.walletCount} wallet${g.walletCount === 1 ? '' : 's'}`}
                className={cn(
                  'btn-press h-8 shrink-0 rounded-md border px-2.5 text-[11px] font-semibold transition-colors',
                  active
                    ? 'border-accent-primary/55 bg-accent-primary/15 text-accent-primary'
                    : 'border-border-subtle bg-bg-sunken text-fg-secondary hover:bg-bg-hover hover:text-fg-primary',
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
              ref={walletGroupMenuBtnRef}
              type="button"
              onPointerDown={blockToolbarDrag}
              onClick={() => setWalletGroupMenuOpen((v) => !v)}
              className={cn(
                INSTANT_TOOLBAR_BTN,
                walletGroupMenuOpen && 'bg-bg-hover text-fg-primary',
              )}
              aria-expanded={walletGroupMenuOpen}
              aria-haspopup="listbox"
              title="More wallet groups"
            >
              <ChevronDown className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          </div>
        ) : null}
      </div>
      ) : null}

      <div className={cn(INSTANT_TOOLBAR_ROW, 'relative z-50 min-h-[38px] pl-2 pr-1')}>
        <div
          className={cn('absolute inset-0', panelDragSurfaceClass)}
          onPointerDown={onMoveDown}
          aria-hidden
        />
        <div className="relative z-10 flex w-full min-w-0 items-center gap-1 pointer-events-none">
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
        <button
          type="button"
          onPointerDown={blockToolbarDrag}
          onClick={() => toggleHotkeys()}
          className={cn(
            INSTANT_TOOLBAR_BTN,
            'pointer-events-auto shrink-0',
            instantUi.hotkeysEnabled &&
              'bg-accent-primary/15 text-accent-primary ring-1 ring-accent-primary/35',
          )}
          aria-pressed={instantUi.hotkeysEnabled}
          aria-label={instantUi.hotkeysEnabled ? 'Hotkeys enabled' : 'Enable hotkeys'}
          title={
            instantUi.hotkeysEnabled
              ? 'Hotkeys enabled · Hold space to use hotkeys'
              : 'Enable hotkeys'
          }
        >
          <Keyboard className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
        {([1, 2, 3] as const).map((slot) => (
          <button
            key={slot}
            type="button"
            onPointerDown={blockToolbarDrag}
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
              INSTANT_PRESET_TAB,
              'pointer-events-auto',
              activePresetSlot === slot
                ? 'bg-accent-primary/25 text-accent-primary ring-1 ring-accent-primary/30'
                : 'text-fg-muted hover:bg-bg-hover hover:text-fg-secondary',
            )}
          >
            P{slot}
          </button>
        ))}
        <button
          type="button"
          onPointerDown={blockToolbarDrag}
          onClick={() => toggleSlotEdit()}
          className={cn(
            INSTANT_TOOLBAR_BTN,
            'pointer-events-auto',
            editSlots
              ? 'bg-sky-500/40 text-sky-50 shadow-[0_0_16px_rgba(56,189,248,0.55)] ring-2 ring-sky-400'
              : undefined,
          )}
          aria-label={editSlots ? 'Finish editing amounts' : 'Edit buy and sell amounts'}
          aria-pressed={editSlots}
          title="Edit grid amounts"
        >
          <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
        <div
          className="pointer-events-none mx-0.5 flex min-h-8 min-w-[1.25rem] max-w-[2.5rem] flex-1 items-center justify-center py-1"
          aria-hidden
        >
          <GripVertical className="h-3.5 w-3.5 text-fg-muted/50" strokeWidth={2} />
        </div>
        <button
          type="button"
          onPointerDown={blockToolbarDrag}
          onClick={() => setInstantSettingsOpen(true)}
          className={cn(INSTANT_TOOLBAR_BTN, 'pointer-events-auto shrink-0')}
          aria-label="Instant trade settings"
          title="Instant trade settings"
        >
          <Settings2 className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
        </div>
        <div className="flex shrink-0 items-center gap-0.5 border-l border-border-subtle/60 pl-1 pointer-events-auto">
        <div className="relative shrink-0" ref={walletMenuRef}>
          <button
            type="button"
            onPointerDown={blockToolbarDrag}
            onClick={() => setWalletMenuOpen((o) => !o)}
            disabled={!authenticated || !(walletRows?.length)}
            className={cn(
              INSTANT_TOOLBAR_BTN,
              'pointer-events-auto relative',
              walletMenuOpen && 'bg-accent-primary/10 text-accent-primary',
              (!authenticated || !walletRows?.length) && 'cursor-not-allowed opacity-40',
            )}
            aria-expanded={walletMenuOpen}
            aria-haspopup="listbox"
            title="Wallets — check up to 100 · Shift / Ctrl + P1–P3 for preset editors"
          >
            <Wallet className="h-3.5 w-3.5" strokeWidth={2} />
            {instantTradeWalletShortlist.length > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-accent-primary px-0.5 tabular-nums text-[8px] font-bold leading-none text-fg-inverse">
                {instantTradeWalletShortlist.length > 99 ? '99+' : instantTradeWalletShortlist.length}
              </span>
            ) : null}
          </button>
        </div>
        <button
          type="button"
          onPointerDown={blockToolbarDrag}
          onClick={onClose}
          className={cn(INSTANT_CLOSE_BTN, 'relative z-[70]')}
          aria-label="Close instant trade"
          title="Close (Esc)"
        >
          <X className="h-4 w-4" strokeWidth={2.25} aria-hidden />
        </button>
        </div>
        </div>
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden bg-bg-raised">
        {!walletsReady ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-2 pb-1.5 pt-1 text-[10px]">
            <p className="text-fg-muted">Loading...</p>
          </div>
        ) : !authenticated || !wallet ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-2 pb-1.5 pt-1 text-[10px]">
            <p className="text-signal-warn">Sign in with an embedded wallet to trade.</p>
          </div>
        ) : (
          <div
            className={cn(
              'flex min-w-0 flex-col overflow-hidden px-2.5 pt-1.5 text-[11px]',
              presetLayout.bodyClass,
            )}
          >
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden pb-1.5">
              <div className={presetLayout.sectionClass}>
            <div className="flex w-full min-w-0 shrink-0 items-center gap-1.5">
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-fg-secondary">
                Buy
              </span>
              {spendAssetOptionsVisible.length > 1 ? (
                <div
                  className="flex shrink-0 items-center gap-px rounded-md border border-border-subtle bg-bg-sunken/60 p-px"
                  role="tablist"
                  aria-label="Spend asset"
                >
                  {spendAssetOptionsVisible.map(({ k, label }) => (
                    <button
                      key={k}
                      type="button"
                      role="tab"
                      aria-selected={buySpendAsset === k}
                      title={k === 'usdc' ? 'Trading with USDC' : undefined}
                      onClick={() => setSpendAsset(k as SolSpendAsset)}
                      className={cn(
                        INSTANT_ASSET_PILL,
                        buySpendAsset === k
                          ? 'bg-bg-hover text-fg-primary'
                          : 'text-fg-muted hover:text-fg-secondary',
                      )}
                    >
                      {k === 'usdc' ? (
                        <QuoteTokenIcon kind="usdc" className="h-3 w-3 shrink-0" />
                      ) : (
                        <img
                          src={CHAIN_ICON_PNG[activeChain]}
                          alt=""
                          className="h-3 w-3 shrink-0 object-contain opacity-90"
                          draggable={false}
                          aria-hidden
                        />
                      )}
                      {label}
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="min-w-0 flex-1" aria-hidden />
              <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold tabular-nums text-fg-primary">
                {buySpendAsset === 'usdc' ? (
                  <>
                    <QuoteTokenIcon kind="usdc" className="h-3 w-3 shrink-0" />
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
                    <TerminalNativeBalance
                      amount={
                        wallet?.address && activeWalletRow?.balance_lamports
                          ? lamportsToSol(BigInt(activeWalletRow.balance_lamports))
                          : 0
                      }
                    />
                  </>
                )}
              </span>
            </div>
            <div className={presetLayout.gridClass} style={presetLayout.gridStyle}>
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
              onPointerDown={onToolbarPointerDown}
              className={cn(
                'mt-1 flex shrink-0 flex-wrap items-center gap-x-2.5 gap-y-1 font-medium text-fg-secondary',
                presetLayout.metaText,
                panelDragSurfaceClass,
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
              <span className="min-w-0 flex-1" aria-hidden />
              <label
                className="ml-auto inline-flex shrink-0 cursor-pointer items-center gap-1.5 text-[11px] font-medium"
                onPointerDown={blockToolbarDrag}
              >
                <input
                  type="checkbox"
                  checked={advChecked}
                  onChange={(e) => setAdvChecked(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-border-subtle accent-accent-primary"
                />
                Adv.
              </label>
            </div>
              </div>

              <div
                className={cn(
                  'mt-2 flex border-t border-border-subtle pt-2',
                  presetLayout.sectionClass,
                )}
              >
            <div className="flex w-full shrink-0 items-center justify-between gap-2 py-0.5">
              <span className="inline-flex min-w-0 items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-fg-secondary">
                Sell
                <span
                  className={cn(
                    'tabular-nums text-[10px]',
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
                  className={cn(INSTANT_TOOLBAR_BTN, 'h-7 min-w-7 shrink-0')}
                  title={`Switch: % of balance vs fixed ${sellFixedSym} received`}
                  aria-label="Toggle sell mode"
                >
                  <ArrowLeftRight className="h-3 w-3" strokeWidth={2} />
                </button>
                <span
                  className={cn(
                    'tabular-nums text-[10px]',
                    sellMode === 'sol' ? 'text-accent-primary' : 'text-fg-muted',
                  )}
                >
                  {sellFixedSym}
                </span>
              </span>
              <span className="shrink-0 truncate text-[11px] font-semibold tabular-nums text-fg-secondary">
                {uiBal} {tick}
              </span>
            </div>
            <div className={presetLayout.gridClass} style={presetLayout.gridStyle}>
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
                                sellMode === 'pct' ? fmtPctChip(n) : fmtSellFixedChip(n),
                              )),
                        ];
                        next[i] = v;
                        return next;
                      });
                    }}
                    className={cn('h-full min-h-[24px] w-full min-w-0', EDIT_PRESET_CLASS)}
                    style={presetLayout.chipStyle}
                    placeholder={sellMode === 'pct' ? '0–100' : sellFixedSym}
                    aria-label={sellMode === 'pct' ? 'Sell percent' : `${sellFixedSym} out`}
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
                    {sellMode === 'pct' ? `${fmtPctChip(pct)}%` : fmtSellFixedChip(pct)}
                  </button>
                ),
              )}
            </div>
            <div
              onPointerDown={onToolbarPointerDown}
              className={cn(
                'mt-1 flex shrink-0 flex-wrap items-center gap-x-2.5 gap-y-1 font-medium text-fg-secondary',
                presetLayout.metaText,
                panelDragSurfaceClass,
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
              <span className="min-w-0 flex-1" aria-hidden />
              <button
                type="button"
                onPointerDown={blockToolbarDrag}
                title={`Sell enough to recover tracked ${nativeSym} in (principal); profit stays in tokens`}
                disabled={!costBasisTonSol || costBasisTonSol <= 0}
                onClick={() => void runSellInitial()}
                className={cn(
                  'btn-press shrink-0 rounded-md border px-1.5 py-0.5 font-semibold transition',
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
              <div className="shrink-0 border-t border-border-subtle">
                <div
                  onPointerDown={onMoveDown}
                  className={cn(panelDragSurfaceClass, 'h-2 w-full')}
                  aria-label="Drag instant trade panel"
                  title="Drag"
                />
                <div
                  className="grid grid-cols-4 divide-x divide-border-subtle px-0 py-1 text-[11px]"
                  role="group"
                  aria-label={`Instant trade stats · ${nativeSym}`}
                >
                <div className="flex min-w-0 flex-col items-center justify-center px-1 py-px">
                  <span
                    className="inline-flex max-w-full min-w-0 items-center gap-1 tabular-nums font-semibold text-emerald-400"
                    title={`Bought — ${formatTerminalNativeString(tradeDeskStats.buyTon)}`}
                  >
                    <span className="sr-only">Bought </span>
                    <img
                      src={CHAIN_ICON_PNG[activeChain]}
                      alt=""
                      width={12}
                      height={12}
                      className="h-3 w-3 shrink-0 object-contain opacity-95"
                      draggable={false}
                    />
                    <span className="min-w-0 truncate">
                      <TerminalNativeBalance amount={tradeDeskStats.buyTon} />
                    </span>
                  </span>
                </div>
                <div className="flex min-w-0 flex-col items-center justify-center px-1 py-px">
                  <span
                    className="inline-flex max-w-full min-w-0 items-center gap-1 tabular-nums font-semibold text-rose-400"
                    title={`Sold — ${formatTerminalNativeString(tradeDeskStats.sellTon)}`}
                  >
                    <span className="sr-only">Sold </span>
                    <img
                      src={CHAIN_ICON_PNG[activeChain]}
                      alt=""
                      width={12}
                      height={12}
                      className="h-3 w-3 shrink-0 object-contain opacity-95"
                      draggable={false}
                    />
                    <span className="min-w-0 truncate">
                      <TerminalNativeBalance amount={tradeDeskStats.sellTon} />
                    </span>
                  </span>
                </div>
                <div className="flex min-w-0 flex-col items-center justify-center px-1 py-px">
                  <span
                    className="inline-flex max-w-full min-w-0 items-center gap-1 tabular-nums font-semibold text-amber-400"
                    title={`Remaining — ${formatTerminalNativeString(remainingTon)}`}
                  >
                    <span className="sr-only">Remaining </span>
                    <img
                      src={CHAIN_ICON_PNG[activeChain]}
                      alt=""
                      width={12}
                      height={12}
                      className="h-3 w-3 shrink-0 object-contain opacity-95"
                      draggable={false}
                    />
                    <span className="min-w-0 truncate">
                      <TerminalNativeBalance amount={remainingTon} />
                    </span>
                  </span>
                </div>
                <div className="flex min-w-0 flex-col items-center justify-center px-1 py-px">
                  <span
                    className={cn(
                      'inline-flex min-w-0 max-w-full items-center justify-center gap-1 truncate tabular-nums font-semibold',
                      netSessionPnl >= 0 ? 'text-emerald-400' : 'text-rose-400',
                    )}
                    title={`PnL — ${fmtInstantPnlTitle(netSessionPnl, netPctForTitle)}`}
                  >
                    <span className="sr-only">PnL </span>
                    <img
                      src={CHAIN_ICON_PNG[activeChain]}
                      alt=""
                      width={12}
                      height={12}
                      className="h-3 w-3 shrink-0 object-contain opacity-95"
                      draggable={false}
                    />
                    <span className="min-w-0 truncate tracking-tight">
                      <TerminalNativeTradePnl pnl={netSessionPnl} pct={netPctForTitle} />
                    </span>
                  </span>
                </div>
              </div>
                <div
                  onPointerDown={onMoveDown}
                  className={cn(panelDragSurfaceClass, 'h-2 w-full')}
                  aria-label="Drag instant trade panel"
                  title="Drag"
                />
              </div>
            ) : (
              <div
                onPointerDown={onMoveDown}
                className={cn(
                  panelDragSurfaceClass,
                  'h-3 shrink-0 border-t border-border-subtle',
                )}
                aria-label="Drag instant trade panel"
                title="Drag"
              />
            )}
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
                const tokenRaw = walletTokenBalanceByAddress.get(w.wallet_address) ?? '0';
                const tokenUi =
                  tokenRaw && tokenRaw !== '0'
                    ? rawToUi(tokenRaw, decimals)
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
                      setActiveWalletAddress(w.wallet_address, true);
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
                      <div className="flex items-center gap-1 truncate text-[10px] text-fg-muted">
                        <BlitzWalletChip
                          walletAddress={w.wallet_address}
                          walletLabel={label || shortenAddress(w.wallet_address, 4)}
                          activeChain={activeChain}
                        />
                        <span aria-hidden>·</span>
                        <span className="truncate font-mono">{shortenAddress(w.wallet_address, 4)}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <WalletMenuNativeBalance
                        amount={solUi}
                        activeChain={activeChain}
                        amountClassName="text-[11px] text-fg-primary"
                        className="rounded-md border border-border-subtle bg-bg-sunken px-2 py-1"
                      />
                      <WalletMenuTokenBalance
                        amount={tokenUi ?? 0}
                        symbol={symbol}
                        amountClassName="text-[11px] text-fg-primary"
                        className={cn(
                          'rounded-md border border-border-subtle bg-bg-sunken px-2 py-1',
                          (tokenUi == null || tokenUi <= 0) && 'opacity-40',
                        )}
                      />
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
                  href="/portfolio?tab=wallets"
                  className="text-accent-primary hover:underline"
                  onClick={() => setWalletMenuOpen(false)}
                >
                  Manage groups
                </Link>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  const walletGroupMenuDrop =
    walletGroupMenuOpen && overflowWalletGroups.length > 0 && walletGroupMenuPos
      ? createPortal(
          <div
            ref={walletGroupMenuPopoverRef}
            role="listbox"
            aria-label="More wallet groups"
            style={{
              position: 'fixed',
              top: walletGroupMenuPos.top,
              left: walletGroupMenuPos.left,
              width: '10rem',
              zIndex: 520,
            }}
            className="overflow-hidden rounded-md border border-border-subtle bg-bg-raised p-1 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
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
                    selectWalletGroup(g.id);
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
                    {g.walletCount}
                  </span>
                </button>
              );
            })}
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
      {walletGroupMenuDrop}
      {walletMenuDrop}
    </>
  );
}
