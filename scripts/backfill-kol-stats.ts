/**
 * Backfill wallet-level PnL / win-rate for the tracked KOLs.
 *
 * Pulls each KOL's last N days of swaps from Helius, inserts them via the
 * existing dedup-aware `insertMintSwap`, then runs `aggregateGlobalWalletStats`
 * to populate `wallet_stats` (the table the KOL desk reads — currently 0 rows).
 *
 * SAFE BY DEFAULT: dry-run unless you pass --apply. Validate one wallet first.
 *
 * Usage:
 *   # dry-run a single wallet (reports swaps + credits, writes nothing):
 *   node --import tsx scripts/backfill-kol-stats.ts --wallet <ADDR>
 *   # apply one wallet for real:
 *   node --import tsx scripts/backfill-kol-stats.ts --wallet <ADDR> --apply
 *   # full run, all KOLs, 30 days:
 *   node --import tsx scripts/backfill-kol-stats.ts --apply
 *
 * Flags: --wallet <addr> | --kols <N> | --days <N> | --max-pages <N>
 *        --delay <ms between pages> | --apply | --dry-run
 */
import path from 'node:path';
import { config } from 'dotenv';

config({ path: path.join(process.cwd(), '.env.local') });
config({ path: path.join(process.cwd(), '.env') });

import { starterKolEntriesForChain } from '../lib/track/starterKolPacks';
import { fetchWalletSwapHistory } from '../lib/indexer/fetchWalletSwapHistory';
import { insertMintSwap, listMintSwapsSince } from '../lib/db/mintSwaps';
import { aggregateGlobalWalletStats } from '../lib/indexer/aggregateGlobalWalletStats';

const WSOL_MINT = 'So11111111111111111111111111111111111111112';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function fetchSolUsdSpot(): Promise<number | null> {
  try {
    const base =
      process.env.JUPITER_PRICE_API_URL?.replace(/\/$/, '') ?? 'https://api.jup.ag/price/v3';
    const res = await fetch(`${base}?ids=${WSOL_MINT}`, { signal: AbortSignal.timeout(8_000) });
    if (!res.ok) return null;
    const json = (await res.json()) as Record<string, { usdPrice?: number }>;
    const px = json[WSOL_MINT]?.usdPrice;
    return px != null && Number.isFinite(px) ? px : null;
  } catch {
    return null;
  }
}

/** Run `fn` over items with bounded concurrency. */
async function pool<T>(items: T[], n: number, fn: (item: T) => Promise<void>): Promise<void> {
  let idx = 0;
  const workers = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (idx < items.length) {
      const cur = items[idx++]!;
      await fn(cur);
    }
  });
  await Promise.all(workers);
}

async function main() {
  const apply = flag('apply') && !flag('dry-run');
  const days = Number(arg('days') ?? 30);
  const maxPages = Number(arg('max-pages') ?? 40);
  const pageDelayMs = Number(arg('delay') ?? 150);
  const singleWallet = arg('wallet');
  const kolLimit = arg('kols') ? Number(arg('kols')) : undefined;

  const sinceMs = Date.now() - days * 86_400_000;
  const sinceIso = new Date(sinceMs).toISOString();

  let wallets: string[];
  if (singleWallet) {
    wallets = [singleWallet.trim()];
  } else {
    const seen = new Set<string>();
    wallets = starterKolEntriesForChain('sol')
      .map((k) => k.wallet.trim())
      .filter((w) => w && !seen.has(w) && (seen.add(w), true));
    if (kolLimit) wallets = wallets.slice(0, kolLimit);
  }

  const solUsd = await fetchSolUsdSpot();

  console.log('─'.repeat(64));
  console.log(`KOL stats backfill — ${apply ? 'APPLY' : 'DRY-RUN (no writes)'}`);
  console.log(`wallets=${wallets.length} days=${days} maxPages=${maxPages} solUsd=${solUsd ?? 'n/a'}`);
  console.log('─'.repeat(64));

  let totalSwaps = 0;
  let totalInserted = 0;
  let totalDuplicate = 0;
  let totalCredits = 0;
  let totalPages = 0;

  for (let i = 0; i < wallets.length; i++) {
    const w = wallets[i]!;
    const label = `${String(i + 1).padStart(2)}/${wallets.length} ${w.slice(0, 6)}…${w.slice(-4)}`;
    try {
      const res = await fetchWalletSwapHistory(w, { solUsd, sinceMs, maxPages, pageDelayMs });
      totalSwaps += res.swaps.length;
      totalCredits += res.creditsEstimated;
      totalPages += res.pagesFetched;

      let inserted = 0;
      let dup = 0;
      if (apply) {
        await pool(res.swaps, 8, async (swap) => {
          const r = await insertMintSwap(swap).catch(() => 'error' as const);
          if (r === 'inserted') inserted += 1;
          else if (r === 'duplicate') dup += 1;
        });
        totalInserted += inserted;
        totalDuplicate += dup;
      }

      console.log(
        `${label}  swaps=${String(res.swaps.length).padStart(4)} ` +
          `pages=${res.pagesFetched} fails=${res.parserFailures} ` +
          `~credits=${res.creditsEstimated}` +
          (apply ? `  inserted=${inserted} dup=${dup}` : '') +
          (res.reachedWindowEdge ? '' : '  ⚠ hit maxPages before 30d edge'),
      );
    } catch (err) {
      console.log(`${label}  ERROR ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log('─'.repeat(64));
  console.log(
    `Fetched: ${totalSwaps} swaps over ${totalPages} pages · ~${totalCredits} Helius credits`,
  );

  if (apply) {
    console.log(`Inserted ${totalInserted} new, ${totalDuplicate} duplicates skipped.`);
    console.log('Aggregating wallet_stats…');
    const swaps = await listMintSwapsSince(sinceIso, 200_000);
    const { upserted } = await aggregateGlobalWalletStats(swaps);
    console.log(`✅ wallet_stats upserted: ${upserted} wallets (from ${swaps.length} swaps in window)`);
  } else {
    console.log('Dry-run only — re-run with --apply to write swaps + wallet_stats.');
  }
  console.log('─'.repeat(64));
}

main().catch((err) => {
  console.error('backfill-kol-stats failed:', err);
  process.exit(1);
});
