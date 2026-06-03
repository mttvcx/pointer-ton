/**
 * Internal commerce gate — UI stays production-polished; backend stays non-custodial
 * until legal/compliance sign-off.
 *
 * TODO(compliance): Region gate + age verification before PACKS_LIVE_COMMERCE_ENABLED.
 * TODO(compliance): Responsible spend limits + cooldown configuration.
 * TODO(fairness): Commit-reveal / VRF-backed provably-fair randomness.
 */
export const PACKS_LIVE_COMMERCE_ENABLED = false;

/** Server-side opens always use simulated ledger — no swap, no transfer. */
export const PACKS_OPEN_USES_SIMULATED_LEDGER = true;
