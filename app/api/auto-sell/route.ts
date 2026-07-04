import { NextResponse, type NextRequest } from 'next/server';
import { requirePointerUser } from '@/lib/api/privyUser';
import { accountFreezeGateOrNull } from '@/lib/trade/accountControlGate';
import {
  AutoSellRuleBodySchema,
  autoSellRuleToDto,
  parseAutoSellTriggerConfig,
} from '@/lib/autoSell/ruleModel';
import {
  insertAutoSellRule,
  isMissingAutoSellTable,
  listAutoSellRulesForUser,
} from '@/lib/db/autoSellRules';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/auto-sell — the user's auto-sell rules (per account, synced web↔mobile). */
export async function GET(req: NextRequest) {
  const auth = await requirePointerUser(req);
  if ('error' in auth) return auth.error;
  try {
    const rows = await listAutoSellRulesForUser(auth.user.id);
    return NextResponse.json({ rules: rows.map(autoSellRuleToDto), provisioned: true });
  } catch (e) {
    if (isMissingAutoSellTable(e)) return NextResponse.json({ rules: [], provisioned: false });
    const msg = e instanceof Error ? e.message : 'list_failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** POST /api/auto-sell — create an auto-sell rule. */
export async function POST(req: NextRequest) {
  const auth = await requirePointerUser(req);
  if ('error' in auth) return auth.error;

  // Frozen accounts cannot arm new automation (firing is independently kill-switched).
  const frozen = await accountFreezeGateOrNull(auth.user.id, 'automation');
  if (frozen) return frozen;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = AutoSellRuleBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });
  }
  const d = parsed.data;
  const triggerConfig = parseAutoSellTriggerConfig(d.triggerType, d.triggerConfig);
  if (!triggerConfig) {
    return NextResponse.json({ error: 'invalid_trigger_config' }, { status: 400 });
  }

  try {
    const row = await insertAutoSellRule({
      user_id: auth.user.id,
      name: d.name ?? '',
      trigger_type: d.triggerType,
      trigger_config: triggerConfig,
      sell_pct: d.sellPct,
      token_scope: d.tokenScope ?? { kind: 'all_held' },
      wallet_scope: d.walletScope ?? 'primary',
      cooldown_seconds: d.cooldownSeconds ?? 0,
      is_active: d.isActive ?? true,
    });
    return NextResponse.json({ rule: autoSellRuleToDto(row) });
  } catch (e) {
    if (isMissingAutoSellTable(e)) return NextResponse.json({ error: 'not_provisioned' }, { status: 503 });
    const msg = e instanceof Error ? e.message : 'insert_failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
