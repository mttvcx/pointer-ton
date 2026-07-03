import { authToken } from '../auth';
import { api } from './client';
import type {
  ExplainTokenResponse,
  MeUser,
  MyWallet,
  PerpMarket,
  PointsSummary,
  Portfolio,
  PulseBundle,
  PulseColumn,
  PulseFeed,
  TokenDetail,
  Verdict,
} from '../types';

/* ---------- public reads (no auth) ---------- */

export function getPulseFeed(column: PulseColumn = 'new', chain = 'sol'): Promise<PulseFeed> {
  return api<PulseFeed>(`/api/pulse/feed?column=${column}&chain=${chain}`);
}

/**
 * Real, tradeable token list for Home — merges the live feed columns, dedupes by
 * mint, and keeps only tokens that have BOTH a logo and a live price snapshot, so
 * every row renders complete (real logo + symbol + price + market cap).
 */
export async function getLiveTokens(chain = 'sol'): Promise<PulseBundle[]> {
  const columns: PulseColumn[] = ['migrated', 'stretch'];
  const feeds = await Promise.all(
    columns.map((c) => getPulseFeed(c, chain).catch(() => ({ items: [] } as unknown as PulseFeed))),
  );
  const seen = new Set<string>();
  const out: PulseBundle[] = [];
  for (const feed of feeds) {
    for (const item of feed.items ?? []) {
      const mint = item.token?.mint;
      if (!mint || seen.has(mint)) continue;
      if (!item.token.image_url) continue;
      if (!item.snapshot || item.snapshot.price_usd == null) continue;
      seen.add(mint);
      out.push(item);
    }
  }
  return out;
}

export function getToken(mint: string): Promise<TokenDetail> {
  return api<TokenDetail>(`/api/tokens/${encodeURIComponent(mint)}`);
}

/** Hyperliquid perp markets (public, vol-sorted server-side). Read-only — order
 * signing isn't shipped yet, same as web's Preview state. */
export async function getPerpMarkets(): Promise<PerpMarket[]> {
  const r = await api<{ markets?: PerpMarket[] }>('/api/perps/markets');
  return r.markets ?? [];
}

/** One recorded trade against a token (mirrors the public trades feed row). */
export type TradeRow = {
  side: 'buy' | 'sell';
  amount_sol: number | null;
  amount_token: number | null;
  price_usd_at_fill: number | null;
  tx_signature: string;
  submitted_at: string;
  wallet_address?: string | null;
  status: string;
};

/** Recent trades for a token (public). Newest first, server-capped by `limit`. */
export async function getTokenTrades(mint: string, limit = 80): Promise<TradeRow[]> {
  const res = await api<{ trades?: TradeRow[] }>(
    `/api/tokens/${encodeURIComponent(mint)}/trades?limit=${limit}`,
  );
  return res.trades ?? [];
}

/* ---------- twitter profile (real, for hover / hold cards) ---------- */

/** Mirrors the web `/api/twitter/profile/[handle]` shape (FixTweet-backed). */
export type TwitterProfile = {
  handle: string;
  displayName: string;
  verified: boolean;
  avatarUrl: string | null;
  bio: string | null;
  followerCount: number;
  followingCount: number;
};

/**
 * Real X profile for a handle. Server is FixTweet-backed and NEVER fabricates
 * follower counts — it throws when a handle can't be resolved, so the caller
 * shows a minimal card instead of fake numbers.
 */
export function getTwitterProfile(handle: string): Promise<TwitterProfile> {
  return api<TwitterProfile>(`/api/twitter/profile/${encodeURIComponent(handle.replace(/^@/, ''))}`);
}

/* ---------- authed (token from the auth layer) ---------- */

/** The signed-in Pointer user (same account as web, keyed by privy_id). */
export async function getMe(): Promise<MeUser> {
  const r = await api<{ user: MeUser }>('/api/me', { token: await authToken() });
  return r.user;
}

/** The user's wallets (embedded Solana/EVM + any imported), with SOL balances. */
export async function getMyWallets(): Promise<MyWallet[]> {
  const r = await api<{ wallets?: MyWallet[] }>('/api/wallets/my', { token: await authToken() });
  return r.wallets ?? [];
}

/** Aggregate portfolio (value, uPnL, positions) for a wallet, or the primary. */
export async function getPortfolio(wallet?: string): Promise<Portfolio> {
  const q = wallet ? `?wallet=${encodeURIComponent(wallet)}` : '';
  return api<Portfolio>(`/api/portfolio${q}`, { token: await authToken() });
}

/** Points balance + leaderboard rank for the signed-in user. */
export async function getPoints(): Promise<PointsSummary> {
  return api<PointsSummary>('/api/points/me', { token: await authToken() });
}

/**
 * A signed Onramper widget URL to buy USDC with a debit/credit card — the real
 * "deposit cash" path (funds land in the user's wallet as USDC). Opens in the
 * browser. Throws if the backend on-ramp isn't configured.
 */
export async function getOnramperUrl(walletAddress: string, fiatAmount?: number): Promise<string> {
  const r = await api<{ widgetUrl: string }>('/api/onramper/signature', {
    token: await authToken(),
    method: 'POST',
    body: {
      activeChain: 'sol',
      walletAddress,
      defaultFiat: 'USD',
      ...(fiatAmount && fiatAmount > 0 ? { fiatAmount } : {}),
    },
  });
  return r.widgetUrl;
}

/** Persist profile fields (username) to the Pointer account via the sync route. */
export async function updateProfile(fields: { username?: string }): Promise<void> {
  await api('/api/auth/sync', { token: await authToken(), method: 'POST', body: fields });
}

export const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

/** Raw token balance for a wallet (USDC = spendable USD balance). */
export async function getTokenBalance(mint: string, wallet: string): Promise<{ rawAmount: string }> {
  return api<{ rawAmount: string }>(
    `/api/trade/balance?mint=${encodeURIComponent(mint)}&wallet=${encodeURIComponent(wallet)}`,
    { token: await authToken() },
  );
}

/** Spendable USD "cash" = the wallet's on-chain USDC (6 decimals). This is the
 *  unified balance card + Onramper/Crossmint deposits land here. */
export async function getCashBalance(wallet: string): Promise<number> {
  const r = await getTokenBalance(USDC_MINT, wallet);
  return (Number(r.rawAmount) || 0) / 1e6;
}

/** The wedge: AI safety read for a token. `fast` is cheap + cached server-side. */
export async function explainToken(mint: string, mode: 'fast' | 'deep' = 'fast'): Promise<ExplainTokenResponse> {
  return api<ExplainTokenResponse>('/api/ai/explain-token', {
    token: await authToken(),
    method: 'POST',
    body: { mint, mode, surface: 'hover' },
  });
}

/** Collapse the AI riskFlags + confidence into the 3-state buy-screen chip. */
export function deriveVerdict(riskFlags: string[], confidence: 'low' | 'medium' | 'high'): Verdict {
  const n = riskFlags.length;
  if (n >= 3 || (n >= 2 && confidence !== 'low')) return 'high_risk';
  if (n >= 1) return 'caution';
  return 'healthy';
}
