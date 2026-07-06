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
import { recallSubject, recordScan } from '@/sibyl/memory/persist';

/** Bound a promise so a slow/hung dependency can never stall the response. */
function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([p, new Promise<T>((res) => setTimeout(() => res(fallback), ms))]);
}

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

export async function askSibyl(
  query: string,
  tier: PlanTier = 'FREE',
  opts?: { userId?: string | null },
): Promise<SibylAnswer> {
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
  // Run specialists + recall prior memory of this subject in parallel.
  const [results, recall] = await Promise.all([
    Promise.all(specialists.map((a) => RUNNERS[a](ctx).catch(() => null))).then((rs) => rs.filter((r): r is AgentResult => r != null)),
    withTimeout(recallSubject(ctx).catch(() => null), 1500, null),
  ]);

  const answer = await runJudge(query, mode, results);
  if (recall && recall.seenCount > 0) answer.memory = { seenCount: recall.seenCount, firstSeen: recall.firstSeen };

  // Write-through into the flywheel (bounded so it never delays/breaks the response).
  await withTimeout(recordScan(answer, ctx, { userId: opts?.userId ?? null }).catch(() => undefined), 3000, undefined);
  return answer;
}
