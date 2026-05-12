import 'server-only';

import { createAdminSupabase } from '@/lib/supabase/server';
import type { ChainFocus, SquadSummary, SquadVisibility, TradingStyle } from '@/lib/squads/types';

export function isMissingSquadsTable(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return /missing_squads_table|does not exist|42P01/i.test(err.message);
}

function mapRow(row: Record<string, unknown>): SquadSummary {
  return {
    id: String(row.id),
    slug: String((row.slug ?? row.id) as string),
    name: String(row.name),
    description: String(row.description ?? ''),
    chainFocus: (row.chain_focus as ChainFocus[]) ?? ['sol'],
    tradingStyles: (row.trading_styles as TradingStyle[]) ?? ['trenches'],
    visibility: (row.visibility as SquadVisibility) ?? 'private',
    memberCount: Math.max(1, Number(row.member_count ?? 1)),
    isMember: true,
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}

/**
 * Lists squads the user belongs to. Throws when DDL is not applied.
 */
export async function listSquadsForUser(userId: string): Promise<SquadSummary[]> {
  const supabase = createAdminSupabase();

  /* eslint-disable @typescript-eslint/no-explicit-any -- `squad_members` not in generated types yet */
  const { data, error } = await (supabase as any)
    .from('squad_members')
    .select('squads(*)')
    .eq('user_id', userId)
    .eq('status', 'active');

  if (error) {
    if (/does not exist|schema cache|42P01|squads/i.test(String(error.message))) {
      throw new Error('missing_squads_table');
    }
    throw new Error(`listSquadsForUser: ${error.message}`);
  }

  const rows = (data ?? []) as Array<{ squads: Record<string, unknown> | null }>;
  return rows
    .map((r) => {
      const s = r.squads;
      if (!s) return null;
      return mapRow(s);
    })
    .filter((x): x is SquadSummary => Boolean(x));
}
