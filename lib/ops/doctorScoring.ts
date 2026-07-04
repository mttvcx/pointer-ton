/**
 * Pointer Doctor V2 — per-finding scoring (pure, no I/O, unit-testable). Turns a
 * raw diagnostic finding into operator-actionable signal: how SURE we are
 * (confidence), who it hurts (user impact), what it costs (revenue impact), and
 * how soon it must be handled (urgency) — plus a composite priority for ranking.
 *
 * Deterministic: no LLM. The optional LLM narration layer (gated by AI cost
 * controls) only summarizes; the scores below are the decision substrate that
 * self-heal (§3) and alerting consume.
 */

export type Severity = 'info' | 'warn' | 'critical';
export type ImpactLevel = 'none' | 'low' | 'medium' | 'high';
export type Urgency = 'low' | 'medium' | 'high' | 'critical';
/** Which subsystem the finding touches — drives the impact weighting. */
export type FindingDomain = 'money' | 'ai' | 'data' | 'realtime' | 'infra' | 'other';

const IMPACT_RANK: Record<ImpactLevel, number> = { none: 0, low: 1, medium: 2, high: 3 };
const URGENCY_RANK: Record<Urgency, number> = { low: 0, medium: 1, high: 2, critical: 3 };
const SEV_RANK: Record<Severity, number> = { info: 0, warn: 1, critical: 2 };

export interface ScoreInput {
  severity: Severity;
  domain: FindingDomain;
  /** Override the default confidence (0–1). */
  confidence?: number;
}

export interface FindingScore {
  confidence: number; // 0–1
  userImpact: ImpactLevel;
  revenueImpact: ImpactLevel;
  urgency: Urgency;
  /** Composite rank for sorting (higher = handle first). */
  priority: number;
}

const DEFAULT_CONFIDENCE: Record<Severity, number> = { info: 0.3, warn: 0.6, critical: 0.9 };

/** Money/AI domains carry revenue impact; user-facing domains carry user impact. */
function revenueImpact(domain: FindingDomain, sev: Severity): ImpactLevel {
  if (domain === 'money') return sev === 'critical' ? 'high' : sev === 'warn' ? 'medium' : 'low';
  if (domain === 'ai') return sev === 'critical' ? 'medium' : 'low';
  return sev === 'critical' ? 'low' : 'none';
}
function userImpact(domain: FindingDomain, sev: Severity): ImpactLevel {
  if (domain === 'money' || domain === 'realtime' || domain === 'data') {
    return sev === 'critical' ? 'high' : sev === 'warn' ? 'medium' : 'low';
  }
  if (domain === 'ai' || domain === 'infra') return sev === 'critical' ? 'medium' : 'low';
  return sev === 'critical' ? 'low' : 'none';
}
function urgency(domain: FindingDomain, sev: Severity): Urgency {
  if (sev === 'critical') return 'critical';
  if (sev === 'warn') return domain === 'money' || domain === 'infra' ? 'high' : 'medium';
  return 'low';
}

export function scoreFinding(input: ScoreInput): FindingScore {
  const confidence = Math.min(1, Math.max(0, input.confidence ?? DEFAULT_CONFIDENCE[input.severity]));
  const rev = revenueImpact(input.domain, input.severity);
  const usr = userImpact(input.domain, input.severity);
  const urg = urgency(input.domain, input.severity);
  // Priority: weight severity + the two impacts + urgency, scaled by confidence so
  // a low-confidence critical ranks below a high-confidence one.
  const raw =
    SEV_RANK[input.severity] * 3 + IMPACT_RANK[rev] * 2.5 + IMPACT_RANK[usr] * 2 + URGENCY_RANK[urg] * 1.5;
  return {
    confidence,
    userImpact: usr,
    revenueImpact: rev,
    urgency: urg,
    priority: Math.round(raw * (0.5 + confidence / 2) * 10) / 10,
  };
}

/** Heuristic domain from a finding id (so existing findings score without edits). */
export function inferDomain(findingId: string): FindingDomain {
  const id = findingId.toLowerCase();
  if (/(trade|fee|cashback|referral|pack|payout|money|spend|quota)/.test(id)) return 'money';
  if (/(ai|copilot|model|prompt)/.test(id)) return 'ai';
  if (/(pulse|realtime|webhook|ingest|stale|latency)/.test(id)) return 'realtime';
  if (/(indexer|index|backfill|swap|data)/.test(id)) return 'data';
  if (/(provider|helius|redis|supabase|rpc|cron|queue|dlq|section)/.test(id)) return 'infra';
  return 'other';
}
