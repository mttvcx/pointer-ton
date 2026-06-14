/** Shared EVM address normalization (client + server safe). */

export function normalizeEvmAddress(addr: string): string | null {
  const a = addr.trim().toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(a)) return null;
  if (a === '0x0000000000000000000000000000000000000000') return null;
  return a;
}

/** Case-insensitive compare for `0x` contract addresses. */
export function evmAddressesMatch(a: string, b: string): boolean {
  const na = normalizeEvmAddress(a);
  const nb = normalizeEvmAddress(b);
  return na != null && nb != null && na === nb;
}

/** Map any EVM address form to the canonical lowercase mint stored in DB. */
export function resolveCanonicalEvmMint(
  addr: string,
  canonicalMints: Iterable<string>,
): string | null {
  const key = normalizeEvmAddress(addr);
  if (!key) return null;
  for (const mint of canonicalMints) {
    if (normalizeEvmAddress(mint) === key) return mint;
  }
  return null;
}
