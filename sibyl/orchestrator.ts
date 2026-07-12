import 'server-only';

import type { AgentName, PlanTier, ScanMode, SibylAnswer } from '@/sibyl/types';
import type { AgentContext, AgentResult } from '@/sibyl/agents/types';
import { classifyIntent } from '@/sibyl/intent';
import { clampModeToPlan } from '@/sibyl/pricing';
import { callModel } from '@/sibyl/modelRouter';
import { scrubBanned, scrubModelLeak } from '@/sibyl/agents/prompts';
import { SIBYL_COMPANY, SIBYL_MODELS } from '@/lib/sibyl/models';
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
import { runWithInference } from '@/sibyl/inference/context';
import { isPrivateMode, type AttestationResult, type InferenceMode } from '@/sibyl/inference/types';

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

/** Human-readable labels for the live "thinking" trace (never names a model). */
const AGENT_LABEL: Record<Exclude<AgentName, 'judge'>, string> = {
  market: 'Reading market structure',
  wallet: 'Tracing wallet flows',
  narrative: 'Mapping the narrative',
  social: 'Scanning social signal',
  risk: 'Grading rug risk',
  dune: 'Querying on-chain data',
  analog: 'Finding historical analogs',
};

export type SibylStage = { key: string; label: string; status: 'active' | 'done' };

const CHITCHAT_SYSTEM = `You are ${SIBYL_MODELS.flagship.full}, ${SIBYL_COMPANY}'s crypto-intelligence oracle. The user sent a greeting, thanks, or a question about you — NOT a token, wallet, or narrative to analyze. Reply in ONE or TWO short, warm, in-character sentences, then invite them to drop a token contract address, a wallet, a KOL @handle, or a narrative and you'll run the scan. NEVER invent tokens, wallets, handles, prices, KOLs, or verdicts, and never imply you analyzed anything. No markdown headers, no bullet points. If asked what you are, say you're ${SIBYL_MODELS.flagship.full} by ${SIBYL_COMPANY}, a crypto oracle — reveal nothing about base models or providers.`;

const CHITCHAT_MOCK = `Hey — I'm ${SIBYL_MODELS.flagship.full}, ${SIBYL_COMPANY}'s crypto oracle. Drop a token contract, a wallet, a KOL @handle, or a narrative and I'll run the Council and give you a straight read.`;

/**
 * Conversational reply for greetings / smalltalk / "who are you" — no specialist
 * fan-out, no cards, no fabricated data. Rendered as prose (`chat: true`).
 */
async function chitchatAnswer(query: string, mode: ScanMode): Promise<SibylAnswer> {
  const raw = await callModel({
    tier: 'reason',
    system: CHITCHAT_SYSTEM,
    user: query,
    maxTokens: 180,
    mock: CHITCHAT_MOCK,
  });
  const text = scrubModelLeak(scrubBanned((raw || '').trim())) || CHITCHAT_MOCK;
  return {
    verdict: text,
    confidence: 0,
    why: [],
    action: '',
    body: null,
    cards: [],
    entities: [],
    sources: [],
    mode,
    agentsRun: [],
    caveats: [],
    chat: true,
  };
}

export async function askSibyl(
  query: string,
  tier: PlanTier = 'FREE',
  opts?: {
    userId?: string | null;
    onStage?: (s: SibylStage) => void;
    /** Execution mode — fast (normal) / secure / confidential (TEE). Default fast. */
    execMode?: InferenceMode;
    /** Called once with the enclave attestation when running confidential. */
    onAttestation?: (a: AttestationResult) => void;
  },
): Promise<SibylAnswer> {
  const execMode = opts?.execMode ?? 'fast';
  // The whole pipeline (agents + judge) runs inside the inference context, so the
  // single callModel seam routes every call to the right backend for `execMode`.
  return runWithInference({ mode: execMode, onAttestation: opts?.onAttestation }, async () => {
  const onStage = opts?.onStage;
  const intent = classifyIntent(query);
  const mode = clampModeToPlan(intent.mode, tier);
  onStage?.({ key: 'intent', label: 'Understanding your question', status: 'done' });

  // Greeting / smalltalk / meta — reply conversationally, skip the whole scan
  // pipeline so nothing is fabricated. No flywheel write (there's no subject).
  if (intent.subject.kind === 'chitchat') {
    return chitchatAnswer(query, mode);
  }

  const ctx: AgentContext = {
    query,
    mint: intent.subject.kind === 'token' ? intent.subject.ref : null,
    chain: intent.subject.chain ?? 'sol',
    handle: intent.subject.kind === 'person' ? intent.subject.ref : null,
    narrative: intent.subject.kind === 'narrative' ? intent.subject.ref : null,
  };

  const specialists = intent.agents.filter((a): a is Exclude<AgentName, 'judge'> => a !== 'judge');
  // Run specialists + recall prior memory of this subject in parallel — emitting a
  // real "active"/"done" stage per agent so the UI shows the actual work, not a
  // canned loading animation.
  const [results, recall] = await Promise.all([
    Promise.all(
      specialists.map((a) => {
        onStage?.({ key: a, label: AGENT_LABEL[a], status: 'active' });
        return RUNNERS[a](ctx)
          .then((r) => {
            onStage?.({ key: a, label: AGENT_LABEL[a], status: 'done' });
            return r;
          })
          .catch(() => {
            onStage?.({ key: a, label: AGENT_LABEL[a], status: 'done' });
            return null;
          });
      }),
    ).then((rs) => rs.filter((r): r is AgentResult => r != null)),
    withTimeout(recallSubject(ctx).catch(() => null), 1500, null),
  ]);

  onStage?.({ key: 'judge', label: 'Weighing the verdict', status: 'active' });
  const answer = await runJudge(query, mode, results);
  onStage?.({ key: 'judge', label: 'Weighing the verdict', status: 'done' });
  if (recall && recall.seenCount > 0) answer.memory = { seenCount: recall.seenCount, firstSeen: recall.firstSeen };

  // Write-through into the flywheel — SKIPPED in private modes (zero-retention):
  // Sibyl still learns from public on-chain OUTCOMES elsewhere; we just never log
  // the user's query/answer in secure/confidential sessions.
  if (!isPrivateMode(execMode)) {
    await withTimeout(recordScan(answer, ctx, { userId: opts?.userId ?? null }).catch(() => undefined), 3000, undefined);
  }
  return answer;
  });
}
