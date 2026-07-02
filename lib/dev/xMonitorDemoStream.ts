/**
 * X Monitor demo stream — synthetic tweet/account events for previewing the feed
 * UI without a live X source. Powers the "Preview samples" toggle: new fake
 * events stream in on an interval so the operator can see every card state
 * (posted / replied / quoted / retweeted / followed / deleted, across X / Truth
 * Social / Instagram) plus AI ticker suggestions with N/T edit-focus badges.
 *
 * Preview-only. Never used for live data — real events come from the ingest
 * pipeline into the same card shapes.
 */
import type { TweetLaunchInput } from '@/lib/launch/types';
import type { TwitterListenAlertPayload } from '@/lib/launch/alertTweet';

export type DemoEvent = 'posted' | 'replied' | 'quoted' | 'retweeted' | 'followed' | 'deleted';
export type DemoPlatform = 'x' | 'truth' | 'instagram';

export interface DemoStreamFields {
  displayName: string;
  verified: boolean;
  followers: number;
  eventType: DemoEvent;
  platform: DemoPlatform;
  avatarUrl?: string;
  /** the other account for reply/quote/retweet/follow events */
  targetHandle?: string;
  quoted?: { handle: string; name: string; text: string; avatarUrl?: string };
  suggestions?: { name: string; ticker: string; image?: string }[];
}

export interface DemoStreamRow extends DemoStreamFields {
  alertId: string;
  createdAt: string;
  tweet: TweetLaunchInput;
  subject: string;
  payload: TwitterListenAlertPayload;
  isMock: true;
}

interface Template extends Omit<DemoStreamFields, 'followers'> {
  handle: string;
  followersK: number; // thousands
  text: string;
  image?: string;
  mint?: string;
  execution?: 'notify' | 'auto_buy' | 'auto_launch';
}

const TEMPLATES: Template[] = [
  {
    handle: 'elonmusk', displayName: 'Elon Musk', verified: true, followersK: 210_000, platform: 'x', eventType: 'posted',
    text: 'Grok 5 is going to be something else. let him cook 🚀',
    suggestions: [{ name: 'Let Him Cook', ticker: 'COOK' }, { name: 'Grok 5', ticker: 'GROK5' }, { name: 'Let Him Cook', ticker: 'LETHIMCOOK' }],
    execution: 'notify',
  },
  {
    handle: 'realDonaldTrump', displayName: 'Donald J. Trump', verified: true, followersK: 88_000, platform: 'truth', eventType: 'posted',
    text: 'S&P 500 closes with the STRONGEST quarter since 2020. America is BACK!',
    suggestions: [{ name: 'S&P 500', ticker: 'SP500' }, { name: 'America Is Back', ticker: 'MABA' }],
    execution: 'notify',
  },
  {
    handle: 'a1lon9', displayName: 'alon', verified: true, followersK: 371, platform: 'x', eventType: 'posted',
    text: 'wif hat but for the AI era. deploying this myself. wagmi',
    suggestions: [{ name: 'AI Wif Hat', ticker: 'AIWIF' }, { name: 'WAGMI', ticker: 'WAGMI' }],
    execution: 'auto_launch',
  },
  {
    handle: 'frankdegods', displayName: 'Frank', verified: true, followersK: 402, platform: 'x', eventType: 'posted',
    text: 'CA: 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU — aping a small bag. NFA.',
    mint: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU', execution: 'auto_buy',
  },
  {
    handle: 'iamjasonlevin', displayName: 'Jason Levin', verified: true, followersK: 43, platform: 'x', eventType: 'followed',
    targetHandle: 'lorafinance', text: '',
    suggestions: [{ name: 'Lora Finance', ticker: 'LORA' }],
    execution: 'notify',
  },
  {
    handle: 'nathan_liow', displayName: 'Nathan', verified: true, followersK: 2, platform: 'x', eventType: 'replied',
    targetHandle: 'AxiomExchange', text: 'wow, let him cook 👨‍🍳',
    quoted: { handle: 'AxiomExchange', name: 'Axiom', text: "We're hiring a Private Chef for the Austin office. DM me!" },
    suggestions: [{ name: 'Let Him Cook', ticker: 'COOK' }, { name: 'Private Chef', ticker: 'CHEF' }],
    execution: 'notify',
  },
  {
    handle: 'pmarca', displayName: 'Marc Andreessen', verified: true, followersK: 4_300, platform: 'x', eventType: 'quoted',
    targetHandle: 'oecolamp', text: 'USA. 🇺🇸',
    quoted: { handle: 'oecolamp', name: 'lamp', text: 'One of the more stunted features of American culture is a lack of tragedy.' },
    suggestions: [{ name: 'USA', ticker: 'USA' }, { name: 'American Coin', ticker: 'USA' }],
    execution: 'notify',
  },
  {
    handle: 'Branche_SC', displayName: 'Branche°', verified: true, followersK: 14, platform: 'x', eventType: 'retweeted',
    targetHandle: 'JosephPolitano', text: '',
    quoted: { handle: 'JosephPolitano', name: 'Joey Politano 🏴', text: 'US factory construction is down 30% from its 2024 highs.' },
    execution: 'notify',
  },
  {
    handle: 'donaldjtrumpjr', displayName: 'Donald Trump Jr.', verified: true, followersK: 14_000, platform: 'instagram', eventType: 'posted',
    text: 'Great day with a great team! 🇺🇸',
    execution: 'notify',
  },
  {
    handle: 'Austen', displayName: 'Austen Allred', verified: true, followersK: 472, platform: 'x', eventType: 'deleted',
    text: "They've been crazy with the cards the whole tournament",
    quoted: { handle: 'notacrankychef', name: 'TheMikeDrop', text: 'Embarrassing for the tournament. The refs made the Cup a laughingstock.' },
    execution: 'notify',
  },
  {
    handle: 'BingXOfficial', displayName: 'BingX', verified: true, followersK: 791, platform: 'x', eventType: 'posted',
    text: 'wen lambo? no, seriously, when?',
    suggestions: [{ name: 'wen lambo', ticker: 'LAMBO' }, { name: 'WEN Lambo', ticker: 'WENLAMBO' }, { name: 'wen', ticker: 'WEN' }],
    execution: 'notify',
  },
  {
    handle: 'WSJ', displayName: 'The Wall Street Journal', verified: true, followersK: 21_000, platform: 'x', eventType: 'posted',
    text: 'We asked five experts: What constitutional amendment would you like to see?',
    suggestions: [{ name: 'Constitutional Amendment', ticker: 'AMENDMENT' }, { name: 'Constitution', ticker: 'AMENDM' }],
    execution: 'notify',
  },
];

