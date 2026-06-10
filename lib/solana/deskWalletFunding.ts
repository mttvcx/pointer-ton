import 'server-only';

import { formatCompactNumber } from '@/lib/format';
import { cexVenueForFundingSource } from '@/lib/solana/cexFundingWallets';
import {
  estimateWalletSignatureCount,
  findRecentIncomingSolFunding,
} from '@/lib/solana/walletFunding';
import type { HolderDeskSynthFunding } from '@/lib/tokens/holderDeskSynth';
import { lamportsToSol } from '@/lib/utils/formatters';

const fundingCache = new Map<string, { at: number; value: DeskWalletFundingResult }>();
const FUNDING_CACHE_MS = 10 * 60_000;

/** Funding received within this window counts as "fresh funded" (Axiom green leaf). */
const FRESH_FUNDING_MAX_AGE_MS = 14 * 24 * 60 * 60_000;
/** Private-wallet funding: also require low on-chain history. */
const FRESH_WALLET_MAX_SIGS = 25;

export type DeskWalletFundingResult = {
  funding: HolderDeskSynthFunding | null;
  /** True when wallet was recently funded from CEX or a young private wallet — not trade-age. */
  isFreshFunded: boolean;
  fundingSourceAddress: string | null;
  isCexFunded: boolean;
};

function formatAgeSinceFund(blockTimeSec: number | null): string | null {
  if (blockTimeSec == null || !Number.isFinite(blockTimeSec)) return null;
  const ms = Date.now() - blockTimeSec * 1000;
  if (ms < 0) return 'now';
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${Math.max(1, m)}m`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 60) return `${d}d`;
  const mo = Math.floor(d / 30);
  if (mo < 24) return `${mo}mo`;
  return `${Math.floor(mo / 12)}y`;
}

/**
 * Resolve real desk funding row + fresh-funded flag from on-chain SOL ingress.
 * Does not invent CEX labels — unknown sources show as funding wallet address.
 */
export async function resolveDeskWalletFunding(
  walletAddress: string,
): Promise<DeskWalletFundingResult> {
  const key = walletAddress.trim();
  const hit = fundingCache.get(key);
  if (hit && Date.now() - hit.at < FUNDING_CACHE_MS) return hit.value;

  const empty: DeskWalletFundingResult = {
    funding: null,
    isFreshFunded: false,
    fundingSourceAddress: null,
    isCexFunded: false,
  };

  let incoming: Awaited<ReturnType<typeof findRecentIncomingSolFunding>>;
  try {
    incoming = await findRecentIncomingSolFunding(key, { scanLimit: 24 });
  } catch {
    fundingCache.set(key, { at: Date.now(), value: empty });
    return empty;
  }
  if (!incoming) {
    fundingCache.set(key, { at: Date.now(), value: empty });
    return empty;
  }

  const cexVenue = cexVenueForFundingSource(incoming.fromAddress);
  const venue = cexVenue ?? incoming.fromAddress;
  const ageSinceFund = formatAgeSinceFund(incoming.blockTime);
  const solNum = lamportsToSol(incoming.lamportsReceived);
  const solFunding =
    Number.isFinite(solNum) && solNum > 0 ? formatCompactNumber(solNum) : null;

  const funding: HolderDeskSynthFunding = {
    venue,
    ageSinceFund,
    solFunding,
    txCount: 1,
    sharedFundedCount: 1,
  };

  const fundAgeMs =
    incoming.blockTime != null ? Date.now() - incoming.blockTime * 1000 : null;
  const recentFund =
    fundAgeMs != null && fundAgeMs >= 0 && fundAgeMs <= FRESH_FUNDING_MAX_AGE_MS;

  let isFreshFunded = false;
  if (recentFund && cexVenue) {
    isFreshFunded = true;
  } else if (recentFund && !cexVenue) {
    const sigCount = await estimateWalletSignatureCount(key);
    isFreshFunded = sigCount != null && sigCount <= FRESH_WALLET_MAX_SIGS;
  }

  const result: DeskWalletFundingResult = {
    funding,
    isFreshFunded,
    fundingSourceAddress: incoming.fromAddress,
    isCexFunded: Boolean(cexVenue),
  };
  fundingCache.set(key, { at: Date.now(), value: result });
  return result;
}

/** Batch resolve with modest concurrency for holder desk APIs. */
export async function resolveDeskWalletFundingBatch(
  wallets: string[],
  concurrency = 2,
): Promise<Map<string, DeskWalletFundingResult>> {
  const out = new Map<string, DeskWalletFundingResult>();
  const unique = [...new Set(wallets.map((w) => w.trim()).filter(Boolean))];
  let i = 0;

  async function worker() {
    while (i < unique.length) {
      const idx = i++;
      const w = unique[idx]!;
      out.set(w, await resolveDeskWalletFunding(w));
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, unique.length) }, () => worker()));
  return out;
}
