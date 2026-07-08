/**
 * Sibyl model family — the single source of truth for naming.
 *
 * Why these names (so branding reads intentional, not arbitrary):
 *   • Sibyl  — a prophetess / oracle: prophetic crypto intelligence.
 *   • Oracle Council — the multi-agent reasoning ENGINE (specialist fan-out + judge);
 *     a council of models that out-reasons any single one (mixture-of-agents).
 *   • Veil   — confidential / private inference (a "veiled" oracle, running inside
 *     an attested TEE enclave).
 *
 * Analogy:  Anthropic·Claude·Opus·4.8  →  Pointer·Sibyl·(7.0 / Veil)·7.0.
 * The underlying inference (open/closed models, TEE or not) is an implementation
 * detail Sibyl NEVER reveals — see SIBYL_STYLE identity. Client-safe (no server-only).
 */
export const SIBYL_COMPANY = 'Pointer';
export const SIBYL_FAMILY = 'Sibyl';
export const SIBYL_VERSION = '7.0';

/** The multi-agent reasoning engine that powers the flagship. */
export const SIBYL_COUNCIL = 'Oracle Council';

export type SibylModelKey = 'flagship' | 'veil';

export const SIBYL_MODELS: Record<
  SibylModelKey,
  { key: SibylModelKey; name: string; full: string; blurb: string }
> = {
  // Flagship — the full Oracle Council fan-out.
  flagship: { key: 'flagship', name: `Sibyl ${SIBYL_VERSION}`, full: `Sibyl ${SIBYL_VERSION}`, blurb: `Flagship — the ${SIBYL_COUNCIL}.` },
  // Confidential — the same council, running privately inside an attested enclave.
  veil: { key: 'veil', name: 'Sibyl Veil', full: 'Sibyl Veil', blurb: 'Confidential — private, attested enclave.' },
};

/** Product model name for a given execution mode. */
export function sibylModelForMode(mode: 'fast' | 'secure' | 'confidential') {
  return mode === 'confidential' ? SIBYL_MODELS.veil : SIBYL_MODELS.flagship;
}
