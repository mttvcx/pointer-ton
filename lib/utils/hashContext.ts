import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';

/** Stable short hash for cache keys — works in browser + Node (no `node:crypto`). */
export function hashContext(parts: Record<string, unknown>): string {
  const stable = JSON.stringify(parts, Object.keys(parts).sort());
  return bytesToHex(sha256(utf8ToBytes(stable))).slice(0, 12);
}
