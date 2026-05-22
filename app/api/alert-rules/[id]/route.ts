import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requirePointerUser } from '@/lib/api/privyUser';
import {
  PulseLaunchpadRuleConfigSchema,
  SolTwitterListenRuleConfigSchema,
} from '@/lib/alerts/alertRuleModel';
import {
  AUTOMATION_TRIGGER_TYPES,
  AUTOMATION_ACTION_TYPES,
  ActivityFilterSchema,
  automationRuleToDto,
  validateAutomationRuleBody,
  type AutomationRuleBody,
} from '@/lib/alerts/automationRuleModel';
import { deleteAlertRule, getAlertRuleForUser, updateAlertRule } from '@/lib/db/alertRules';
import type { Json } from '@/lib/supabase/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const patchSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    ruleConfig: z.unknown().optional(),
    triggerType: z.enum(AUTOMATION_TRIGGER_TYPES).optional(),
    triggerConfig: z.unknown().optional(),
    actionType: z.enum(AUTOMATION_ACTION_TYPES).optional(),
    actionConfig: z.unknown().optional(),
    activityFilter: ActivityFilterSchema.optional(),
    disableAfterSuccess: z.boolean().optional(),
    cooldownSeconds: z.number().int().min(0).max(86_400).optional(),
    dailyCapSol: z.number().positive().max(1_000_000).nullable().optional(),
    flashEnabled: z.boolean().optional(),
    flashColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    flashSize: z.enum(['normal', 'large']).optional(),
    audioEnabled: z.boolean().optional(),
    audioUrl: z.string().url().nullable().optional(),
    audioPreset: z.string().max(32).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requirePointerUser(req);
  if ('error' in auth) return auth.error;
  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });
  }

  const existing = await getAlertRuleForUser(auth.user.id, id);
  if (!existing) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const p = parsed.data;
  const isAutomation =
    existing.rule_type === 'automation' || p.triggerType != null || p.actionType != null;

  let validatedRuleConfig: Json | undefined;
  if (p.ruleConfig !== undefined && !isAutomation) {
    if (existing.rule_type === 'pulse_launchpad') {
      const cfg = PulseLaunchpadRuleConfigSchema.safeParse(p.ruleConfig);
      if (!cfg.success) {
        return NextResponse.json({ error: 'invalid_body', issues: cfg.error.issues }, { status: 400 });
      }
      validatedRuleConfig = cfg.data as Json;
    } else if (existing.rule_type === 'sol_twitter_listen') {
      const cfg = SolTwitterListenRuleConfigSchema.safeParse(p.ruleConfig);
      if (!cfg.success) {
        return NextResponse.json({ error: 'invalid_body', issues: cfg.error.issues }, { status: 400 });
      }
      validatedRuleConfig = cfg.data as Json;
    } else {
      return NextResponse.json({ error: 'unsupported_rule_type' }, { status: 400 });
    }
  }

  let automationPatch: Record<string, unknown> = {};
  if (isAutomation) {
    const dto = automationRuleToDto(existing);
    const merged: AutomationRuleBody = {
      name: p.name ?? existing.name,
      triggerType: (p.triggerType ?? dto.triggerType) as AutomationRuleBody['triggerType'],
      triggerConfig: p.triggerConfig ?? dto.triggerConfig,
      actionType: (p.actionType ?? dto.actionType) as AutomationRuleBody['actionType'],
      actionConfig: p.actionConfig ?? dto.actionConfig,
      activityFilter: p.activityFilter ?? (dto.activityFilter as AutomationRuleBody['activityFilter']),
      disableAfterSuccess: p.disableAfterSuccess ?? dto.disableAfterSuccess,
      cooldownSeconds: p.cooldownSeconds ?? dto.cooldownSeconds,
      dailyCapSol: p.dailyCapSol !== undefined ? p.dailyCapSol : dto.dailyCapSol,
    };
    if (!merged.triggerType || !merged.actionType) {
      return NextResponse.json({ error: 'invalid_automation_rule' }, { status: 400 });
    }
    const validated = validateAutomationRuleBody(merged);
    if (!validated) {
      return NextResponse.json({ error: 'invalid_trigger_or_action_config' }, { status: 400 });
    }
    automationPatch = {
      rule_type: 'automation',
      trigger_type: merged.triggerType,
      trigger_config: validated.triggerConfig as Json,
      action_type: merged.actionType,
      action_config: validated.actionConfig as Json,
      activity_filter: validated.activityFilter as Json,
      disable_after_success: merged.disableAfterSuccess ?? false,
      cooldown_seconds: merged.cooldownSeconds ?? 0,
      daily_cap_sol: merged.dailyCapSol ?? null,
    };
  }

  try {
    const row = await updateAlertRule(auth.user.id, id, {
      ...(p.name != null ? { name: p.name } : {}),
      ...(validatedRuleConfig != null ? { rule_config: validatedRuleConfig } : {}),
      ...automationPatch,
      ...(p.flashEnabled != null ? { flash_enabled: p.flashEnabled } : {}),
      ...(p.flashColor != null ? { flash_color: p.flashColor } : {}),
      ...(p.flashSize != null ? { flash_size: p.flashSize } : {}),
      ...(p.audioEnabled != null ? { audio_enabled: p.audioEnabled } : {}),
      ...(p.audioUrl !== undefined ? { audio_url: p.audioUrl } : {}),
      ...(p.audioPreset != null ? { audio_preset: p.audioPreset } : {}),
      ...(p.isActive != null ? { is_active: p.isActive } : {}),
    });
    return NextResponse.json({ rule: automationRuleToDto(row) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'update_failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requirePointerUser(_req);
  if ('error' in auth) return auth.error;
  const { id } = await ctx.params;

  const existing = await getAlertRuleForUser(auth.user.id, id);
  if (!existing) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  try {
    await deleteAlertRule(auth.user.id, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'delete_failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
