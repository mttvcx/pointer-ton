import 'server-only';

import { runCascade, type CascadeMode } from '@/lib/ai/cascade';
import { ExplainTokenOutputSchema, type ExplainTokenOutput } from '@/lib/ai/schemas';
import {
  getLatestSnapshotForMint,
  getTokenByMint,
  listTopHolders,
} from '@/lib/db/tokens';
import { listRecentSocialForMint } from '@/lib/db/social';
import { listTradesForMint } from '@/lib/db/trades';
import {
  formatCompactUsd,
  formatNumber,
  formatPercent,
  formatPriceUsd,
  formatRelativeTime,
} from '@/lib/utils/formatters';

export interface ExplainTokenInput {
  mint: string;
  userId: string;
  mode?: CascadeMode;
}

/**
 * Build a minimal text "fact sheet" the cascade can summarize. Avoid pasting
 * raw JSON - models hallucinate around it.
 */
function buildPrompt(facts: {
  symbol: string | null;
  name: string | null;
  description: string | null;
  launchPad: string | null;
  createdAt: string;
  marketCapUsd: number | null;
  liquidityUsd: number | null;
  priceUsd: number | null;
  volume24hUsd: number | null;
  txns1h: number | null;
  holderCount: number | null;
  top10Pct: number | null;
  devHoldingPct: number | null;
  isLpLocked: boolean | null;
  mintAuthority: string | null;
  freezeAuthority: string | null;
  recentSocial: number;
  recentTrades24h: number;
}): { system: string; user: string } {
  const system = [
    'You are Pointer, an experienced Solana memecoin analyst.',
    'Be terse, specific, and skeptical. Prefer numbers over adjectives.',
    'Never recommend buying or selling. Treat every token as risky by default.',
  ].join(' ');

  const lines: string[] = [];
  const sym = facts.symbol ?? 'UNKNOWN';
  const nm = facts.name ?? 'unnamed token';
  lines.push(`Token: ${sym} (${nm})`);
  if (facts.launchPad) lines.push(`Launchpad: ${facts.launchPad}`);
  lines.push(`Age: created ${formatRelativeTime(facts.createdAt)}`);
  if (facts.priceUsd != null) lines.push(`Price: ${formatPriceUsd(facts.priceUsd)}`);
  if (facts.marketCapUsd != null)
    lines.push(`Market cap: ${formatCompactUsd(facts.marketCapUsd)}`);
  if (facts.liquidityUsd != null)
    lines.push(`Liquidity: ${formatCompactUsd(facts.liquidityUsd)}`);
  if (facts.volume24hUsd != null)
    lines.push(`24h volume: ${formatCompactUsd(facts.volume24hUsd)}`);
  if (facts.txns1h != null) lines.push(`1h txns: ${formatNumber(facts.txns1h, { decimals: 0 })}`);
  if (facts.holderCount != null)
    lines.push(`Holders: ${formatNumber(facts.holderCount, { decimals: 0 })}`);
  if (facts.top10Pct != null) lines.push(`Top 10 supply: ${formatPercent(facts.top10Pct)}`);
  if (facts.devHoldingPct != null)
    lines.push(`Dev still holds: ${formatPercent(facts.devHoldingPct)}`);
  if (facts.mintAuthority) lines.push(`Mint authority: not revoked (${facts.mintAuthority})`);
  else lines.push('Mint authority: revoked');
  if (facts.freezeAuthority) lines.push(`Freeze authority: ${facts.freezeAuthority}`);
  else lines.push('Freeze authority: revoked');
  if (facts.isLpLocked != null)
    lines.push(`LP locked: ${facts.isLpLocked ? 'yes' : 'no'}`);
  if (facts.description)
    lines.push(`Self-described: ${facts.description.slice(0, 240)}`);
  lines.push(`Recent social mentions (last hour): ${facts.recentSocial}`);
  lines.push(`Pointer trades on this mint last 24h: ${facts.recentTrades24h}`);

  const user = [
    'Summarize the token using only the facts below.',
    '',
    lines.join('\n'),
    '',
    'Respond as JSON matching this schema:',
    '{ "summary": string (<=600 chars),',
    '  "bullCase": string[] (1-4 items, each <=200 chars),',
    '  "bearCase": string[] (1-4 items, each <=200 chars),',
    '  "riskFlags": string[] (0-6 items, each <=100 chars, e.g. "high dev holding"),',
    '  "confidence": "low" | "medium" | "high" }',
  ].join('\n');

  return { system, user };
}

export async function explainToken(input: ExplainTokenInput): Promise<{
  data: ExplainTokenOutput;
  cacheHit: boolean;
  modelUsed: string;
  costUsd: number;
}> {
  const token = await getTokenByMint(input.mint);
  if (!token) throw new Error('token_not_found');

  const [snapshot, holders, social, trades] = await Promise.all([
    getLatestSnapshotForMint(input.mint),
    listTopHolders(input.mint, 10),
    listRecentSocialForMint(input.mint, 10),
    listTradesForMint(input.mint, 50),
  ]);

  const recentSocial = social.filter((s) => {
    if (!s.posted_at) return false;
    return Date.now() - new Date(s.posted_at).getTime() < 60 * 60 * 1000;
  }).length;

  const recentTrades24h = trades.filter(
    (t) => Date.now() - new Date(t.submitted_at).getTime() < 24 * 60 * 60 * 1000,
  ).length;

  const top10Pct =
    holders.length > 0
      ? holders.slice(0, 10).reduce((s, h) => s + (h.pct_of_supply ?? 0), 0)
      : (snapshot?.top10_holder_pct ?? null);

  const { system, user } = buildPrompt({
    symbol: token.symbol,
    name: token.name,
    description: token.description,
    launchPad: token.launch_pad,
    createdAt: token.created_at,
    marketCapUsd: snapshot?.market_cap_usd ?? null,
    liquidityUsd: snapshot?.liquidity_usd ?? null,
    priceUsd: snapshot?.price_usd ?? null,
    volume24hUsd: snapshot?.volume_24h_usd ?? null,
    txns1h: snapshot?.txns_1h ?? null,
    holderCount: snapshot?.holder_count ?? null,
    top10Pct,
    devHoldingPct: snapshot?.dev_holding_pct ?? null,
    isLpLocked: token.is_lp_locked,
    mintAuthority: token.mint_authority,
    freezeAuthority: token.freeze_authority,
    recentSocial,
    recentTrades24h,
  });

  const result = await runCascade({
    pipeline: 'explainToken',
    userId: input.userId,
    mode: input.mode ?? 'fast',
    inputs: {
      mint: input.mint,
      mode: input.mode ?? 'fast',
      // Snapshot id pinned so cache invalidates on a fresh snapshot.
      snapshotId: snapshot?.id ?? null,
      holderHash: holders.map((h) => `${h.wallet_address}:${h.amount_raw}`).join(','),
    },
    systemPrompt: system,
    userPrompt: user,
  });

  // Schema is stable so the cast is safe; runCascade enforces it at runtime.
  return {
    data: result.data as ExplainTokenOutput,
    cacheHit: result.cacheHit,
    modelUsed: result.modelUsed,
    costUsd: result.costUsd,
  };
}

export { ExplainTokenOutputSchema };
