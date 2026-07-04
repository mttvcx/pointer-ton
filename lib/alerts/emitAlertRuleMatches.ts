import 'server-only';

import { insertAlert } from '@/lib/db/alerts';
import { listActivePulseLaunchpadRules } from '@/lib/db/alertRules';
import {
  ALERT_TYPE_ALERT_RULE,
  parsePulseLaunchpadRuleConfig,
} from '@/lib/alerts/alertRuleModel';
import type { PulseNewTokenAlertInput } from '@/lib/alerts/pulseNewTokenTypes';
import { notifyUser } from '@/lib/push/notifyUser';
import { alertProtocolFilterMatches } from '@/lib/protocol/alertProtocolMatch';

/**
 * Fan-out user alerts when a new Pulse token is indexed and matches saved rules.
 * Best-effort: never throws to callers on the ingest path.
 */
export async function emitMatchingPulseLaunchpadAlertRules(
  input: PulseNewTokenAlertInput,
): Promise<void> {
  try {
    const rules = await listActivePulseLaunchpadRules();
    if (rules.length === 0) return;

    for (const rule of rules) {
      if (rule.rule_type !== 'pulse_launchpad') continue;
      const config = parsePulseLaunchpadRuleConfig(rule.rule_config);
      if (!config) continue;

      if (
        !alertProtocolFilterMatches(
          input.launchpad ?? null,
          input.protocol_id ?? null,
          input.source_confidence ?? null,
          config.launchpads,
        )
      ) {
        continue;
      }

      const minLiq = config.minInitialLiquiditySol;
      if (minLiq != null && minLiq > 0) {
        const liq = input.initial_liquidity_sol;
        if (liq == null || !Number.isFinite(liq) || liq < minLiq) continue;
      }

      const summary =
        input.symbol || input.name
          ? `${rule.name}: ${[input.symbol, input.name].filter(Boolean).join(' - ')}`
          : `${rule.name}: new mint`;

      await insertAlert({
        user_id: rule.user_id,
        type: ALERT_TYPE_ALERT_RULE,
        payload: {
          message: summary,
          ruleId: rule.id,
          ruleName: rule.name,
          mint: input.mint,
          symbol: input.symbol ?? null,
          name: input.name ?? null,
          wallet: input.creator_wallet ?? undefined,
          launchpad: input.launchpad ?? null,
          source: input.source,
          flash: {
            enabled: rule.flash_enabled,
            color: rule.flash_color,
            size: rule.flash_size,
          },
          audio: {
            enabled: rule.audio_enabled,
            preset: rule.audio_preset,
            url: rule.audio_url,
          },
        },
      });

      try {
        const body =
          input.symbol || input.name
            ? [input.symbol, input.name].filter(Boolean).join(' - ')
            : 'New listing matched your rule';
        await notifyUser(rule.user_id, {
          title: `Rule: ${rule.name}`,
          body,
          url: `/token/${encodeURIComponent(input.mint)}`,
        });
      } catch (pushErr) {
        const m = pushErr instanceof Error ? pushErr.message : String(pushErr);
        console.warn('[alert_rules] web push failed:', m);
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[alert_rules] emitMatchingPulseLaunchpadAlertRules failed:', msg);
  }
}
