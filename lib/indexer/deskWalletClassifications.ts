import 'server-only';

import type { MintWalletStatsRow } from '@/lib/db/mintWalletStats';
import type { TokenHolderRow } from '@/lib/db/tokens';
import {
  classifyWalletForDesk,
  type WalletDeskClassification,
} from '@/lib/onchain/walletDeskClassification';
import {
  resolveKnownPoolAddresses,
  type PoolWalletRole,
} from '@/lib/onchain/resolveKnownPoolAddresses';
import { resolveLockedVaultHint } from '@/lib/onchain/resolveLockedVaultAccount';
import { resolveDeskWalletFundingBatch } from '@/lib/solana/deskWalletFunding';

export type DeskWalletClassificationPayload = WalletDeskClassification;

/** Build per-wallet desk classifications for holders + trades APIs. */
export async function buildDeskWalletClassifications(params: {
  mint: string;
  holders: TokenHolderRow[];
  walletStats: Map<string, MintWalletStatsRow>;
  creatorWallet?: string | null;
  tokenCreatedAt?: string | null;
  /** Skip RPC funding scans (demo / rate-limit guard). */
  skipFunding?: boolean;
}): Promise<Record<string, DeskWalletClassificationPayload>> {
  const poolCtx = await resolveKnownPoolAddresses(params.mint);
  const addrs = params.holders
    .map((h) => h.wallet_address?.trim())
    .filter((a): a is string => Boolean(a))
    .filter((a) => !poolCtx.addresses.has(a));

  const fundingMap = params.skipFunding
    ? new Map()
    : await resolveDeskWalletFundingBatch(addrs, 2);

  const out: Record<string, DeskWalletClassificationPayload> = {};

  const lockedHints = new Map<string, string>();
  const lockedCandidates = params.holders.filter((h) => {
    const addr = h.wallet_address?.trim();
    if (!addr || poolCtx.addresses.has(addr)) return false;
    const pct = h.pct_of_supply ?? 0;
    const stats = params.walletStats.get(addr);
    return pct >= 8 && (!stats || (stats.buy_usd <= 0 && stats.sell_usd <= 0));
  });
  await Promise.all(
    lockedCandidates.map(async (h) => {
      const addr = h.wallet_address!.trim();
      const hint = await resolveLockedVaultHint(addr, h.pct_of_supply);
      lockedHints.set(addr, hint.tooltip);
    }),
  );

  for (const h of params.holders) {
    const addr = h.wallet_address?.trim();
    if (!addr) continue;
    const poolRole: PoolWalletRole | null = poolCtx.roles.get(addr) ?? null;
    const stats = params.walletStats.get(addr) ?? null;
    const fund = fundingMap.get(addr);

    out[addr] = classifyWalletForDesk({
      address: addr,
      creatorWallet: params.creatorWallet,
      poolRole,
      walletStats: stats,
      tokenCreatedAt: params.tokenCreatedAt,
      pctSupply: h.pct_of_supply,
      isDevFlag: h.is_dev,
      isSniperFlag: h.is_sniper,
      funding: fund?.funding ?? null,
      isFreshFunded: fund?.isFreshFunded ?? false,
      lockedVaultTooltip: lockedHints.get(addr) ?? null,
    });
  }

  return out;
}

export async function classifyTradeWallet(params: {
  mint: string;
  wallet: string;
  creatorWallet?: string | null;
  walletStats?: MintWalletStatsRow | null;
  tokenCreatedAt?: string | null;
  skipFunding?: boolean;
}): Promise<DeskWalletClassificationPayload> {
  const poolCtx = await resolveKnownPoolAddresses(params.mint);
  const poolRole = poolCtx.roles.get(params.wallet) ?? null;
  const fund = params.skipFunding ? null : (await resolveDeskWalletFundingBatch([params.wallet], 1)).get(params.wallet);

  return classifyWalletForDesk({
    address: params.wallet,
    creatorWallet: params.creatorWallet,
    poolRole,
    walletStats: params.walletStats ?? null,
    tokenCreatedAt: params.tokenCreatedAt,
    funding: fund?.funding ?? null,
    isFreshFunded: fund?.isFreshFunded ?? false,
  });
}
