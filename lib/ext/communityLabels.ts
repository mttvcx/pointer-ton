import 'server-only';
import { createAdminSupabase } from '@/lib/supabase/server';

/**
 * Crowdsourced labels — the self-growing directory. Users tag handles/wallets;
 * a label becomes PUBLIC (verified) once enough distinct users agree. The
 * submitter always sees their own immediately. Threshold via env.
 */

const THRESHOLD = (() => {
  const v = Number(process.env.COMMUNITY_VERIFY_THRESHOLD);
  return Number.isFinite(v) && v > 0 ? v : 2;
})();

export type SubjectType = 'handle' | 'wallet';
const norm = (s: string) => s.replace(/^@/, '').trim().toLowerCase();

// `community_labels` is newly created and not in the generated Supabase types
// yet — a narrow typed view over just the calls we make (no `any`).
interface CommunityRow {
  subject: string;
  label: string;
  submitted_by: string;
  auto_verified?: boolean;
  source?: string;
}
interface CommunityTable {
  upsert: (v: Record<string, unknown>, o: { onConflict: string }) => Promise<{ error: { message: string } | null }>;
  select: (c: string) => {
    eq: (col: string, val: string) => { in: (col: string, vals: string[]) => { limit: (n: number) => Promise<{ data: CommunityRow[] | null }> } };
  };
}
function table(): CommunityTable {
  return (createAdminSupabase() as unknown as { from: (t: string) => CommunityTable }).from('community_labels');
}

export async function submitCommunityLabel(p: {
  userId: string;
  subjectType: SubjectType;
  subject: string;
  label: string;
  category?: string | null;
  /** 'user' (crowdsource, needs agreement), 'ai' (Claude), or 'x' (X's own affiliation). */
  source?: 'user' | 'ai' | 'x';
  confidence?: number | null;
  /** authoritative — surfaces immediately without needing N agreements (X labels, high-confidence AI). */
  autoVerified?: boolean;
}): Promise<void> {
  const subject = p.subjectType === 'handle' ? norm(p.subject) : p.subject.trim();
  const label = p.label.trim().slice(0, 64);
  if (!subject || !label) throw new Error('empty');
  const { error } = await table().upsert(
    {
      subject_type: p.subjectType,
      subject,
      label,
      category: p.category ?? null,
      submitted_by: p.userId,
      source: p.source ?? 'user',
      confidence: p.confidence ?? null,
      auto_verified: p.autoVerified ?? false,
    },
    { onConflict: 'subject_type,subject,submitted_by' },
  );
  if (error) throw new Error(`community_submit_failed: ${error.message}`);
}

/** True if the subject already has an AI- or X-sourced label (skip re-classifying). */
export async function hasMachineLabel(subjectType: SubjectType, subject: string): Promise<boolean> {
  const key = subjectType === 'handle' ? norm(subject) : subject.trim();
  if (!key) return false;
  try {
    const { data } = await table().select('subject, label, submitted_by, source').eq('subject_type', subjectType).in('subject', [key]).limit(50);
    return (data ?? []).some((r) => r.source === 'ai' || r.source === 'x');
  } catch {
    return false;
  }
}

export interface CommunityHit {
  label: string;
  count: number;
  verified: boolean;
  mine: boolean;
}

/** ALL labels for a subject (verified by agreement, or the user's own) — for the
 *  multi-label stack ("different lines"). */
export async function getAllCommunityLabels(userId: string, subjectType: SubjectType, subject: string): Promise<string[]> {
  const key = subjectType === 'handle' ? norm(subject) : subject.trim();
  if (!key) return [];
  try {
    const { data } = await table().select('subject, label, submitted_by, auto_verified').eq('subject_type', subjectType).in('subject', [key]).limit(200);
    const counts = new Map<string, { c: number; mine: boolean; auto: boolean }>();
    for (const r of data ?? []) {
      const e = counts.get(r.label) ?? { c: 0, mine: false, auto: false };
      e.c++;
      if (r.submitted_by === userId) e.mine = true;
      if (r.auto_verified) e.auto = true;
      counts.set(r.label, e);
    }
    return [...counts.entries()].filter(([, e]) => e.c >= THRESHOLD || e.mine || e.auto).map(([l]) => l);
  } catch {
    return [];
  }
}

/** Top agreed label per subject — included when verified (≥ threshold) or it's
 *  the requesting user's own submission. */
export async function getCommunityLabels(
  userId: string,
  subjectType: SubjectType,
  subjects: string[],
): Promise<Record<string, CommunityHit>> {
  const out: Record<string, CommunityHit> = {};
  const keys = [...new Set(subjects.map((s) => (subjectType === 'handle' ? norm(s) : s.trim())))].filter(Boolean);
  if (!keys.length) return out;

  try {
    const { data } = await table().select('subject, label, submitted_by, auto_verified').eq('subject_type', subjectType).in('subject', keys).limit(1000);
    const tally = new Map<string, Map<string, { count: number; mine: boolean; auto: boolean }>>();
    for (const r of data ?? []) {
      const byLabel = tally.get(r.subject) ?? new Map<string, { count: number; mine: boolean; auto: boolean }>();
      const e = byLabel.get(r.label) ?? { count: 0, mine: false, auto: false };
      e.count++;
      if (r.submitted_by === userId) e.mine = true;
      if (r.auto_verified) e.auto = true;
      byLabel.set(r.label, e);
      tally.set(r.subject, byLabel);
    }
    for (const [subject, byLabel] of tally) {
      let best: { label: string; count: number; mine: boolean; auto: boolean } | null = null;
      for (const [label, e] of byLabel) {
        if (!best) {
          best = { label, count: e.count, mine: e.mine, auto: e.auto };
          continue;
        }
        const better = (e.auto && !best.auto) || (e.auto === best.auto && (e.count > best.count || (e.mine && !best.mine)));
        if (better) best = { label, count: e.count, mine: e.mine, auto: e.auto };
      }
      if (best && (best.count >= THRESHOLD || best.mine || best.auto)) {
        out[subject] = { label: best.label, count: best.count, verified: best.count >= THRESHOLD || best.auto, mine: best.mine };
      }
    }
  } catch {
    /* degrade — community is additive, never blocks the directory */
  }
  return out;
}
