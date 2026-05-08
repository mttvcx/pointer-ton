'use client';

/* Trading panel syncs local controls from async preset fetch and limit-alert deep links. */
/* eslint-disable react-hooks/set-state-in-effect -- intentional hydration from server / URL */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MyWalletRow } from '@/lib/hooks/useActiveSolanaWallet';
import { useActiveSolanaWallet } from '@/lib/hooks/useActiveSolanaWallet';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePointerTradeSubmit } from '@/lib/hooks/usePointerTradeSubmit';
import type { TradeQuoteApiOk } from '@/lib/trading/quoteTypes';
import {
  ArrowBigUp,
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  ChevronsRight,
  CircleDollarSign,
  Clock,
  Coins,
  Loader2,
  Settings,
  Shield,
  TrendingDown,
  Wallet,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { BUY_PRESETS_SOL, DEFAULT_SLIPPAGE_BPS } from '@/lib/utils/constants';
import {
  formatCompactUsd,
  formatNumber,
  lamportsToSol,
  rawToUi,
  uiToRaw,
} from '@/lib/utils/formatters';
import type { TokenMarketSnapshotRow } from '@/lib/db/tokens';
import type { TokenExtendedMetrics } from '@/lib/types/tokenExtendedMetrics';
import { cn } from '@/lib/utils/cn';
import type { Tables } from '@/lib/supabase/types';
import { mevModeToLanding, type MevMode } from '@/lib/trading/mevMode';
import { PresetSelector } from '@/components/trading/PresetSelector';
import { PresetEditorModal } from '@/components/trading/PresetEditorModal';
import { AdvancedTradingSettingsModal } from '@/components/trading/AdvancedTradingSettingsModal';
import { useTradingStore, type PresetSlot } from '@/store/trading';

type LimitOrderRow = Tables<'limit_orders'>;

type TradePanelMode = 'market' | 'limit_mcap' | 'advanced' | 'limit_alerts';

type AdvStrategyId = 'migration' | 'dev_sell' | 'trail_sl' | 'dca';

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

type TradeSide = 'buy' | 'sell';
type LandingMode = 'jito' | 'rpc';

const SLIPPAGE_PRESETS_BPS = [50, 100, 500, 1_000] as const;
const SELL_PCTS = [25, 50, 75, 100] as const;

function TradeAmountInput({
  value,
  onChange,
  placeholder,
  suffix,
  icon,
  'aria-label': ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  suffix: string;
  icon: 'sol' | 'token';
  'aria-label'?: string;
}) {
  const Icon = icon === 'sol' ? Coins : Wallet;
  return (
    <div className="relative flex min-h-[2.35rem] items-center gap-2 rounded-md border border-border-subtle bg-bg-base px-2.5 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ring-1 ring-white/[0.06] transition-colors focus-within:border-accent-primary/55 focus-within:ring-accent-primary/20">
      <Icon className="h-3.5 w-3.5 shrink-0 text-fg-muted" aria-hidden />
      <input
        type="text"
        inputMode="decimal"
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.value)}
        className="focus-ring min-w-0 flex-1 border-0 bg-transparent py-0.5 text-right font-sans text-sm font-medium tabular-nums text-fg-primary outline-none placeholder:text-fg-muted/80 placeholder:italic"
      />
      <span className="pointer-events-none shrink-0 text-[10px] font-semibold uppercase tracking-wide text-fg-muted">
        {suffix}
      </span>
    </div>
  );
}

function TradeTapeStrip({ m }: { m: TokenExtendedMetrics }) {
  const buys = m.buys6h ?? 0;
  const sells = m.sells6h ?? 0;
  const total = buys + sells;
  const buyRatio = total > 0 ? buys / total : 0.5;

  return (
    <div className="space-y-1 rounded-lg border border-border-subtle/80 bg-bg-hover/12 px-2 py-1.5">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5 text-[9px] tabular-nums leading-tight">
        <span className="shrink-0 text-fg-muted">
          6h Vol{' '}
          <span className="font-semibold text-fg-primary">
            {m.vol6hUsd != null ? formatCompactUsd(m.vol6hUsd) : '—'}
          </span>
        </span>
        <span className="shrink-0">
          <span className="text-fg-muted">Buys </span>
          <span className="font-semibold text-signal-bull">
            {m.buys6h ?? '—'} / {m.buyVol6hUsd != null ? formatCompactUsd(m.buyVol6hUsd) : '—'}
          </span>
        </span>
        <span className="shrink-0">
          <span className="text-fg-muted">Sells </span>
          <span className="font-semibold text-signal-bear">
            {m.sells6h ?? '—'} / {m.sellVol6hUsd != null ? formatCompactUsd(m.sellVol6hUsd) : '—'}
          </span>
        </span>
        <span className="shrink-0 text-fg-muted">
          Net{' '}
          <span
            className={cn(
              'font-semibold',
              m.netVol6hUsd != null && m.netVol6hUsd < 0 ? 'text-signal-bear' : 'text-signal-bull',
            )}
          >
            {m.netVol6hUsd != null ? `${m.netVol6hUsd >= 0 ? '+' : ''}${formatCompactUsd(m.netVol6hUsd)}` : '—'}
          </span>
        </span>
      </div>
      <div className="flex h-1 w-full overflow-hidden rounded-full bg-bg-sunken">
        <div
          className="h-full bg-signal-bull transition-[width]"
          style={{ width: `${buyRatio * 100}%` }}
        />
        <div className="h-full flex-1 bg-signal-bear/85" />
      </div>
    </div>
  );
}

