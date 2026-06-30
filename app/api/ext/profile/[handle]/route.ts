import { NextResponse, type NextRequest } from 'next/server';
import { requireExtAuth } from '@/lib/ext/auth';
import { createAdminSupabase } from '@/lib/supabase/server';
import { getCommunityLabels, getAllCommunityLabels, type CommunityHit } from '@/lib/ext/communityLabels';
import { getKolCas } from '@/lib/ext/kolCas';
import { getSmartFollowers } from '@/lib/ext/smartFollowers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Ext profile intel — the X profile summary card. Pulls Pointer's identity
 * directory (display name, category/badge, verified, socials) + the KOL's linked
 * wallets from identity_wallets. Smart-followers / Ethos are paywalled upstreams
 * (kept null, never invented). The wallet rows let the card deep-link into the
 * per-wallet analytics (/api/ext/wallet) on demand.
 */

const norm = (h: string) => h.replace(/^@/, '').trim().toLowerCase();

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

export async function GET(req: NextRequest, ctx: { params: Promise<{ handle: string }> }) {
  const auth = await requireExtAuth(req);
  if ('response' in auth) return auth.response;

  const handle = norm((await ctx.params).handle ?? '');
  if (!handle) return NextResponse.json({ error: 'invalid_handle' }, { status: 400 });

  const empty = {
    handle,
    found: false,
    name: null as string | null,
    badge: null as string | null,
    verified: false,
    telegram: null as string | null,
    website: null as string | null,
    notes: null as string | null,
    wallets: [] as { address: string; chain: string; label: string | null }[],
    labels: [] as string[],
    smartFollowers: null as number | null,
    ethos: null as { score: number | null; reviews: number | null } | null,
  };

  try {
    const supabase = createAdminSupabase();
    const { data: profs } = await supabase
      .from('identity_profiles')
      .select('id, display_name, primary_category, verified, telegram_handle, website_url, notes')
      .ilike('twitter_handle', handle)
      .limit(1);
    const prof = profs?.[0];
    if (!prof) {
      // Not in the curated directory — fall back to a verified community tag.
      let community: Record<string, CommunityHit> = {};
      try {
        community = await getCommunityLabels(auth.userId, 'handle', [handle]);
      } catch {
        /* community optional */
      }
      const hit = community[handle];
      if (hit) {
        return NextResponse.json({ ...empty, found: true, name: hit.label, badge: hit.verified ? 'Community' : 'Tagged', labels: [hit.label] });
      }
      return NextResponse.json(empty);
    }

    const { data: wRows } = await supabase
      .from('identity_wallets')
      .select('address, chain')
      .eq('identity_id', prof.id)
      .limit(20);

    const badge = badgeForCategory(prof.primary_category);
    const [cas, smart, extraLabels] = await Promise.all([
      getKolCas(handle, 12).catch(() => []),
      getSmartFollowers(handle, 24).catch(() => ({ count: 0, list: [] })),
      getAllCommunityLabels(auth.userId, 'handle', handle).catch(() => [] as string[]),
    ]);
    const labels = [...new Set([...(badge ? [badge] : []), ...extraLabels])];
    return NextResponse.json({
      handle,
      found: true,
      name: prof.display_name ?? null,
      badge,
      verified: !!prof.verified,
      telegram: prof.telegram_handle ?? null,
      website: prof.website_url ?? null,
      notes: prof.notes ?? null,
      wallets: (wRows ?? []).map((w) => ({ address: w.address, chain: w.chain, label: prof.display_name ?? null })),
      labels,
      cas,
      smartFollowers: smart.count,
      smartFollowerList: smart.list,
      ethos: null,
    });
  } catch {
    return NextResponse.json(empty);
  }
}
