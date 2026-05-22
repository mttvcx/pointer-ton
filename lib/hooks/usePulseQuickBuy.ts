'use client';

import { useCallback, useMemo, useState } from 'react';
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
import { DEFAULT_SLIPPAGE_BPS } from '@/lib/utils/constants';
import { formatNumber } from '@/lib/utils/formatters';
import { mevModeToLanding, type MevMode } from '@/lib/trading/mevMode';
import { nativeTicker } from '@/lib/chains/nativeCurrency';
import type { AppChainId } from '@/lib/chains/appChain';
import { useTradingStore, type PresetSlot } from '@/store/trading';
import { useUIStore } from '@/store/ui';
import { dispatchSolanaAccountRefresh } from '@/lib/client/portfolioRefreshEvents';
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

/**
 * Quote ? sign ? execute for Pulse row quick-buy (buy only).
 */
export function usePulseQuickBuy() {
  const { getAccessToken, authenticated } = usePointerAuth();
  const qc = useQueryClient();
  const activeChain = useUIStore((s) => s.activeChain);
  const { submitFromQuote } = usePointerTradeSubmit();
  const { activePresetSlot, spendAsset } = useTradingStore();
  const [busyMint, setBusyMint] = useState<string | null>(null);

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

  const buyToken = useCallback(
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

      if (!walletsReady || !wallet) {
        return fail('Connect wallet via TonConnect after sign-in.');
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

      const feeExtra =
        activePreset != null
          ? {
              jitoTipLamports: activePreset.jito_tip_lamports,
              priorityFeeLamports: activePreset.priority_fee_lamports,
              autoFee: activePreset.auto_fee,
              maxFeeSol: activePreset.max_fee_sol,
            }
          : {};

      const slippageBps = activePreset?.slippage_bps ?? DEFAULT_SLIPPAGE_BPS;
      const dynamicSlippage = activePreset?.dynamic_slippage ?? true;
      const landing = mevModeToLanding(activePreset?.mev_mode ?? 'reduced');

      setBusyMint(mint);
      const toastId = silent ? undefined : toast.loading('Getting quote...');
      try {
        const body = {
          mint,
          side: 'buy' as const,
          userPublicKey: wallet.address,
          ...buyQuoteAmountFields(asset, amount),
          slippageBps,
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
        const executable =
          ok.chain === 'sol'
            ? Boolean(ok.swapTransaction && ok.summary?.amountOutRaw != null)
            : Boolean(ok.tonConnect?.messages?.length && ok.summary?.amountOutRaw);
        if (!executable) {
          throw new Error('No swap transaction from quote');
        }

        if (!silent && toastId) toast.loading('Sign in wallet...', { id: toastId });
        const { signature: sig } = await submitFromQuote({
          quote: ok,
          walletAddress: wallet.address,
          mint,
          getAccessToken,
        });

        if (!silent && toastId) {
          toast.success('Buy complete', {
            id: toastId,
            description: sig ? `Signature: ${sig.slice(0, 8)}...` : undefined,
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
        dispatchSolanaAccountRefresh('pulse_quick_buy');
        if (silent) return { ok: true, signature: sig ?? null };
      } catch (e) {
        if (!silent && toastId) toast.dismiss(toastId);
        const msg = e instanceof Error ? e.message : 'Trade failed';
        if (silent) return { ok: false, error: msg };
        toast.error('Quick buy failed', { description: msg.slice(0, 200) });
      } finally {
        setBusyMint(null);
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
      spendAsset,
    ],
  );

  const sellTokenPct = useCallback(
    async (
      mint: string,
      sellPct: number,
      options?: SellTokenOptions,
    ): Promise<QuickBuyResult | void> => {
      const silent = options?.silent === true;
      const fail = (error: string): QuickBuyResult => ({ ok: false, error });

      if (!walletsReady || !wallet) {
        if (!silent) {
          toast.error('Connect TON wallet', { description: 'Use TonConnect after sign-in.' });
        }
        return silent ? fail('Wallet not connected') : undefined;
      }
      if (activeWalletRow?.is_imported === true) {
        if (!silent) {
          toast.error('View-only wallet', {
            description: 'Use a non-imported wallet linked in TonConnect to trade.',
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

      setBusyMint(mint);
      const toastId = silent ? undefined : toast.loading('Sell: quote...');
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

        const feeExtra =
          activePreset != null
            ? {
                jitoTipLamports: activePreset.jito_tip_lamports,
                priorityFeeLamports: activePreset.priority_fee_lamports,
                autoFee: activePreset.auto_fee,
                maxFeeSol: activePreset.max_fee_sol,
              }
            : {};

        const slippageBps = activePreset?.slippage_bps ?? DEFAULT_SLIPPAGE_BPS;
        const dynamicSlippage = activePreset?.dynamic_slippage ?? true;
        const landing = mevModeToLanding(activePreset?.mev_mode ?? 'reduced');

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
            landing,
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

        if (!silent && toastId) {
          toast.success('Sell complete', {
            id: toastId,
            description: sig ? `${sig.slice(0, 8)}...` : undefined,
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
        dispatchSolanaAccountRefresh('pulse_quick_buy');
        if (silent) return { ok: true, signature: sig ?? null };
      } catch (e) {
        if (!silent && toastId) toast.dismiss(toastId);
        const msg = e instanceof Error ? e.message : 'Trade failed';
        if (silent) return { ok: false, error: msg };
        toast.error('Quick sell failed', { description: msg.slice(0, 200) });
      } finally {
        setBusyMint(null);
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

  return {
    buyToken,
    sellTokenPct,
    busyMint,
    walletReady: walletsReady && !!wallet,
    canTrade: Boolean(wallet && !activeWalletRow?.is_imported),
  };
}
