'use client';

/**
 * Client / SDK attestation surface — "verify, don't trust." These call
 * /api/sibyl/attestation so a user, an enterprise, or a fund's own tooling can
 * confirm the confidential enclave (measurement + model hash) before relying on a
 * session. In the public SDK these become `sibyl.verifySession()` etc.
 */

export type SibylAttestation = {
  verified: boolean;
  provider: string | null;
  modelHash: string | null;
  measurement: string | null;
  quoteRef: string | null;
  verifiedAt: string;
  reason?: string;
};

export async function getAttestation(): Promise<{ configured: boolean; attestation: SibylAttestation }> {
  const res = await fetch('/api/sibyl/attestation', { cache: 'no-store' });
  if (!res.ok) throw new Error('attestation_fetch_failed');
  return (await res.json()) as { configured: boolean; attestation: SibylAttestation };
}

/** Gate before sending a confidential prompt — true only if the enclave verifies. */
export async function verifySession(): Promise<boolean> {
  const { attestation } = await getAttestation();
  return attestation.verified;
}

/** Pin the exact model a fund audited — refuse if a different model is running. */
export async function verifyModelHash(expected: string): Promise<boolean> {
  const { attestation } = await getAttestation();
  return attestation.verified && attestation.modelHash === expected;
}
