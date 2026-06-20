'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import type { AppChainId } from '@/lib/chains/appChain';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { usePointerTradeSubmit } from '@/lib/hooks/usePointerTradeSubmit';
import { tokenRawForSellPct } from '@/lib/hooks/useSpotTradeExecution';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { MyWalletRow } from '@/lib/hooks/useActiveSolanaWallet';
import { useActiveSolanaWallet } from '@/lib/hooks/useActiveSolanaWallet';
import type { TradeQuoteApiOk } from '@/lib/trading/quoteTypes';
import { addInstantTradeSellTon } from '@/lib/trading/instantTradeStats';
import { recordUserTradeActivity } from '@/lib/alerts/recordUserTradeActivity';
import { isSandboxMode } from '@/lib/sandbox/mode';
import {
  founderBetaMobileTradeMessage,
  isFounderBetaMobileTradeBlocked,
} from '@/lib/beta/founderBetaClient';
import { sandboxBuy, sandboxSellPct } from '@/lib/sandbox/trade';
import { addInstantTradeBuyTon } from '@/lib/trading/instantTradeStats';
import { DEFAULT_SLIPPAGE_BPS } from '@/lib/utils/constants';
import { formatNumber } from '@/lib/utils/formatters';
import { buildBlitzAwareFees, isBlitzWallet } from '@/lib/trading/blitz';
import { mevModeToLanding, type MevMode } from '@/lib/trading/mevMode';
import {
  viewOnlyWalletTradeMessage,
  walletConnectRequiredMessage,
  walletConnectRequiredTitle,
} from '@/lib/trading/walletConnectCopy';
import { isTradableAppChain } from '@/lib/chains/mintKind';
import { useTradingStore, type PresetSlot } from '@/store/trading';
import { useShallow } from 'zustand/react/shallow';
import { useUIStore } from '@/store/ui';
import { invalidateTokenDeskAfterTrade } from '@/lib/client/tokenDeskRefresh';
import {
  buyQuoteAmountFields,
  spendAssetLabel,
  type SolSpendAsset,
} from '@/lib/trading/spendAsset';

export type QuickBuyResult =
  | { ok: true; signature: string | null }
  | { ok: false; error: string };

type BuyTokenOptions = { silent?: boolean; spendAsset?: SolSpendAsset };
type SellTokenOptions = { silent?: boolean };

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

type QueueJob =
  | {
      kind: 'buy';
      mint: string;
      amount: number;
      opts?: BuyTokenOptions;
      resolve: (r: QuickBuyResult | void) => void;
    }
  | {
      kind: 'sell';
      mint: string;
      sellPct: number;
      opts?: SellTokenOptions;
      resolve: (r: QuickBuyResult | void) => void;
    };

/**
 * Quote → sign → execute for Pulse row quick-buy.
 * Clicks enqueue instantly; trades drain FIFO one at a time (spam-friendly).
 */
