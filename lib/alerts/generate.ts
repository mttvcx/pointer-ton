import 'server-only';

import { subMinutes } from 'date-fns';
import { insertAlert } from '@/lib/db/alerts';
import { createAdminSupabase } from '@/lib/supabase/server';
import { emitMatchingPulseLaunchpadAlertRules } from '@/lib/alerts/emitAlertRuleMatches';
import type { PulseNewTokenAlertInput } from '@/lib/alerts/pulseNewTokenTypes';

/** Broadcast alert: new fungible indexed into Pulse (DAS, webhook, or TonAPI poll/hydrate). */
export const ALERT_TYPE_PULSE_NEW_TOKEN = 'pulse_new_token' as const;

export type { PulseNewTokenAlertInput } from '@/lib/alerts/pulseNewTokenTypes';

const DEDUP_WINDOW_MINUTES = 120;

async function hasRecentPulseNewTokenAlert(mint: string): Promise<boolean> {
  const supabase = createAdminSupabase();
  const since = subMinutes(new Date(), DEDUP_WINDOW_MINUTES).toISOString();
  const { data, error } = await supabase
    .from('alerts')
    .select('id')
    .is('user_id', null)
    .eq('type', ALERT_TYPE_PULSE_NEW_TOKEN)
    .gte('created_at', since)
    .contains('payload', { mint })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn('[alerts] dedup query failed:', error.message);
    return false;
  }
  return data != null;
}

/**
 * Upserts a global ticker row (`user_id` IS NULL) when a new token is first indexed.
 * Best-effort: failures are logged and swallowed so ingest paths keep working.
 */
export async function emitGlobalPulseNewTokenAlert(input: PulseNewTokenAlertInput): Promise<void> {
  try {
    if (await hasRecentPulseNewTokenAlert(input.mint)) return;

    const launchpad =
      input.launchpad && input.launchpad !== 'unknown' ? input.launchpad : null;

    await insertAlert({
      user_id: null,
      type: ALERT_TYPE_PULSE_NEW_TOKEN,
      payload: {
        mint: input.mint,
        symbol: input.symbol ?? undefined,
        name: input.name ?? undefined,
        launchpad,
        source: input.source,
        wallet: input.creator_wallet ?? undefined,
        signature: input.tx_signature ?? undefined,
        summary:
          input.symbol || input.name
            ? `New token: ${[input.symbol, input.name].filter(Boolean).join(' - ')}`
            : `New token mint ${input.mint.slice(0, 4)}...`,
      },
    });

    await emitMatchingPulseLaunchpadAlertRules({
      ...input,
      launchpad,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[alerts] emitGlobalPulseNewTokenAlert failed:', msg);
  }
}
