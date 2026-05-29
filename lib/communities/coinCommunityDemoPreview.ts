import { coinCommunityWebUrl, type CoinCommunitySummary } from '@/lib/communities/coinCommunity';
import {
  PULSE_SHOWCASE_MINT_CUM,
  PULSE_SHOWCASE_MINT_EIGHT,
  PULSE_SHOWCASE_MINT_PUMPERS,
} from '@/lib/utils/solDemoMints';
import { isUiDemoMode } from '@/lib/dev/uiDemoMode';

const PREVIEW_BY_MINT: Record<string, CoinCommunitySummary> = {
  [PULSE_SHOWCASE_MINT_CUM]: {
    tokenAddress: PULSE_SHOWCASE_MINT_CUM,
    tokenSymbol: 'CUM',
    tokenImageUrl: null,
    memberCount: 108,
    postCount: 398,
    totalLikes: 1_842,
    latestPostAt: Date.now() - 12 * 60_000,
    active: true,
    webUrl: coinCommunityWebUrl(PULSE_SHOWCASE_MINT_CUM),
    messages: [
      {
        id: 'cum-preview-1',
        username: 'dalulucrypto',
        displayName: 'dalulu',
        profileImageUrl: null,
        content: 'Community is live — who is still holding?',
        mediaUrl: null,
        likeCount: 14,
        replyCount: 3,
        createdAt: new Date(Date.now() - 18 * 60_000).toISOString(),
        userTwitterUrl: 'https://x.com/dalulucrypto',
        followerCount: 4_200,
      },
      {
        id: 'cum-preview-2',
        username: 'CoinComms',
        displayName: 'Coin Communities',
        profileImageUrl: null,
        content: 'Welcome to the per-token feed. Post charts, memes, and alpha here.',
        mediaUrl: null,
        likeCount: 31,
        replyCount: 8,
        createdAt: new Date(Date.now() - 2 * 60 * 60_000).toISOString(),
        userTwitterUrl: 'https://x.com/CoinComms',
        followerCount: 12_400,
      },
      {
        id: 'cum-preview-3',
        username: 'anon',
        displayName: 'anon',
        profileImageUrl: null,
        content: 'Bonding curve looking spicy on this one ngl',
        mediaUrl: null,
        likeCount: 6,
        replyCount: 1,
        createdAt: new Date(Date.now() - 5 * 60 * 60_000).toISOString(),
        userTwitterUrl: null,
        followerCount: null,
      },
    ],
  },
  [PULSE_SHOWCASE_MINT_PUMPERS]: {
    tokenAddress: PULSE_SHOWCASE_MINT_PUMPERS,
    tokenSymbol: 'PUMPERS',
    tokenImageUrl: null,
    memberCount: 33,
    postCount: 87,
    totalLikes: 412,
    latestPostAt: Date.now() - 45 * 60_000,
    active: true,
    webUrl: coinCommunityWebUrl(PULSE_SHOWCASE_MINT_PUMPERS),
    messages: [
      {
        id: 'pumpers-preview-1',
        username: 'pumpers',
        displayName: 'PUMPERS',
        profileImageUrl: null,
        content: 'Telegram raid in 10 — community link is pinned.',
        mediaUrl: null,
        likeCount: 9,
        replyCount: 2,
        createdAt: new Date(Date.now() - 45 * 60_000).toISOString(),
        userTwitterUrl: null,
        followerCount: null,
      },
      {
        id: 'pumpers-preview-2',
        username: 'CoinComms',
        displayName: 'Coin Communities',
        profileImageUrl: null,
        content: 'Profile + community combo row — hover works the same as Axiom.',
        mediaUrl: null,
        likeCount: 18,
        replyCount: 4,
        createdAt: new Date(Date.now() - 3 * 60 * 60_000).toISOString(),
        userTwitterUrl: 'https://x.com/CoinComms',
        followerCount: 12_400,
      },
    ],
  },
  [PULSE_SHOWCASE_MINT_EIGHT]: {
    tokenAddress: PULSE_SHOWCASE_MINT_EIGHT,
    tokenSymbol: 'EIGHT',
    tokenImageUrl: null,
    memberCount: 22,
    postCount: 54,
    totalLikes: 198,
    latestPostAt: Date.now() - 90 * 60_000,
    active: true,
    webUrl: coinCommunityWebUrl(PULSE_SHOWCASE_MINT_EIGHT),
    messages: [
      {
        id: 'eight-preview-1',
        username: 'holder',
        displayName: 'holder',
        profileImageUrl: null,
        content: 'Eight figure arc loading…',
        mediaUrl: null,
        likeCount: 4,
        replyCount: 0,
        createdAt: new Date(Date.now() - 90 * 60_000).toISOString(),
        userTwitterUrl: null,
        followerCount: null,
      },
    ],
  },
};

/** Instant hover payload for showcase mints while the live API warms up. */
export function coinCommunityInitialPreview(mint: string): CoinCommunitySummary | undefined {
  const trimmed = mint.trim();
  if (!trimmed) return undefined;
  if (!isUiDemoMode()) return undefined;
  return PREVIEW_BY_MINT[trimmed];
}
