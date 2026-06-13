'use client';

/* Trading panel syncs local controls from async preset fetch and limit-alert deep links. */
/* eslint-disable react-hooks/set-state-in-effect -- intentional hydration from server / URL */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { MyWalletRow } from '@/lib/hooks/useActiveSolanaWallet';
import { useActiveSolanaWallet } from '@/lib/hooks/useActiveSolanaWallet';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePointerTradeSubmit } from '@/lib/hooks/usePointerTradeSubmit';
import type { TradeQuoteApiOk } from '@/lib/trading/quoteTypes';
import {
  ArrowBigUp,
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  Copy,
  ExternalLink,
  Check,
  CircleDollarSign,
  Clock,
  Loader2,
  Pencil,
  TrendingDown,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { toastCopied, toastCopyFailed } from '@/lib/ui/copyToast';
import { BUY_PRESETS_USDC, DEFAULT_SLIPPAGE_BPS, USDC_DECIMALS } from '@/lib/utils/constants';
import { resolveBuyPresetsSol, resolveDefaultBuyPresetSol } from '@/lib/beta/founderBeta';
import { buyQuoteAmountFields, spendAssetLabel } from '@/lib/trading/spendAsset';
import { dispatchSolanaAccountRefresh } from '@/lib/client/portfolioRefreshEvents';
import { invalidateTokenDeskAfterTrade } from '@/lib/client/tokenDeskRefresh';
import { deskWalletStatsQueryKey, useDeskWalletStats } from '@/lib/hooks/useDeskWalletStats';
import { USDC_MINT } from '@/lib/utils/addresses';
import {
  formatCompactUsd,
  formatNumber,
  formatUsd,
  lamportsToSol,
  rawToUi,
  uiToRaw,
} from '@/lib/utils/formatters';
import type { TokenMarketSnapshotRow } from '@/lib/db/tokens';
import type { TokenExtendedMetrics } from '@/lib/types/tokenExtendedMetrics';
import { useTokenExtendedMetrics } from '@/lib/hooks/useTokenExtendedMetrics';
import {
  noWalletLinkedBanner,
  viewOnlyWalletTradeMessage,
  walletConnectRequiredMessage,
  walletConnectRequiredTitle,
} from '@/lib/trading/walletConnectCopy';
import { cn } from '@/lib/utils/cn';
import { explorerTokenAriaLabel, explorerTokenHrefFromMint, mintMatchesAppChain } from '@/lib/chains/mintKind';
import { nativeTicker } from '@/lib/chains/nativeCurrency';
import type { AppChainId } from '@/lib/chains/appChain';
import type { Tables } from '@/lib/supabase/types';
import { mevModeToLanding, type MevMode } from '@/lib/trading/mevMode';
import { PresetTradePanel, type PresetTradeRow } from '@/components/trading/PresetTradePanel';
import { recordUserTradeActivity } from '@/lib/alerts/recordUserTradeActivity';
import { TokenInfoPanel } from '@/components/tokens/TokenInfoPanel';
import { TokenTradeDeskStrip } from '@/components/tokens/TokenTradeDeskStrip';
import {
  pickTokenTradePerfChanges,
  type TokenTradePerfTf,
} from '@/lib/tokens/tokenTradePerfTfs';
import { buildBlitzAwareFees, isBlitzWallet } from '@/lib/trading/blitz';
import { useTradingStore, type PresetSlot } from '@/store/trading';
import { useUIStore } from '@/store/ui';
import { computeDeskWalletDisplayStats } from '@/lib/trading/deskWalletDisplayStats';
import {
  addInstantTradeBuyTon,
  addInstantTradeSellTon,
  readInstantTradeLifetimeStats,
  INSTANT_TRADE_STATS_EVT,
} from '@/lib/trading/instantTradeStats';
import { TradingWalletPickerPopover } from '@/components/trading/TradingWalletPickerPopover';
import { balanceRawFromQueryData } from '@/lib/trading/tradeBalanceQuery';
import { TradeDeskStatsStrip } from '@/components/trading/TradeDeskStatsStrip';
import { MultiWalletBuySettingsModal } from '@/components/trading/MultiWalletBuySettingsModal';

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
  'aria-label': ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  'aria-label'?: string;
}) {
  return (
    <div className="relative flex min-h-[2.35rem] items-center gap-2 rounded-md border border-border-subtle bg-bg-hover/40 px-2.5 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-colors focus-within:border-accent-primary/55 focus-within:ring-accent-primary/20">
      <span className="pointer-events-none shrink-0 text-[10px] font-semibold uppercase tracking-wide text-fg-muted">
        Amount
      </span>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.value)}
        className="focus-ring min-w-0 flex-1 border-0 bg-transparent py-0.5 text-right font-sans text-sm font-medium tabular-nums text-fg-primary outline-none placeholder:text-fg-muted/80 placeholder:italic"
      />
    </div>
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
  const activeChain = useUIStore((s) => s.activeChain);
  const nativeSym = nativeTicker(activeChain);
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
  const activePresetSlot = useTradingStore((s) => s.activePresetSlot);
  const spendAsset = useTradingStore((s) => s.spendAsset);
  const setSpendAsset = useTradingStore((s) => s.setSpendAsset);
  const blitzWalletAddresses = useTradingStore((s) => s.blitzWalletAddresses);

  const limitToastRef = useRef<string | null>(null);
  const initialBuySolAppliedRef = useRef(false);

  const [tradePanelMode, setTradePanelMode] = useState<TradePanelMode>('market');
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
  const [perfTf, setPerfTf] = useState<TokenTradePerfTf>('6h');
  const [activePresetSol, setActivePresetSol] = useState<number | null>(resolveDefaultBuyPresetSol());
  const [buyCustomSol, setBuyCustomSol] = useState('');
  const [sellPct, setSellPct] = useState<(typeof SELL_PCTS)[number]>(100);
  const [sellCustomUi, setSellCustomUi] = useState('');
  const [sellUseCustom, setSellUseCustom] = useState(false);

  const [slippageBps, setSlippageBps] = useState(DEFAULT_SLIPPAGE_BPS);
  const [slippageCustom, setSlippageCustom] = useState('');
  const [useCustomSlippage, setUseCustomSlippage] = useState(false);
  const [dynamicSlippage, setDynamicSlippage] = useState(true);
  const [landing, setLanding] = useState<LandingMode>('jito');
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);
  const [multiWalletBuySettingsOpen, setMultiWalletBuySettingsOpen] = useState(false);
  const [selectedWalletAddresses, setSelectedWalletAddresses] = useState<string[]>([]);
  const [buyChipsEditing, setBuyChipsEditing] = useState(false);
  const [buyChipsDraft, setBuyChipsDraft] = useState(['', '', '', '']);
  const [statsUsdMode, setStatsUsdMode] = useState(false);
  const [statsRevision, setStatsRevision] = useState(0);

  useEffect(() => {
    const onStats = (e: Event) => {
      const d = (e as CustomEvent<{ mint?: string; wallet?: string }>).detail;
      if (d?.mint === mint && d?.wallet === wallet?.address) {
        setStatsRevision((r) => r + 1);
        void qc.invalidateQueries({ queryKey: deskWalletStatsQueryKey(mint, wallet?.address) });
      }
    };
    window.addEventListener(INSTANT_TRADE_STATS_EVT, onStats);
    return () => window.removeEventListener(INSTANT_TRADE_STATS_EVT, onStats);
  }, [mint, wallet?.address, qc]);

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

  const {
    rawMetrics: extendedTape,
    metrics: effectiveExtendedTape,
    isLoading: extendedTapeLoading,
  } = useTokenExtendedMetrics(mint);

  /** Live desks never fabricate TF % — missing Dex windows render as `—`. */
  const perfChanges = useMemo(
    () => pickTokenTradePerfChanges(marketSnapshot?.extended_metrics, mint),
    [marketSnapshot?.extended_metrics, mint],
  );

  const baseMcUsd = marketSnapshot?.market_cap_usd;
  const targetMcUsd = useMemo(() => {
    if (baseMcUsd == null || !Number.isFinite(baseMcUsd) || baseMcUsd <= 0) return null;
    return baseMcUsd * (1 + limitMcSliderPct / 100);
  }, [baseMcUsd, limitMcSliderPct]);

  const buyAmount = useMemo(() => {
    if (activePresetSol != null) return activePresetSol;
    const n = parseFloat(buyCustomSol);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [activePresetSol, buyCustomSol]);

  /** @deprecated alias — same as `buyAmount`. */
  const buyAmountSol = buyAmount;

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

  const { data: usdcBalanceData } = useQuery({
    queryKey: ['trade-balance-usdc', wallet?.address],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const res = await fetch(
        `/api/trade/balance?mint=${encodeURIComponent(USDC_MINT)}&wallet=${encodeURIComponent(wallet!.address)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const json: unknown = await res.json();
      if (!res.ok) throw new Error('balance');
      return json as { rawAmount: string };
    },
    enabled: Boolean(activeChain === 'sol' && walletsReady && wallet?.address),
    staleTime: 10_000,
  });

  const usdcBalPreview = useMemo(() => {
    const raw = usdcBalanceData?.rawAmount ?? '0';
    return formatNumber(rawToUi(raw, USDC_DECIMALS), { decimals: 2 });
  }, [usdcBalanceData?.rawAmount]);

  const balanceRaw = balanceData?.rawAmount ?? '0';

  const { data: solUsdRate } = useQuery({
    queryKey: ['portfolio-sol-usd'],
    queryFn: async (): Promise<number | null> => {
      const token = await getAccessToken();
      if (!token) return null;
      const res = await fetch('/api/portfolio?tradesLimit=0&fifoLimit=0', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      const json = (await res.json()) as { solUsd?: number | null };
      const px = json.solUsd;
      return typeof px === 'number' && Number.isFinite(px) && px > 0 ? px : null;
    },
    enabled: authenticated,
    staleTime: 60_000,
  });

  const lifetimeStats = useMemo(() => {
    if (!wallet?.address) return { buyTon: 0, sellTon: 0 };
    return readInstantTradeLifetimeStats(mint, wallet.address);
  }, [mint, wallet?.address, balanceRaw, statsRevision]);

  const { data: deskStats } = useDeskWalletStats(mint, wallet?.address);

  const tradeDeskStats = useMemo(
    () =>
      computeDeskWalletDisplayStats({
        session: lifetimeStats,
        desk: deskStats,
        solUsdRate: solUsdRate ?? null,
        priceUsd: marketSnapshot?.price_usd,
        balanceRaw,
        decimals,
      }),
    [
      lifetimeStats,
      deskStats,
      solUsdRate,
      marketSnapshot?.price_usd,
      balanceRaw,
      decimals,
    ],
  );

  const netSessionPnlSol = tradeDeskStats.netPnlSol;
  const holdingSol = tradeDeskStats.holdingSol;
  const netPnlPct = tradeDeskStats.netPnlPct;
  const displayBuyTon = tradeDeskStats.buyTon;
  const displaySellTon = tradeDeskStats.sellTon;
  const displayBuyUsd = tradeDeskStats.buyUsd;
  const displaySellUsd = tradeDeskStats.sellUsd;
  const displayHoldingUsd = tradeDeskStats.holdingUsd;
  const netPnlUsd = tradeDeskStats.netPnlUsd;

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
      return `${mint}|buy|${spendAsset}|${buyAmount ?? ''}|${effectiveSlippageBps}|${dynamicSlippage}|${landing}`;
    }
    return `${mint}|sell|${sellAmountTokenRaw ?? ''}|${effectiveSlippageBps}|${dynamicSlippage}|${landing}`;
  }, [
    mint,
    tab,
    spendAsset,
    buyAmount,
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
    if (activeChain === 'sol' && spendAsset === 'usdc') {
      return [...BUY_PRESETS_USDC];
    }
    const fromPreset = activePreset?.buy_amounts_sol;
    if (fromPreset && fromPreset.length > 0) return fromPreset;
    return [...resolveBuyPresetsSol()];
  }, [activePreset?.buy_amounts_sol, activeChain, spendAsset]);

  const buyRowChips = useMemo(() => {
    const chips = buyChipAmounts.slice(0, 4);
    while (chips.length < 4) {
      chips.push(resolveBuyPresetsSol()[chips.length] ?? resolveDefaultBuyPresetSol());
    }
    return chips;
  }, [buyChipAmounts]);

  const canEditBuyChips = activeChain === 'sol' && spendAsset === 'sol';

  useEffect(() => {
    setBuyChipsEditing(false);
  }, [activePresetSlot, spendAsset, tab, mint]);

  const saveBuyChipsMut = useMutation({
    mutationFn: async (amounts: number[]) => {
      if (!activePreset) throw new Error('no_preset');
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const merged = [...amounts, ...activePreset.buy_amounts_sol.slice(4)];
      const res = await fetch('/api/presets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          slot: activePreset.slot,
          buy_amounts_sol: merged,
        }),
      });
      const json: unknown = await res.json();
      if (!res.ok) {
        const msg =
          typeof json === 'object' && json && 'message' in json
            ? String((json as { message: unknown }).message)
            : 'Save failed';
        throw new Error(msg);
      }
      return json;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['trading-presets'] });
      setBuyChipsEditing(false);
      toast.success('Buy amounts saved');
    },
    onError: () => toast.error('Could not save buy amounts'),
  });

  const toggleBuyChipsEdit = () => {
    if (!canEditBuyChips) return;
    if (buyChipsEditing) {
      const amounts = buyChipsDraft.map((s) => Number.parseFloat(s.trim()));
      if (amounts.some((n) => !Number.isFinite(n) || n <= 0)) {
        toast.error('Enter four valid SOL amounts');
        return;
      }
      if (!activePreset) {
        toast.error('Preset still loading');
        return;
      }
      saveBuyChipsMut.mutate(amounts);
      return;
    }
    setBuyChipsDraft(buyRowChips.map((n) => String(n)));
    setBuyChipsEditing(true);
  };

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
    // Only fetch the user's existing limit orders once they're actually in a
    // limit-order surface — no eager fetch on every token open for the common
    // market-buy flow. Mutations call refetch() directly, which works even
    // while the query is otherwise disabled.
    enabled: Boolean(
      authenticated && mint && (tradePanelMode === 'limit_alerts' || tradePanelMode === 'limit_mcap'),
    ),
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
    })} ${nativeSym}`;
  }, [quote, decimals, symbol, nativeSym]);

  const formattedPay = useMemo(() => {
    if (!quote?.summary.amountInRaw) return null;
    if (quote.side === 'buy') {
      if (quote.spendAsset === 'usdc' || quote.summary.amountUsdcEstimate != null) {
        const est =
          quote.summary.amountUsdcEstimate ??
          rawToUi(quote.summary.amountInRaw, USDC_DECIMALS);
        return `${formatNumber(est, { decimals: 2 })} USDC`;
      }
      return `${formatNumber(lamportsToSol(BigInt(quote.summary.amountInRaw)), {
        decimals: 4,
      })} ${nativeSym}`;
    }
    return `${formatNumber(rawToUi(quote.summary.amountInRaw, decimals), { decimals: 4 })} ${symbol ?? 'tokens'}`;
  }, [quote, decimals, symbol, nativeSym]);

  const runTrade = useCallback(async () => {
    if (!wallet) {
      toast.error(walletConnectRequiredTitle(activeChain), {
        description: walletConnectRequiredMessage(activeChain),
      });
      return;
    }
    if (activeWalletRow?.is_imported === true) {
      toast.error('View-only wallet', {
        description: viewOnlyWalletTradeMessage(activeChain),
      });
      return;
    }
    const token = await getAccessToken();
    if (!token) {
      toast.error('Session expired', { description: 'Refresh and sign in again.' });
      return;
    }

    if (tab === 'buy' && (buyAmount == null || buyAmount <= 0)) {
      toast.error(`Enter ${spendAssetLabel(activeChain === 'sol' ? spendAsset : 'sol')} amount`);
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
      const blitzOn = isBlitzWallet(wallet.address, blitzWalletAddresses);
      const presetFees =
        activePreset != null
          ? {
              jitoTipLamports: activePreset.jito_tip_lamports,
              priorityFeeLamports: activePreset.priority_fee_lamports,
              autoFee: activePreset.auto_fee,
              maxFeeSol: activePreset.max_fee_sol,
              landing,
            }
          : { landing };
      const { fees: feeExtra, landing: blitzLanding } = buildBlitzAwareFees(blitzOn, presetFees);
      const tradeLanding = blitzLanding ?? landing;

      const buyAsset = activeChain === 'sol' ? spendAsset : 'sol';
      const body =
        tab === 'buy'
          ? {
              mint,
              side: 'buy' as const,
              userPublicKey: wallet.address,
              ...buyQuoteAmountFields(buyAsset, buyAmount!),
              slippageBps: effectiveSlippageBps,
              dynamicSlippage,
              landing: tradeLanding,
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
              landing: tradeLanding,
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
      const executable =
        ok.chain === 'sol'
          ? Boolean(ok.swapTransaction && ok.summary?.amountOutRaw != null)
          : Boolean(ok.tonConnect?.messages?.length && ok.summary?.amountOutRaw);
      if (!executable) {
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
      const chainRes: AppChainId = ok.chain === 'sol' || ok.chain === 'ton' ? ok.chain : activeChain;
      const sym = nativeTicker(chainRes);
      if (tab === 'buy' && buyAmount != null && buyAmount > 0) {
        const paySym = spendAssetLabel(activeChain === 'sol' ? spendAsset : 'sol');
        const narration = `Bought ${formatNumber(buyAmount, { decimals: spendAsset === 'usdc' ? 2 : 4 })} ${paySym} · token page.`;
        if (wallet?.address && activeChain === 'sol' && spendAsset === 'sol') {
          addInstantTradeBuyTon(mint, wallet.address, buyAmount);
        }
        void (async () => {
          const posted = await recordUserTradeActivity(token, narration, {
            kind: 'token_panel_buy',
            mint,
            chain: chainRes,
            amountSol: spendAsset === 'sol' ? buyAmount : undefined,
            txSignature: sig ?? null,
          });
          if (posted) void qc.invalidateQueries({ queryKey: ['alerts-ticker'] });
        })();
      } else {
        const est =
          typeof ok.summary.amountSolEstimate === 'number' && Number.isFinite(ok.summary.amountSolEstimate)
            ? Math.max(0, ok.summary.amountSolEstimate)
            : undefined;
        if (wallet?.address && est != null && est > 0) {
          addInstantTradeSellTon(mint, wallet.address, est);
        }
        const narration =
          est != null
            ? `Sold tokens for ~${formatNumber(est, { decimals: 4 })} ${sym} · token page.`
            : `Sold tokens · token page.`;
        void (async () => {
          const posted = await recordUserTradeActivity(token, narration, {
            kind: 'token_panel_sell',
            mint,
            chain: chainRes,
            amountSol: est,
            txSignature: sig ?? null,
          });
          if (posted) void qc.invalidateQueries({ queryKey: ['alerts-ticker'] });
        })();
      }
      setQuote(null);
      setQuoteForKey(null);
      setQuoteWallet(null);
      setStatsRevision((n) => n + 1);
      void refetchBalance();
      invalidateTokenDeskAfterTrade(qc, mint, {
        walletAddress: wallet?.address,
        reason: 'buy_sell_panel',
      });
      void qc.invalidateQueries({ queryKey: ['wallets-my'] });
      dispatchSolanaAccountRefresh('buy_sell_panel');
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
    activeChain,
    nativeSym,
    getAccessToken,
    submitFromQuote,
    tab,
    mint,
    buyAmount,
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
    spendAsset,
    qc,
  ]);

  const sym = symbol ?? 'Token';

  const presetTradeRows = useMemo((): PresetTradeRow[] => {
    const list = presetsPayload?.presets;
    if (list && list.length > 0) return list;
    const fallbackNames = ['Fast', 'Normal', 'Safe'] as const;
    return ([1, 2, 3] as const).map((slot, i) => ({
      slot,
      name: fallbackNames[i] ?? `Preset ${slot}`,
      buy_amounts_sol: [...resolveBuyPresetsSol()],
      slippage_bps: DEFAULT_SLIPPAGE_BPS,
      dynamic_slippage: true,
      mev_mode: 'reduced' as MevMode,
      priority_fee_lamports: 100_000,
      jito_tip_lamports: 4_000,
      auto_fee: false,
      max_fee_sol: 0.1,
    }));
  }, [presetsPayload?.presets]);

  const panelMode = tradePanelMode === 'limit_alerts' ? 'market' : tradePanelMode;
  const walletMenuRows = useMemo(() => {
    const raw = myWalletsQ.data?.wallets ?? [];
    return raw.filter((w) => mintMatchesAppChain(w.wallet_address, activeChain));
  }, [myWalletsQ.data?.wallets, activeChain]);
  const selectWallets = (rows: MyWalletRow[]) => {
    const addresses = rows.map((w) => w.wallet_address);
    setSelectedWalletAddresses(addresses);
    if (addresses[0]) setActiveWalletAddress(addresses[0]);
  };

  const selectedCombinedSol = useMemo(() => {
    let total = 0n;
    for (const w of walletMenuRows) {
      if (!selectedWalletAddresses.includes(w.wallet_address) || !w.balance_lamports) continue;
      try {
        total += BigInt(w.balance_lamports);
      } catch {
        /* skip malformed balance */
      }
    }
    return lamportsToSol(total);
  }, [walletMenuRows, selectedWalletAddresses]);

  const walletTokenBalanceQueries = useQueries({
    queries: walletMenuRows.map((w) => ({
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
    walletMenuRows.forEach((w, i) => {
      map.set(w.wallet_address, balanceRawFromQueryData(walletTokenBalanceQueries[i]?.data));
    });
    return map;
  }, [walletMenuRows, walletTokenBalanceQueries]);

  const toggleWalletSelection = (address: string) => {
    setSelectedWalletAddresses((current) =>
      current.includes(address) ? current.filter((addr) => addr !== address) : [...current, address],
    );
  };

  return (
    <>
    <div
      data-mint={mint}
      className="relative flex w-full min-w-0 flex-col bg-bg-raised text-[12px] text-fg-primary"
    >
      <div className="space-y-3 px-3 pb-5 pt-2 lg:px-3 lg:pb-4">
        {!walletsReady ? (
          <p className="flex items-center gap-2 rounded border border-border-subtle bg-bg-raised px-2 py-1 text-[11px] text-fg-secondary">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading wallet...
          </p>
        ) : !wallet ? (
          <p className="rounded border border-border-subtle bg-bg-raised px-2 py-1 text-[11px] text-signal-warn">
            {noWalletLinkedBanner(activeChain)}
          </p>
        ) : null}

        <TokenTradeDeskStrip
          metrics={effectiveExtendedTape}
          mint={mint}
          changes={perfChanges}
          selected={perfTf}
          onSelect={setPerfTf}
        />

        <div className="flex w-full rounded-lg bg-bg-hover/50 p-1">
          <button
            type="button"
            aria-pressed={tab === 'buy'}
            onClick={() => setTab('buy')}
            className={cn(
              'btn-press focus-ring flex h-9 flex-1 items-center justify-center rounded-md text-[13px] font-semibold',
              'transition-[background-color,color,box-shadow,filter] duration-200 ease-out',
              tab === 'buy'
                ? 'cta-bull'
                : 'bg-transparent text-fg-muted hover:bg-signal-bull/10 hover:text-signal-bull',
            )}
          >
            Buy
          </button>
          <button
            type="button"
            aria-pressed={tab === 'sell'}
            disabled={panelMode === 'limit_mcap'}
            onClick={() => setTab('sell')}
            className={cn(
              'btn-press focus-ring flex h-9 flex-1 items-center justify-center rounded-md text-[13px] font-semibold',
              'transition-[background-color,color,box-shadow,filter] duration-200 ease-out disabled:cursor-not-allowed disabled:opacity-40',
              tab === 'sell'
                ? 'cta-bear'
                : 'bg-transparent text-fg-muted hover:bg-signal-bear/10 hover:text-signal-bear disabled:hover:bg-transparent disabled:hover:text-fg-muted',
            )}
          >
            Sell
          </button>
        </div>

        <div className="flex h-9 min-w-0 items-center gap-0.5 overflow-hidden border-b border-border-subtle/40">
          {([['market', 'Market'], ['limit_mcap', 'Limit'], ['advanced', 'Adv.']] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={panelMode === id}
              onClick={() => setTradePanelMode(id)}
              className={cn(
                '-mb-px flex h-full items-center border-b-2 px-2.5 text-[12px] font-semibold transition-colors duration-150',
                panelMode === id
                  ? 'border-fg-primary text-fg-primary'
                  : 'border-transparent text-fg-muted hover:text-fg-secondary',
              )}
            >
              {label}
            </button>
          ))}
          <TradingWalletPickerPopover
            className="h-full"
            open={walletMenuOpen}
            onOpenChange={setWalletMenuOpen}
            wallets={walletMenuRows}
            selectedAddresses={selectedWalletAddresses}
            onToggleWallet={toggleWalletSelection}
            onSelectWallets={selectWallets}
            triggerBalanceSol={selectedCombinedSol}
            activeChain={activeChain}
            disabled={!walletsReady || walletMenuRows.length === 0}
            tokenSymbol={symbol}
            tokenImageUrl={marketSnapshot?.image_url ?? null}
            tokenDecimals={decimals}
            tokenBalanceRawByAddress={walletTokenBalanceByAddress}
            onSettingsClick={() => {
              setWalletMenuOpen(false);
              setMultiWalletBuySettingsOpen(true);
            }}
            demoBuyAmount={buyAmount ?? activePresetSol ?? undefined}
          />
        </div>

        {panelMode === 'advanced' ? (
          <div className="grid grid-cols-2 gap-1.5">
            {(
              [
                ['migration', 'Migration'],
                ['dev_sell', 'Dev Sell'],
                ['trail_sl', 'Trail SL'],
                ['dca', 'DCA'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setAdvStrategy(id)}
                className={cn(
                  'rounded-md border px-2.5 py-1.5 text-[11px] font-semibold transition-colors',
                  advStrategy === id
                    ? 'border-accent-primary/40 bg-accent-primary/10 text-fg-primary'
                    : 'border-border-subtle/60 text-fg-muted hover:border-border-subtle hover:text-fg-secondary',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}

        {limitAlertOrder?.status === 'triggered' ? <div className="rounded border border-signal-warn/40 bg-signal-warn/10 px-2 py-1.5 text-[10px] leading-snug text-fg-secondary"><span className="font-semibold text-signal-warn">Limit alert fired</span> - spot reached your ${limitAlertOrder.trigger_price_usd} target.</div> : null}

        {panelMode === 'limit_mcap' ? (
          <div className="rounded-md border border-border-subtle bg-bg-raised p-2">
            <div className="mb-1 flex items-center justify-between text-[10px] text-fg-secondary"><span>MKT cap target</span><span className="tabular-nums text-fg-primary">{targetMcUsd != null ? formatCompactUsd(targetMcUsd) : '-'}</span></div>
            <input type="range" min={-100} max={100} step={1} value={limitMcSliderPct} onChange={(e) => setLimitMcSliderPct(Number(e.target.value))} className="h-2 w-full cursor-pointer accent-accent-primary" aria-label="Market cap offset percent" />
          </div>
        ) : null}

        {tab === 'buy' ? (
          <div className="rounded-md border border-border-subtle bg-bg-raised p-2">
            {activeChain === 'sol' ? (
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[10px] font-medium uppercase tracking-wide text-fg-secondary">
                  Spend
                </span>
                <div className="flex items-center gap-0.5 rounded-md border border-border-subtle p-0.5">
                  {(['sol', 'usdc'] as const).map((asset) => (
                    <button
                      key={asset}
                      type="button"
                      title={asset === 'usdc' ? 'Trading with USDC' : undefined}
                      onClick={() => setSpendAsset(asset)}
                      className={cn(
                        'rounded px-2 py-0.5 text-[10px] font-semibold transition',
                        spendAsset === asset
                          ? 'bg-accent-primary/20 text-accent-primary'
                          : 'text-fg-muted hover:text-fg-secondary',
                      )}
                    >
                      {asset === 'usdc' ? 'USDC' : 'SOL'}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="mb-1 flex items-center justify-between text-[10px] text-fg-secondary">
              <span>Amount</span>
              <span className="tabular-nums">
                Bal{' '}
                {activeChain === 'sol' && spendAsset === 'usdc'
                  ? `${usdcBalPreview ?? '0'} USDC`
                  : `${solBalPreview ?? '0'} ${nativeSym}`}
              </span>
            </div>
            <TradeAmountInput
              value={buyCustomSol}
              onChange={onBuyCustom}
              placeholder={activePresetSol != null ? String(activePresetSol) : '0.0'}
              aria-label={`${activeChain === 'sol' && spendAsset === 'usdc' ? 'USDC' : nativeSym} amount to buy`}
            />
            <div className={cn('mt-1 grid gap-1.5', canEditBuyChips ? 'grid-cols-5' : 'grid-cols-4')}>
              {buyChipsEditing
                ? buyChipsDraft.map((chip, i) => (
                    <input
                      key={i}
                      type="text"
                      inputMode="decimal"
                      value={chip}
                      onChange={(e) =>
                        setBuyChipsDraft((current) => {
                          const next = [...current];
                          next[i] = e.target.value;
                          return next;
                        })
                      }
                      aria-label={`Buy amount ${i + 1}`}
                      className="focus-ring h-8 rounded border border-sky-400/45 bg-sky-500/10 px-1 text-center text-sm font-medium tabular-nums text-fg-primary"
                    />
                  ))
                : buyRowChips.map((s, i) => (
                    <button
                      key={`${i}-${s}`}
                      type="button"
                      onClick={() => pickBuyPreset(s)}
                      className={cn(
                        'btn-press focus-ring flex h-8 items-center justify-center rounded border text-sm font-medium tabular-nums transition-all duration-100',
                        activePresetSol === Number(s)
                          ? 'border-accent-primary/40 bg-accent-primary/15 text-accent-primary'
                          : 'border-border-subtle bg-bg-sunken text-fg-secondary hover:border-border hover:bg-bg-hover hover:text-fg-primary',
                      )}
                    >
                      {s}
                    </button>
                  ))}
              {canEditBuyChips ? (
                <button
                  type="button"
                  aria-pressed={buyChipsEditing}
                  aria-label={buyChipsEditing ? 'Save buy amounts' : 'Edit buy amounts'}
                  disabled={saveBuyChipsMut.isPending}
                  onClick={toggleBuyChipsEdit}
                  className={cn(
                    'focus-ring flex h-8 items-center justify-center rounded border text-sm font-medium transition-all duration-100',
                    buyChipsEditing
                      ? 'border-sky-400/50 bg-sky-500/20 text-sky-100'
                      : 'border-border-subtle bg-bg-sunken text-fg-secondary hover:border-border hover:bg-bg-hover hover:text-fg-primary',
                    saveBuyChipsMut.isPending && 'cursor-wait opacity-60',
                  )}
                >
                  {buyChipsEditing ? (
                    <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                  ) : (
                    <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
                  )}
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="rounded-md border border-border-subtle bg-bg-raised p-2">
            <div className="mb-1 flex items-center justify-between text-[10px] text-fg-secondary"><span>Amount</span><span className="tabular-nums">Bal {formatNumber(rawToUi(balanceRaw, decimals), { decimals: 4 })} {sym}</span></div>
            <div className="mt-1 grid grid-cols-5 gap-1.5">
              {SELL_PCTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setSellUseCustom(false);
                    setSellPct(p);
                  }}
                  className={cn(
                    'btn-press focus-ring flex h-8 items-center justify-center rounded border text-sm font-medium tabular-nums transition-all duration-100',
                    !sellUseCustom && sellPct === p
                      ? 'border-signal-bear/40 bg-signal-bear/15 text-signal-bear'
                      : 'border-border-subtle bg-bg-sunken text-fg-secondary hover:border-border hover:bg-bg-hover hover:text-fg-primary',
                  )}
                >
                  {p}%
                </button>
              ))}
              <button
                type="button"
                onClick={() => setSellUseCustom(true)}
                className={cn(
                  'btn-press focus-ring flex h-8 items-center justify-center rounded border text-sm font-medium transition-all duration-100',
                  sellUseCustom
                    ? 'border-signal-bear/40 bg-signal-bear/15 text-signal-bear'
                    : 'border-border-subtle bg-bg-sunken text-fg-secondary hover:border-border hover:bg-bg-hover hover:text-fg-primary',
                )}
              >
                Custom
              </button>
            </div>
            {sellUseCustom ? <div className="mt-1.5"><TradeAmountInput value={sellCustomUi} onChange={setSellCustomUi} placeholder="Tokens to sell" aria-label={`${sym} amount to sell`} /></div> : null}
          </div>
        )}

        {quote && !quoteStale ? <div className="rounded border border-border-subtle bg-bg-raised px-2 py-1 text-[11px]"><div className="flex justify-between gap-2 text-fg-secondary"><span>You pay</span><span className="tabular-nums text-fg-primary">{formattedPay ?? '-'}</span></div><div className="mt-0.5 flex justify-between gap-2 text-fg-secondary"><span>You receive</span><span className="tabular-nums text-fg-primary">{formattedReceive ?? '-'}</span></div></div> : null}
        {quoteStale ? <p className="text-[10px] text-signal-warn">Settings changed. Tap the action button for a fresh quote.</p> : null}
        {tradingBlockedImported ? <p className="rounded border border-border-subtle bg-bg-raised px-2 py-1 text-[10px] leading-snug text-fg-secondary">Imported wallets are view-only for swaps right now. Switch to an embedded Pointer wallet to trade.</p> : null}

        <div className="pt-0.5">
          <button
            type="button"
            disabled={!wallet || tradingBlockedImported || (panelMode === 'limit_mcap' && targetMcUsd == null)}
            onClick={() => {
              if (panelMode === 'limit_mcap') {
                toast.message('MC limit buy', { description: 'MC-triggered execution is not live yet. Use Market to swap now.' });
                return;
              }
              void runTrade();
            }}
            className={cn(
              'btn-press focus-ring flex h-11 w-full items-center justify-center gap-2 rounded-lg text-[13px] font-bold transition disabled:cursor-not-allowed disabled:opacity-50',
              tab === 'buy' ? 'cta-bull' : 'cta-bear',
            )}
          >
            {panelMode === 'limit_mcap' && targetMcUsd != null
              ? `Buy @ ${formatCompactUsd(targetMcUsd)} MC`
              : `${tab === 'buy' ? 'Buy' : 'Sell'} ${ctaSym}`}
          </button>
        </div>

      <div className="-mx-3 w-[calc(100%+1.5rem)]">
        <TradeDeskStatsStrip
          activeChain={activeChain}
          nativeSym={nativeSym}
          usdMode={statsUsdMode}
          onToggleUsd={() => setStatsUsdMode((m) => !m)}
          bought={statsUsdMode ? displayBuyUsd : displayBuyTon}
          sold={statsUsdMode ? displaySellUsd : displaySellTon}
          holding={statsUsdMode ? displayHoldingUsd : holdingSol}
          pnl={statsUsdMode ? netPnlUsd : netSessionPnlSol}
          pnlPct={netPnlPct}
          className="rounded-none border-x-0"
        />
      </div>

        {wallet && authenticated ? (
          <PresetTradePanel presets={presetTradeRows} disabled={!authenticated} />
        ) : null}
        <TokenInfoPanel mint={mint} compactGrid />
        <div className="border-t border-border-subtle pt-2">
          <div className="flex items-center gap-1.5 py-1">
            <span className="shrink-0 text-[10px] uppercase tracking-wider text-fg-muted">CA:</span>
            <span className="min-w-0 flex-1 truncate font-mono text-xs text-fg-secondary" title={mint}>
              {mint}
            </span>
            <button
              type="button"
              aria-label="Copy contract address"
              className="shrink-0 text-fg-muted transition-colors hover:text-fg-primary"
              onClick={() => {
                void navigator.clipboard.writeText(mint).then(
                  () => toastCopied(mint),
                  () => toastCopyFailed(),
                );
              }}
            >
              <Copy className="h-3.5 w-3.5 cursor-pointer" strokeWidth={2} />
            </button>
            <a
              href={explorerTokenHrefFromMint(mint, activeChain)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={explorerTokenAriaLabel(activeChain)}
              className="shrink-0 text-fg-muted transition-colors hover:text-fg-primary"
            >
              <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
            </a>
          </div>
        </div>
      </div>

    </div>
    <MultiWalletBuySettingsModal
      open={multiWalletBuySettingsOpen}
      onClose={() => setMultiWalletBuySettingsOpen(false)}
      selectedWalletCount={selectedWalletAddresses.length}
    />
    </>
  );
}
