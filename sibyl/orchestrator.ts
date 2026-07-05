import 'server-only';

import type { AgentName, PlanTier, SibylAnswer } from '@/sibyl/types';
import type { AgentContext, AgentResult } from '@/sibyl/agents/types';
import { classifyIntent } from '@/sibyl/intent';
import { clampModeToPlan } from '@/sibyl/pricing';
import {
  runAnalogAgent,
  runDuneAgent,
  runJudge,
  runMarketAgent,
  runNarrativeAgent,
  runRiskAgent,
  runSocialAgent,
  runWalletAgent,
} from '@/sibyl/agents/runners';

/**
 * Sibyl's single intelligence layer. The dashboard chat, the future public API
 * (POST /v1/token/analyze …), the extension, and mobile all call THIS — never a
 * separate backend. Query → intent → plan-clamped mode → specialist fan-out →
 * judge → CT-native answer + interactive cards.
 */
const RUNNERS: Record<Exclude<AgentName, 'judge'>, (ctx: AgentContext) => Promise<AgentResult>> = {
  market: runMarketAgent,
  wallet: runWalletAgent,
  narrative: runNarrativeAgent,
  social: runSocialAgent,
  risk: runRiskAgent,
  dune: runDuneAgent,
  analog: runAnalogAgent,
};

export async function askSibyl(query: string, tier: PlanTier = 'FREE'): Promise<SibylAnswer> {
  const intent = classifyIntent(query);
  const mode = clampModeToPlan(intent.mode, tier);

  const ctx: AgentContext = {
    query,
    mint: intent.subject.kind === 'token' ? intent.subject.ref : null,
    chain: intent.subject.chain ?? 'sol',
    handle: intent.subject.kind === 'person' ? intent.subject.ref : null,
    narrative: intent.subject.kind === 'narrative' ? intent.subject.ref : null,
  };

  const specialists = intent.agents.filter((a): a is Exclude<AgentName, 'judge'> => a !== 'judge');
  const results = (await Promise.all(specialists.map((a) => RUNNERS[a](ctx).catch(() => null)))).filter(
    (r): r is AgentResult => r != null,
  );

  return runJudge(query, mode, results);
}