function CompactFeeStrip({
  slippageBps,
  priorityLamports,
  jitoLamports,
}: {
  slippageBps: number;
  priorityLamports: number;
  jitoLamports: number;
}) {
  const gas = formatNumber(lamportsToSol(BigInt(Math.max(0, priorityLamports))), {
    decimals: 3,
  });
  const tip = formatNumber(lamportsToSol(BigInt(Math.max(0, jitoLamports))), { decimals: 3 });
  const slipPct = slippageBps / 100;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-md border border-border-subtle/60 bg-bg-base/80 px-2 py-1 font-sans text-[8px] text-fg-muted">
      <span className="tabular-nums">
        Slip {(slipPct < 1 ? slipPct.toFixed(2) : slipPct.toFixed(1))}%
      </span>
      <span className="opacity-40">·</span>
      <span className="tabular-nums">Gas {gas}</span>
      <span className="opacity-40">·</span>
      <span className="tabular-nums text-signal-warn">
        Tip {tip}
        <span className="ml-0.5" aria-hidden>
          ⚠
        </span>
      </span>
      <span className="opacity-40">·</span>
      <span className="inline-flex items-center gap-0.5 tabular-nums">
        <Shield className="h-2.5 w-2.5 opacity-80" strokeWidth={2} aria-hidden />
        On
      </span>
    </div>
  );
}

