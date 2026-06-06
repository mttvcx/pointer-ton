import 'server-only';
import { createAdminSupabase } from '@/lib/supabase/server';
import type { Json, Tables } from '@/lib/supabase/types';

export type BugReportRow = Tables<'bug_reports'>;

export async function insertBugReport(input: {
  receiptId: string;
  category: string;
  severity: string;
  description: string;
  route?: string | null;
  activeChain?: string | null;
  mintHint?: string | null;
  walletMasked?: string | null;
  context: Json;
  delivered: boolean;
}): Promise<void> {
  const supabase = createAdminSupabase();
  const { error } = await supabase.from('bug_reports').insert({
    receipt_id: input.receiptId,
    category: input.category,
    severity: input.severity,
    description: input.description,
    route: input.route ?? null,
    active_chain: input.activeChain ?? null,
    mint_hint: input.mintHint ?? null,
    wallet_masked: input.walletMasked ?? null,
    context: input.context,
    delivered: input.delivered,
  });
  if (error) throw new Error(`insertBugReport failed: ${error.message}`);
}

export async function listBugReports(opts: { status?: string; limit?: number } = {}): Promise<BugReportRow[]> {
  const supabase = createAdminSupabase();
  let q = supabase.from('bug_reports').select('*').order('created_at', { ascending: false });
  if (opts.status) q = q.eq('status', opts.status);
  q = q.limit(Math.min(300, Math.max(1, opts.limit ?? 100)));
  const { data, error } = await q;
  if (error) throw new Error(`listBugReports failed: ${error.message}`);
  return data ?? [];
}

export async function setBugReportStatus(input: {
  id: string;
  status: string;
  triagedByUserId: string | null;
}): Promise<BugReportRow> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('bug_reports')
    .update({ status: input.status, triaged_by: input.triagedByUserId, triaged_at: new Date().toISOString() })
    .eq('id', input.id)
    .select('*')
    .single();
  if (error || !data) throw new Error(`setBugReportStatus failed: ${error?.message}`);
  return data;
}
