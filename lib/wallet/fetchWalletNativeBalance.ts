import { parseLamportsStringToSol } from '@/lib/utils/formatters';

export type WalletNativeBalanceSnapshot = {
  lamports: string;
  ui: number;
};

export function walletNativeBalanceQueryKey(walletId: string) {
  return ['wallet-native-balance', walletId] as const;
}

export async function fetchWalletNativeBalance(
  walletId: string,
  getAccessToken: () => Promise<string | null>,
): Promise<WalletNativeBalanceSnapshot> {
  const token = await getAccessToken();
  if (!token) throw new Error('no_token');
  const res = await fetch(`/api/wallets/${walletId}/balance`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('balance_failed');
  const json = (await res.json()) as { lamports?: string };
  const lamports = json.lamports ?? '0';
  return {
    lamports,
    ui: parseLamportsStringToSol(lamports) ?? 0,
  };
}
