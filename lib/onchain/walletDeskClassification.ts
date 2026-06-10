import type { MintWalletStatsRow } from '@/lib/db/mintWalletStats';
import type { HolderDeskSynthFunding } from '@/lib/tokens/holderDeskSynth';
import type { WalletIntelBadgeKind } from '@/lib/walletIdentity/types';
import { poolRoleDisplayLabel, type PoolWalletRole } from '@/lib/onchain/poolWalletTypes';

export type WalletDeskRole = PoolWalletRole | 'locked_vault' | null;

export type WalletDeskClassification = {
  role: WalletDeskRole;
  displayLabel: string | null;
  badges: WalletIntelBadgeKind[];
  isDev: boolean;
  isSniper: boolean;
  /** Recent CEX or young-wallet SOL funding — not trade-age heuristic. */
  isFresh: boolean;
  funding: HolderDeskSynthFunding | null;
  /** Non-person accounts — hide misleading SOL balance / desk synth. */
  isSystemAccount: boolean;
  /** Locked vault tooltip from on-chain owner lookup. */
  lockedVaultTooltip?: string | null;
};

const SNIPER_LAUNCH_WINDOW_MS = 15 * 60_000;
const SNIPER_EXIT_WINDOW_MS = 60 * 60_000;
const LOCKED_SUPPLY_PCT = 8;

function msBetween(a: string | null | undefined, b: string | null | undefined): number | null {
  if (!a || !b) return null;
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return null;
  return Math.abs(tb - ta);
}

/** Heuristic sniper: in near launch window and fast round-trip. */
export function detectSniperFromStats(
  stats: MintWalletStatsRow | null | undefined,
  tokenCreatedAt: string | null | undefined,
): boolean {
  if (!stats?.first_trade_at) return false;
  const launchMs = tokenCreatedAt ? new Date(tokenCreatedAt).getTime() : null;
  const firstMs = new Date(stats.first_trade_at).getTime();
  if (!Number.isFinite(firstMs)) return false;

  const nearLaunch =
    launchMs != null && Number.isFinite(launchMs) && firstMs - launchMs <= SNIPER_LAUNCH_WINDOW_MS;

  if (!nearLaunch) return false;

  const bought = stats.bought_token_raw;
  const sold = stats.sold_token_raw;
  if (bought <= 0) return false;

  const span = msBetween(stats.first_trade_at, stats.last_trade_at);
  const fastExit =
    Boolean(stats.first_trade_at && stats.last_trade_at) &&
    span != null &&
    span <= SNIPER_EXIT_WINDOW_MS &&
    sold > 0;

  const roundTrip = sold / bought >= 0.4;
  return fastExit && roundTrip;
}

/**
 * Classify a wallet for desk badges + holder display labels from on-chain context.
 */
export function classifyWalletForDesk(params: {
  address: string;
  creatorWallet?: string | null;
  poolRole?: PoolWalletRole | null;
  walletStats?: MintWalletStatsRow | null;
  tokenCreatedAt?: string | null;
  pctSupply?: number | null;
  /** Pre-flagged from holder row. */
  isSniperFlag?: boolean | null;
  isDevFlag?: boolean | null;
  /** From {@link resolveDeskWalletFunding} — required for accurate fresh + funding column. */
  funding?: HolderDeskSynthFunding | null;
  isFreshFunded?: boolean;
  lockedVaultTooltip?: string | null;
}): WalletDeskClassification {
  const address = params.address.trim();
  const creator = params.creatorWallet?.trim() || null;
  const poolRole = params.poolRole ?? null;
  const stats = params.walletStats;

  let role: WalletDeskRole = poolRole;
  let displayLabel = poolRoleDisplayLabel(poolRole as PoolWalletRole | null);

  const isDev = Boolean(params.isDevFlag) || Boolean(creator && creator === address);
  const isSniper =
    Boolean(params.isSniperFlag) || detectSniperFromStats(stats, params.tokenCreatedAt);

  const highSupplyNoTrades =
    (params.pctSupply ?? 0) >= LOCKED_SUPPLY_PCT &&
    (!stats || (stats.buy_usd <= 0 && stats.sell_usd <= 0));

  if (!role && highSupplyNoTrades && poolRole == null) {
    role = 'locked_vault';
    displayLabel = null;
  }

  const isSystemAccount = Boolean(poolRole) || role === 'locked_vault';

  const isFresh = !isSystemAccount && Boolean(params.isFreshFunded);

  const badges: WalletIntelBadgeKind[] = [];
  if (isDev) badges.push('dev');
  if (isSniper) badges.push('sniper');
  if (isFresh) badges.push('fresh');

  return {
    role,
    displayLabel,
    badges,
    isDev,
    isSniper,
    isFresh,
    funding: params.funding ?? null,
    isSystemAccount,
    lockedVaultTooltip: role === 'locked_vault' ? (params.lockedVaultTooltip ?? null) : null,
  };
}
