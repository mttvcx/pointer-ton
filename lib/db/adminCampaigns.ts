import 'server-only';
import { randomUUID } from 'node:crypto';
import { createAdminSupabase } from '@/lib/supabase/server';
import { adminGrantPoints, grantCashback } from '@/lib/db/adminEconomy';
import type { Json, Tables } from '@/lib/supabase/types';

export type AdminCampaignRow = Tables<'admin_campaigns'>;
export type AdminGrantRow = Tables<'admin_grants'>;

export const GRANT_TYPES = ['points', 'cashback'] as const;
export type GrantType = (typeof GRANT_TYPES)[number];

export async function createCampaign(input: {
  name: string;
  grantType: string;
  config?: Json;
  reason?: string;
  startsAt?: string | null;
  endsAt?: string | null;
  createdByUserId: string | null;
}): Promise<AdminCampaignRow> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('admin_campaigns')
    .insert({
      name: input.name,
      grant_type: input.grantType,
      config: input.config ?? {},
      reason: input.reason ?? null,
      starts_at: input.startsAt ?? null,
      ends_at: input.endsAt ?? null,
      created_by: input.createdByUserId,
      status: 'active',
    })
    .select('*')
    .single();
  if (error || !data) throw new Error(`createCampaign failed: ${error?.message}`);
  return data;
}

export async function listCampaigns(limit = 100): Promise<AdminCampaignRow[]> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('admin_campaigns')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listCampaigns failed: ${error.message}`);
  return data ?? [];
}

export async function listGrants(opts: { campaignId?: string; limit?: number } = {}): Promise<AdminGrantRow[]> {
  const supabase = createAdminSupabase();
  let q = supabase.from('admin_grants').select('*').order('created_at', { ascending: false });
  if (opts.campaignId) q = q.eq('campaign_id', opts.campaignId);
  q = q.limit(Math.min(500, Math.max(1, opts.limit ?? 200)));
  const { data, error } = await q;
  if (error) throw new Error(`listGrants failed: ${error.message}`);
  return data ?? [];
}

/**
 * Issue a grant: applies the real effect (points or cashback) and records the
 * grant row. Returns the created grant. Caller is responsible for the audit
 * log entry.
 */
export async function issueGrant(input: {
  campaignId: string | null;
  targetUserId: string;
  grantType: GrantType;
  amount: number;
  reason: string;
  createdByUserId: string | null;
  grantedByLabel: string;
}): Promise<AdminGrantRow> {
  if (input.grantType === 'points') {
    await adminGrantPoints({
      userId: input.targetUserId,
      amount: input.amount,
      reason: input.reason,
      grantedByLabel: input.grantedByLabel,
      dedupeKey: `campaign_grant:${randomUUID()}`,
    });
  } else {
    await grantCashback({
      userId: input.targetUserId,
      amountSol: input.amount,
      reason: input.reason,
      createdByUserId: input.createdByUserId,
    });
  }

  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('admin_grants')
    .insert({
      campaign_id: input.campaignId,
      target_user_id: input.targetUserId,
      grant_type: input.grantType,
      amount: input.amount,
      reason: input.reason,
      status: 'applied',
      created_by: input.createdByUserId,
    })
    .select('*')
    .single();
  if (error || !data) throw new Error(`issueGrant record failed: ${error?.message}`);
  return data;
}
