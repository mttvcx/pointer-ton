import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requirePointerUser } from '@/lib/api/privyUser';
import {
  ALERT_RULE_TYPES,
  PulseLaunchpadRuleConfigSchema,
  SolTwitterListenRuleConfigSchema,
} from '@/lib/alerts/alertRuleModel';
import {
  AUTOMATION_RULE_TYPE,
  AutomationRuleBodySchema,
  automationRuleToDto,
  validateAutomationRuleBody,
} from '@/lib/alerts/automationRuleModel';
import { insertAlertRule, listAlertRulesForUser } from '@/lib/db/alertRules';
import { accountFreezeGateOrNull } from '@/lib/trade/accountControlGate';
import type { Json } from '@/lib/supabase/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const legacyPostSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    ruleType: z.enum(ALERT_RULE_TYPES),
    ruleConfig: z.unknown(),
    flashEnabled: z.boolean().optional(),
    flashColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    flashSize: z.enum(['normal', 'large']).optional(),
    audioEnabled: z.boolean().optional(),
    audioUrl: z.string().url().nullable().optional(),
    audioPreset: z.string().max(32).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

const automationPostSchema = AutomationRuleBodySchema;

export async function GET(req: NextRequest) {
  const auth = await requirePointerUser(req);
  if ('error' in auth) return auth.error;
  try {
    const rows = await listAlertRulesForUser(auth.user.id);
    return NextResponse.json({ rules: rows.map(automationRuleToDto) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'list_failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requirePointerUser(req);
  if ('error' in auth) return auth.error;

  // Per-user account freeze (automation kind, fail-closed) — a frozen account
  // cannot arm a new alert/auto-buy rule (auto-buy execution itself routes
  // through trade/execute, which is independently freeze-gated).
  const frozen = await accountFreezeGateOrNull(auth.user.id, 'automation');
  if (frozen) return frozen;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const b = body as Record<string, unknown>;

  if (b.triggerType != null && b.actionType != null) {
    const parsed = automationPostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'invalid_body', issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const validated = validateAutomationRuleBody(parsed.data);
    if (!validated) {
      return NextResponse.json({ error: 'invalid_trigger_or_action_config' }, { status: 400 });
    }

    const d = parsed.data;
    try {
      const row = await insertAlertRule({
        user_id: auth.user.id,
        name: d.name,
        rule_type: AUTOMATION_RULE_TYPE,
        rule_config: {} as Json,
        trigger_type: d.triggerType,
        trigger_config: validated.triggerConfig as Json,
        action_type: d.actionType,
        action_config: validated.actionConfig as Json,
        activity_filter: validated.activityFilter as Json,
        disable_after_success: d.disableAfterSuccess ?? false,
        cooldown_seconds: d.cooldownSeconds ?? 0,
        daily_cap_sol: d.dailyCapSol ?? null,
        flash_enabled: d.flashEnabled ?? true,
        flash_color: d.flashColor ?? '#0077B6',
        flash_size: d.flashSize ?? 'normal',
        audio_enabled: d.audioEnabled ?? false,
        audio_url: d.audioUrl ?? null,
        audio_preset: d.audioPreset ?? 'chime',
        is_active: d.isActive ?? true,
      });
      return NextResponse.json({ rule: automationRuleToDto(row) });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'insert_failed';
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  const parsed = legacyPostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });
  }

  const leg = parsed.data;
  let ruleConfigParsed: Json;
  if (leg.ruleType === 'pulse_launchpad') {
    const cfg = PulseLaunchpadRuleConfigSchema.safeParse(leg.ruleConfig);
    if (!cfg.success) {
      return NextResponse.json({ error: 'invalid_body', issues: cfg.error.issues }, { status: 400 });
    }
    ruleConfigParsed = cfg.data as Json;
  } else if (leg.ruleType === 'sol_twitter_listen') {
    const cfg = SolTwitterListenRuleConfigSchema.safeParse(leg.ruleConfig);
    if (!cfg.success) {
      return NextResponse.json({ error: 'invalid_body', issues: cfg.error.issues }, { status: 400 });
    }
    ruleConfigParsed = cfg.data as Json;
  } else {
    return NextResponse.json({ error: 'unsupported_rule_type' }, { status: 400 });
  }

  try {
    const row = await insertAlertRule({
      user_id: auth.user.id,
      name: leg.name,
      rule_type: leg.ruleType,
      rule_config: ruleConfigParsed,
      flash_enabled: leg.flashEnabled ?? true,
      flash_color: leg.flashColor ?? '#0077B6',
      flash_size: leg.flashSize ?? 'normal',
      audio_enabled: leg.audioEnabled ?? false,
      audio_url: leg.audioUrl ?? null,
      audio_preset: leg.audioPreset ?? 'chime',
      is_active: leg.isActive ?? true,
    });
    return NextResponse.json({ rule: automationRuleToDto(row) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'insert_failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
