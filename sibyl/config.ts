/**
 * Sibyl runtime config. Everything is env-driven so the same code runs in mock
 * mode (zero keys — great demo) or with real providers/models as keys land.
 */

/**
 * MODEL mock: no LLM gateway key (and no explicit opt-out) → synthesize the
 * narrative/judge deterministically. This gates the *model* layer ONLY — it must
 * NOT gate data providers, which are real whenever their own key/data exists.
 */
export function sibylMockMode(): boolean {
  if (process.env.SIBYL_MOCK?.trim() === '1') return true;
  if (process.env.SIBYL_MOCK?.trim() === '0') return false;
  // Auto: mock when we have no model gateway configured at all.
  return !(process.env.OPENROUTER_API_KEY || process.env.SIBYL_MODEL_API_KEY || process.env.GROQ_API_KEY);
}

/**
 * DATA mock: hard-offline switch only. Data providers mock when this is on OR when
 * their own credential is missing — never merely because the LLM gateway is absent.
 * So a real HELIUS_API_KEY yields real holders even with zero model keys.
 */
export function sibylForceMock(): boolean {
  return process.env.SIBYL_MOCK?.trim() === '1';
}

export const SIBYL = {
  name: 'Sibyl',
  tagline: 'The intelligence engine for crypto.',
  /** Where it will live; today it rides the Pointer deployment under /sibyl. */
  futureHost: 'ai.pointer-ton-orcin.vercel.app',
} as const;
