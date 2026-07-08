import 'server-only';

import type { InferenceMode } from '@/sibyl/inference/types';
import { confidentialConfigured } from '@/sibyl/inference/confidential';

export type ResolvedMode = { requested: InferenceMode; applied: InferenceMode; note: string | null };

/**
 * Resolve the mode we can HONESTLY honor:
 *  - `confidential` requires a paid tier AND a configured+attestable enclave; else
 *    we DOWNGRADE to `secure` (anon retrieval + zero-retention, normal model) and
 *    say so. We never claim "confidential" we can't cryptographically prove.
 *  - `secure` is available to any authenticated caller (near-free privacy).
 *  - `fast` is the default.
 */
export function resolveExecMode(requested: InferenceMode | undefined, tier: string): ResolvedMode {
  const req: InferenceMode = requested ?? 'fast';
  if (req === 'confidential') {
    if (tier === 'FREE') {
      return { requested: req, applied: 'secure', note: 'Confidential mode is an enterprise feature — running in Private mode.' };
    }
    if (!confidentialConfigured()) {
      return { requested: req, applied: 'secure', note: 'Confidential enclave not configured yet — running in Private mode.' };
    }
    return { requested: req, applied: 'confidential', note: null };
  }
  return { requested: req, applied: req, note: null };
}
