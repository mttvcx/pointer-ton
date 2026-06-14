/** Match Kolscan 6-char prefix or Axiom `BCag...UPJd` partial against a full address. */
export function matchesPartialAddress(full: string, partial: string): boolean {
  const p = partial.trim();
  if (!p || !full) return false;

  if (p.includes('...')) {
    const [pre, suf] = p.split('...');
    if (!pre || !suf) return false;
    return full.startsWith(pre) && full.endsWith(suf);
  }

  return full.startsWith(p);
}

export function resolvePartialAddress(
  partial: string,
  candidates: string[],
): { address: string | null; matches: string[] } {
  const matches = candidates.filter((c) => matchesPartialAddress(c, partial));
  if (matches.length === 1) return { address: matches[0]!, matches };
  return { address: null, matches };
}

/** Extract unique Solana base58 addresses from free-form paste text. */
export function extractSolanaAddressesFromText(text: string): string[] {
  const re = /[1-9A-HJ-NP-Za-km-z]{32,44}/g;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of text.matchAll(re)) {
    const addr = m[0]!;
    if (seen.has(addr)) continue;
    seen.add(addr);
    out.push(addr);
  }
  return out;
}
