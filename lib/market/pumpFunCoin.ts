import 'server-only';

/** Public pump.fun coin row — social + creator for Pulse row hydration. */
export type PumpFunCoinRow = {
  mint: string;
  name: string | null;
  symbol: string | null;
  twitter: string | null;
  telegram: string | null;
  website: string | null;
  creator: string | null;
  description: string | null;
  image_uri: string | null;
  /** Bonding curve complete — token migrated off pump.fun. */
  complete: boolean;
};

const BASE = 'https://frontend-api-v3.pump.fun/coins';

function pickString(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

/** Best-effort pump.fun coin metadata (no auth). Returns null on 404 / network errors. */
export async function fetchPumpFunCoin(mint: string): Promise<PumpFunCoinRow | null> {
  const id = mint.trim();
  if (!id) return null;
  try {
    const res = await fetch(`${BASE}/${encodeURIComponent(id)}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(6_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as Record<string, unknown>;
    return {
      mint: pickString(json.mint) ?? id,
      name: pickString(json.name),
      symbol: pickString(json.symbol),
      twitter: pickString(json.twitter),
      telegram: pickString(json.telegram),
      website: pickString(json.website),
      creator: pickString(json.creator),
      description: pickString(json.description),
      image_uri: pickString(json.image_uri),
      complete: json.complete === true,
    };
  } catch {
    return null;
  }
}

export function isLikelyPumpFunMint(mint: string, launchPad: string | null | undefined): boolean {
  if (launchPad === 'pump.fun') return true;
  return mint.toLowerCase().endsWith('pump');
}
