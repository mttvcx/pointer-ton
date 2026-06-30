import { NextResponse, type NextRequest } from 'next/server';
import { requireExtAuth } from '@/lib/ext/auth';
import { createAdminSupabase } from '@/lib/supabase/server';
import { getWalletLabelsForUser } from '@/lib/db/walletLabels';
import { getCommunityLabels, type CommunityHit } from '@/lib/ext/communityLabels';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Universal labels for the on-page extension — Pointer's OWN curated directory,
 * served automatically (no import). Given the @handles / wallets visible on a
 * page, returns the known KOL/identity label for each (from `identity_profiles`
 * + `identity_wallets`), merged with the user's personal wallet labels. This is
 * what stamps "RED · KOL" onto a profile the moment you see it.
 */

const norm = (h: string) => h.replace(/^@/, '').trim().toLowerCase();

interface LabelHit {
  name: string;
  badge: string | null;
  verified: boolean;
  kind: 'kol' | 'personal' | 'community';
}

function badgeForCategory(cat: string | null): string | null {
  if (!cat) return null;
  const c = cat.toLowerCase();
  if (c === 'kol') return 'KOL';
  if (c === 'team' || c === 'project') return 'Team';
  if (c === 'exchange') return 'CEX';
  if (c === 'fund' || c === 'vc') return 'Fund';
  if (c === 'insider') return 'Insider';
  if (c === 'mm') return 'MM';
  return cat.charAt(0).toUpperCase() + cat.slice(1);
}

export async function POST(req: NextRequest) {
  const auth = await requireExtAuth(req);
  if ('response' in auth) return auth.response;

  let body: { handles?: unknown; wallets?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 });
  }
  const handles = Array.isArray(body.handles) ? [...new Set(body.handles.map(String).map(norm))].filter(Boolean).slice(0, 60) : [];
  const wallets = Array.isArray(body.wallets) ? [...new Set(body.wallets.map(String).map((w) => w.trim()))].filter(Boolean).slice(0, 60) : [];

  const outHandles: Record<string, LabelHit> = {};
  const outWallets: Record<string, LabelHit> = {};

  const supabase = createAdminSupabase();

  // ── known profiles by twitter handle ──
  if (handles.length) {
    try {
      const orFilter = handles.map((h) => `twitter_handle.ilike.${h}`).join(',');
      const { data } = await supabase
        .from('identity_profiles')
        .select('display_name, twitter_handle, primary_category, verified')
        .or(orFilter)
        .limit(120);
      for (const p of data ?? []) {
        const h = p.twitter_handle ? norm(p.twitter_handle) : null;
        if (!h || !p.display_name) continue;
        outHandles[h] = { name: p.display_name, badge: badgeForCategory(p.primary_category), verified: !!p.verified, kind: 'kol' };
      }
    } catch {
      /* degrade — return what we have */
    }
  }

  // ── known wallets (identity directory) — two queries, no embedded join ──
  if (wallets.length) {
    try {
      const cands = [...new Set(wallets.flatMap((w) => [w, w.toLowerCase()]))];
      const list = cands.join(',');
      const { data: wRows } = await supabase
        .from('identity_wallets')
        .select('address, normalized_address, identity_id')
        .or(`address.in.(${list}),normalized_address.in.(${list})`)
        .limit(120);
      const rows = wRows ?? [];
      const ids = [...new Set(rows.map((r) => r.identity_id))];
      if (ids.length) {
        const { data: profs } = await supabase
          .from('identity_profiles')
          .select('id, display_name, primary_category, verified')
          .in('id', ids);
        const byId = new Map((profs ?? []).map((p) => [p.id, p]));
        for (const r of rows) {
          const prof = byId.get(r.identity_id);
          if (!prof?.display_name) continue;
          const orig = wallets.find((w) => w === r.address || w.toLowerCase() === r.normalized_address || w === r.normalized_address) ?? r.address;
          outWallets[orig] = { name: prof.display_name, badge: badgeForCategory(prof.primary_category), verified: !!prof.verified, kind: 'kol' };
        }
      }
    } catch {
      /* degrade */
    }
  }

  // ── personal wallet labels (override the directory for the user's own tags) ──
  if (wallets.length) {
    try {
      const mine = await getWalletLabelsForUser(auth.userId);
      for (const w of wallets) {
        const row = mine[w];
        if (row?.label) {
          outWallets[w] = { name: row.label, badge: row.emoji ?? 'Label', verified: false, kind: 'personal' };
        }
      }
    } catch {
      /* degrade */
    }
  }

  // ── community labels (crowdsourced) — fill the gaps the directory misses ──
  try {
    const [ch, cw] = await Promise.all([
      handles.length ? getCommunityLabels(auth.userId, 'handle', handles) : Promise.resolve<Record<string, CommunityHit>>({}),
      wallets.length ? getCommunityLabels(auth.userId, 'wallet', wallets) : Promise.resolve<Record<string, CommunityHit>>({}),
    ]);
    for (const [h, hit] of Object.entries(ch)) {
      if (!outHandles[h]) outHandles[h] = { name: hit.label, badge: hit.verified ? 'Community' : 'Tagged', verified: hit.verified, kind: 'community' };
    }
    for (const [w, hit] of Object.entries(cw)) {
      if (!outWallets[w]) outWallets[w] = { name: hit.label, badge: hit.verified ? 'Community' : 'Tagged', verified: hit.verified, kind: 'community' };
    }
  } catch {
    /* community is additive — never blocks the directory */
  }

  return NextResponse.json({ handles: outHandles, wallets: outWallets });
}
