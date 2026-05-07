import 'server-only';
import { getConnection } from '@/lib/solana/connection';

/**
 * Microlamports per compute unit at the given percentile of recent landed txs
 * (via standard RPC `getRecentPrioritizationFees` on Helius).
 */
export async function getRecommendedPriorityFee(percentile = 75): Promise<number> {
  const pct = Math.min(100, Math.max(0, percentile));
  const conn = getConnection();
  const rows = await conn.getRecentPrioritizationFees();
  if (rows.length === 0) return 50_000;

  const fees = rows.map((r) => r.prioritizationFee).sort((a, b) => a - b);
  const idx = Math.min(
    fees.length - 1,
    Math.max(0, Math.ceil((pct / 100) * fees.length) - 1),
  );
  return fees[idx] ?? fees[fees.length - 1] ?? 50_000;
}
