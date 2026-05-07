'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeftRight,
  ExternalLink,
  GripVertical,
  Keyboard,
  Pencil,
  Settings2,
  Shield,
  Wallet,
  X,
} from 'lucide-react';
import { BUY_PRESETS_SOL, DEFAULT_SLIPPAGE_BPS } from '@/lib/utils/constants';
import type { MevMode } from '@/lib/trading/mevMode';
import { explorerAddressUrl, shortenAddress } from '@/lib/utils/addresses';
import { cn } from '@/lib/utils/cn';
import { useSpotTradeExecution } from '@/lib/hooks/useSpotTradeExecution';
import { useTradingStore, type PresetSlot, INSTANT_TRADE_WALLET_CAP } from '@/store/trading';
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

const BOUNDS_KEY = 'pointer-instant-compact-trade-bounds-v1';
const LEGACY_POS_KEY = 'pointer-instant-trade-pos-v1';
const SLOT_OVERRIDES_KEY = 'pointer-instant-trade-slot-overrides-v1';

const MIN_W = 248;
const MIN_H = 320;
/** Axiom-style bright blue “editing preset values” treatment. */
const EDIT_PRESET_CLASS =
  'rounded-full border-2 border-sky-400 bg-sky-500/25 py-1.5 text-center font-sans text-[10px] font-semibold tabular-nums text-sky-50 shadow-[0_0_18px_rgba(56,189,248,0.45)] ring-2 ring-sky-400/45 outline-none focus:border-sky-300 focus:ring-sky-400/70';
const DEFAULT_SELL_PCT = [0.5, 1, 2, 3, 5, 10, 25, 100] as const;
const DEFAULT_SELL_SOL = [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5] as const;
const INSTANT_FILL = [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5] as const;

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
    const sellMode: SellMode = j.sellMode === 'sol' ? 'sol' : 'pct';
    if (buy.length !== 8) return null;
    const pct = sellPct.length === 8 ? sellPct : [...DEFAULT_SELL_PCT];
    const sol = sellSol.length === 8 ? sellSol : [...DEFAULT_SELL_SOL];
    if (sellPct.length !== 8 && sellLegacy.length !== 8) return null;
    return { buy, sellPct: pct, sellSol: sol, sellMode };
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

function readBounds(): { x: number; y: number; w: number; h: number } {
  const def = { x: 56, y: 72, w: 292, h: 448 };
  if (typeof window === 'undefined') return def;
  try {
    const raw = localStorage.getItem(BOUNDS_KEY);
    if (raw) {
      const j = JSON.parse(raw) as Record<string, unknown>;
      if (
        typeof j.x === 'number' &&
        typeof j.y === 'number' &&
        typeof j.w === 'number' &&
        typeof j.h === 'number'
      ) {
        return { x: j.x, y: j.y, w: j.w, h: j.h };
      }
    }
    const leg = localStorage.getItem(LEGACY_POS_KEY);
    if (leg) {
      const o = JSON.parse(leg) as Record<string, unknown>;
      if (typeof o.x === 'number' && typeof o.y === 'number') {
        return { ...def, x: o.x, y: o.y };
      }
    }
  } catch {
    /* ignore */
  }
  return def;
}

