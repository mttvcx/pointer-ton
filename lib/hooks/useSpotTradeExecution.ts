'use client';

import { useCallback, useMemo } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useWallets as usePrivySolWallets } from '@privy-io/react-auth/solana';
import type { MyWalletRow } from '@/lib/hooks/useActiveSolanaWallet';
import { useActiveSolanaWallet } from '@/lib/hooks/useActiveSolanaWallet';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePointerTradeSubmit } from '@/lib/hooks/usePointerTradeSubmit';
import type { TradeQuoteApiOk } from '@/lib/trading/quoteTypes';
import { toast } from 'sonner';
import { DEFAULT_SLIPPAGE_BPS } from '@/lib/utils/constants';
import { buildBlitzAwareFees, isBlitzWallet } from '@/lib/trading/blitz';
import { mevModeToLanding, type MevMode } from '@/lib/trading/mevMode';
import { nativeTicker } from '@/lib/chains/nativeCurrency';
import {
  walletConnectRequiredMessage,
  viewOnlyWalletTradeMessage,
} from '@/lib/trading/walletConnectCopy';
import type { AppChainId } from '@/lib/chains/appChain';
import { recordUserTradeActivity } from '@/lib/alerts/recordUserTradeActivity';
import { isSandboxMode } from '@/lib/sandbox/mode';
import { sandboxBuy, sandboxSellPct, sandboxSellSolOut } from '@/lib/sandbox/trade';
import { formatNumber } from '@/lib/utils/formatters';
import { useTradingStore, type PresetSlot } from '@/store/trading';
import { useUIStore } from '@/store/ui';
import {
  buyQuoteAmountFields,
  spendAssetLabel,
  type SolSpendAsset,
} from '@/lib/trading/spendAsset';
import { USDC_MINT } from '@/lib/utils/addresses';
import { invalidateTokenDeskAfterTrade } from '@/lib/client/tokenDeskRefresh';
import { useDeskWalletStats } from '@/lib/hooks/useDeskWalletStats';
import { computeDeskWalletDisplayStats } from '@/lib/trading/deskWalletDisplayStats';
import {
  founderBetaMobileTradeMessage,
  isFounderBetaMobileTradeBlocked,
} from '@/lib/beta/founderBetaClient';
import {
  addInstantTradeCostBasisTon,
  clearInstantTradeCostBasisTon,
  readInstantTradeCostBasisTon,
} from '@/lib/trading/instantTradeCostBasis';
import {
  addInstantTradeBuyTon,
  addInstantTradeSellTon,
  readInstantTradeLifetimeStats,
} from '@/lib/trading/instantTradeStats';