function TokenInfoGrid({ m }: { m: TokenExtendedMetrics | null | undefined }) {
  const pct = (n: number | null | undefined) => (n != null ? `${formatNumber(n, { decimals: 2 })}%` : '—');
  const tone = (n: number | null | undefined, warn = 25) =>
    n == null ? 'text-[#9ca3af]' : n > warn ? 'text-[#fb7185]' : 'text-[#34d399]';
  const items = [
    { label: 'Top 10 H.', value: pct(m?.top10HolderPct), cls: tone(m?.top10HolderPct, 20) },
    { label: 'Dev H.', value: pct(m?.devHoldingPct), cls: tone(m?.devHoldingPct, 5) },
    { label: 'Snipers H.', value: pct(m?.sniperHolderPct), cls: 'text-[#34d399]' },
    { label: 'Insiders', value: pct(m?.insidersPct), cls: tone(m?.insidersPct, 12) },
    { label: 'Bundlers', value: pct(m?.bundlersPct), cls: tone(m?.bundlersPct, 20) },
    { label: 'LP Burned', value: pct(m?.lpBurnedPct), cls: m?.lpBurnedPct != null && m.lpBurnedPct >= 99 ? 'text-[#34d399]' : 'text-[#e5e7eb]' },
    { label: 'Holders', value: m?.holders != null ? formatNumber(m.holders, { decimals: 0 }) : '—', cls: 'text-[#e5e7eb]' },
    { label: 'Pro Traders', value: m?.proTraders != null ? formatNumber(m.proTraders, { decimals: 0 }) : '—', cls: 'text-[#e5e7eb]' },
    { label: 'Dex Paid', value: m?.dexPaid == null ? '—' : m.dexPaid ? 'Paid' : 'Unpaid', cls: m?.dexPaid ? 'text-[#34d399]' : 'text-[#fb7185]' },
  ];

  return (
    <section className="rounded-md border border-[#1b1f2a] bg-[#0b0d12] p-2">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[12px] font-semibold text-white">Token Info</span>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {items.map((item) => (
          <div key={item.label} className="min-h-[54px] rounded border border-[#1b1f2a] bg-[#11141b] px-2 py-1.5 text-center">
            <div className={cn('truncate text-[12px] font-semibold tabular-nums', item.cls)}>{item.value}</div>
            <div className="mt-1 truncate text-[10px] text-[#8b93a3]">{item.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Label for Buy/Sell CTA when on-chain symbol is generic (e.g. DEX pool "LP"). */
function tradeCtaLabel(symbol: string | null, tokenName: string | null | undefined): string {
  const sym = (symbol ?? '').trim();
  const generic = !sym || /^lp$/i.test(sym) || /^lq$/i.test(sym) || /^pool$/i.test(sym);
  if (!generic) {
    return sym.length > 16 ? `${sym.slice(0, 14)}…` : sym;
  }
  let raw = (tokenName ?? '').trim();
  if (!raw) return sym || 'token';
  raw = raw.replace(/^(lp\s+)?(dedust|ston\.?fi|megaton)[^.]*:\s*/i, '').trim();
  raw = raw.replace(/^lp\s+/i, '').trim();
  const left = raw.split('/')[0]?.trim() || raw;
  const out = left.length > 22 ? `${left.slice(0, 20)}…` : left;
  return out || sym || 'token';
}

export function BuySellPanel({
  mint,
  symbol,
  tokenName,
  decimals,
  limitAlertOrder,
  initialBuySol,
  initialTradeSide = 'buy',
  onRequestInstantTrade,
  marketSnapshot,
}: {
  mint: string;
  symbol: string | null;
  /** Human-readable name when `symbol` is a pool placeholder (e.g. LP). */
  tokenName?: string | null;
  decimals: number;
  limitAlertOrder?: LimitOrderRow | null;
  /** Deep link from Pulse quick-buy (`?buySol=`). Applied once chips load. */
  initialBuySol?: number | null;
  /** Deep link from quick trade (`?tradeTab=sell`). */
  initialTradeSide?: TradeSide;
  /** Opens compact instant-trade overlay (dock stays visible). */
  onRequestInstantTrade?: () => void;
  marketSnapshot?: TokenMarketSnapshotRow | null;
}) {
  const { getAccessToken, authenticated } = usePointerAuth();
  const qc = useQueryClient();
  const myWalletsQ = useQuery({
    queryKey: ['wallets-my'],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const res = await fetch('/api/wallets/my', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('wallets');
      return res.json() as Promise<{ wallets: MyWalletRow[] }>;
    },
    enabled: authenticated,
    staleTime: 30_000,
  });

  const { wallet, ready: walletsReady, setActiveWalletAddress } = useActiveSolanaWallet(
    myWalletsQ.data?.wallets,
  );

  const activeWalletRow = useMemo(
    () => myWalletsQ.data?.wallets.find((w) => w.wallet_address === wallet?.address),
    [myWalletsQ.data?.wallets, wallet?.address],
  );
  const activeWalletCount = useMemo(
    () => (myWalletsQ.data?.wallets ?? []).filter((w) => !w.is_archived).length,
    [myWalletsQ.data?.wallets],
  );
  const solBalPreview = useMemo(() => {
    const lam = activeWalletRow?.balance_lamports;
    if (lam == null || lam === '') return null;
    try {
      return formatNumber(lamportsToSol(BigInt(lam)), { decimals: 4 });
    } catch {
      return null;
    }
  }, [activeWalletRow?.balance_lamports]);
  const tradingBlockedImported = activeWalletRow?.is_imported === true;
  const { submitFromQuote } = usePointerTradeSubmit();
  const { activePresetSlot } = useTradingStore();

  const limitToastRef = useRef<string | null>(null);
  const initialBuySolAppliedRef = useRef(false);

  const [tradePanelMode, setTradePanelMode] = useState<TradePanelMode>('market');
  const [presetEditorOpen, setPresetEditorOpen] = useState(false);
  const [advancedSettingsOpen, setAdvancedSettingsOpen] = useState(false);
  const [limitTriggerUsd, setLimitTriggerUsd] = useState('');
  const [limitExpiry, setLimitExpiry] = useState<'1h' | '4h' | '24h' | 'never'>('24h');

  const [limitMcSliderPct, setLimitMcSliderPct] = useState(0);
  const [advStrategy, setAdvStrategy] = useState<AdvStrategyId>('migration');
  const [devSellMinPct, setDevSellMinPct] = useState('');
  const [trailDropPct, setTrailDropPct] = useState('30');
  const [dcaSlices, setDcaSlices] = useState('5');
  const [dcaIntervalSec, setDcaIntervalSec] = useState('60');
  const [dcaMinMc, setDcaMinMc] = useState('');
  const [dcaMaxMc, setDcaMaxMc] = useState('');

  const [tab, setTab] = useState<TradeSide>(initialTradeSide);
  const [activePresetSol, setActivePresetSol] = useState<number | null>(BUY_PRESETS_SOL[0] ?? 0.1);
  const [buyCustomSol, setBuyCustomSol] = useState('');
  const [sellPct, setSellPct] = useState<(typeof SELL_PCTS)[number]>(100);
  const [sellCustomUi, setSellCustomUi] = useState('');
  const [sellUseCustom, setSellUseCustom] = useState(false);

  const [slippageBps, setSlippageBps] = useState(DEFAULT_SLIPPAGE_BPS);
  const [slippageCustom, setSlippageCustom] = useState('');
  const [useCustomSlippage, setUseCustomSlippage] = useState(false);
  const [dynamicSlippage, setDynamicSlippage] = useState(true);
  const [landing, setLanding] = useState<LandingMode>('jito');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);
  const [selectedWalletAddresses, setSelectedWalletAddresses] = useState<string[]>([]);

  useEffect(() => {
    setTab(initialTradeSide);
  }, [initialTradeSide, mint]);

  useEffect(() => {
    if (tradePanelMode === 'limit_mcap') setTab('buy');
  }, [tradePanelMode]);

  useEffect(() => {
    if (!wallet?.address) return;
    setSelectedWalletAddresses((current) =>
      current.includes(wallet.address) ? current : [wallet.address],
    );
  }, [wallet?.address]);

  const [quote, setQuote] = useState<TradeQuoteApiOk | null>(null);
  const [quoteForKey, setQuoteForKey] = useState<string | null>(null);
  const [quoteWallet, setQuoteWallet] = useState<string | null>(null);

  const effectiveSlippageBps = useMemo(() => {
    if (!useCustomSlippage) return slippageBps;
    const n = Number(slippageCustom);
    if (!Number.isFinite(n)) return DEFAULT_SLIPPAGE_BPS;
    return Math.min(5000, Math.max(1, Math.round(n)));
  }, [slippageBps, slippageCustom, useCustomSlippage]);

  const { data: extendedTape } = useQuery({
    queryKey: ['trade-extended-tape', mint],
    queryFn: async (): Promise<TokenExtendedMetrics | null> => {
      const res = await fetch(`/api/tokens/${encodeURIComponent(mint)}/extended-metrics`);
      const json: unknown = await res.json();
      if (!res.ok) return null;
      if (typeof json === 'object' && json && 'metrics' in json) {
        return (json as { metrics: TokenExtendedMetrics }).metrics;
      }
      return null;
    },
    staleTime: 45_000,
  });

  const baseMcUsd = marketSnapshot?.market_cap_usd;
  const targetMcUsd = useMemo(() => {
    if (baseMcUsd == null || !Number.isFinite(baseMcUsd) || baseMcUsd <= 0) return null;
    return baseMcUsd * (1 + limitMcSliderPct / 100);
  }, [baseMcUsd, limitMcSliderPct]);

  const buyAmountSol = useMemo(() => {
    if (activePresetSol != null) return activePresetSol;
    const n = parseFloat(buyCustomSol);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [activePresetSol, buyCustomSol]);

  const { data: balanceData, refetch: refetchBalance } = useQuery({
    queryKey: ['trade-balance', mint, wallet?.address],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const res = await fetch(
        `/api/trade/balance?mint=${encodeURIComponent(mint)}&wallet=${encodeURIComponent(wallet!.address)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const json: unknown = await res.json();
      if (!res.ok) {
        const msg =
          typeof json === 'object' && json && 'message' in json
            ? String((json as { message: unknown }).message)
            : res.statusText;
        throw new Error(msg);
      }
      return json as { rawAmount: string };
    },
    enabled: Boolean(walletsReady && wallet?.address && mint),
    staleTime: 10_000,
  });

  const balanceRaw = balanceData?.rawAmount ?? '0';

  const ctaSym = useMemo(() => tradeCtaLabel(symbol, tokenName), [symbol, tokenName]);

  const sellAmountTokenRaw = useMemo(() => {
    const bal = BigInt(balanceRaw === '' ? '0' : balanceRaw);
    if (bal <= 0n) return null;
    if (sellUseCustom) {
      const ui = parseFloat(sellCustomUi);
      if (!Number.isFinite(ui) || ui <= 0) return null;
      const raw = uiToRaw(ui, decimals);
      if (raw <= 0n) return null;
      if (raw > bal) return String(bal);
      return String(raw);
    }
    const portion = (bal * BigInt(sellPct)) / 100n;
    return portion > 0n ? String(portion) : null;
  }, [balanceRaw, decimals, sellCustomUi, sellPct, sellUseCustom]);

  const paramsKey = useMemo(() => {
    if (tab === 'buy') {
      return `${mint}|buy|${buyAmountSol ?? ''}|${effectiveSlippageBps}|${dynamicSlippage}|${landing}`;
    }
    return `${mint}|sell|${sellAmountTokenRaw ?? ''}|${effectiveSlippageBps}|${dynamicSlippage}|${landing}`;
  }, [
    mint,
    tab,
    buyAmountSol,
    sellAmountTokenRaw,
    effectiveSlippageBps,
    dynamicSlippage,
    landing,
  ]);

  const quoteStale = Boolean(
    quote &&
      (quoteForKey !== paramsKey ||
        quote.mint !== mint ||
        !wallet ||
        !quoteWallet ||
        quoteWallet !== wallet.address),
  );

  const { data: presetsPayload } = useQuery({
    queryKey: ['trading-presets'],
    queryFn: async (): Promise<{ presets: TradingPresetApi[] } | null> => {
      const token = await getAccessToken();
      if (!token) return null;
      const res = await fetch('/api/presets', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return null;
      return res.json() as Promise<{ presets: TradingPresetApi[] }>;
    },
    enabled: authenticated,
    staleTime: 60_000,
  });

  const activePreset = useMemo(() => {
    const list = presetsPayload?.presets ?? [];
    return list.find((p) => p.slot === activePresetSlot) ?? null;
  }, [presetsPayload?.presets, activePresetSlot]);

  const buyChipAmounts = useMemo(() => {
    const fromPreset = activePreset?.buy_amounts_sol;
    if (fromPreset && fromPreset.length > 0) return fromPreset;
    return [...BUY_PRESETS_SOL];
  }, [activePreset?.buy_amounts_sol]);

  useEffect(() => {
    if (!activePreset) return;
    setSlippageBps(activePreset.slippage_bps);
    setDynamicSlippage(activePreset.dynamic_slippage);
    setLanding(mevModeToLanding(activePreset.mev_mode));
    setUseCustomSlippage(false);
  }, [activePreset]);

  useEffect(() => {
    if (!buyChipAmounts.length) return;

    if (
      !initialBuySolAppliedRef.current &&
      initialBuySol != null &&
      Number.isFinite(initialBuySol) &&
      initialBuySol > 0
    ) {
      initialBuySolAppliedRef.current = true;
      setTradePanelMode('market');
      setTab('buy');
      if (buyChipAmounts.includes(initialBuySol)) {
        setActivePresetSol(initialBuySol);
        setBuyCustomSol('');
      } else {
        setActivePresetSol(null);
        setBuyCustomSol(String(initialBuySol));
      }
      return;
    }

    setActivePresetSol((prev) => {
      if (prev != null && buyChipAmounts.includes(prev)) return prev;
      if (prev === null && buyCustomSol.trim() !== '') return null;
      return buyChipAmounts[0] ?? null;
    });
  }, [buyChipAmounts, initialBuySol, buyCustomSol]);

  const { data: limitListPayload, refetch: refetchLimitList } = useQuery({
    queryKey: ['limit-orders', mint],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) return { orders: [] as LimitOrderRow[] };
      const res = await fetch(`/api/limit-orders?mint=${encodeURIComponent(mint)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return { orders: [] as LimitOrderRow[] };
      return res.json() as Promise<{ orders: LimitOrderRow[] }>;
    },
    enabled: Boolean(authenticated && mint),
    staleTime: 15_000,
  });

  const cancelLimitMut = useMutation({
    mutationFn: async (id: string) => {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const res = await fetch(`/api/limit-orders/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('cancel_failed');
    },
    onSuccess: () => {
      void refetchLimitList();
      void qc.invalidateQueries({ queryKey: ['limit-orders'] });
      toast.success('Limit alert cancelled');
    },
    onError: () => toast.error('Could not cancel'),
  });

  const createLimitMut = useMutation({
    mutationFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const trig = Number.parseFloat(limitTriggerUsd);
      if (!Number.isFinite(trig) || trig <= 0) throw new Error('trigger');
      if (tab === 'buy' && (buyAmountSol == null || buyAmountSol <= 0)) throw new Error('amount');
      if (tab === 'sell' && sellUseCustom) throw new Error('custom_sell_pct');

      const body =
        tab === 'buy'
          ? {
              mint,
              side: 'buy' as const,
              trigger_price_usd: trig,
              amount_sol: buyAmountSol!,
              slippage_bps: effectiveSlippageBps,
              expiry: limitExpiry,
            }
          : {
              mint,
              side: 'sell' as const,
              trigger_price_usd: trig,
              amount_token_pct: sellPct,
              slippage_bps: effectiveSlippageBps,
              expiry: limitExpiry,
            };

      const res = await fetch('/api/limit-orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const json: unknown = await res.json();
      if (!res.ok) {
        const msg =
          typeof json === 'object' && json && 'message' in json
            ? String((json as { message: unknown }).message)
            : 'create_failed';
        throw new Error(msg);
      }
      return json;
    },
    onSuccess: () => {
      setLimitTriggerUsd('');
      void refetchLimitList();
      toast.success('Limit alert saved', {
        description:
          'We notify you when price hits the target. You confirm the swap in-app with Privy.',
      });
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : '';
      if (msg === 'custom_sell_pct') {
        toast.error('Limit sell alert', {
          description:
            'Use a percentage chip (25–100%) for alerts. Custom token amounts are Phase 3.',
        });
        return;
      }
      toast.error('Could not create limit alert', { description: msg.slice(0, 120) });
    },
  });

  useEffect(() => {
    const o = limitAlertOrder;
    if (!o?.id || o.status !== 'triggered') return;
    if (limitToastRef.current === o.id) return;
    limitToastRef.current = o.id;
    setTradePanelMode('market');
    setTab(o.side);
    setSlippageBps(o.slippage_bps);
    setUseCustomSlippage(false);
    if (o.side === 'buy' && o.amount_sol != null) {
      setActivePresetSol(o.amount_sol);
      setBuyCustomSol('');
    }
    if (o.side === 'sell' && o.amount_token_pct != null) {
      const p = Math.min(100, Math.max(25, Math.round(o.amount_token_pct)));
      const allowed: (typeof SELL_PCTS)[number][] = [...SELL_PCTS];
      const nearest = allowed.reduce((a, b) =>
        Math.abs(b - p) < Math.abs(a - p) ? b : a,
      );
      setSellPct(nearest);
      setSellUseCustom(false);
    }
    toast.message('Limit alert triggered', {
      description: `Price hit your $${o.trigger_price_usd} mark. Review and confirm your ${o.side}.`,
    });
  }, [limitAlertOrder]);

  const pickBuyPreset = (sol: number) => {
    setActivePresetSol(sol);
    setBuyCustomSol('');
  };

  const onBuyCustom = (v: string) => {
    setBuyCustomSol(v);
    setActivePresetSol(null);
  };

  const formattedReceive = useMemo(() => {
    if (!quote?.summary.amountOutRaw) return null;
    if (quote.side === 'buy') {
      return `${formatNumber(rawToUi(quote.summary.amountOutRaw, decimals), { decimals: 4 })} ${symbol ?? 'tokens'}`;
    }
    return `${formatNumber(lamportsToSol(BigInt(quote.summary.amountOutRaw)), {
      decimals: 5,
    })} TON`;
  }, [quote, decimals, symbol]);

  const formattedPay = useMemo(() => {
    if (!quote?.summary.amountInRaw) return null;
    if (quote.side === 'buy') {
      return `${formatNumber(lamportsToSol(BigInt(quote.summary.amountInRaw)), {
        decimals: 4,
      })} TON`;
    }
    return `${formatNumber(rawToUi(quote.summary.amountInRaw, decimals), { decimals: 4 })} ${symbol ?? 'tokens'}`;
  }, [quote, decimals, symbol]);

  const runTrade = useCallback(async () => {
    if (!wallet) {
      toast.error('Connect TON wallet', { description: 'Use TonConnect after sign-in.' });
      return;
    }
    if (activeWalletRow?.is_imported === true) {
      toast.error('View-only wallet', {
        description: 'Use a non-imported wallet linked in TonConnect to trade.',
      });
      return;
    }
    const token = await getAccessToken();
    if (!token) {
      toast.error('Session expired', { description: 'Refresh and sign in again.' });
      return;
    }

    if (tab === 'buy' && (buyAmountSol == null || buyAmountSol <= 0)) {
      toast.error('Enter TON amount');
      return;
    }
    if (tab === 'sell' && !sellAmountTokenRaw) {
      toast.error('No tokens to sell', {
        description: balanceRaw === '0' ? 'Zero balance for this mint.' : 'Adjust amount.',
      });
      return;
    }

    const toastId = toast.loading('Getting quote...');
    try {
      const feeExtra =
        activePreset != null
          ? {
              jitoTipLamports: activePreset.jito_tip_lamports,
              priorityFeeLamports: activePreset.priority_fee_lamports,
              autoFee: activePreset.auto_fee,
              maxFeeSol: activePreset.max_fee_sol,
            }
          : {};

      const body =
        tab === 'buy'
          ? {
              mint,
              side: 'buy' as const,
              userPublicKey: wallet.address,
              amountSol: buyAmountSol!,
              slippageBps: effectiveSlippageBps,
              dynamicSlippage,
              landing,
              includeSwapTx: true,
              ...feeExtra,
            }
          : {
              mint,
              side: 'sell' as const,
              userPublicKey: wallet.address,
              amountTokenRaw: sellAmountTokenRaw!,
              slippageBps: effectiveSlippageBps,
              dynamicSlippage,
              landing,
              includeSwapTx: true,
              ...feeExtra,
            };

      const res = await fetch('/api/trade/quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const json: unknown = await res.json();
      if (!res.ok) {
        const msg =
          typeof json === 'object' && json && 'message' in json
            ? String((json as { message: unknown }).message)
            : `Quote failed (${res.status})`;
        throw new Error(msg);
      }
      const ok = json as TradeQuoteApiOk;
      if (!ok.tonConnect?.messages?.length || !ok.summary?.amountOutRaw) {
        throw new Error('No swap transaction from quote');
      }

      setQuote(ok);
      setQuoteForKey(paramsKey);
      setQuoteWallet(wallet.address);

      toast.loading('Sign in wallet...', { id: toastId });
      const { signature: sig } = await submitFromQuote({
        quote: ok,
        walletAddress: wallet.address,
        mint,
        getAccessToken,
      });

      toast.success(tab === 'buy' ? 'Buy complete' : 'Sell complete', {
        id: toastId,
        description: sig ? `Signature: ${sig.slice(0, 8)}...` : undefined,
      });
      setQuote(null);
      setQuoteForKey(null);
      setQuoteWallet(null);
      void refetchBalance();
      void qc.invalidateQueries({ queryKey: ['wallets-my'] });
    } catch (e) {
      toast.dismiss(toastId);
      setQuote(null);
      setQuoteForKey(null);
      setQuoteWallet(null);
      const msg = e instanceof Error ? e.message : 'Trade failed';
      toast.error('Trade failed', { description: msg.slice(0, 200) });
    }
  }, [
    wallet,
    getAccessToken,
    submitFromQuote,
    tab,
    mint,
    buyAmountSol,
    sellAmountTokenRaw,
    balanceRaw,
    effectiveSlippageBps,
    dynamicSlippage,
    landing,
    paramsKey,
    refetchBalance,
    activePreset,
    activeWalletRow?.is_imported,
    qc,
  ]);

  const sym = symbol ?? 'Token';

  const presetRowsForSelector = useMemo((): { slot: PresetSlot; name: string }[] => {
    const list = presetsPayload?.presets;
    if (list && list.length > 0) return list.map((p) => ({ slot: p.slot, name: p.name }));
    return [
      { slot: 1, name: 'Fast' },
      { slot: 2, name: 'Normal' },
      { slot: 3, name: 'Safe' },
    ];
  }, [presetsPayload?.presets]);

  const editorPresetFull = activePreset;
  const panelMode = tradePanelMode === 'limit_alerts' ? 'market' : tradePanelMode;
  const axiomBuyAmounts = [0.5, 1, 2, 3];
  const walletMenuRows = myWalletsQ.data?.wallets ?? [];
  const selectWallets = (rows: MyWalletRow[]) => {
    const addresses = rows.map((w) => w.wallet_address);
    setSelectedWalletAddresses(addresses);
    if (addresses[0]) setActiveWalletAddress(addresses[0]);
  };

  const walletPickerShellRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!walletMenuOpen) return;
    function onDown(e: MouseEvent) {
      const el = walletPickerShellRef.current;
      if (el?.contains(e.target as Node)) return;
      setWalletMenuOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [walletMenuOpen]);

  return (
    <div
      ref={walletPickerShellRef}
      data-mint={mint}
      className="relative flex h-full max-h-[calc(100vh-var(--app-topbar-h)-var(--app-bottombar-h)-8px)] min-h-0 w-full min-w-0 flex-col overflow-hidden bg-[#0b0d12] text-[12px] text-white"
    >
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-2 pb-5 [scrollbar-width:thin]">
        {extendedTape ? <TradeTapeStrip m={extendedTape} /> : (
          <div className="rounded-md border border-[#1b1f2a] bg-[#11141b] px-2 py-1.5 text-[11px] text-[#6b7280]">
            6h Vol - <span className="text-[#34d399]">Buys -</span> <span className="text-[#fb7185]">Sells -</span> Net -
          </div>
        )}

        {!walletsReady ? (
          <p className="flex items-center gap-2 rounded border border-[#1b1f2a] bg-[#11141b] px-2 py-1 text-[11px] text-[#9ca3af]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading wallet...
          </p>
        ) : !wallet ? (
          <p className="rounded border border-[#1b1f2a] bg-[#11141b] px-2 py-1 text-[11px] text-signal-warn">
            No TON wallet linked. Connect with TonConnect after sign-in.
          </p>
        ) : null}

        <div className="flex w-full rounded-lg border border-[#1b1f2a] bg-[#0b0d12] p-0.5">
          <button type="button" onClick={() => setTab('buy')} className={cn('btn-press focus-ring flex flex-1 items-center justify-center rounded-md py-2 text-[13px] font-semibold transition', tab === 'buy' ? 'bg-[#38d99c] text-[#04120d]' : 'text-[#9ca3af] hover:bg-white/[0.04] hover:text-white')}>Buy</button>
          <button type="button" disabled={panelMode === 'limit_mcap'} onClick={() => setTab('sell')} className={cn('btn-press focus-ring flex flex-1 items-center justify-center rounded-md py-2 text-[13px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40', tab === 'sell' ? 'bg-[#fb7185] text-[#21060c]' : 'text-[#9ca3af] hover:bg-white/[0.04] hover:text-white')}>Sell</button>
        </div>

        <div className="flex min-w-0 items-center gap-1 border-b border-[#1b1f2a] pb-1">
          {([['market', 'Market'], ['limit_mcap', 'Limit'], ['advanced', 'Adv.']] as const).map(([id, label]) => (
            <button key={id} type="button" onClick={() => setTradePanelMode(id)} className={cn('rounded px-2 py-1 text-[12px] font-semibold transition', panelMode === id ? 'bg-white/10 text-white' : 'text-[#8b93a3] hover:text-white')}>{label}</button>
          ))}
          <div className="relative ml-auto">
            <button
              type="button"
              onClick={() => setWalletMenuOpen((v) => !v)}
              className="flex items-center gap-1 rounded-full border border-[#1b1f2a] bg-[#11141b] px-2 py-1 text-[10px] text-[#9ca3af] hover:bg-white/[0.04] hover:text-white"
              aria-expanded={walletMenuOpen}
              aria-label="Select trading wallets"
            >
              <Wallet className="h-3 w-3" />
              <span className="tabular-nums">{activeWalletCount}</span>
              <Coins className="h-3 w-3 text-[#5865F2]" />
              <span className="tabular-nums">{solBalPreview ?? '0.0000'}</span>
            </button>
          </div>
        </div>

        {limitAlertOrder?.status === 'triggered' ? <div className="rounded border border-signal-warn/40 bg-signal-warn/10 px-2 py-1.5 text-[10px] leading-snug text-[#d1d5db]"><span className="font-semibold text-signal-warn">Limit alert fired</span> - spot reached your ${limitAlertOrder.trigger_price_usd} target.</div> : null}

        {panelMode === 'limit_mcap' ? (
          <div className="rounded-md border border-[#1b1f2a] bg-[#11141b] p-2">
            <div className="mb-1 flex items-center justify-between text-[10px] text-[#8b93a3]"><span>MKT cap target</span><span className="tabular-nums text-white">{targetMcUsd != null ? formatCompactUsd(targetMcUsd) : '-'}</span></div>
            <input type="range" min={-100} max={100} step={1} value={limitMcSliderPct} onChange={(e) => setLimitMcSliderPct(Number(e.target.value))} className="h-2 w-full cursor-pointer accent-[#5865F2]" aria-label="Market cap offset percent" />
          </div>
        ) : null}

        {tab === 'buy' ? (
          <div className="rounded-md border border-[#1b1f2a] bg-[#11141b] p-2">
            <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[#8b93a3]">Amount</div>
            <TradeAmountInput value={buyCustomSol} onChange={onBuyCustom} placeholder={activePresetSol != null ? String(activePresetSol) : '0.0'} suffix="TON" icon="sol" aria-label="TON amount to buy" />
            <div className="mt-1 grid grid-cols-5 overflow-hidden rounded border border-[#1b1f2a] text-center text-[12px] font-semibold">
              {axiomBuyAmounts.map((s) => <button key={s} type="button" onClick={() => pickBuyPreset(s)} className={cn('border-r border-[#1b1f2a] py-1.5 tabular-nums last:border-r-0 hover:bg-white/5', activePresetSol === Number(s) ? 'text-[#38d99c]' : 'text-white')}>{s}</button>)}
              <button type="button" className="py-1.5 text-[#8b93a3] hover:bg-white/5">%</button>
            </div>
          </div>
        ) : (
          <div className="rounded-md border border-[#1b1f2a] bg-[#11141b] p-2">
            <div className="mb-1 flex items-center justify-between text-[10px] text-[#8b93a3]"><span>Amount</span><span className="tabular-nums">Bal {formatNumber(rawToUi(balanceRaw, decimals), { decimals: 4 })} {sym}</span></div>
            <div className="grid grid-cols-5 overflow-hidden rounded border border-[#1b1f2a] text-center text-[12px] font-semibold">
              {SELL_PCTS.map((p) => <button key={p} type="button" onClick={() => { setSellUseCustom(false); setSellPct(p); }} className={cn('border-r border-[#1b1f2a] py-1.5 tabular-nums hover:bg-white/5', !sellUseCustom && sellPct === p ? 'text-[#fb7185]' : 'text-white')}>{p}%</button>)}
              <button type="button" onClick={() => setSellUseCustom(true)} className={cn('py-1.5 hover:bg-white/5', sellUseCustom ? 'text-[#fb7185]' : 'text-[#8b93a3]')}>Custom</button>
            </div>
            {sellUseCustom ? <div className="mt-1.5"><TradeAmountInput value={sellCustomUi} onChange={setSellCustomUi} placeholder="Tokens to sell" suffix={sym.length > 8 ? `${sym.slice(0, 6)}...` : sym} icon="token" aria-label={`${sym} amount to sell`} /></div> : null}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1 rounded-md border border-[#1b1f2a] bg-[#11141b] px-2 py-1 text-[10px] text-[#8b93a3]">
          <CompactFeeStrip slippageBps={effectiveSlippageBps} priorityLamports={activePreset?.priority_fee_lamports ?? 0} jitoLamports={activePreset?.jito_tip_lamports ?? 0} />
          <span className="ml-auto inline-flex items-center gap-1"><input type="checkbox" checked={dynamicSlippage} onChange={(e) => setDynamicSlippage(e.target.checked)} className="h-3 w-3 rounded border-[#1b1f2a]" />Dynamic</span>
        </div>

        <div className="rounded-md border border-[#1b1f2a] bg-[#0b0d12] px-2 py-1.5">
          <label className="flex cursor-pointer items-center gap-2 text-[12px] font-semibold text-white"><input type="checkbox" checked={advancedOpen && panelMode === 'advanced'} onChange={(e) => { setAdvancedOpen(e.target.checked); if (e.target.checked) setTradePanelMode('advanced'); }} className="h-3.5 w-3.5 rounded border-[#1b1f2a]" />Advanced Trading Strategy</label>
          {panelMode === 'advanced' && advancedOpen ? <div className="mt-2 grid grid-cols-2 gap-1 text-[10px]">{([['migration', 'Migration'], ['dev_sell', 'Dev Sell'], ['trail_sl', 'Trail SL'], ['dca', 'DCA']] as const).map(([id, label]) => <button key={id} type="button" onClick={() => setAdvStrategy(id)} className={cn('rounded border border-[#1b1f2a] px-2 py-1 font-semibold', advStrategy === id ? 'bg-[#5865F2]/20 text-white' : 'text-[#8b93a3]')}>{label}</button>)}</div> : null}
        </div>

        {quote && !quoteStale ? <div className="rounded border border-[#1b1f2a] bg-[#11141b] px-2 py-1 text-[11px]"><div className="flex justify-between gap-2 text-[#8b93a3]"><span>You pay</span><span className="tabular-nums text-white">{formattedPay ?? '-'}</span></div><div className="mt-0.5 flex justify-between gap-2 text-[#8b93a3]"><span>You receive</span><span className="tabular-nums text-white">{formattedReceive ?? '-'}</span></div></div> : null}
        {quoteStale ? <p className="text-[10px] text-signal-warn">Settings changed. Tap the action button for a fresh quote.</p> : null}
        {tradingBlockedImported ? <p className="rounded border border-[#1b1f2a] bg-[#11141b] px-2 py-1 text-[10px] leading-snug text-[#9ca3af]">Imported wallets are view-only for swaps right now. Switch to an embedded Pointer wallet to trade.</p> : null}

        <button type="button" disabled={!wallet || tradingBlockedImported || (panelMode === 'limit_mcap' && targetMcUsd == null)} onClick={() => { if (panelMode === 'limit_mcap') { toast.message('MC limit buy', { description: 'MC-triggered execution is not live yet. Use Market to swap now.' }); return; } void runTrade(); }} className={cn('btn-press focus-ring sticky bottom-0 z-[1] flex w-full items-center justify-center gap-2 rounded-full py-3 text-[13px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50', tab === 'buy' ? 'cta-bull' : 'cta-bear')}>
          {panelMode === 'limit_mcap' && targetMcUsd != null ? `Buy @ ${formatCompactUsd(targetMcUsd)} MC` : `${tab === 'buy' ? 'Buy' : 'Sell'} ${ctaSym}`}
        </button>

        <div className="grid grid-cols-4 border-t border-[#1b1f2a] pt-2 text-[11px] leading-tight">
          <div className="border-r border-[#1b1f2a] pr-2"><div className="text-[#8b93a3]">Bought</div><div className="font-semibold text-[#38d99c]">$0</div></div>
          <div className="border-r border-[#1b1f2a] px-2"><div className="text-[#8b93a3]">Sold</div><div className="font-semibold text-[#fb7185]">$0</div></div>
          <div className="border-r border-[#1b1f2a] px-2"><div className="text-[#8b93a3]">Holding</div><div className="font-semibold text-white">$0</div></div>
          <div className="pl-2"><div className="text-[#8b93a3]">PnL</div><div className="font-semibold text-[#38d99c]">+$0 (0%)</div></div>
        </div>

        {wallet && authenticated ? <PresetSelector presets={presetRowsForSelector} onEdit={() => { if (!activePreset) { toast.error('Still loading presets...'); return; } setPresetEditorOpen(true); }} onAdvancedSettings={() => { if (!activePreset) { toast.error('Still loading presets...'); return; } setAdvancedSettingsOpen(true); }} disabled={!authenticated} /> : null}
        <TokenInfoGrid m={extendedTape} />
        <button type="button" onClick={() => { void navigator.clipboard.writeText(mint); toast.success('Contract address copied'); }} className="flex w-full items-center justify-between rounded border border-[#1b1f2a] bg-[#11141b] px-2 py-1.5 text-[11px] text-[#d1d5db] hover:bg-white/[0.03]"><span className="text-[#8b93a3]">CA:</span><span className="min-w-0 flex-1 truncate px-2 text-left tabular-nums">{mint}</span><span className="text-[#8b93a3]">?</span></button>
      </div>

      {walletMenuOpen ? (
        <div
          className="absolute right-3 top-[104px] z-[80] w-[350px] max-w-[calc(100%-24px)] overflow-hidden rounded-md border bg-[#14161d] shadow-2xl"
          style={{ borderColor: '#2a2f3a' }}
        >
          <div className="flex items-center justify-between border-b px-3 py-2" style={{ borderColor: '#2a2f3a' }}>
            <div className="flex min-w-0 items-center gap-1">
              <button
                type="button"
                onClick={() => selectWallets(walletMenuRows.filter((w) => !w.is_archived && w.is_active))}
                className="rounded-full bg-white/10 px-2 py-1 text-[11px] font-semibold text-white hover:bg-white/15"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={() =>
                  selectWallets(
                    walletMenuRows.filter((w) => {
                      if (w.is_archived || !w.is_active || !w.balance_lamports) return false;
                      try {
                        return BigInt(w.balance_lamports) > 0n;
                      } catch {
                        return false;
                      }
                    }),
                  )
                }
                className="rounded-full bg-white/10 px-2 py-1 text-[11px] font-semibold text-white hover:bg-white/15"
              >
                Select All with Balance
              </button>
            </div>
            <button
              type="button"
              onClick={() => toast.info('Wallet selector settings coming soon')}
              className="rounded p-1 text-[#8b93a3] hover:bg-white/5 hover:text-white"
              aria-label="Wallet selector settings"
            >
              <Settings className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="max-h-[270px] overflow-y-auto">
            {walletMenuRows.map((w, i) => {
              const selected = selectedWalletAddresses.includes(w.wallet_address);
              const sol = w.balance_lamports ? formatNumber(lamportsToSol(BigInt(w.balance_lamports)), { decimals: 3 }) : '0';
              return (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => {
                    setSelectedWalletAddresses((current) =>
                      current.includes(w.wallet_address)
                        ? current.filter((addr) => addr !== w.wallet_address)
                        : [...current, w.wallet_address],
                    );
                    setActiveWalletAddress(w.wallet_address);
                  }}
                  className="grid w-full grid-cols-[1.5rem_1fr_auto_auto] items-center gap-2 border-b px-3 py-2 text-left hover:bg-white/[0.04]"
                  style={{ borderColor: '#1b1f2a' }}
                >
                  <span
                    className={cn(
                      'flex h-4 w-4 items-center justify-center rounded border text-[10px]',
                      selected ? 'border-[#38d99c] bg-[#38d99c] text-[#04120d]' : 'border-[#3b4252]',
                    )}
                  >
                    {selected ? '✓' : ''}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[12px] font-semibold text-white">
                      {w.label?.trim() || `Wallet ${i + 1}`}
                    </span>
                    <span className="block truncate text-[10px] text-[#8b93a3]">
                      {w.is_imported ? 'View-only' : 'Trading'} · {w.wallet_address.slice(0, 5)}...{w.wallet_address.slice(-4)}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-[#1b1f2a] bg-[#0b0d12] px-2 py-1 text-[11px] tabular-nums text-[#cbd5e1]">
                    <Coins className="h-3 w-3 text-[#5865F2]" /> {sol}
                  </span>
                  <span className="rounded-full border border-[#1b1f2a] bg-[#0b0d12] px-2 py-1 text-[11px] text-[#8b93a3]">0</span>
                </button>
              );
            })}
            {walletMenuRows.length === 0 ? (
              <div className="px-3 py-6 text-center text-[11px] text-[#8b93a3]">No wallets found</div>
            ) : null}
          </div>
        </div>
      ) : null}

      <PresetEditorModal
        open={presetEditorOpen}
        onClose={() => setPresetEditorOpen(false)}
        preset={editorPresetFull}
      />
      <AdvancedTradingSettingsModal
        open={advancedSettingsOpen}
        onClose={() => setAdvancedSettingsOpen(false)}
        preset={editorPresetFull}
      />
    </div>
  );
}
