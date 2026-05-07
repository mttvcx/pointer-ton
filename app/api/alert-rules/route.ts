import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requirePointerUser } from '@/lib/api/privyUser';
import { PulseLaunchpadRuleConfigSchema, ALERT_RULE_TYPES } from '@/lib/alerts/alertRuleModel';
import { insertAlertRule, listAlertRulesForUser } from '@/lib/db/alertRules';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const postSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    ruleType: z.enum(ALERT_RULE_TYPES),
    ruleConfig: PulseLaunchpadRuleConfigSchema,
    flashEnabled: z.boolean().optional(),
    flashColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    flashSize: z.enum(['normal', 'large']).optional(),
    audioEnabled: z.boolean().optional(),
    audioUrl: z.string().url().nullable().optional(),
    audioPreset: z.string().max(32).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

function toDto(r: Awaited<ReturnType<typeof listAlertRulesForUser>>[number]) {
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

export async function GET(req: NextRequest) {
  const auth = await requirePointerUser(req);
  if ('error' in auth) return auth.error;
  try {
    const rows = await listAlertRulesForUser(auth.user.id);
    return NextResponse.json({ rules: rows.map(toDto) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'list_failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requirePointerUser(req);
  if ('error' in auth) return auth.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });
  }

  const b = parsed.data;
  try {
    const row = await insertAlertRule({
      user_id: auth.user.id,
      name: b.name,
      rule_type: b.ruleType,
      rule_config: b.ruleConfig,
      flash_enabled: b.flashEnabled ?? true,
      flash_color: b.flashColor ?? '#7C5CFF',
      flash_size: b.flashSize ?? 'normal',
      audio_enabled: b.audioEnabled ?? false,
      audio_url: b.audioUrl ?? null,
      audio_preset: b.audioPreset ?? 'chime',
      is_active: b.isActive ?? true,
    });
    return NextResponse.json({ rule: toDto(row) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'insert_failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
