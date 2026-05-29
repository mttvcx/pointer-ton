import { NextResponse } from 'next/server';
import {
  coinCommunityWebUrl,
  isCoinCommunityActive,
  type CoinCommunityMessage,
  type CoinCommunitySummary,
} from '@/lib/communities/coinCommunity';

export const runtime = 'edge';

const API_BASE = (process.env.COIN_COMMUNITIES_API_BASE || 'https://api.coin-communities.xyz').replace(
  /\/$/,
  '',
);
const PREVIEW_MESSAGE_LIMIT = 4;

type RawCommunity = {
  tokenSymbol?: string | null;
  tokenImageUrl?: string | null;
  memberCount?: number | null;
  postCount?: number | null;
  totalLikes?: number | null;
  latestPostAt?: number | null;
};

type RawMessage = {
  id: string;
  username?: string | null;
  displayName?: string | null;
  profileImageUrl?: string | null;
  content?: string | null;
  mediaUrl?: string | null;
  likeCount?: number | null;
  replyCount?: number | null;
  createdAt?: string | null;
  userTwitterUrl?: string | null;
  followerCount?: number | null;
};

function num(v: number | null | undefined): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ mint: string }> },
): Promise<Response> {
  const apiKey = process.env.COIN_COMMUNITIES_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: 'coin communities not configured' }, { status: 501 });
  }

  const { mint: raw = '' } = await ctx.params;
  const mint = decodeURIComponent(raw).trim();
  if (!mint) {
    return NextResponse.json({ error: 'missing token address' }, { status: 400 });
  }

  const headers = { 'x-api-key': apiKey, accept: 'application/json' };
  const enc = encodeURIComponent(mint);

  try {
    const communityRes = await fetch(`${API_BASE}/api/v1/communities/${enc}`, { headers });
    if (!communityRes.ok) {
      return NextResponse.json({ error: 'community lookup failed' }, { status: 502 });
    }
    const communityJson = (await communityRes.json()) as RawCommunity;

    const memberCount = num(communityJson.memberCount);
    const postCount = num(communityJson.postCount);
    const active = isCoinCommunityActive(memberCount, postCount);

    let messages: CoinCommunityMessage[] = [];
    if (active) {
      const msgRes = await fetch(
        `${API_BASE}/api/v1/communities/${enc}/messages/public?limit=${PREVIEW_MESSAGE_LIMIT}`,
        { headers },
      );
      if (msgRes.ok) {
        const msgJson = (await msgRes.json()) as { messages?: RawMessage[] };
        messages = (msgJson.messages ?? []).slice(0, PREVIEW_MESSAGE_LIMIT).map((m) => ({
          id: m.id,
          username: m.username ?? null,
          displayName: m.displayName ?? null,
          profileImageUrl: m.profileImageUrl ?? null,
          content: m.content ?? '',
          mediaUrl: m.mediaUrl ?? null,
          likeCount: num(m.likeCount),
          replyCount: num(m.replyCount),
          createdAt: m.createdAt ?? '',
          userTwitterUrl: m.userTwitterUrl ?? null,
          followerCount: typeof m.followerCount === 'number' ? m.followerCount : null,
        }));
      }
    }

    const summary: CoinCommunitySummary = {
      tokenAddress: mint,
      tokenSymbol: communityJson.tokenSymbol ?? null,
      tokenImageUrl: communityJson.tokenImageUrl ?? null,
      memberCount,
      postCount,
      totalLikes: num(communityJson.totalLikes),
      latestPostAt:
        typeof communityJson.latestPostAt === 'number' ? communityJson.latestPostAt : null,
      messages,
      active,
      webUrl: coinCommunityWebUrl(mint),
    };

    return NextResponse.json(summary, {
      headers: { 'cache-control': 'public, s-maxage=30, stale-while-revalidate=120' },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'lookup failed' },
      { status: 502 },
    );
  }
}
