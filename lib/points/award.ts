import 'server-only';

import { createAdminSupabase } from '@/lib/supabase/server';
import { getPointMultiplierForUser } from '@/lib/db/tiers';
import type { Json, TablesInsert } from '@/lib/supabase/types';
import { POINTS_FORMULA_V1, type PointsFormulaEventType } from '@/lib/points/formula';
import {
  countTrackerSetupPointsEvents,
  loadDailyLoginUtcDays,
  sumFinalPointsUtcToday,
} from '@/lib/points/queries';

export interface AwardPointsInput {
  dedupeKey: string;
  metadata?: Json;
  /** Required for trade_volume */
  amountSol?: number;
}

async function hasDedupeAward(
  userId: string,
  eventType: string,
  dedupeKey: string,
): Promise<boolean> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('points_events')
    .select('id')
    .eq('user_id', userId)
    .eq('event_type', eventType)
    .filter('metadata->>dedupe_key', 'eq', dedupeKey)
    .maybeSingle();
  if (error) throw new Error(`hasDedupeAward: ${error.message}`);
  return data != null;
}

function utcTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function consecutiveStreakBeforeDay(loginDays: Set<string>, startBeforeDay: string): number {
  const cfg = POINTS_FORMULA_V1.daily_login;
  let streak = 0;
  const d = new Date(`${startBeforeDay}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  while (streak < cfg.streak_max) {
    const key = d.toISOString().slice(0, 10);
    if (!loginDays.has(key)) break;
    streak++;
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return streak;
}

/**
 * Awards points into `points_events` with tier multiplier on `base_points`.
 * Idempotent per `(user_id, event_type, metadata.dedupe_key)`.
 */
export async function awardPoints(
  userId: string,
  eventType: PointsFormulaEventType,
  input: AwardPointsInput,
): Promise<{ skipped: boolean; reason?: string }> {
  const { dedupeKey, metadata, amountSol } = input;
  if (!dedupeKey) return { skipped: true, reason: 'missing_dedupe' };

  if (await hasDedupeAward(userId, eventType, dedupeKey)) {
    return { skipped: true, reason: 'duplicate' };
  }

  let basePoints = 0;

  switch (eventType) {
    case 'trade_volume': {
      const sol = amountSol ?? 0;
      if (!(sol > 0)) return { skipped: true, reason: 'no_sol' };
      const cfg = POINTS_FORMULA_V1.trade_volume;
      const raw = sol * cfg.points_per_sol;
      const usedToday = await sumFinalPointsUtcToday(userId, 'trade_volume');
      const room = Math.max(0, cfg.max_per_day - usedToday);
      basePoints = Math.max(0, Math.min(raw, room));
      break;
    }
    case 'daily_login': {
      const cfg = POINTS_FORMULA_V1.daily_login;
      const today = utcTodayKey();
      const priorDays = await loadDailyLoginUtcDays(userId, today);
      const streak = consecutiveStreakBeforeDay(priorDays, today);
      const bonus = Math.min(streak, cfg.streak_max) * cfg.streak_bonus_per_day;
      basePoints = cfg.points + bonus;
      break;
    }
    case 'first_trade': {
      basePoints = POINTS_FORMULA_V1.first_trade.points;
      break;
    }
    case 'tracker_setup': {
      const cfg = POINTS_FORMULA_V1.tracker_setup;
      const n = await countTrackerSetupPointsEvents(userId);
      if (n >= cfg.max_per_user) return { skipped: true, reason: 'tracker_cap' };
      basePoints = cfg.points;
      break;
    }
    case 'feedback_submitted': {
      basePoints = POINTS_FORMULA_V1.feedback_submitted.points;
      break;
    }
    case 'social_share': {
      const supabase = createAdminSupabase();
      const start = new Date();
      start.setUTCHours(0, 0, 0, 0);
      const { count, error: cErr } = await supabase
        .from('points_events')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('event_type', 'social_share')
        .gte('created_at', start.toISOString());
      if (cErr) throw new Error(`social_share cap: ${cErr.message}`);
      if ((count ?? 0) >= POINTS_FORMULA_V1.social_share.max_per_day) {
        return { skipped: true, reason: 'social_cap' };
      }
      basePoints = POINTS_FORMULA_V1.social_share.points;
      break;
    }
    case 'referral_volume': {
      const sol = amountSol ?? 0;
      if (!(sol > 0)) return { skipped: true, reason: 'no_sol' };
      basePoints = sol * POINTS_FORMULA_V1.referral_volume.points_per_sol;
      break;
    }
  }

  if (!(basePoints > 0)) return { skipped: true, reason: 'zero_base' };

  const mult = await getPointMultiplierForUser(userId);
  const meta: Json = {
    ...(metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? (metadata as Record<string, Json>)
      : {}),
    dedupe_key: dedupeKey,
  };

  const row: TablesInsert<'points_events'> = {
    user_id: userId,
    event_type: eventType,
    base_points: basePoints,
    multiplier: mult,
    metadata: meta,
  };

  const supabase = createAdminSupabase();
  const { error } = await supabase.from('points_events').insert(row);
  if (error) throw new Error(`awardPoints insert: ${error.message}`);
  return { skipped: false };
}

/** Best-effort daily login (UTC day dedupe). */
export async function maybeAwardDailyLogin(userId: string): Promise<void> {
  const today = utcTodayKey();
  await awardPoints(userId, 'daily_login', { dedupeKey: `login:${today}` });
}
