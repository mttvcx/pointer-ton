'use client';

import { useQuery } from '@tanstack/react-query';
import { TerminalWalletChip } from '@/components/wallet/TerminalWalletChip';
import { WalletPickerPopover } from '@/components/wallets/WalletPickerPopover';
import { pulseWalletBtnCls } from '@/components/pulse/pulseToolbarStyles';
import { useActiveSolanaWallet } from '@/lib/hooks/useActiveSolanaWallet';
import type { MyWalletRow } from '@/lib/hooks/useActiveSolanaWallet';
import { useWalletNativeBalance } from '@/lib/hooks/useWalletNativeBalance';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { parseLamportsStringToSol } from '@/lib/utils/formatters';
import { useTradingStore } from '@/store/trading';
import { useUIStore } from '@/store/ui';
import { cn } from '@/lib/utils/cn';

/** Pulse top strip — Axiom-style bordered wallet pill (same picker as bottom dock). */
export function PulseWorkspaceWalletChip({ className }: { className?: string }) {
  const { authenticated, getAccessToken } = usePointerAuth();
  const activeChain = useUIStore((s) => s.activeChain);

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

  const { activeAddress } = useActiveSolanaWallet(myWalletsQ.data?.wallets);
  const rowForActive = myWalletsQ.data?.wallets?.find((w) => w.wallet_address === activeAddress);

  const liveNativeBalQ = useWalletNativeBalance({
    enabled: authenticated && Boolean(rowForActive?.id),
    walletId: rowForActive?.id,
    fallbackLamports: rowForActive?.balance_lamports,
    getAccessToken,
  });

  const solBal =
    activeChain === 'sol'
      ? (liveNativeBalQ.data?.ui ?? parseLamportsStringToSol(rowForActive?.balance_lamports ?? null))
      : null;
  const tonBalUi =
    activeChain === 'ton'
      ? (liveNativeBalQ.data?.ui ??
        parseLamportsStringToSol(rowForActive?.balance_lamports ?? null) ??
        0)
      : null;
  const barBal = activeChain === 'sol' ? solBal : activeChain === 'ton' ? tonBalUi : null;

  const shortlistLen = useTradingStore((s) => (s.instantTradeWalletShortlist ?? []).length);
  const walletTotalCount = (myWalletsQ.data?.wallets ?? []).filter((w) => !w.is_archived).length;
  const dockCount = authenticated
    ? shortlistLen > 0
      ? shortlistLen
      : walletTotalCount
    : null;

  if (!authenticated) return null;

  return (
    <WalletPickerPopover
      className={cn(pulseWalletBtnCls, className)}
      placement="below"
      align="right"
      title="Active wallets"
    >
      <TerminalWalletChip
        walletCount={dockCount}
        nativeBalance={barBal}
        activeChain={activeChain}
        variant="pulse"
        showChevron
      />
    </WalletPickerPopover>
  );
}
