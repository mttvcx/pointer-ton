import 'server-only';

/**
 * Best-effort: treat `0x` as wallet vs token contract for search routing.
 * Full classification would hit RPC `getCode` — Phase 1 uses wallet default for ambiguous opens.
 */
export async function resolveEvmSearchAddressKind(
  address: string,
): Promise<'wallet' | 'token'> {
  const a = address.trim().toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(a)) return 'token';
  return 'wallet';
}
