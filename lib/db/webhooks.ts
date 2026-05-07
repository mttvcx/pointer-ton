import 'server-only';
import { createAdminSupabase } from '@/lib/supabase/server';
import type { Tables, TablesInsert } from '@/lib/supabase/types';

export type WebhookEventRow = Tables<'webhook_events'>;

export async function upsertWebhookEvent(
  row: TablesInsert<'webhook_events'>,
): Promise<WebhookEventRow> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('webhook_events')
    .upsert(row, { onConflict: 'signature' })
    .select('*')
    .single();
  if (error) throw new Error(`upsertWebhookEvent failed: ${error.message}`);
  return data;
}

export async function getWebhookEventBySignature(
  signature: string,
): Promise<WebhookEventRow | null> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('webhook_events')
    .select('*')
    .eq('signature', signature)
    .maybeSingle();
  if (error) throw new Error(`getWebhookEventBySignature failed: ${error.message}`);
  return data;
}
