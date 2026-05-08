import 'server-only';

import { runCascade } from '@/lib/ai/cascade';
import type { ParseTrackerRuleOutput } from '@/lib/ai/schemas';

export async function parseTrackerRuleNaturalLanguage(input: {
  userId: string;
  nlText: string;
  walletAddress: string;
  walletLabel: string | null;
}): Promise<ParseTrackerRuleOutput> {
  const system = [
    'You convert natural-language wallet tracker rules into strict JSON (TON network, jettons, launchpads).',
    'eventTypes (array, 1-6): token_launch = wallet creates/deploys a new token; swap_buy / swap_sell = buys or sells (future); any_trade = any swap including launches for broad "anything" rules.',
    'For "new token", "launches", "deploys", "mints" use token_launch and/or any_trade.',
    'launchpadsAnyOf: optional short names e.g. ["pump.fun","bags","moonshot","printr"] - use null or omit if user did not restrict launchpads.',
    'mintFilter: full token / jetton address if user names one token; else null.',
    'minSol: positive TON (native) threshold for swap rules only — use this JSON field name even though it is TON-notional; null for launch-only rules.',
    'summary: <=200 chars, human label shown in the UI (what this rule does).',
    'Respond ONLY with JSON: { "summary": string, "condition": { "eventTypes": [...], ... } }',
  ].join(' ');

  const user = [
    `Wallet: ${input.walletAddress}`,
    input.walletLabel ? `Label: ${input.walletLabel}` : null,
    `Rule: ${input.nlText.trim().slice(0, 800)}`,
  ]
    .filter(Boolean)
    .join('\n');

  const { data } = await runCascade({
    pipeline: 'parseTrackerRule',
    userId: input.userId,
    inputs: {
      nl: input.nlText.slice(0, 600),
      wallet: input.walletAddress,
    },
    systemPrompt: system,
    userPrompt: user,
    mode: 'fast',
  });

  return data;
}
