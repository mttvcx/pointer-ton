'use client';

import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

function hexToBytes(h: string): Uint8Array {
  const clean = h.length % 2 ? '0' + h : h;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}

/** Bytes from a Solana secret in JSON-array, hex, or base58 form. */
function solSecretBytes(secret: string): Uint8Array {
  if (secret.startsWith('[')) return Uint8Array.from(JSON.parse(secret) as number[]);
  if (/^[0-9a-fA-F]+$/.test(secret)) return hexToBytes(secret);
  return bs58.decode(secret);
}

/**
 * Derive the Solana public address from an imported secret key — client-side,
 * the key never leaves the browser. Accepts a 64-byte secret key (base58 like a
 * Phantom export, 128-char hex, or JSON array) or a 32-byte seed (64-char hex).
 * Imported wallets are stored view-only, so we only need the public address.
 */
export function deriveSolanaAddressFromSecret(secret: string): string {
  const s = secret.trim();
  if (!s) throw new Error('empty_key');
  let bytes: Uint8Array;
  try {
    bytes = solSecretBytes(s);
  } catch {
    throw new Error('unsupported_key_format');
  }
  try {
    const kp = bytes.length === 32 ? Keypair.fromSeed(bytes) : Keypair.fromSecretKey(bytes);
    return kp.publicKey.toBase58();
  } catch {
    throw new Error('unsupported_key_format');
  }
}
