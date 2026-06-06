import 'server-only';
import { createAdminSupabase } from '@/lib/supabase/server';
import type { Json, Tables } from '@/lib/supabase/types';

export type EmergencyActionRow = Tables<'emergency_actions'>;

export async function insertEmergencyAction(input: {
  targetUserId: string;
  action: string;
  walletAddress: string;
  mint?: string | null;
  reason: string;
  performedByUserId: string | null;
  metadata?: Record<string, unknown>;
}): Promise<EmergencyActionRow> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('emergency_actions')
    .insert({
      target_user_id: input.targetUserId,
      action: input.action,
      wallet_address: input.walletAddress,
      mint: input.mint ?? null,
      reason: input.reason,
      performed_by: input.performedByUserId,
      metadata: (input.metadata ?? {}) as Json,
      status: 'pending',
    })
    .select('*')
    .single();
  if (error || !data) throw new Error(`insertEmergencyAction failed: ${error?.message}`);
  return data;
}

export async function finalizeEmergencyAction(input: {
  id: string;
  status: 'confirmed' | 'failed';
  txSignature?: string | null;
  errorMessage?: string | null;
  metadataPatch?: Record<string, unknown>;
}): Promise<EmergencyActionRow> {
  const supabase = createAdminSupabase();
  const { data: existing } = await supabase
    .from('emergency_actions')
    .select('metadata')
    .eq('id', input.id)
    .maybeSingle();

  const merged = {
    ...((existing?.metadata as Record<string, unknown> | null) ?? {}),
    ...(input.metadataPatch ?? {}),
  };

  const { data, error } = await supabase
    .from('emergency_actions')
    .update({
      status: input.status,
      tx_signature: input.txSignature ?? null,
      error_message: input.errorMessage ?? null,
      metadata: merged as Json,
    })
    .eq('id', input.id)
    .select('*')
    .single();
  if (error || !data) throw new Error(`finalizeEmergencyAction failed: ${error?.message}`);
  return data;
}

export async function listEmergencyActionsForUser(
  targetUserId: string,
  limit = 25,
): Promise<EmergencyActionRow[]> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('emergency_actions')
    .select('*')
    .eq('target_user_id', targetUserId)
    .order('created_at', { ascending: false })
    .limit(Math.min(100, Math.max(1, limit)));
  if (error) throw new Error(`listEmergencyActionsForUser failed: ${error.message}`);
  return data ?? [];
}
