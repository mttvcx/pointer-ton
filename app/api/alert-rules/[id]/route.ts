import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requirePointerUser } from '@/lib/api/privyUser';
import {
  PulseLaunchpadRuleConfigSchema,
  SolTwitterListenRuleConfigSchema,
} from '@/lib/alerts/alertRuleModel';
import { deleteAlertRule, getAlertRuleForUser, updateAlertRule } from '@/lib/db/alertRules';
import type { Json } from '@/lib/supabase/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const patchSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    ruleConfig: z.unknown().optional(),
    flashEnabled: z.boolean().optional(),
    flashColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    flashSize: z.enum(['normal', 'large']).optional(),
    audioEnabled: z.boolean().optional(),
    audioUrl: z.string().url().nullable().optional(),
    audioPreset: z.string().max(32).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

function toDto(r: NonNullable<Awaited<ReturnType<typeof getAlertRuleForUser>>>) {
  return {
    id: r.id,
    name: r.name,
    ruleType: r.rule_type,
    ruleConfig: r.rule_config,
    flashEnabled: r.flash_enabled,
    flashColor: r.flash_color,
    flashSize: r.flash_size,
    audioEnabled: r.audio_enabled,
    audioUrl: r.audio_url,
    audioPreset: r.audio_preset,
    isActive: r.is_active,
    createdAt: r.created_at,
  };
}

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

  let validatedRuleConfig: Json | undefined;
  if (p.ruleConfig !== undefined) {
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

  try {
    const row = await updateAlertRule(auth.user.id, id, {
      ...(p.name != null ? { name: p.name } : {}),
      ...(validatedRuleConfig != null ? { rule_config: validatedRuleConfig } : {}),
      ...(p.flashEnabled != null ? { flash_enabled: p.flashEnabled } : {}),
      ...(p.flashColor != null ? { flash_color: p.flashColor } : {}),
      ...(p.flashSize != null ? { flash_size: p.flashSize } : {}),
      ...(p.audioEnabled != null ? { audio_enabled: p.audioEnabled } : {}),
      ...(p.audioUrl !== undefined ? { audio_url: p.audioUrl } : {}),
      ...(p.audioPreset != null ? { audio_preset: p.audioPreset } : {}),
      ...(p.isActive != null ? { is_active: p.isActive } : {}),
    });
    return NextResponse.json({ rule: toDto(row) });
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
