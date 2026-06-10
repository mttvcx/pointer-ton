import 'server-only';

import { PublicKey } from '@solana/web3.js';
import { getConnection } from '@/lib/solana/connection';
import { heliusCall, HELIUS_CREDITS } from '@/lib/helius/creditLogger';

/** Known program owners for locked / vault token accounts. */
const LOCKED_VAULT_PROGRAM_LABELS: Readonly<Record<string, string>> = {
  '11111111111111111111111111111111': 'Wallet account',
  strmRqUCoQUgGUan5YhzUZa6KqdzwX5L6FpUxfmKg5y: 'Streamflow vesting',
  TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA: 'SPL token account',
  TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb: 'Token-2022 account',
};

const cache = new Map<string, { at: number; hint: LockedVaultHint }>();
const CACHE_MS = 30 * 60_000;

export type LockedVaultHint = {
  ownerProgram: string | null;
  ownerLabel: string | null;
  /** Human tooltip — never invented beyond on-chain owner + supply facts. */
  tooltip: string;
};

export async function resolveLockedVaultHint(
  address: string,
  pctSupply?: number | null,
): Promise<LockedVaultHint> {
  const key = address.trim();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.hint;

  let ownerProgram: string | null = null;
  let ownerLabel: string | null = null;

  try {
    const info = await heliusCall('getAccountInfo', HELIUS_CREDITS.RPC, () =>
      getConnection().getAccountInfo(new PublicKey(key)),
    );
    ownerProgram = info?.owner?.toBase58() ?? null;
    ownerLabel = ownerProgram ? (LOCKED_VAULT_PROGRAM_LABELS[ownerProgram] ?? ownerProgram) : null;
  } catch {
    /* optional */
  }

  const pct =
    pctSupply != null && Number.isFinite(pctSupply)
      ? `${pctSupply.toFixed(2)}% supply`
      : 'high supply';

  const tooltip = ownerLabel
    ? `Locked ${pct} · ${ownerLabel} · ${key}`
    : `Locked ${pct} · no trades · ${key}`;

  const hint: LockedVaultHint = { ownerProgram, ownerLabel, tooltip };
  cache.set(key, { at: Date.now(), hint });
  return hint;
}
