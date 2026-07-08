import 'server-only';

import { AsyncLocalStorage } from 'node:async_hooks';
import type { AttestationResult, InferenceMode } from '@/sibyl/inference/types';

/**
 * Request-scoped inference context. Set ONCE at the top of `askSibyl`, read by the
 * single `callModel` seam — so the mode (and therefore the confidential-vs-normal
 * backend) flows to every agent + the judge WITHOUT threading a param through all
 * seven runners. This is what keeps confidential compute an optional layer rather
 * than a rewrite.
 */
type Store = {
  mode: InferenceMode;
  onAttestation?: (a: AttestationResult) => void;
  /** Set once we've surfaced the attestation for this request (idempotent). */
  attested?: boolean;
};

const als = new AsyncLocalStorage<Store>();

export function runWithInference<T>(store: Store, fn: () => Promise<T>): Promise<T> {
  return als.run(store, fn);
}

export function currentInferenceMode(): InferenceMode {
  return als.getStore()?.mode ?? 'fast';
}

/** Surface the verified attestation to the caller exactly once per request. */
export function reportAttestation(a: AttestationResult): void {
  const s = als.getStore();
  if (s && !s.attested) {
    s.attested = true;
    s.onAttestation?.(a);
  }
}
