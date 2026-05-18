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
  const { activePresetSlot } = useTradingStore();
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
    async (mint: string, amountSol: number) => {
      if (!walletsReady || !wallet) {
        toast.error('Connect TON wallet', { description: 'Use TonConnect after sign-in.' });
        return;
      }
      if (activeWalletRow?.is_imported === true) {
        toast.error('View-only wallet', {
          description: 'Use a non-imported wallet linked in TonConnect to trade.',
        });
        return;
      }
      if (!Number.isFinite(amountSol) || amountSol <= 0) {
        toast.error('Invalid amount', { description: 'Set a positive TON amount in the column header.' });
        return;
      }
      const token = await getAccessToken();
      if (!token) {
        toast.error('Sign in required', { description: 'Log in to quick buy.' });
        return;
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
      const toastId = toast.loading('Getting quote...');
      try {
        const body = {
          mint,
          side: 'buy' as const,
          userPublicKey: wallet.address,
          amountSol,
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

        toast.loading('Sign in wallet...', { id: toastId });
        const { signature: sig } = await submitFromQuote({
          quote: ok,
          walletAddress: wallet.address,
          mint,
          getAccessToken,
        });

        toast.success('Buy complete', {
          id: toastId,
          description: sig ? `Signature: ${sig.slice(0, 8)}...` : undefined,
        });
        const chainRes: AppChainId = ok.chain === 'sol' || ok.chain === 'ton' ? ok.chain : activeChain;
        const sym = nativeTicker(chainRes);
        const narration = `Bought ${formatNumber(amountSol, { decimals: 4 })} ${sym} · Pulse quick buy.`;
        void (async () => {
          const t = await getAccessToken();
          if (!t) return;
          const posted = await recordUserTradeActivity(t, narration, {
            kind: 'pulse_quick_buy',
            mint,
            chain: chainRes,
            amountSol,
            txSignature: sig ?? null,
          });
          if (posted) void qc.invalidateQueries({ queryKey: ['alerts-ticker'] });
        })();
        void qc.invalidateQueries({ queryKey: ['wallets-my'] });
      } catch (e) {
        toast.dismiss(toastId);
        const msg = e instanceof Error ? e.message : 'Trade failed';
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
    ],
  );

  const sellTokenPct = useCallback(
    async (mint: string, sellPct: number) => {
      if (!walletsReady || !wallet) {
        toast.error('Connect TON wallet', { description: 'Use TonConnect after sign-in.' });
        return;
      }
      if (activeWalletRow?.is_imported === true) {
        toast.error('View-only wallet', {
          description: 'Use a non-imported wallet linked in TonConnect to trade.',
        });
        return;
      }
      if (!Number.isFinite(sellPct) || sellPct <= 0 || sellPct > 100) {
        toast.error('Invalid sell %');
        return;
      }
      const token = await getAccessToken();
      if (!token) {
        toast.error('Sign in required', { description: 'Log in to quick sell.' });
        return;
      }

      setBusyMint(mint);
      const toastId = toast.loading('Sell: quote...');
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
          toast.dismiss(toastId);
          toast.error('No tokens to sell', {
            description: 'Zero balance for this mint.',
          });
          return;
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

        toast.success('Sell complete', {
          id: toastId,
          description: sig ? `${sig.slice(0, 8)}...` : undefined,
        });
        const chainResSell: AppChainId = ok.chain === 'sol' || ok.chain === 'ton' ? ok.chain : activeChain;
        const narrSell = `Sold ${formatNumber(sellPct, { decimals: 0 })}% of balance · Pulse quick sell.`;
        void (async () => {
          const t = await getAccessToken();
          if (!t) return;
          const est =
            typeof ok.summary.amountSolEstimate === 'number' && Number.isFinite(ok.summary.amountSolEstimate)
              ? Math.max(0, ok.summary.amountSolEstimate)
              : undefined;
          const posted = await recordUserTradeActivity(t, narrSell, {
            kind: 'pulse_quick_sell',
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
      } catch (e) {
        toast.dismiss(toastId);
        const msg = e instanceof Error ? e.message : 'Trade failed';
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
