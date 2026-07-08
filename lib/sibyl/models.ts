/**
 * Sibyl model family — the single source of truth for naming. Maps to the
 * Anthropic analogy:  Anthropic → Pointer,  Claude → Sibyl,  Opus/Sonnet → Oracle/Veil,
 * 4.8 → 7.0.  So the AI is "Pointer's Sibyl Oracle 7.0" (and "Sibyl Veil 7.0" for the
 * confidential/private model). The underlying inference (open/closed models, TEE or
 * not) is an implementation detail Sibyl NEVER reveals — see SIBYL_STYLE identity.
 *
 * Client-safe (no server-only) so the UI + prompts share one definition.
 */
export const SIBYL_COMPANY = 'Pointer';
export const SIBYL_FAMILY = 'Sibyl';
export const SIBYL_VERSION = '7.0';

export type SibylModelKey = 'oracle' | 'veil';

export const SIBYL_MODELS: Record<
  SibylModelKey,
  { key: SibylModelKey; name: string; full: string; blurb: string }
> = {
  // Flagship — the full multi-model reasoning council (mixture-of-agents).
  oracle: { key: 'oracle', name: 'Sibyl Oracle', full: `Sibyl Oracle ${SIBYL_VERSION}`, blurb: 'Flagship crypto reasoning — the full multi-model council.' },
  // Confidential — same brain, running privately inside an attested TEE enclave.
  veil: { key: 'veil', name: 'Sibyl Veil', full: `Sibyl Veil ${SIBYL_VERSION}`, blurb: 'Confidential — runs privately inside an attested enclave.' },
};

/** The product model name for a given execution mode. */
export function sibylModelForMode(mode: 'fast' | 'secure' | 'confidential') {
  return mode === 'confidential' ? SIBYL_MODELS.veil : SIBYL_MODELS.oracle;
}
