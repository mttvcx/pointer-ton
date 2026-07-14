import { NextResponse, type NextRequest } from 'next/server';
import { getUserByPrivyId } from '@/lib/db/users';
import { verifyPrivyAccessToken } from '@/lib/privy/config';
import { getUiPrefs, upsertUiPrefs, type UiPrefsBlob } from '@/lib/db/uiPrefs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Account-level workspace/layout sync. Blob = { localStorageKey: stringValue }. */

const MAX_KEYS = 64;
const MAX_TOTAL_BYTES = 64 * 1024; // 64KB cap — layout prefs are tiny

async function authUserId(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  if (!token) return null;
  try {
    const { privyId } = await verifyPrivyAccessToken(token);
    const user = await getUserByPrivyId(privyId);
    return user?.id ?? null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const userId = await authUserId(req);
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const prefs = await getUiPrefs(userId);
  return NextResponse.json({ prefs: prefs ?? {} });
}

export async function PUT(req: NextRequest) {
  const userId = await authUserId(req);
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const raw = (body as { prefs?: unknown })?.prefs;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return NextResponse.json({ error: 'invalid_prefs' }, { status: 400 });
  }

  // Keep only string→string entries; enforce sane caps (never trust the client).
  const clean: UiPrefsBlob = {};
  let count = 0;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof k !== 'string' || typeof v !== 'string') continue;
    if (count >= MAX_KEYS) break;
    clean[k] = v;
    count += 1;
  }
  if (JSON.stringify(clean).length > MAX_TOTAL_BYTES) {
    return NextResponse.json({ error: 'prefs_too_large' }, { status: 413 });
  }

  const ok = await upsertUiPrefs(userId, clean);
  if (!ok) return NextResponse.json({ error: 'save_failed' }, { status: 502 });
  return NextResponse.json({ ok: true, keys: count });
}
