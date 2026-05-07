import 'server-only';
import {
  getRecentSignaturesForAddress,
  getSolBalanceLamports,
} from '@/lib/solana/recent-activity';

export type TrackedWalletEnrichment = {
  lamports: string | null;
  lastActiveUnix: number | null;
};

const BATCH = 8;

/** RPC-backed balance + most recent signature time per address (best-effort). */
export async function enrichTrackedWalletAddresses(
  addresses: readonly string[],
): Promise<Record<string, TrackedWalletEnrichment>> {
  const out: Record<string, TrackedWalletEnrichment> = {};
  for (let i = 0; i < addresses.length; i += BATCH) {
    const slice = addresses.slice(i, i + BATCH);
    await Promise.all(
      slice.map(async (addr) => {
        try {
          const [lamports, sigs] = await Promise.all([
            getSolBalanceLamports(addr),
            getRecentSignaturesForAddress(addr, 1),
          ]);
          const last = sigs[0]?.blockTime ?? null;
          out[addr] = {
            lamports: lamports.toString(),
            lastActiveUnix: last,
          };
        } catch {
          out[addr] = { lamports: null, lastActiveUnix: null };
        }
      }),
    );
  }
  return out;
}
