import 'server-only';

import type { AuthorizationContext } from '@privy-io/node';

/** Normalize PEM or raw base64 PKCS8 private key for Privy authorization_context. */
export function normalizePrivyAuthorizationPrivateKey(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.includes('BEGIN')) return trimmed.replace(/\s/g, '');
  const body = trimmed
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s/g, '');
  return body;
}

export function getPrivySignerKeyQuorumId(): string | null {
  const id = process.env.PRIVY_SIGNER_KEY_QUORUM_ID?.trim();
  return id || null;
}

export function buildPrivyAuthorizationContext(): AuthorizationContext | null {
  const raw = process.env.PRIVY_AUTHORIZATION_PRIVATE_KEY?.trim();
  if (!raw) return null;
  return {
    authorization_private_keys: [normalizePrivyAuthorizationPrivateKey(raw)],
  };
}

export function serverSignerConfigured(): boolean {
  return Boolean(buildPrivyAuthorizationContext() && getPrivySignerKeyQuorumId());
}