function persistBounds(b: { x: number; y: number; w: number; h: number }) {
  try {
    localStorage.setItem(BOUNDS_KEY, JSON.stringify(b));
  } catch {
    /* ignore */
  }
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

  const maxR = window.innerWidth - 8;
  const maxB = window.innerHeight - 8;
  x = clamp(x, 8, maxR - MIN_W);
  y = clamp(y, 8, maxB - MIN_H);
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
  const [bounds, setBounds] = useState(readBounds);
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
  const [buySpendAsset, setBuySpendAsset] = useState<'sol' | 'usdc' | 'usol'>('sol');
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
    walletRows,
    activeWalletAddress,
    setActiveWalletAddress,
    signingWalletAddresses,
  } = useSpotTradeExecution(mint);

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
      setBounds(readBounds());
      setSlotBundle(readSlotOverrides() ?? migrateLegacySlots());
      setInstantUi(readInstantTradeUiSettings());
    });
    return () => cancelAnimationFrame(raf);
  }, [open]);

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

  const buyValues =
    slotBundle?.buy && slotBundle.buy.length === 8 ? slotBundle.buy : buyFromPreset;

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
          buy: buy8,
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
    setDraftBuy(buyValues.map((n) => fmtSolChip(n)));
    setDraftSell(
      sellValues.map((n) => (sellMode === 'pct' ? fmtPctChip(n) : fmtSolChip(n))),
    );
    setEditSlots(true);
  }, [
    editSlots,
    draftBuy,
    draftSell,
    buyValues,
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

  const tick = (symbol ?? 'TOKEN').replace(/^\$+/, '').slice(0, 8) || 'TOKEN';
  const uiBal = formatNumber(rawToUi(balanceRaw, decimals), { decimals: 4 });

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
    const maxW = window.innerWidth - 8;
    const maxH = window.innerHeight - 8;
    setBounds((prev) => {
      let next = prev;
      if (d.kind === 'move') {
        const nx = clamp(d.rx + dx, 8, maxW - d.rw);
        const ny = clamp(d.ry + dy, 8, maxH - d.rh);
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
    persistBounds(boundsRef.current);
  }, []);

  if (!mounted || !open) return null;

  const feeHint = activePreset
    ? `${lamportsToSol(BigInt(activePreset.priority_fee_lamports)).toFixed(3)} / ${lamportsToSol(BigInt(activePreset.jito_tip_lamports)).toFixed(3)}`
    : '-';

  const EDGE_HIT = 6;
  const CORNER = 10;

  const panel = (
    <div
      className={cn(
        'fixed z-[240] flex flex-col overflow-hidden rounded-xl border border-border-subtle bg-bg-base/95 font-sans shadow-2xl backdrop-blur-sm transition-[opacity,transform,box-shadow] duration-150 ease-out',
        grabbed && 'scale-[1.015] opacity-[0.88] shadow-[0_28px_64px_-12px_rgba(0,0,0,0.75)] ring-1 ring-white/10',
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

      <div className="relative z-10 flex shrink-0 items-center gap-0.5 border-b border-border-subtle bg-bg-hover/30 px-1.5 py-1 pl-2">
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
          <GripVertical className="h-3.5 w-3.5 text-fg-muted" />
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
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 pb-2 pt-1.5 text-[10px]">
          <div
            className={cn(
              'flex min-h-full flex-col',
              walletsReady && authenticated && wallet ? 'min-h-[min(100%,18rem)]' : '',
            )}
          >
        {!walletsReady ? (
          <p className="text-fg-muted">Loading...</p>
        ) : !authenticated || !wallet ? (
          <p className="text-signal-warn">Sign in with an embedded wallet to trade.</p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold uppercase tracking-wide text-fg-muted">Buy</span>
              <div className="flex items-center gap-0.5 rounded-md border border-border-subtle p-0.5">
                {(
                  [
                    { k: 'sol' as const, label: 'SOL', disabled: false },
                    { k: 'usdc' as const, label: 'USDC', disabled: true },
                    { k: 'usol' as const, label: 'uSOL', disabled: true },
                  ] as const
                ).map(({ k, label, disabled }) => (
                  <button
                    key={k}
                    type="button"
                    disabled={disabled}
                    title={disabled ? 'Coming soon' : undefined}
                    onClick={() => !disabled && setBuySpendAsset(k)}
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
            <div className="mt-1 grid grid-cols-4 gap-1">
              {buyValues.map((sol, i) =>
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
                    className={cn('w-full min-w-0', EDIT_PRESET_CLASS)}
                  />
                ) : (
                  <button
                    key={`b-${i}-${sol}`}
                    type="button"
                    onClick={() => void runBuy(sol)}
                    className="btn-press rounded-full border border-emerald-400/55 bg-emerald-500/10 py-1.5 text-center font-sans text-[10px] font-semibold tabular-nums text-emerald-300 transition hover:bg-emerald-500/20"
                  >
                    {fmtSolChip(sol)}
                  </button>
                ),
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[8px] text-fg-muted">
              <span>{(effectiveSlippageBps / 100).toFixed(2)}% slip</span>
              <span>{feeHint}</span>
              <span className="inline-flex items-center gap-0.5">
                <Shield className="h-2.5 w-2.5" /> On
              </span>
              <label className="ml-auto inline-flex cursor-pointer items-center gap-1 text-[8px] text-fg-secondary">
                <input
                  type="checkbox"
                  checked={advChecked}
                  onChange={(e) => setAdvChecked(e.target.checked)}
                  className="h-2.5 w-2.5 rounded border-border-subtle"
                />
                Adv.
              </label>
            </div>

            <div className="mt-2 flex items-center justify-between gap-2 border-t border-border-subtle pt-2">
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
                  title="Switch: % of balance vs fixed SOL received"
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
                  SOL
                </span>
              </span>
              <span className="truncate tabular-nums text-[9px] text-fg-secondary">
                {uiBal} {tick}
              </span>
            </div>
            <div className="mt-1 grid grid-cols-4 gap-1">
              {sellValues.map((pct, i) =>
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
                    className={cn('w-full min-w-0', EDIT_PRESET_CLASS)}
                    placeholder={sellMode === 'pct' ? '0–100' : 'SOL'}
                    aria-label={sellMode === 'pct' ? 'Sell percent' : 'SOL out'}
                  />
                ) : (
                  <button
                    key={`s-${i}-${pct}`}
                    type="button"
                    onClick={() =>
                      void (sellMode === 'pct' ? runSell(pct) : runSellSolOut(pct))
                    }
                    className="btn-press rounded-full border border-rose-400/45 bg-rose-500/10 py-1.5 text-center font-sans text-[10px] font-semibold tabular-nums text-rose-300 transition hover:bg-rose-500/18"
                  >
                    {sellMode === 'pct' ? `${fmtPctChip(pct)}%` : fmtSolChip(pct)}
                  </button>
                ),
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[8px] text-fg-muted">
              <span>{(effectiveSlippageBps / 100).toFixed(2)}% slip</span>
              <span>{feeHint}</span>
              <span className="inline-flex items-center gap-0.5">
                <Shield className="h-2.5 w-2.5" /> On
              </span>
              <span className="ml-auto text-[8px] font-semibold text-rose-400/90">Sell Init.</span>
            </div>

            {instantUi.showPnlRow ? (
            <div className="mt-2 grid grid-cols-4 gap-0.5 border-t border-border-subtle pt-2 tabular-nums text-[8px] tabular-nums">
              <span className="text-emerald-400">-</span>
              <span className="text-rose-400">-</span>
              <span className="text-violet-300">-</span>
              <span className="text-emerald-400">+0</span>
            </div>
            ) : null}
            {walletsReady && authenticated && wallet ? (
              <div className="min-h-0 flex-1 bg-transparent" aria-hidden />
            ) : null}
          </>
        )}
          </div>
        </div>
      </div>
    </div>
  );

  const walletMenuDrop =
    walletMenuOpen && (walletRows?.length ?? 0) > 0 && walletPopoverPos
      ? createPortal(
          <div
            ref={walletPopoverRef}
            role="listbox"
            style={{
              position: 'fixed',
              top: walletPopoverPos.top,
              right: walletPopoverPos.right,
              width: 'min(18rem, calc(100vw - 16px))',
              zIndex: 520,
            }}
            className="overflow-hidden rounded-lg border border-border-subtle bg-bg-base/98 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between gap-2 border-b border-border-subtle px-2 py-1">
              <span className="text-[9px] font-semibold uppercase tracking-wide text-fg-muted">
                Trading wallet
              </span>
              {instantTradeWalletShortlist.length > 0 ? (
                <button
                  type="button"
                  className="text-[9px] font-medium text-accent-primary hover:underline"
                  onClick={() => clearInstantTradeWalletShortlist()}
                >
                  Clear multi
                </button>
              ) : null}
            </div>
            <p className="border-b border-border-subtle px-2 py-1 text-[8px] leading-snug text-fg-muted">
              Row = signer · check up to {INSTANT_TRADE_WALLET_CAP} for shortlist
            </p>
            <div className="max-h-[min(42vh,280px)] overflow-y-auto overscroll-contain">
              {walletRows!.map((w) => {
                const canSign = signingWalletAddresses.has(w.wallet_address);
                const unusable = w.is_archived || !w.is_active || !canSign;
                const isSel = w.wallet_address === (activeWalletAddress ?? wallet?.address);
                const inShort = instantTradeWalletShortlist.includes(w.wallet_address);
                const shortlistFull = instantTradeWalletShortlist.length >= INSTANT_TRADE_WALLET_CAP;
                const solUi =
                  w.balance_lamports != null && w.balance_lamports !== ''
                    ? lamportsToSol(BigInt(w.balance_lamports))
                    : null;
                return (
                  <div
                    key={w.id}
                    className={cn(
                      'flex items-stretch gap-0.5 border-b border-border-subtle/60 px-1 last:border-b-0',
                      isSel ? 'bg-bg-hover/70' : '',
                    )}
                  >
                    <label className="flex shrink-0 cursor-pointer items-center px-0.5">
                      <input
                        type="checkbox"
                        checked={inShort}
                        disabled={!inShort && (unusable || shortlistFull)}
                        onChange={() => toggleInstantTradeWallet(w.wallet_address)}
                        onClick={(e) => e.stopPropagation()}
                        title={
                          shortlistFull && !inShort
                            ? `Max ${INSTANT_TRADE_WALLET_CAP} wallets`
                            : 'Shortlist for multi-wallet'
                        }
                        className="h-3 w-3 rounded border-border-subtle"
                        aria-label="Shortlist wallet for multi-select"
                      />
                    </label>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSel}
                      disabled={unusable && !isSel}
                      onClick={() => {
                        if (unusable && !isSel) return;
                        setActiveWalletAddress(w.wallet_address);
                        setWalletMenuOpen(false);
                      }}
                      className={cn(
                        'min-w-0 flex-1 px-1.5 py-1.5 text-left text-[10px] transition-colors',
                        unusable && !isSel
                          ? 'cursor-not-allowed text-fg-muted opacity-50'
                          : 'text-fg-secondary hover:bg-bg-hover hover:text-fg-primary',
                        isSel && 'text-fg-primary',
                      )}
                    >
                      <span className="block truncate font-medium">
                        {w.label?.trim() || shortenAddress(w.wallet_address, 4)}
                        {w.is_primary ? (
                          <span className="font-normal text-fg-muted"> · primary</span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 flex items-center justify-between gap-2 tabular-nums text-[9px] text-fg-muted">
                        <span>{shortenAddress(w.wallet_address, 4)}</span>
                        <span className="shrink-0 tabular-nums">
                          {solUi != null ? `${formatNumber(solUi, { decimals: 3 })} SOL` : '—'}
                        </span>
                      </span>
                      {(w.is_archived || !w.is_active || !canSign) && (
                        <span className="mt-0.5 block text-[8px] text-signal-warn">
                          {!canSign
                            ? 'Not linked to app wallet'
                            : w.is_archived
                              ? 'Archived'
                              : 'Inactive'}
                        </span>
                      )}
                    </button>
                    <a
                      href={explorerAddressUrl(w.wallet_address)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex shrink-0 items-center px-1 text-fg-muted hover:text-fg-secondary"
                      title="Explorer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="h-3 w-3" strokeWidth={2} />
                    </a>
                  </div>
                );
              })}
            </div>
            <Link
              href="/wallets"
              className="block border-t border-border-subtle px-2 py-1.5 text-[10px] text-accent-primary hover:bg-bg-hover"
              onClick={() => setWalletMenuOpen(false)}
            >
              Manage wallets
            </Link>
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