const fmtFollowers = (k: number): number => Math.round(k * 1000);

/** Real X avatar for a handle (demo only — external service, preview UI). */
const avatarFor = (handle: string): string => `https://unavatar.io/twitter/${handle}`;
/** Deterministic demo token image for a suggestion. */
const suggestionImg = (ticker: string, i: number): string =>
  `https://picsum.photos/seed/pt-${ticker.replace(/[^a-z0-9]/gi, '')}-${i}/64`;

/** Build one demo row from template index `t`, made unique by `seq`. */
export function makeDemoStreamRow(seq: number, tIndex: number, nowMs: number): DemoStreamRow {
  const t = TEMPLATES[((tIndex % TEMPLATES.length) + TEMPLATES.length) % TEMPLATES.length]!;
  const id = `ux-mock-stream-${seq}`;
  const tweet: TweetLaunchInput = {
    id: `${9_000_000_000_000_000 + seq}`,
    authorHandle: t.handle,
    text: t.text,
    tweetUrl: `https://x.com/${t.handle}/status/${9_000_000_000_000_000 + seq}`,
    ...(t.image ? { imageUrls: [t.image] } : {}),
  };
  const payload: TwitterListenAlertPayload = {
    handle: t.handle,
    tweetText: t.text,
    tweetUrl: tweet.tweetUrl,
    execution: t.execution ?? 'notify',
    ...(t.mint ? { mint: t.mint } : {}),
  };
  return {
    alertId: id,
    createdAt: new Date(nowMs).toISOString(),
    tweet,
    subject: id,
    payload,
    isMock: true,
    displayName: t.displayName,
    verified: t.verified,
    followers: fmtFollowers(t.followersK),
    eventType: t.eventType,
    platform: t.platform,
    avatarUrl: avatarFor(t.handle),
    ...(t.targetHandle ? { targetHandle: t.targetHandle } : {}),
    ...(t.quoted ? { quoted: { ...t.quoted, avatarUrl: avatarFor(t.quoted.handle) } } : {}),
    ...(t.suggestions
      ? { suggestions: t.suggestions.map((s, i) => ({ ...s, image: suggestionImg(s.ticker, i) })) }
      : {}),
  };
}

/** Seed the feed with a spread of event types so the first paint shows variety. */
export function seedDemoStream(nowMs: number): DemoStreamRow[] {
  return [0, 1, 2, 3, 4, 5].map((i) => makeDemoStreamRow(i, i, nowMs - i * 45_000));
}
