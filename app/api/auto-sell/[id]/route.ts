import { NextResponse, type NextRequest } from 'next/server';
import { requirePointerUser } from '@/lib/api/privyUser';
import {
  AutoSellRulePatchSchema,
  autoSellRuleToDto,
  parseAutoSellTriggerConfig,
} from '@/lib/autoSell/ruleModel';
import {
  deleteAutoSellRule,
  getAutoSellRuleForUser,
  isMissingAutoSellTable,
  updateAutoSellRule,
} from '@/lib/db/autoSellRules';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** PATCH /api/auto-sell/[id] — update an auto-sell rule (partial). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePointerUser(req);
  if ('error' in auth) return auth.error;
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = AutoSellRulePatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });
  }
  const d = parsed.data;

  // If the trigger is being changed, validate its config against the (new or existing) type.
  const patch: Record<string, unknown> = {};
  if (d.name !== undefined) patch.name = d.name;
  if (d.sellPct !== undefined) patch.sell_pct = d.sellPct;
  if (d.tokenScope !== undefined) patch.token_scope = d.tokenScope;
  if (d.walletScope !== undefined) patch.wallet_scope = d.walletScope;
  if (d.cooldownSeconds !== undefined) patch.cooldown_seconds = d.cooldownSeconds;
  if (d.isActive !== undefined) patch.is_active = d.isActive;

  if (d.triggerType !== undefined || d.triggerConfig !== undefined) {
    try {
      const existing = await getAutoSellRuleForUser(auth.user.id, id);
      if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });
      const triggerType = d.triggerType ?? existing.trigger_type;
      const rawConfig = d.triggerConfig ?? existing.trigger_config;
      const tc = parseAutoSellTriggerConfig(triggerType, rawConfig);
      if (!tc) return NextResponse.json({ error: 'invalid_trigger_config' }, { status: 400 });
      patch.trigger_type = triggerType;
      patch.trigger_config = tc;
    } catch (e) {
      if (isMissingAutoSellTable(e)) return NextResponse.json({ error: 'not_provisioned' }, { status: 503 });
      throw e;
    }
  }

  try {
    const row = await updateAutoSellRule(auth.user.id, id, patch);
    if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json({ rule: autoSellRuleToDto(row) });
  } catch (e) {
    if (isMissingAutoSellTable(e)) return NextResponse.json({ error: 'not_provisioned' }, { status: 503 });
    const msg = e instanceof Error ? e.message : 'update_failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** DELETE /api/auto-sell/[id] — remove an auto-sell rule. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePointerUser(req);
  if ('error' in auth) return auth.error;
  const { id } = await params;
  try {
    await deleteAutoSellRule(auth.user.id, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (isMissingAutoSellTable(e)) return NextResponse.json({ error: 'not_provisioned' }, { status: 503 });
    const msg = e instanceof Error ? e.message : 'delete_failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
