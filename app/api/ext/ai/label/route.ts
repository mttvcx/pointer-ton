import { NextResponse, type NextRequest } from 'next/server';
import { requireExtAuth } from '@/lib/ext/auth';
import { getAnthropic } from '@/lib/ai/clients';
import { submitCommunityLabel, hasMachineLabel } from '@/lib/ext/communityLabels';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * AI auto-labeler. Given an X account's public meta (name + bio, optionally X's
 * own affiliation badge), assign ONE concise role label across ANY domain — most
 * "key followers" aren't crypto (AI-lab founders, podcasters, VCs). X's own
 * affiliation is authoritative (applied directly); otherwise Claude Haiku
 * classifies from the bio and only high-confidence labels auto-apply — the rest
 * queue (stored, not yet public). One classification per handle, ever.
 */

const HAIKU = 'claude-haiku-4-5-20251001';
const AI_USER = 'ai';
const X_USER = 'x';
const DEDUP_MS = 60 * 60 * 1000;
const recent = new Map<string, number>();

const SYSTEM = `You label X (Twitter) accounts by WHAT THE PERSON DOES, read from their name and bio. Cover ANY domain — tech, finance, media, science, art, sports — NOT just crypto. Many are "key followers": notable people who aren't crypto at all (an AI-lab founder, a podcaster, a VC, a journalist).

Output ONE short role label (≤ 40 chars), ideally "Role @ Org" when identifiable, else a concise role. Examples: "Founder @ OpenAI", "Host @ Dwarkesh Podcast", "Crypto KOL", "Solana Dev", "VC / Investor", "AI Researcher", "NFT Artist", "Journalist @ Bloomberg".

Also output a category from: founder, builder, kol, trader, investor, researcher, media, artist, exchange, project, athlete, personal, other. Use "personal" when the bio is vague with no clear professional role.

Give a confidence 0..1 for how sure you are the label is correct AND specific. Be conservative — low confidence for thin bios.

Reply with ONLY a single minified JSON object, no prose, no code fences: {"label":string,"category":string,"confidence":number}`;

export async function POST(req: NextRequest) {
  const auth = await requireExtAuth(req);
  if ('response' in auth) return auth.response;

  let body: { handle?: string; name?: string; bio?: string; affiliation?: string; followers?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 });
  }

  const handle = (body.handle ?? '').replace(/^@/, '').trim().toLowerCase();
  if (!handle || !/^[a-z0-9_]{1,15}$/.test(handle)) {
    return NextResponse.json({ error: 'bad_handle' }, { status: 400 });
  }

  const last = recent.get(handle);
  if (last != null && Date.now() - last < DEDUP_MS) return NextResponse.json({ ok: true, skipped: 'recent' });

  // Tier 1 — X's own affiliation badge is authoritative: apply directly, no LLM.
  const affiliation = (body.affiliation ?? '').trim().slice(0, 64);
  if (affiliation) {
    recent.set(handle, Date.now());
    await submitCommunityLabel({ userId: X_USER, subjectType: 'handle', subject: handle, label: affiliation, category: 'affiliation', source: 'x', autoVerified: true }).catch(() => {});
    return NextResponse.json({ ok: true, label: affiliation, source: 'x', applied: true });
  }

  // Skip anything already machine-labeled.
  if (await hasMachineLabel('handle', handle)) {
    recent.set(handle, Date.now());
    return NextResponse.json({ ok: true, skipped: 'labeled' });
  }

  const bio = (body.bio ?? '').trim().slice(0, 400);
  if (!bio) return NextResponse.json({ ok: true, skipped: 'no_bio' });
  recent.set(handle, Date.now());

  // Tier 2 — Claude classifies by what they do, any domain.
  let parsed: { label?: string; category?: string; confidence?: number } | null = null;
  try {
    const client = getAnthropic();
    const msg = await client.messages.create({
      model: HAIKU,
      max_tokens: 160,
      system: SYSTEM,
      messages: [{ role: 'user', content: `Name: ${body.name ?? handle}\nHandle: @${handle}\nBio: ${bio}\nFollowers: ${body.followers ?? 'unknown'}` }],
    });
    const text = msg.content.map((c) => (c.type === 'text' ? c.text : '')).join('').trim();
    const json = text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    parsed = JSON.parse(json);
  } catch {
    return NextResponse.json({ ok: false, error: 'classify_failed' });
  }

  const label = (parsed?.label ?? '').trim().slice(0, 64);
  const category = (parsed?.category ?? 'other').trim().slice(0, 32);
  const confidence = typeof parsed?.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0;

  if (!label || category === 'personal' || confidence < 0.5) {
    return NextResponse.json({ ok: true, label: label || null, category, confidence, applied: false, reason: 'low_signal' });
  }

  const autoVerified = confidence >= 0.7; // high-confidence auto-applies; the rest queue
  await submitCommunityLabel({ userId: AI_USER, subjectType: 'handle', subject: handle, label, category, source: 'ai', confidence, autoVerified }).catch(() => {});
  return NextResponse.json({ ok: true, label, category, confidence, applied: autoVerified, queued: !autoVerified });
}
