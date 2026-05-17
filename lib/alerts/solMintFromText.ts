import { PublicKey } from '@solana/web3.js';

const BASE58_CANDIDATE = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;

/** Deduped validated Solana mints found in concatenated URLs + tweet text. */
export function extractSolMintCandidates(blob: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const m of blob.matchAll(BASE58_CANDIDATE)) {
    const s = m[0];
    try {
      const canon = new PublicKey(s).toBase58();
      if (seen.has(canon)) continue;
      seen.add(canon);
      out.push(canon);
    } catch {
      /* skip */
    }
  }
  return out;
}

export function normalizeTwitterHandle(raw: string): string {
  return raw.replace(/^@+/u, '').trim().toLowerCase();
}
