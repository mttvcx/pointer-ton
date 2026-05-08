'use client';

import { useCallback, useMemo } from 'react';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { usePointerTradeSubmit } from '@/lib/hooks/usePointerTradeSubmit';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { MyWalletRow } from '@/lib/hooks/useActiveSolanaWallet';
import { useActiveSolanaWallet } from '@/lib/hooks/useActiveSolanaWallet';
import type { TradeQuoteApiOk } from '@/lib/trading/quoteTypes';
import { DEFAULT_SLIPPAGE_BPS } from '@/lib/utils/constants';
import { mevModeToLanding, type MevMode } from '@/lib/trading/mevMode';
import { useTradingStore, type PresetSlot } from '@/store/trading';

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
  const { submitFromQuote } = usePointerTradeSubmit();
  const { activePresetSlot } = useTradingStore();

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
        if (!ok.tonConnect?.messages?.length || !ok.summary?.amountOutRaw) {
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
        void qc.invalidateQueries({ queryKey: ['wallets-my'] });
      } catch (e) {
        toast.dismiss(toastId);
        const msg = e instanceof Error ? e.message : 'Trade failed';
        toast.error('Quick buy failed', { description: msg.slice(0, 200) });
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
    ],
  );

  return {
    buyToken,
    busyMint: null as string | null,
    walletReady: walletsReady && !!wallet,
    canTrade: Boolean(wallet && !activeWalletRow?.is_imported),
  };
}
