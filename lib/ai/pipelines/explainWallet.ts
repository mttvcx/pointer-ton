import 'server-only';

import { runCascade, type CascadeMode } from '@/lib/ai/cascade';
import { ExplainWalletOutputSchema, type ExplainWalletOutput } from '@/lib/ai/schemas';
import { getDevWalletStats, getWalletStats } from '@/lib/db/wallets';
import {
  formatCompactUsd,
  formatNumber,
  formatPercent,
  formatRelativeTime,
} from '@/lib/utils/formatters';

export interface ExplainWalletInput {
  address: string;
  userId: string;
  mode?: CascadeMode;
}

function buildPrompt(facts: {
  address: string;
  pnl30d: number | null;
  pnl7d: number | null;
  winRate30d: number | null;
  trades30d: number | null;
  bestTradeMultiple: number | null;
  avgHoldSeconds: number | null;
  totalVolume30dUsd: number | null;
  isKol: boolean | null;
  kolHandle: string | null;
  devTokensLaunched: number | null;
  devTokensRugged: number | null;
  devTokensMooned: number | null;
  devReputation: number | null;
  devLastLaunchAt: string | null;
  statsComputedAt: string | null;
}): { system: string; user: string } {
  const system = [
    'You are Pointer, an analyst classifying an on-chain wallet by behavior (TON ecosystem).',
    'Be terse and skeptical. Pick exactly one archetype.',
    'Never recommend copying trades or treat the wallet as a signal.',
  ].join(' ');

  const lines: string[] = [];
  lines.push(`Wallet: ${facts.address}`);
  if (facts.kolHandle) lines.push(`KOL handle: @${facts.kolHandle}`);
  if (facts.isKol === true) lines.push('Tagged: KOL');
  if (facts.pnl30d != null) lines.push(`30d PnL: ${formatCompactUsd(facts.pnl30d)}`);
  if (facts.pnl7d != null) lines.push(`7d PnL: ${formatCompactUsd(facts.pnl7d)}`);
  if (facts.winRate30d != null)
    lines.push(`30d win rate: ${formatPercent(facts.winRate30d)}`);
  if (facts.trades30d != null)
    lines.push(`30d trades: ${formatNumber(facts.trades30d, { decimals: 0 })}`);
  if (facts.totalVolume30dUsd != null)
    lines.push(`30d volume: ${formatCompactUsd(facts.totalVolume30dUsd)}`);
  if (facts.bestTradeMultiple != null)
    lines.push(`Best trade: ${facts.bestTradeMultiple.toFixed(1)}x`);
  if (facts.avgHoldSeconds != null) {
    const mins = facts.avgHoldSeconds / 60;
    lines.push(`Avg hold: ${mins < 60 ? `${mins.toFixed(1)}m` : `${(mins / 60).toFixed(1)}h`}`);
  }
  if (facts.devTokensLaunched != null) {
    lines.push(`Tokens deployed: ${facts.devTokensLaunched}`);
    if (facts.devTokensRugged != null)
      lines.push(`...rugged: ${facts.devTokensRugged}`);
    if (facts.devTokensMooned != null)
      lines.push(`...mooned: ${facts.devTokensMooned}`);
    if (facts.devReputation != null)
      lines.push(`Dev reputation score: ${facts.devReputation.toFixed(2)}`);
    if (facts.devLastLaunchAt)
      lines.push(`Last launch: ${formatRelativeTime(facts.devLastLaunchAt)}`);
  }
  if (facts.statsComputedAt) {
    lines.push(`Indexed stats updated: ${formatRelativeTime(facts.statsComputedAt)}`);
  }

  const user = [
    'Classify this wallet using only the facts below (indexed DB stats — no live RPC).',
    '',
    lines.join('\n'),
    '',
    'Respond as JSON matching this schema:',
    '{ "archetype": "kol" | "sniper" | "trader" | "whale" | "dev" | "unknown",',
    '  "summary": string (<=500 chars),',
    '  "strengths": string[] (0-4 items, each <=160 chars),',
    '  "cautions": string[] (0-4 items, each <=160 chars),',
    '  "confidence": "low" | "medium" | "high" }',
  ].join('\n');

  return { system, user };
}

export async function explainWallet(input: ExplainWalletInput): Promise<{
  data: ExplainWalletOutput;
  cacheHit: boolean;
  fromCache: boolean;
  modelUsed: string;
  costUsd: number;
}> {
  const [stats, dev] = await Promise.all([
    getWalletStats(input.address),
    getDevWalletStats(input.address),
  ]);

  const { system, user } = buildPrompt({
    address: input.address,
    pnl30d: stats?.pnl_usd_30d ?? null,
    pnl7d: stats?.pnl_usd_7d ?? null,
    winRate30d: stats?.win_rate_30d ?? null,
    trades30d: stats?.trades_30d ?? null,
    bestTradeMultiple: stats?.best_trade_multiple ?? null,
    avgHoldSeconds: stats?.avg_hold_seconds ?? null,
    totalVolume30dUsd: stats?.total_volume_30d_usd ?? null,
    isKol: stats?.is_kol ?? null,
    kolHandle: stats?.kol_handle ?? null,
    devTokensLaunched: dev?.tokens_launched ?? null,
    devTokensRugged: dev?.tokens_rugged ?? null,
    devTokensMooned: dev?.tokens_mooned ?? null,
    devReputation: dev?.reputation_score ?? null,
    devLastLaunchAt: dev?.last_launch_at ?? null,
    statsComputedAt: stats?.computed_at ?? null,
  });

  const walletActivityFingerprint =
    stats?.computed_at != null
      ? `${stats.trades_30d ?? 0}:${stats.computed_at}`
      : 'none';

  const result = await runCascade({
    pipeline: 'explainWallet',
    userId: input.userId,
    mode: input.mode ?? 'fast',
    inputs: {
      address: input.address,
      mode: input.mode ?? 'fast',
      trades30d: stats?.trades_30d ?? 0,
    },
    scanContext: {
      sourceWallet: input.address,
      walletActivityFingerprint,
    },
    systemPrompt: system,
    userPrompt: user,
  });

  return {
    data: result.data as ExplainWalletOutput,
    cacheHit: result.cacheHit,
    fromCache: result.fromCache,
    modelUsed: result.modelUsed,
    costUsd: result.costUsd,
  };
}

export { ExplainWalletOutputSchema };
