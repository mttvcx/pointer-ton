import { NextResponse } from 'next/server';
import { attestationConfigured, fetchAndVerifyAttestation } from '@/sibyl/inference/attestation';
import { confidentialConfigured } from '@/sibyl/inference/confidential';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/sibyl/attestation — the "verify us, don't trust us" endpoint. Returns
 * the confidential enclave's current attestation so a client / SDK / a fund's own
 * tooling can verify the enclave (measurement + model hash) BEFORE sending prompts.
 * Powers SDK verifySession() / getAttestation() / verifyModelHash().
 */
export async function GET() {
  const configured = confidentialConfigured() && attestationConfigured();
  const attestation = await fetchAndVerifyAttestation();
  return NextResponse.json({ configured, attestation });
}
