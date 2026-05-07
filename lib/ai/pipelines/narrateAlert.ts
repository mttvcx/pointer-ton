import 'server-only';

import { runCascade } from '@/lib/ai/cascade';
import { NarrateAlertOutputSchema, type NarrateAlertOutput } from '@/lib/ai/schemas';
import { getAlertById, updateAlertNarration } from '@/lib/db/alerts';

export interface NarrateAlertInput {
  alertId: string;
  /** User to bill the cascade against (Pointer user id). */
  userId: string;
}

const SYSTEM_PROMPT = [
  'You are Pointer, narrating an in-app trading alert in two short lines.',
  'Be specific, factual, never financial advice.',
  'Headline <= 80 chars. Body <= 280 chars. No emojis. No exclamation points.',
].join(' ');

export async function narrateAlert(input: NarrateAlertInput): Promise<{
  data: NarrateAlertOutput;
  cacheHit: boolean;
  modelUsed: string;
  costUsd: number;
}> {
  const alert = await getAlertById(input.alertId);
  if (!alert) throw new Error('alert_not_found');

  // Refuse to re-narrate confirmed text. Caller can clear `ai_narration` if it
  // wants a regen.
  if (alert.ai_narration) {
    return {
      data: {
        headline: alert.ai_narration.split('\n')[0]?.slice(0, 120) ?? alert.ai_narration,
        body: alert.ai_narration,
        severity: 'info',
      },
      cacheHit: true,
      modelUsed: 'cached:db',
      costUsd: 0,
    };
  }

  const payloadStr = JSON.stringify(alert.payload).slice(0, 1200);
  const userPrompt = [
    `Alert type: ${alert.type}`,
    `Payload: ${payloadStr}`,
    '',
    'Respond as JSON: { "headline": string, "body": string, "severity": "info"|"warn"|"critical" }',
  ].join('\n');

  const result = await runCascade({
    pipeline: 'narrateAlert',
    userId: input.userId,
    inputs: {
      alertId: alert.id,
      type: alert.type,
      payload: alert.payload,
    },
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    // Webhook-driven; no points award per call (we already award on cascade
    // proper for user-initiated calls).
    skipPointsAward: true,
  });

  const narration = `${result.data.headline}\n${result.data.body}`;
  try {
    await updateAlertNarration(alert.id, narration);
  } catch (err) {
    console.warn('[ai] narrateAlert: persist narration failed', err);
  }

  return {
    data: result.data as NarrateAlertOutput,
    cacheHit: result.cacheHit,
    modelUsed: result.modelUsed,
    costUsd: result.costUsd,
  };
}

export { NarrateAlertOutputSchema };
