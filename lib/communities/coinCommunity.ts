/**
 * Coin Communities — per-token community feed that replaces the dead X Communities
 * link on the Pulse social strip. Mirrors the Twitter-profile hover pattern: a glyph
 * with a rich hover preview + click-through to the public community page.
 *
 * API: https://api.coin-communities.xyz (paths under /api/v1). Auth is the `x-api-key`
 * header, kept server-side only and proxied through /api/communities/[mint].
 */

/** Public web page for a token's community (click-through target for the glyph). */
export const COIN_COMMUNITIES_WEB_BASE = 'https://coincommunities.org';

export function coinCommunityWebUrl(tokenAddress: string): string {
  return `${COIN_COMMUNITIES_WEB_BASE}/communities/${encodeURIComponent(tokenAddress)}`;
}

export type CoinCommunityMessage = {
  id: string;
  username: string | null;
  displayName: string | null;
  profileImageUrl: string | null;
  content: string;
  mediaUrl: string | null;
  likeCount: number;
  replyCount: number;
  createdAt: string;
  userTwitterUrl: string | null;
  followerCount: number | null;
};

export type CoinCommunitySummary = {
  tokenAddress: string;
  tokenSymbol: string | null;
  tokenImageUrl: string | null;
  memberCount: number;
  postCount: number;
  totalLikes: number;
  latestPostAt: number | null;
  /** Recent public messages (preview only — full feed lives on coincommunities.org). */
  messages: CoinCommunityMessage[];
  /** True when the community has real activity (members or posts) worth surfacing. */
  active: boolean;
  webUrl: string;
};

/**
 * The API returns a community object for *every* token (auto-provisioned with zero
 * counts). Only surface the glyph when there's genuine activity.
 */
export function isCoinCommunityActive(memberCount: number, postCount: number): boolean {
  return memberCount > 0 || postCount > 0;
}
