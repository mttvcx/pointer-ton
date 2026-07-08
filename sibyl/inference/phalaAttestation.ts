import 'server-only';

import type { AttestationResult } from '@/sibyl/inference/types';

/**
 * Phala confidential-AI attestation adapter.
 *
 * v1 (this): confirm the target model is actually TEE-served by the gateway via
 * `GET /v1/models` (`is_tee`). The gateway itself runs in a TEE and publishes an
 * attestation report, so an `is_tee` model = confidential inference. This flips the
 * badge to "Verified (gateway)".
 *
 * v2 hardening (TODO): bind each response's `x-receipt-id` → `GET /v1/aci/receipts/{id}`
 * and check `workload_id` / `workload_keyset_digest` against a freshly fetched
 * attestation report (and, for max assurance, verify the raw quote via
 * cloud-api.phala.network/api/v1/attestations/verify). That upgrades "gateway says
 * TEE" to "hardware quote proves TEE for THIS response".
 */
export async function verifyPhalaAttestation(): Promise<AttestationResult> {
  const now = new Date().toISOString();
  const endpoint = process.env.SIBYL_CONFIDENTIAL_ENDPOINT?.trim() || '';
  const key = process.env.SIBYL_CONFIDENTIAL_API_KEY?.trim();
  const model = process.env.SIBYL_CONFIDENTIAL_MODEL?.trim() || '';
  // …/v1/chat/completions → …/v1
  const base = endpoint.replace(/\/chat\/completions\/?$/, '').replace(/\/$/, '');

  const fail = (reason: string): AttestationResult => ({
    verified: false,
    provider: 'phala',
    modelHash: model || null,
    measurement: null,
    quoteRef: null,
    verifiedAt: now,
    reason,
  });

  if (!base) return fail('endpoint_not_set');
  try {
    const res = await fetch(`${base}/models`, {
      headers: key ? { Authorization: `Bearer ${key}` } : {},
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return fail(`models_http_${res.status}`);
    const json = (await res.json()) as { data?: Array<{ id?: string; is_tee?: boolean }> };
    const list = json.data ?? [];
    // Match the configured model; if none configured, treat any TEE model as proof.
    const entry = model ? list.find((m) => m.id === model) : list.find((m) => m.is_tee);
    const isTee = Boolean(entry?.is_tee);
    if (!isTee) return fail(model ? 'model_not_tee_or_not_found' : 'no_tee_models');
    return {
      verified: true,
      provider: 'phala',
      modelHash: entry?.id ?? model ?? null,
      measurement: 'gateway:is_tee', // v1: gateway-level. v2: real quote measurement.
      quoteRef: null,
      verifiedAt: now,
    };
  } catch {
    return fail('attestation_error');
  }
}
