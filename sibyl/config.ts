/**
 * Sibyl runtime config. Everything is env-driven so the same code runs in mock
 * mode (zero keys — great demo) or with real providers/models as keys land.
 */

/** No LLM keys AND no explicit opt-out → mock everything so the dashboard works. */
export function sibylMockMode(): boolean {
  if (process.env.SIBYL_MOCK?.trim() === '1') return true;
  if (process.env.SIBYL_MOCK?.trim() === '0') return false;
  // Auto: mock when we have no model gateway configured at all.
  return !(process.env.OPENROUTER_API_KEY || process.env.SIBYL_MODEL_API_KEY || process.env.GROQ_API_KEY);
}

export const SIBYL = {
  name: 'Sibyl',
  tagline: 'The intelligence engine for crypto.',
  /** Where it will live; today it rides the Pointer deployment under /sibyl. */
  futureHost: 'ai.pointer.trade',
} as const;