function chainFromQuote(ok: TradeQuoteApiOk, fallback: AppChainId): AppChainId {
  return ok.chain === 'sol' || ok.chain === 'ton' ? ok.chain : fallback;
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


/** `pct` is a percent of balance (0.5 = 0.5%, 100 = 100%). Uses balance * pct / 100 in integer math. */
export function tokenRawForSellPct(balanceRaw: string, pct: number): string | null {
  const bal = BigInt(balanceRaw === '' ? '0' : balanceRaw);
  if (bal <= 0n) return null;
  const bps = Math.round(pct * 100);
  const portion = (bal * BigInt(bps)) / 10000n;
  if (portion <= 0n) return null;
  return String(portion);
}

export function useSpotTradeExecution(
  mint: string,
  opts?: { decimals?: number; priceUsd?: number | null },
) {
  const activeChain = useUIStore((s) => s.activeChain);
  const { getAccessToken, authenticated } = usePointerAuth();
  const qc = useQueryClient();
  const { submitFromQuote } = usePointerTradeSubmit();
  const activePresetSlot = useTradingStore((s) => s.activePresetSlot);
  const spendAsset = useTradingStore((s) => s.spendAsset);
  const setSpendAsset = useTradingStore((s) => s.setSpendAsset);
  const blitzWalletAddresses = useTradingStore((s) => s.blitzWalletAddresses);

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

  const { wallet, wallets, ready: walletsReady, activeAddress, setActiveWalletAddress } =
    useActiveSolanaWallet(myWalletsQ.data?.wallets);

  const { wallets: privySolWallets } = usePrivySolWallets();

  const signingWalletAddresses = useMemo(() => {
    if (activeChain === 'sol') {
      const s = new Set<string>();
      for (const pw of privySolWallets) {
        try {
          s.add(new PublicKey(pw.address).toBase58());
        } catch {
          s.add(pw.address);
        }
      }
      for (const row of myWalletsQ.data?.wallets ?? []) {
        if (row.is_imported || !row.is_active || row.is_archived) continue;
        try {
          s.add(new PublicKey(row.wallet_address.trim()).toBase58());
        } catch {
          /* skip invalid */
        }
      }
      return s;
    }
    return new Set(wallets.map((w) => w.address));
  }, [activeChain, privySolWallets, myWalletsQ.data?.wallets, wallets]);

  const activeWalletRow = useMemo(
    () => myWalletsQ.data?.wallets.find((w) => w.wallet_address === wallet?.address),
    [myWalletsQ.data?.wallets, wallet?.address],
  );

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

  const { data: usdcBalanceData, refetch: refetchUsdcBalance } = useQuery({
    queryKey: ['trade-balance-usdc', wallet?.address],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const res = await fetch(
        `/api/trade/balance?mint=${encodeURIComponent(USDC_MINT)}&wallet=${encodeURIComponent(wallet!.address)}`,
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
      return json as { rawAmount: string; decimals?: number };
    },
    enabled: Boolean(activeChain === 'sol' && walletsReady && wallet?.address),
    staleTime: 10_000,
  });

  const usdcBalanceRaw = usdcBalanceData?.rawAmount ?? '0';

  const costBasisTonSol = useMemo(() => {
    if (!wallet?.address) return 0;
    return readInstantTradeCostBasisTon(mint, wallet.address);
  }, [mint, wallet?.address, balanceRaw]);

  const lifetimeStats = useMemo(() => {
    if (!wallet?.address) return { buyTon: 0, sellTon: 0 };
    return readInstantTradeLifetimeStats(mint, wallet.address);
  }, [mint, wallet?.address, balanceRaw]);

  const { data: deskStats } = useDeskWalletStats(mint, wallet?.address);

  const { data: solUsdRate } = useQuery({
    queryKey: ['portfolio-sol-usd'],
    queryFn: async () => {
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

  const tradeDeskStats = useMemo(
    () =>
      computeDeskWalletDisplayStats({
        session: lifetimeStats,
        desk: deskStats,
        solUsdRate: solUsdRate ?? null,
        priceUsd: opts?.priceUsd,
        balanceRaw,
        decimals: opts?.decimals,
      }),
    [
      lifetimeStats,
      deskStats,
      solUsdRate,
      opts?.priceUsd,
      balanceRaw,
      opts?.decimals,
    ],
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

  const effectiveSlippageBps = activePreset?.slippage_bps ?? DEFAULT_SLIPPAGE_BPS;
  const dynamicSlippage = activePreset?.dynamic_slippage ?? true;
  const landing = mevModeToLanding(activePreset?.mev_mode ?? 'off');

  const runBuy = useCallback(
    async (amount: number, spendAssetOverride?: SolSpendAsset) => {
      if (isFounderBetaMobileTradeBlocked()) {
        toast.error('Desktop-only beta', { description: founderBetaMobileTradeMessage() });
        return;
      }
      // SANDBOX: route to the fake executor before ANY live quote/sign/execute.
      if (isSandboxMode()) {
        const res = sandboxBuy({ mint, amountSol: amount });
        if (res.ok) {
          toast.success('SANDBOX buy filled', {
            description: `${res.tx.hash.slice(0, 18)}… · fake fill, no real funds`,
          });
        } else {
          toast.error('SANDBOX buy failed', { description: res.error });
        }
        return;
      }
      const asset: SolSpendAsset =
        spendAssetOverride ?? (activeChain === 'sol' ? spendAsset : 'sol');
      if (!wallet) {
        toast.error(walletConnectRequiredMessage(activeChain));
        return;
      }
      if (activeWalletRow?.is_imported === true) {
        toast.error('View-only wallet', {
          description: viewOnlyWalletTradeMessage(activeChain),
        });
        return;
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        toast.error('Invalid amount');
        return;
      }
      const token = await getAccessToken();
      if (!token) {
        toast.error('Sign in required');
        return;
      }

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

      const toastId = toast.loading('Buy: quote...');
      try {
        const res = await fetch('/api/trade/quote', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            mint,
            side: 'buy' as const,
            userPublicKey: wallet.address,
            ...buyQuoteAmountFields(asset, amount),
            slippageBps: effectiveSlippageBps,
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

        toast.loading('Buy: sign in wallet...', { id: toastId });
        const { signature: sig } = await submitFromQuote({
          quote: ok,
          walletAddress: wallet.address,
          mint,
          getAccessToken,
        });

        toast.success('Buy complete', {
          id: toastId,
          description: sig ? `${sig.slice(0, 8)}...` : undefined,
        });
        const cr = chainFromQuote(ok, activeChain);
        const sym = spendAssetLabel(asset);
        const narration = `Bought ${formatNumber(amount, { decimals: asset === 'usdc' ? 2 : 4 })} ${sym} · trade panel.`;
        void (async () => {
          const tok = await getAccessToken();
          if (!tok) return;
          const posted = await recordUserTradeActivity(tok, narration, {
            kind: 'spot_buy',
            mint,
            chain: cr,
            amountSol: asset === 'sol' ? amount : undefined,
            txSignature: sig ?? null,
          });
          if (posted) void qc.invalidateQueries({ queryKey: ['alerts-ticker'] });
        })();
        if (asset === 'sol') {
          addInstantTradeCostBasisTon(mint, wallet.address, amount);
          addInstantTradeBuyTon(mint, wallet.address, amount);
        }
        void refetchBalance();
        void refetchUsdcBalance();
        void qc.invalidateQueries({ queryKey: ['wallets-my'] });
        invalidateTokenDeskAfterTrade(qc, mint, {
          walletAddress: wallet.address,
          reason: 'spot_trade',
        });
      } catch (e) {
        toast.dismiss(toastId);
        const msg = e instanceof Error ? e.message : 'Trade failed';
        toast.error('Buy failed', { description: msg.slice(0, 200) });
      }
    },
    [
      wallet,
      activeWalletRow?.is_imported,
      activeChain,
      spendAsset,
      getAccessToken,
      mint,
      effectiveSlippageBps,
      dynamicSlippage,
      landing,
      activePreset,
      submitFromQuote,
      refetchBalance,
      refetchUsdcBalance,
      qc,
    ],
  );

  const runSell = useCallback(
    async (sellPct: number) => {
      if (isFounderBetaMobileTradeBlocked()) {
        toast.error('Desktop-only beta', { description: founderBetaMobileTradeMessage() });
        return;
      }
      if (isSandboxMode()) {
        const res = sandboxSellPct({ mint, pct: sellPct });
        if (res.ok) {
          toast.success('SANDBOX sell filled', {
            description: `PnL ${res.realizedPnlSol >= 0 ? '+' : ''}${res.realizedPnlSol.toFixed(4)} SOL · fake`,
          });
        } else {
          toast.error('SANDBOX sell failed', { description: res.error });
        }
        return;
      }
      if (!wallet) {
        toast.error(walletConnectRequiredMessage(activeChain));
        return;
      }
      if (activeWalletRow?.is_imported === true) {
        toast.error('View-only wallet', {
          description: viewOnlyWalletTradeMessage(activeChain),
        });
        return;
      }
      const amountTokenRaw = tokenRawForSellPct(balanceRaw, sellPct);
      if (!amountTokenRaw) {
        toast.error('No tokens to sell', {
          description: 'Zero balance for this mint.',
        });
        return;
      }
      const token = await getAccessToken();
      if (!token) {
        toast.error('Sign in required');
        return;
      }

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

      const toastId = toast.loading('Sell: quote...');
      try {
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
            slippageBps: effectiveSlippageBps,
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

        toast.loading('Sell: sign in wallet...', { id: toastId });
        const { signature: sig } = await submitFromQuote({
          quote: ok,
          walletAddress: wallet.address,
          mint,
          getAccessToken,
        });

        toast.success('Sell complete', {
          id: toastId,
          description: sig ? `${sig.slice(0, 8)}...` : undefined,
        });
        const crS = chainFromQuote(ok, activeChain);
        const narrS = `Sold ${formatNumber(sellPct, { decimals: 0 })}% · trade panel.`;
        void (async () => {
          const tok = await getAccessToken();
          if (!tok) return;
          const estS =
            typeof ok.summary.amountSolEstimate === 'number' && Number.isFinite(ok.summary.amountSolEstimate)
              ? Math.max(0, ok.summary.amountSolEstimate)
              : undefined;
          const posted = await recordUserTradeActivity(tok, narrS, {
            kind: 'spot_sell_pct',
            mint,
            chain: crS,
            sellPct,
            amountSol: estS,
            txSignature: sig ?? null,
          });
          if (posted) void qc.invalidateQueries({ queryKey: ['alerts-ticker'] });
        })();
        const estOut =
          typeof ok.summary.amountSolEstimate === 'number' && Number.isFinite(ok.summary.amountSolEstimate)
            ? Math.max(0, ok.summary.amountSolEstimate)
            : 0;
        if (estOut > 0) addInstantTradeSellTon(mint, wallet.address, estOut);
        void refetchBalance();
        void qc.invalidateQueries({ queryKey: ['wallets-my'] });
        invalidateTokenDeskAfterTrade(qc, mint, {
          walletAddress: wallet.address,
          reason: 'spot_trade',
        });
      } catch (e) {
        toast.dismiss(toastId);
        const msg = e instanceof Error ? e.message : 'Trade failed';
        toast.error('Sell failed', { description: msg.slice(0, 200) });
      }
    },
    [
      wallet,
      activeWalletRow?.is_imported,
      activeChain,
      balanceRaw,
      getAccessToken,
      mint,
      effectiveSlippageBps,
      dynamicSlippage,
      landing,
      activePreset,
      submitFromQuote,
      refetchBalance,
      qc,
    ],
  );

  const runSellSolOut = useCallback(
    async (amountSolOut: number, opts?: { clearCostBasis?: boolean }) => {
      if (isFounderBetaMobileTradeBlocked()) {
        toast.error('Desktop-only beta', { description: founderBetaMobileTradeMessage() });
        return;
      }
      if (isSandboxMode()) {
        const res = sandboxSellSolOut({ mint, amountSolOut });
        if (res.ok) {
          toast.success('SANDBOX sell filled', {
            description: `PnL ${res.realizedPnlSol >= 0 ? '+' : ''}${res.realizedPnlSol.toFixed(4)} SOL · fake`,
          });
        } else {
          toast.error('SANDBOX sell failed', { description: res.error });
        }
        return;
      }
      if (!wallet) {
        toast.error(walletConnectRequiredMessage(activeChain));
        return;
      }
      if (activeWalletRow?.is_imported === true) {
        toast.error('View-only wallet', {
          description: viewOnlyWalletTradeMessage(activeChain),
        });
        return;
      }
      if (!Number.isFinite(amountSolOut) || amountSolOut <= 0) {
        toast.error('Invalid amount');
        return;
      }
      const token = await getAccessToken();
      if (!token) {
        toast.error('Sign in required');
        return;
      }

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

      const toastId = toast.loading('Sell: quote...');
      try {
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
            amountSolOut,
            slippageBps: effectiveSlippageBps,
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

        toast.loading('Sell: sign in wallet...', { id: toastId });
        const { signature: sig } = await submitFromQuote({
          quote: ok,
          walletAddress: wallet.address,
          mint,
          getAccessToken,
        });

        toast.success('Sell complete', {
          id: toastId,
          description: sig ? `${sig.slice(0, 8)}...` : undefined,
        });
        const crSo = chainFromQuote(ok, activeChain);
        const symSo = nativeTicker(crSo);
        void (async () => {
          const tok = await getAccessToken();
          if (!tok) return;
          const estOutN =
            typeof ok.summary.amountSolEstimate === 'number' && Number.isFinite(ok.summary.amountSolEstimate)
              ? Math.max(0, ok.summary.amountSolEstimate)
              : amountSolOut;
          const narrSo = `Sold for ~${formatNumber(estOutN, { decimals: 4 })} ${symSo} · trade panel (fixed out).`;
          const posted = await recordUserTradeActivity(tok, narrSo, {
            kind: 'spot_sell_sol_out',
            mint,
            chain: crSo,
            amountSol: estOutN,
            txSignature: sig ?? null,
          });
          if (posted) void qc.invalidateQueries({ queryKey: ['alerts-ticker'] });
        })();
        const estOut =
          typeof ok.summary.amountSolEstimate === 'number' && Number.isFinite(ok.summary.amountSolEstimate)
            ? Math.max(0, ok.summary.amountSolEstimate)
            : amountSolOut;
        if (estOut > 0) addInstantTradeSellTon(mint, wallet.address, estOut);
        if (opts?.clearCostBasis && wallet?.address) {
          clearInstantTradeCostBasisTon(mint, wallet.address);
        }
        void refetchBalance();
        void qc.invalidateQueries({ queryKey: ['wallets-my'] });
        invalidateTokenDeskAfterTrade(qc, mint, {
          walletAddress: wallet.address,
          reason: 'spot_trade',
        });
      } catch (e) {
        toast.dismiss(toastId);
        const msg = e instanceof Error ? e.message : 'Trade failed';
        toast.error('Sell failed', { description: msg.slice(0, 200) });
      }
    },
    [
      wallet,
      activeWalletRow?.is_imported,
      activeChain,
      getAccessToken,
      mint,
      effectiveSlippageBps,
      dynamicSlippage,
      landing,
      activePreset,
      submitFromQuote,
      refetchBalance,
      qc,
    ],
  );

  const runSellInitial = useCallback(async () => {
    if (isSandboxMode()) {
      await runSell(100);
      return;
    }
    if (!wallet?.address) {
      toast.error(walletConnectRequiredMessage(activeChain));
      return;
    }
    const basis = readInstantTradeCostBasisTon(mint, wallet.address);
    if (!Number.isFinite(basis) || basis <= 0) {
      toast.error('No tracked principal', {
        description: 'Buy from this panel first — we track your TON in for Sell Init.',
      });
      return;
    }
    await runSellSolOut(basis, { clearCostBasis: true });
  }, [mint, wallet?.address, runSellSolOut, runSell, activeChain]);

  return {
    wallet,
    walletsReady,
    authenticated,
    balanceRaw,
    refetchBalance,
    activePreset,
    effectiveSlippageBps,
    dynamicSlippage,
    landing,
    runBuy,
    runSell,
    runSellSolOut,
    runSellInitial,
    costBasisTonSol,
    lifetimeStats,
    tradeDeskStats,
    spendAsset,
    setSpendAsset,
    usdcBalanceRaw,
    walletRows: myWalletsQ.data?.wallets,
    activeWalletAddress: activeAddress,
    setActiveWalletAddress,
    signingWalletAddresses,
  };
}
