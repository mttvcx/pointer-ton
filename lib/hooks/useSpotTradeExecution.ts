'use client';

import { useCallback, useMemo } from 'react';
import type { MyWalletRow } from '@/lib/hooks/useActiveSolanaWallet';
import { useActiveSolanaWallet } from '@/lib/hooks/useActiveSolanaWallet';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePointerTradeSubmit } from '@/lib/hooks/usePointerTradeSubmit';
import type { TradeQuoteApiOk } from '@/lib/trading/quoteTypes';
import { toast } from 'sonner';
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


/** `pct` is a percent of balance (0.5 = 0.5%, 100 = 100%). Uses balance * pct / 100 in integer math. */
export function tokenRawForSellPct(balanceRaw: string, pct: number): string | null {
  const bal = BigInt(balanceRaw === '' ? '0' : balanceRaw);
  if (bal <= 0n) return null;
  const bps = Math.round(pct * 100);
  const portion = (bal * BigInt(bps)) / 10000n;
  if (portion <= 0n) return null;
  return String(portion);
}

export function useSpotTradeExecution(mint: string) {
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

  const { wallet, wallets, ready: walletsReady, activeAddress, setActiveWalletAddress } =
    useActiveSolanaWallet(myWalletsQ.data?.wallets);

  const signingWalletAddresses = useMemo(
    () => new Set(wallets.map((w) => w.address)),
    [wallets],
  );

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
    async (amountSol: number) => {
      if (!wallet) {
        toast.error('Connect TON wallet');
        return;
      }
      if (activeWalletRow?.is_imported === true) {
        toast.error('View-only wallet', {
          description: 'Use a wallet linked in TonConnect to trade.',
        });
        return;
      }
      if (!Number.isFinite(amountSol) || amountSol <= 0) {
        toast.error('Invalid amount');
        return;
      }
      const token = await getAccessToken();
      if (!token) {
        toast.error('Sign in required');
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
            amountSol,
            slippageBps: effectiveSlippageBps,
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
        if (!ok.tonConnect?.messages?.length || !ok.summary?.amountOutRaw) {
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
        void refetchBalance();
        void qc.invalidateQueries({ queryKey: ['wallets-my'] });
      } catch (e) {
        toast.dismiss(toastId);
        const msg = e instanceof Error ? e.message : 'Trade failed';
        toast.error('Buy failed', { description: msg.slice(0, 200) });
      }
    },
    [
      wallet,
      activeWalletRow?.is_imported,
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

  const runSell = useCallback(
    async (sellPct: number) => {
      if (!wallet) {
        toast.error('Connect TON wallet');
        return;
      }
      if (activeWalletRow?.is_imported === true) {
        toast.error('View-only wallet', {
          description: 'Use a wallet linked in TonConnect to trade.',
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

      const feeExtra =
        activePreset != null
          ? {
              jitoTipLamports: activePreset.jito_tip_lamports,
              priorityFeeLamports: activePreset.priority_fee_lamports,
              autoFee: activePreset.auto_fee,
              maxFeeSol: activePreset.max_fee_sol,
            }
          : {};

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
        if (!ok.tonConnect?.messages?.length || !ok.summary?.amountOutRaw) {
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
        void refetchBalance();
        void qc.invalidateQueries({ queryKey: ['wallets-my'] });
      } catch (e) {
        toast.dismiss(toastId);
        const msg = e instanceof Error ? e.message : 'Trade failed';
        toast.error('Sell failed', { description: msg.slice(0, 200) });
      }
    },
    [
      wallet,
      activeWalletRow?.is_imported,
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
    async (amountSolOut: number) => {
      if (!wallet) {
        toast.error('Connect TON wallet');
        return;
      }
      if (activeWalletRow?.is_imported === true) {
        toast.error('View-only wallet', {
          description: 'Use a wallet linked in TonConnect to trade.',
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

      const feeExtra =
        activePreset != null
          ? {
              jitoTipLamports: activePreset.jito_tip_lamports,
              priorityFeeLamports: activePreset.priority_fee_lamports,
              autoFee: activePreset.auto_fee,
              maxFeeSol: activePreset.max_fee_sol,
            }
          : {};

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
        if (!ok.tonConnect?.messages?.length || !ok.summary?.amountOutRaw) {
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
        void refetchBalance();
        void qc.invalidateQueries({ queryKey: ['wallets-my'] });
      } catch (e) {
        toast.dismiss(toastId);
        const msg = e instanceof Error ? e.message : 'Trade failed';
        toast.error('Sell failed', { description: msg.slice(0, 200) });
      }
    },
    [
      wallet,
      activeWalletRow?.is_imported,
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
    walletRows: myWalletsQ.data?.wallets,
    activeWalletAddress: activeAddress,
    setActiveWalletAddress,
    signingWalletAddresses,
  };
}
