'use client';

import { useCallback, useMemo } from 'react';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { useSignTransaction } from '@/lib/auth/solanaShims';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { MyWalletRow } from '@/lib/hooks/useActiveSolanaWallet';
import { useActiveSolanaWallet } from '@/lib/hooks/useActiveSolanaWallet';
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

type QuoteApiOk = {
  side: 'buy';
  mint: string;
  quote: Record<string, unknown>;
  swapTransaction: string | null;
  summary: {
    amountInRaw: string;
    amountOutRaw: string | null;
    amountSolEstimate: number;
  };
};

const SILENT_SOLANA_SIGN_TX_OPTIONS = {
  uiOptions: { showWalletUIs: false as const },
} as const;

function base64ToUint8(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function uint8ToBase64(bytes: Uint8Array): string {
  const chunk = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/**
 * Quote ? sign ? execute for Pulse row quick-buy (buy only).
 */
export function usePulseQuickBuy() {
  const { getAccessToken, authenticated } = usePointerAuth();
  const qc = useQueryClient();
  const { signTransaction } = useSignTransaction();
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
        toast.error('No Solana wallet', { description: 'Connect an embedded wallet first.' });
        return;
      }
      if (activeWalletRow?.is_imported === true) {
        toast.error('View-only wallet', {
          description: 'Imported wallets cannot trade yet. Use an embedded wallet.',
        });
        return;
      }
      if (!Number.isFinite(amountSol) || amountSol <= 0) {
        toast.error('Invalid amount', { description: 'Set a positive SOL amount in the column header.' });
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
        const ok = json as QuoteApiOk;
        if (!ok.swapTransaction || !ok.summary?.amountOutRaw) {
          throw new Error('No swap transaction from quote');
        }

        toast.loading('Signing...', { id: toastId });
        const unsigned = base64ToUint8(ok.swapTransaction);
        const { signedTransaction } = await signTransaction({
          transaction: unsigned,
          wallet,
          chain: 'solana:mainnet',
          options: SILENT_SOLANA_SIGN_TX_OPTIONS,
        });
        const signedB64 = uint8ToBase64(signedTransaction);

        toast.loading('Submitting...', { id: toastId });
        const execRes = await fetch('/api/trade/execute', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            signedTransaction: signedB64,
            userPublicKey: wallet.address,
            mint,
            side: ok.side,
            amountInRaw: ok.summary.amountInRaw,
            amountOutRaw: ok.summary.amountOutRaw ?? '0',
            amountSolNotional: ok.summary.amountSolEstimate,
          }),
        });
        const execJson: unknown = await execRes.json();
        if (!execRes.ok) {
          const msg =
            typeof execJson === 'object' && execJson && 'message' in execJson
              ? String((execJson as { message: unknown }).message)
              : `Execute failed (${execRes.status})`;
          throw new Error(msg);
        }
        const sig =
          typeof execJson === 'object' && execJson && 'signature' in execJson
            ? String((execJson as { signature: unknown }).signature)
            : '';
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
      signTransaction,
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
