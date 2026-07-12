/**
 * Harve model family — the single source of truth for naming.
 *
 * Why these names (so branding reads intentional, not arbitrary):
 *   • Harve  — Pointer's crypto-intelligence analyst: a name, not a tool, so it
 *     reads as someone who reads the market for you (and quietly, harve → harvest:
 *     it harvests alpha out of the noise).
 *   • Oracle Council — the multi-agent reasoning ENGINE (specialist fan-out + judge);
 *     a council of models that out-reasons any single one (mixture-of-agents).
 *   • Veil   — confidential / private inference (runs inside an attested TEE enclave).
 *
 * Analogy:  Anthropic·Claude·Opus·4.8  →  Pointer·Harve·(Oracle / Veil).
 * The underlying inference (open/closed models, TEE or not) is an implementation
 * detail Harve NEVER reveals — see SIBYL_STYLE identity. Client-safe (no server-only).
 * (Internal identifiers/routes/env vars keep the `sibyl`/`SIBYL_` prefix — opaque
 * wiring, unrelated to the product name.)
 */
export const SIBYL_COMPANY = 'Pointer';
export const SIBYL_FAMILY = 'Harve';

/** The multi-agent reasoning engine that powers Oracle. */
export const SIBYL_COUNCIL = 'Council';

export type SibylModelKey = 'flagship' | 'veil';

export const SIBYL_MODELS: Record<
  SibylModelKey,
  { key: SibylModelKey; name: string; full: string; blurb: string }
> = {
  // Flagship model — Oracle (like Opus). Powered by the full Council fan-out.
  flagship: { key: 'flagship', name: 'Oracle 7.0', full: 'Harve Oracle 7.0', blurb: 'Flagship — the full Council.' },
  // Confidential model — Veil (a "veiled" oracle), runs privately in an attested enclave.
  veil: { key: 'veil', name: 'Veil 6.5', full: 'Harve Veil 6.5', blurb: 'Confidential — private, attested enclave.' },
};

/** Product model name for a given execution mode. */
export function sibylModelForMode(mode: 'fast' | 'secure' | 'confidential') {
  return mode === 'confidential' ? SIBYL_MODELS.veil : SIBYL_MODELS.flagship;
}
