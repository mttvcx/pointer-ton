/**
 * Environment contract — pure, no I/O (unit-testable). `scripts/validate-env.mjs`
 * runs `validateEnv(process.env)` at deploy preflight; CI validates the schema
 * shape. Keep this in sync with `.env.example`.
 *
 * A group is satisfied if ANY of its keys is set (handles renamed/alternate keys
 * like the legacy service-role vs newer secret key). `required` groups missing →
 * the app cannot run correctly; `recommended` → a feature degrades but the app
 * boots.
 */
export type EnvGroup = {
  /** Stable id for the requirement (for messages). */
  id: string;
  /** Satisfied if ANY of these env keys is present + non-empty. */
  anyOf: string[];
  tier: 'required' | 'recommended';
  /** What breaks if this is missing. */
  note: string;
};

export const ENV_GROUPS: EnvGroup[] = [
  // --- required: app cannot function ---
  { id: 'supabase_url', anyOf: ['SUPABASE_SERVICE_URL', 'NEXT_PUBLIC_SUPABASE_URL'], tier: 'required', note: 'Supabase project URL — all DB access' },
  { id: 'supabase_service_key', anyOf: ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY'], tier: 'required', note: 'Supabase service role — server DB writes' },
  { id: 'supabase_anon_key', anyOf: ['NEXT_PUBLIC_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'], tier: 'required', note: 'Supabase anon/publishable key — client' },
  { id: 'privy_app_id', anyOf: ['NEXT_PUBLIC_PRIVY_APP_ID'], tier: 'required', note: 'Privy auth — sign-in + token verification' },
  { id: 'app_url', anyOf: ['NEXT_PUBLIC_APP_URL'], tier: 'required', note: 'Canonical app URL — CORS, links, callbacks' },
  { id: 'helius', anyOf: ['HELIUS_API_KEY', 'NEXT_PUBLIC_HELIUS_API_KEY'], tier: 'required', note: 'Helius RPC/DAS — ingestion + balances + trades' },
  { id: 'redis', anyOf: ['UPSTASH_REDIS_REST_URL'], tier: 'required', note: 'Upstash Redis — emergency controls, quotas, breakers, webhook queue' },
  { id: 'redis_token', anyOf: ['UPSTASH_REDIS_REST_TOKEN'], tier: 'required', note: 'Upstash Redis auth token' },
  { id: 'session_secret', anyOf: ['POINTER_SESSION_SECRET'], tier: 'required', note: 'Server session signing' },
  { id: 'cron_secret', anyOf: ['CRON_SECRET'], tier: 'required', note: 'Cron + internal job authorization' },

  // --- recommended: a subsystem degrades without it ---
  { id: 'helius_webhook_auth', anyOf: ['HELIUS_WEBHOOK_AUTH_TOKEN'], tier: 'recommended', note: 'Inbound webhook authentication' },
  { id: 'admin_secret', anyOf: ['POINTER_ADMIN_SECRET'], tier: 'recommended', note: 'Break-glass admin access' },
  { id: 'jupiter', anyOf: ['JUPITER_API_KEY'], tier: 'recommended', note: 'Jupiter quote/swap rate limits' },
  { id: 'vapid', anyOf: ['VAPID_PRIVATE_KEY'], tier: 'recommended', note: 'Web push notifications' },
  { id: 'sentry', anyOf: ['NEXT_PUBLIC_SENTRY_DSN'], tier: 'recommended', note: 'Error reporting' },
  { id: 'kalshi', anyOf: ['KALSHI_API_KEY_ID'], tier: 'recommended', note: 'Predictions markets' },
  { id: 'insightx', anyOf: ['INSIGHTX_API_KEY'], tier: 'recommended', note: 'Bubble maps / risk' },
  { id: 'ops_alerting', anyOf: ['OPS_DISCORD_WEBHOOK_URL', 'OPS_SLACK_WEBHOOK_URL'], tier: 'recommended', note: 'Ops incident alerting (Discord/Slack) — paged on error/critical' },
];

export type EnvValidation = {
  ok: boolean;
  missingRequired: string[]; // group ids
  missingRecommended: string[];
};

const has = (env: Record<string, string | undefined>, key: string): boolean => {
  const v = env[key];
  return typeof v === 'string' && v.trim().length > 0;
};

/** Validate an env bag against the contract. Pure. */
export function validateEnv(env: Record<string, string | undefined>): EnvValidation {
  const missingRequired: string[] = [];
  const missingRecommended: string[] = [];
  for (const g of ENV_GROUPS) {
    const satisfied = g.anyOf.some((k) => has(env, k));
    if (satisfied) continue;
    if (g.tier === 'required') missingRequired.push(g.id);
    else missingRecommended.push(g.id);
  }
  return { ok: missingRequired.length === 0, missingRequired, missingRecommended };
}

/** Schema self-check (used by CI without secrets): the contract must be well-formed. */
export function validateSchemaShape(): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const g of ENV_GROUPS) {
    if (ids.has(g.id)) errors.push(`duplicate group id: ${g.id}`);
    ids.add(g.id);
    if (g.anyOf.length === 0) errors.push(`group ${g.id} has no keys`);
    if (g.tier !== 'required' && g.tier !== 'recommended') errors.push(`group ${g.id} bad tier`);
  }
  return { ok: errors.length === 0, errors };
}