export function usePulseQuickBuy() {
  const { getAccessToken, authenticated } = usePointerAuth();
  const qc = useQueryClient();
  const activeChain = useUIStore((s) => s.activeChain);
  const { submitFromQuote } = usePointerTradeSubmit();
  const { activePresetSlot, spendAsset, blitzWalletAddresses } = useTradingStore(
    useShallow((s) => ({
      activePresetSlot: s.activePresetSlot,
      spendAsset: s.spendAsset,
      blitzWalletAddresses: s.blitzWalletAddresses,
    })),
  );
  const [activeMint, setActiveMint] = useState<string | null>(null);
  const [queueSize, setQueueSize] = useState(0);

  const queueRef = useRef<QueueJob[]>([]);
  const drainingRef = useRef(false);
  // Depth-1 quote prefetch: while one buy signs, the next queued buy's quote is
  // warmed here so spam-buys don't each pay the ~300-800ms quote round-trip.
  // Keyed by mint:amount:asset; short TTL; falls back to a fresh fetch on miss.
  const quoteCacheRef = useRef<Map<string, { quote: TradeQuoteApiOk; at: number }>>(new Map());
  const QUOTE_PREFETCH_TTL_MS = 8_000;

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

  const { wallet, ready: walletsReady } = useActiveSolanaWallet(myWalletsQ.data?.wallets);

  const activeWalletRow = useMemo(
    () => myWalletsQ.data?.wallets.find((w) => w.wallet_address === wallet?.address),
    [myWalletsQ.data?.wallets, wallet?.address],
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

  const quoteKey = useCallback(
    (mint: string, amount: number, asset: SolSpendAsset) => `${mint}:${amount}:${asset}`,
    [],
  );

  /**
   * Build + fetch a buy quote (with the active preset's slippage / landing /
   * fees). Identical logic for the live path and the prefetch, so a prefetched
   * quote is byte-for-byte what an on-demand fetch would have produced.
   */
  const fetchBuyQuote = useCallback(
    async (
      mint: string,
      amount: number,
      asset: SolSpendAsset,
      token: string,
    ): Promise<TradeQuoteApiOk> => {
      const slippageBps = activePreset?.slippage_bps ?? DEFAULT_SLIPPAGE_BPS;
      const dynamicSlippage = activePreset?.dynamic_slippage ?? true;
      const baseLanding = mevModeToLanding(activePreset?.mev_mode ?? 'reduced');
      const blitzOn = isBlitzWallet(wallet!.address, blitzWalletAddresses);
      const presetFees =
        activePreset != null
          ? {
              jitoTipLamports: activePreset.jito_tip_lamports,
              priorityFeeLamports: activePreset.priority_fee_lamports,
              autoFee: activePreset.auto_fee,
              maxFeeSol: activePreset.max_fee_sol,
              landing: baseLanding,
            }
          : { landing: baseLanding };
      const { fees: feeExtra, landing: blitzLanding } = buildBlitzAwareFees(blitzOn, presetFees);
      const tradeLanding = blitzLanding ?? baseLanding;

      const res = await fetch('/api/trade/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          mint,
          side: 'buy' as const,
          userPublicKey: wallet!.address,
          ...buyQuoteAmountFields(asset, amount),
          slippageBps,
          dynamicSlippage,
          landing: tradeLanding,
          includeSwapTx: true,
          ...feeExtra,
        }),
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
      if (!executable) throw new Error('No swap transaction from quote');
      return ok;
    },
    [activePreset, wallet, blitzWalletAddresses],
  );

  /** Use a fresh, matching prefetched quote if present; otherwise fetch fresh. */
  const getOrFetchBuyQuote = useCallback(
    async (
      mint: string,
      amount: number,
      asset: SolSpendAsset,
      token: string,
    ): Promise<TradeQuoteApiOk> => {
      const key = quoteKey(mint, amount, asset);
      const cached = quoteCacheRef.current.get(key);
      quoteCacheRef.current.delete(key);
      if (
        cached &&
        Date.now() - cached.at < QUOTE_PREFETCH_TTL_MS &&
        cached.quote.mint === mint
      ) {
        return cached.quote;
      }
      return fetchBuyQuote(mint, amount, asset, token);
    },
    [fetchBuyQuote, quoteKey],
  );

  /** Best-effort warm the next queued buy's quote while the current one signs. */
  const prefetchBuyQuote = useCallback(
    async (mint: string, amount: number, asset: SolSpendAsset) => {
      if (!wallet || !Number.isFinite(amount) || amount <= 0) return;
      const key = quoteKey(mint, amount, asset);
      if (quoteCacheRef.current.has(key)) return;
      try {
        const token = await getAccessToken();
        if (!token) return;
        const quote = await fetchBuyQuote(mint, amount, asset, token);
        quoteCacheRef.current.set(key, { quote, at: Date.now() });
      } catch {
        /* prefetch is best-effort — the live fetch will retry on demand */
      }
    },
    [wallet, getAccessToken, fetchBuyQuote, quoteKey],
  );

  const executeBuy = useCallback(
    async (
      mint: string,
      amount: number,
      opts?: BuyTokenOptions,
    ): Promise<QuickBuyResult | void> => {
      const silent = Boolean(opts?.silent);
      const asset: SolSpendAsset =
        opts?.spendAsset ?? (activeChain === 'sol' ? spendAsset : 'sol');
      const fail = (error: string): QuickBuyResult => {
        if (!silent) {
          toast.error('Quick buy failed', { description: error.slice(0, 200) });
        }
        return { ok: false, error };
      };

      if (isFounderBetaMobileTradeBlocked()) {
        return fail(founderBetaMobileTradeMessage());
      }

      // SANDBOX: fake fill before ANY live quote/sign/execute (covers manual
      // quick-buy AND silent auto-buy callers).
      if (isSandboxMode()) {
        const res = sandboxBuy({ mint, amountSol: amount, source: silent ? 'autobuy' : 'manual' });
        if (res.ok) {
          if (!silent) {
            toast.success('SANDBOX buy filled', {
              description: `${res.tx.hash.slice(0, 18)}… · fake fill`,
            });
          }
          return { ok: true, signature: res.tx.hash };
        }
        if (!silent) toast.error('SANDBOX buy failed', { description: res.error });
        return { ok: false, error: res.error };
      }

      if (!walletsReady || !wallet) {
        return fail(walletConnectRequiredMessage(activeChain));
      }
      if (activeWalletRow?.is_imported === true) {
        return fail('View-only wallet — use a linked trading wallet.');
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        const sym = spendAssetLabel(asset);
        return fail(`Invalid amount — set a positive ${sym} amount.`);
      }
      const token = await getAccessToken();
      if (!token) {
        return fail('Sign in required.');
      }

      const toastId = silent ? undefined : toast.loading('Getting quote...');
      const __t0 = performance.now();
      try {
        // Uses a warm prefetched quote when the queue had one ready, else fetches.
        const ok = await getOrFetchBuyQuote(mint, amount, asset, token);
        const __tQuote = performance.now();

        if (!silent && toastId) toast.loading('Sign in wallet...', { id: toastId });
        const { signature: sig } = await submitFromQuote({
          quote: ok,
          walletAddress: wallet.address,
          mint,
          getAccessToken,
        });
        const __tDone = performance.now();
        const __q = Math.round(__tQuote - __t0);
        const __se = Math.round(__tDone - __tQuote);
        const __total = Math.round(__tDone - __t0);
        // Execution telemetry — read in DevTools console or off the toast.
        // quote≈0 means a prefetched quote was used (warm path).
        // eslint-disable-next-line no-console
        console.log(
          `[pointer-speed] BUY total=${__total}ms quote=${__q}ms sign+exec=${__se}ms ${__q < 40 ? '(prefetched)' : '(cold quote)'} mint=${mint.slice(0, 8)} amt=${amount}`,
        );

        if (!silent && toastId) {
          toast.success(`Filled in ${__total}ms`, {
            id: toastId,
            description: `quote ${__q}ms · sign+exec ${__se}ms${sig ? ` · ${sig.slice(0, 6)}…` : ''}`,
          });
        }
        const chainRes: AppChainId = ok.chain === 'sol' || ok.chain === 'ton' ? ok.chain : activeChain;
        const sym = spendAssetLabel(asset);
        const narration = silent
          ? `Auto-buy ${formatNumber(amount, { decimals: asset === 'usdc' ? 2 : 4 })} ${sym} · ${mint.slice(0, 8)}…`
          : `Bought ${formatNumber(amount, { decimals: asset === 'usdc' ? 2 : 4 })} ${sym} · Pulse quick buy.`;
        void (async () => {
          const t = await getAccessToken();
          if (!t) return;
          const posted = await recordUserTradeActivity(t, narration, {
            kind: silent ? 'auto_buy' : 'pulse_quick_buy',
            mint,
            chain: chainRes,
            amountSol: asset === 'sol' ? amount : undefined,
            txSignature: sig ?? null,
          });
          if (posted) void qc.invalidateQueries({ queryKey: ['alerts-ticker'] });
        })();
        void qc.invalidateQueries({ queryKey: ['wallets-my'] });
        invalidateTokenDeskAfterTrade(qc, mint, {
          walletAddress: wallet.address,
          reason: silent ? 'pulse_auto_buy' : 'pulse_quick_buy',
        });
        if (asset === 'sol') {
          addInstantTradeBuyTon(mint, wallet.address, amount);
        }
        if (silent) return { ok: true, signature: sig ?? null };
      } catch (e) {
        if (!silent && toastId) toast.dismiss(toastId);
        const msg = e instanceof Error ? e.message : 'Trade failed';
        if (silent) return { ok: false, error: msg };
        toast.error('Quick buy failed', { description: msg.slice(0, 200) });
      }
    },
    [
      walletsReady,
      wallet,
      activeWalletRow?.is_imported,
      getAccessToken,
      getOrFetchBuyQuote,
      submitFromQuote,
      qc,
      activeChain,
      spendAsset,
    ],
  );

  const executeSell = useCallback(
    async (
      mint: string,
      sellPct: number,
      options?: SellTokenOptions,
    ): Promise<QuickBuyResult | void> => {
      const silent = options?.silent === true;
      const fail = (error: string): QuickBuyResult => ({ ok: false, error });

      // SANDBOX: fake sell before ANY live quote/sign/execute.
      if (isSandboxMode()) {
        const res = sandboxSellPct({ mint, pct: sellPct });
        if (res.ok) {
          if (!silent) {
            toast.success('SANDBOX sell filled', {
              description: `PnL ${res.realizedPnlSol >= 0 ? '+' : ''}${res.realizedPnlSol.toFixed(4)} SOL · fake`,
            });
          }
          return { ok: true, signature: res.tx.hash };
        }
        if (!silent) toast.error('SANDBOX sell failed', { description: res.error });
        return { ok: false, error: res.error };
      }

      if (!walletsReady || !wallet) {
        if (!silent) {
          toast.error(walletConnectRequiredTitle(activeChain), {
            description: walletConnectRequiredMessage(activeChain),
          });
        }
        return silent ? fail('Wallet not connected') : undefined;
      }
      if (activeWalletRow?.is_imported === true) {
        if (!silent) {
          toast.error('View-only wallet', {
            description: viewOnlyWalletTradeMessage(activeChain),
          });
        }
        return silent ? fail('View-only wallet') : undefined;
      }
      if (!Number.isFinite(sellPct) || sellPct <= 0 || sellPct > 100) {
        if (!silent) toast.error('Invalid sell %');
        return silent ? fail('Invalid sell %') : undefined;
      }
      const token = await getAccessToken();
      if (!token) {
        if (!silent) {
          toast.error('Sign in required', { description: 'Log in to quick sell.' });
        }
        return silent ? fail('Sign in required') : undefined;
      }

      const toastId = silent ? undefined : toast.loading('Sell: quote...');
      const __t0 = performance.now();
      try {
        const balRes = await fetch(
          `/api/trade/balance?mint=${encodeURIComponent(mint)}&wallet=${encodeURIComponent(wallet.address)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const balJson: unknown = await balRes.json();
        if (!balRes.ok) {
          const msg =
            typeof balJson === 'object' && balJson && 'message' in balJson
              ? String((balJson as { message: unknown }).message)
              : balRes.statusText;
          throw new Error(msg);
        }
        const rawAmount =
          typeof balJson === 'object' && balJson && 'rawAmount' in balJson
            ? String((balJson as { rawAmount: unknown }).rawAmount)
            : '0';
        const amountTokenRaw = tokenRawForSellPct(rawAmount, sellPct);
        if (!amountTokenRaw) {
          if (!silent && toastId) toast.dismiss(toastId);
          return fail('No tokens to sell — zero balance.');
        }

        const slippageBps = activePreset?.slippage_bps ?? DEFAULT_SLIPPAGE_BPS;
        const dynamicSlippage = activePreset?.dynamic_slippage ?? true;
        const baseLanding = mevModeToLanding(activePreset?.mev_mode ?? 'reduced');
        const blitzOn = isBlitzWallet(wallet.address, blitzWalletAddresses);
        const presetFees =
          activePreset != null
            ? {
                jitoTipLamports: activePreset.jito_tip_lamports,
                priorityFeeLamports: activePreset.priority_fee_lamports,
                autoFee: activePreset.auto_fee,
                maxFeeSol: activePreset.max_fee_sol,
                landing: baseLanding,
              }
            : { landing: baseLanding };
        const { fees: feeExtra, landing: blitzLanding } = buildBlitzAwareFees(blitzOn, presetFees);
        const tradeLanding = blitzLanding ?? baseLanding;

        const res = await fetch('/api/trade/quote', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            mint,
            side: 'sell' as const,
            userPublicKey: wallet.address,
            amountTokenRaw,
            slippageBps,
            dynamicSlippage,
            landing: tradeLanding,
            includeSwapTx: true,
            ...feeExtra,
          }),
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

        const __tQuote = performance.now();
        if (!silent && toastId) toast.loading('Sell: sign in wallet...', { id: toastId });
        const { signature: sig } = await submitFromQuote({
          quote: ok,
          walletAddress: wallet.address,
          mint,
          getAccessToken,
        });
        const __tDone = performance.now();
        const __q = Math.round(__tQuote - __t0);
        const __se = Math.round(__tDone - __tQuote);
        const __total = Math.round(__tDone - __t0);
        // eslint-disable-next-line no-console
        console.log(
          `[pointer-speed] SELL total=${__total}ms quote+bal=${__q}ms sign+exec=${__se}ms mint=${mint.slice(0, 8)} pct=${sellPct}`,
        );

        if (!silent && toastId) {
          toast.success(`Sold in ${__total}ms`, {
            id: toastId,
            description: `quote+bal ${__q}ms · sign+exec ${__se}ms${sig ? ` · ${sig.slice(0, 6)}…` : ''}`,
          });
        }
        const chainResSell: AppChainId = ok.chain === 'sol' || ok.chain === 'ton' ? ok.chain : activeChain;
        const narrSell = silent
          ? `Auto-sell ${formatNumber(sellPct, { decimals: 0 })}% · ${mint.slice(0, 8)}…`
          : `Sold ${formatNumber(sellPct, { decimals: 0 })}% of balance · Pulse quick sell.`;
        void (async () => {
          const t = await getAccessToken();
          if (!t) return;
          const est =
            typeof ok.summary.amountSolEstimate === 'number' && Number.isFinite(ok.summary.amountSolEstimate)
              ? Math.max(0, ok.summary.amountSolEstimate)
              : undefined;
          const posted = await recordUserTradeActivity(t, narrSell, {
            kind: silent ? 'auto_sell' : 'pulse_quick_sell',
            mint,
            chain: chainResSell,
            sellPct,
            amountSol: est,
            txSignature: sig ?? null,
          });
          if (posted) void qc.invalidateQueries({ queryKey: ['alerts-ticker'] });
        })();
        const estOut =
          typeof ok.summary.amountSolEstimate === 'number' && Number.isFinite(ok.summary.amountSolEstimate)
            ? Math.max(0, ok.summary.amountSolEstimate)
            : 0;
        if (estOut > 0) addInstantTradeSellTon(mint, wallet.address, estOut);
        void qc.invalidateQueries({ queryKey: ['wallets-my'] });
        invalidateTokenDeskAfterTrade(qc, mint, {
          walletAddress: wallet.address,
          reason: 'pulse_quick_sell',
        });
        if (silent) return { ok: true, signature: sig ?? null };
      } catch (e) {
        if (!silent && toastId) toast.dismiss(toastId);
        const msg = e instanceof Error ? e.message : 'Trade failed';
        if (silent) return { ok: false, error: msg };
        toast.error('Quick sell failed', { description: msg.slice(0, 200) });
      }
    },
    [
      walletsReady,
      wallet,
      activeWalletRow?.is_imported,
      getAccessToken,
      activePreset,
      submitFromQuote,
      qc,
      activeChain,
    ],
  );

  const drainQueue = useCallback(async () => {
    if (drainingRef.current) return;
    drainingRef.current = true;
    try {
      while (queueRef.current.length > 0) {
        const job = queueRef.current.shift()!;
        setQueueSize(queueRef.current.length);
        setActiveMint(job.mint);
        // Warm the NEXT buy's quote concurrently so spam-buys sign immediately.
        const next = queueRef.current[0];
        if (next && next.kind === 'buy') {
          const nextAsset: SolSpendAsset =
            next.opts?.spendAsset ?? (activeChain === 'sol' ? spendAsset : 'sol');
          void prefetchBuyQuote(next.mint, next.amount, nextAsset);
        }
        try {
          const result =
            job.kind === 'buy'
              ? await executeBuy(job.mint, job.amount, job.opts)
              : await executeSell(job.mint, job.sellPct, job.opts);
          job.resolve(result);
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Trade failed';
          job.resolve({ ok: false, error: msg });
        } finally {
          setActiveMint(null);
        }
      }
      setQueueSize(0);
    } finally {
      drainingRef.current = false;
    }
  }, [executeBuy, executeSell, prefetchBuyQuote, activeChain, spendAsset]);

  const enqueue = useCallback(
    (job: QueueJob) => {
      queueRef.current.push(job);
      setQueueSize(queueRef.current.length);
      void drainQueue();
    },
    [drainQueue],
  );

  const buyToken = useCallback(
    (mint: string, amount: number, opts?: BuyTokenOptions): Promise<QuickBuyResult | void> =>
      new Promise((resolve) => {
        enqueue({ kind: 'buy', mint, amount, opts, resolve });
      }),
    [enqueue],
  );

  const sellTokenPct = useCallback(
    (mint: string, sellPct: number, options?: SellTokenOptions): Promise<QuickBuyResult | void> =>
      new Promise((resolve) => {
        enqueue({ kind: 'sell', mint, sellPct, opts: options, resolve });
      }),
    [enqueue],
  );

  return {
    buyToken,
    sellTokenPct,
    /** Mint currently executing (not queued) — informational only. */
    busyMint: activeMint,
    queueSize,
    walletReady: walletsReady && !!wallet,
    canTrade: Boolean(
      wallet && !activeWalletRow?.is_imported && isTradableAppChain(activeChain),
    ),
    /** True when header chain has no swap backend (ETH/BNB/Base browse-only). */
    chainTradable: isTradableAppChain(activeChain),
  };
}
