/**
 * Pointer Ops — shared shapes for the Mission Control surfaces.
 *
 * Plain types only (no `server-only`) so both the server collector
 * (`lib/db/opsHealth.ts`) and the client page (`app/(app)/admin/ops`) can import
 * them. Every section is a discriminated union of a real result OR an honest
 * `{ ok: false, error }` — Pointer Ops never fabricates a healthy reading.
 */

export type OpsIndexStatus = 'indexing' | 'indexed' | 'no_swaps' | 'failed' | 'pending';

export type OpsSectionError = { ok: false; error: string };

export type OpsTradingHealth = {
  ok: true;
  windowHours: number;
  confirmed: number;
  failed: number;
  pending: number;
  /** failed / (failed + confirmed) over the window, or null when no fills. */
  failRatePct: number | null;
  volumeSolToday: number;
};

export type OpsIndexerHealth = {
  ok: true;
  total: number;
  byStatus: Record<OpsIndexStatus, number>;
  recentFailures: { mint: string; lastError: string | null; updatedAt: string }[];
};

export type OpsPulseHealth = {
  ok: true;
  latestTokenAt: string | null;
  /** Minutes since the most recent discovered token, or null when none exist. */
  ageMinutes: number | null;
  tokensLastHour: number;
};

export type OpsHeliusHealth = {
  ok: true;
  sinceIso: string;
  stats: Record<string, unknown>;
};

export type OpsProvider = {
  key: string;
  label: string;
  configured: boolean;
  critical: boolean;
};

export type OpsFlags = {
  pauseIngest: boolean;
  packsLiveCommerce: boolean;
  packsTreasuryConfigured: boolean;
};

/** Latest recorded run per cron (from the ops_events substrate). */
export type OpsCronRun = {
  name: string;
  status: string;
  ts: string;
  durationMs: number | null;
  ageMinutes: number;
};

/** A compact ops_events row for the live timeline. */
export type OpsEventLite = {
  ts: string;
  category: string;
  name: string;
  status: string;
  severity: string;
  message: string | null;
  durationMs: number | null;
};

/** An auto-opened incident, grouped by category:name, from error/critical events. */
export type OpsIncident = {
  id: string;
  key: string;
  category: string;
  name: string;
  severity: string;
  status: string;
  count: number;
  sampleMessage: string | null;
  firstSeen: string;
  lastSeen: string;
};

export type DoctorSeverity = 'ok' | 'warn' | 'critical';
export type DoctorFinding = {
  id: string;
  severity: 'warn' | 'critical';
  title: string;
  detail: string;
  action: string;
  /** Doctor V2 scoring (confidence / user+revenue impact / urgency / priority). */
  score?: import('@/lib/ops/doctorScoring').FindingScore;
};
/** Read-only diagnosis from Pointer Doctor (rule-based; no LLM, no actions). */
export type DoctorReport = {
  status: DoctorSeverity;
  summary: string;
  findings: DoctorFinding[];
  checkedAt: string;
};

export type OpsHealthSnapshot = {
  generatedAt: string;
  trading: OpsTradingHealth | OpsSectionError;
  indexer: OpsIndexerHealth | OpsSectionError;
  pulse: OpsPulseHealth | OpsSectionError;
  helius: OpsHeliusHealth | OpsSectionError;
  flags: OpsFlags;
  providers: OpsProvider[];
  crons: OpsCronRun[] | OpsSectionError;
  incidents: OpsIncident[] | OpsSectionError;
  recentEvents: OpsEventLite[] | OpsSectionError;
  doctor: DoctorReport;
};
