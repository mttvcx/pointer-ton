import type { Asset } from 'helius-sdk/types/das';
import type { PulseTokenBundle } from '@/types/tokens';

export type TwitterLinkKind = 'profile' | 'community' | 'tweet' | 'search';

export type TwitterLinkInfo = { url: string; kind: TwitterLinkKind; handle?: string };

export type PulseSocialModel = {
  website: string | null;
  telegram: string | null;
  instagram: string | null;
  github: string | null;
  youtube: string | null;
  tiktok: string | null;
  pumpFunUrl: string | null;
  twitterProfile: TwitterLinkInfo | null;
  twitterCommunity: TwitterLinkInfo | null;
  twitterTweet: TwitterLinkInfo | null;
  /** X/Twitter search, hashtag, or explore query URL (use X logo, not feather). */
  twitterSearch: TwitterLinkInfo | null;
};

/** Snowflake timestamp embedded in numeric tweet status IDs (X/Twitter). */
const TWITTER_SNOWFLAKE_EPOCH_MS = 1288834974657;

export function tweetIdFromStatusUrl(statusUrl: string): string | null {
  try {
    const u = new URL(statusUrl);
    if (!isTwitterHost(u.hostname)) return null;
    const m = u.pathname.match(/\/(?:status|i\/web\/status)\/(\d+)/i);
    return m?.[1] ?? null;
  } catch {
    return null;
  }
}

/** Approximate post time from status URL; null if ID missing or invalid. */
export function approxTweetCreatedAtMs(statusUrl: string): number | null {
  const idStr = tweetIdFromStatusUrl(statusUrl);
  if (!idStr) return null;
  try {
    const id = BigInt(idStr);
    if (id <= 0n) return null;
    const ms = Number(id >> 22n) + TWITTER_SNOWFLAKE_EPOCH_MS;
    return Number.isFinite(ms) && ms > 1_000_000_000_000 ? ms : null;
  } catch {
    return null;
  }
}

/** True = older than `maxAgeMs`; false = newer or equal; null = could not tell from ID. */
export function isTweetOlderThan(statusUrl: string, maxAgeMs: number): boolean | null {
  const ts = approxTweetCreatedAtMs(statusUrl);
  if (ts == null) return null;
  return Date.now() - ts > maxAgeMs;
}

const URL_IN_STRING = /https?:\/\/[^\s"'<>)\]]+/gi;

function stripTrailingJunk(url: string): string {
  return url.replace(/[),.;]+$/g, '');
}

function rewriteTwitterToX(url: string): string {
  try {
    const u = new URL(url);
    const h = u.hostname.replace(/^www\./, '').toLowerCase();
    if (h === 'twitter.com') {
      u.hostname = 'x.com';
      return u.toString();
    }
  } catch {
    /* ignore */
  }
  return url;
}

/** Make social links reliably clickable (add https, fix twitter.com ? x.com). */
export function ensureBrowserUrl(raw: string | null | undefined): string | null {
  if (raw == null || typeof raw !== 'string') return null;
  let t = stripTrailingJunk(raw.trim());
  if (!t) return null;
  if (t.startsWith('//')) t = `https:${t}`;
  else if (!/^https?:\/\//i.test(t)) {
    if (/^(x\.com|twitter\.com)(\/|$)/i.test(t)) t = `https://${t.replace(/^\/+/, '')}`;
    else if (/^t\.me(\/|$)/i.test(t)) t = `https://${t}`;
    else if (/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}([/:?#].*)?$/i.test(t)) t = `https://${t}`;
    else return null;
  }
  let normalized: string;
  try {
    normalized = new URL(t).toString();
  } catch {
    return null;
  }
  return rewriteTwitterToX(normalized);
}

export function normalizeHttpUrl(s: string): string | null {
  const t = stripTrailingJunk(s.trim());
  if (!t) return null;
  try {
    return new URL(t).toString();
  } catch {
    return null;
  }
}

function isTwitterHost(hostname: string): boolean {
  const h = hostname.replace(/^www\./, '').toLowerCase();
  return h === 'twitter.com' || h === 'x.com';
}

function isInstagramHost(hostname: string): boolean {
  const h = hostname.replace(/^www\./, '').toLowerCase();
  return h === 'instagram.com' || h === 'instagr.am';
}

function isGithubHost(hostname: string): boolean {
  const h = hostname.replace(/^www\./, '').toLowerCase();
  return h === 'github.com' || h.endsWith('.github.com');
}

function isYoutubeHost(hostname: string): boolean {
  const h = hostname.replace(/^www\./, '').toLowerCase();
  return h === 'youtube.com' || h === 'youtu.be' || h === 'm.youtube.com';
}

function isTiktokHost(hostname: string): boolean {
  const h = hostname.replace(/^www\./, '').toLowerCase();
  return h === 'tiktok.com' || h === 'www.tiktok.com';
}

/** IPFS / storage gateways are not user-facing websites for the globe icon. */
export function isNonWebsiteInfrastructureUrl(url: string): boolean {
  try {
    const h = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    if (h.includes('ipfs')) return true;
    if (h.includes('arweave')) return true;
    if (h === 'nftstorage.link') return true;
    if (h.endsWith('.ipfs.dweb.link')) return true;
    if (h.endsWith('.ipfs.nftstorage.link')) return true;
    if (h === 'gateway.pinata.cloud') return true;
    return false;
  } catch {
    return false;
  }
}

export function resolveDisplayWebsite(url: string | null | undefined): string | null {
  if (!url) return null;
  const normalized = ensureBrowserUrl(url) ?? normalizeHttpUrl(url);
  if (!normalized || isNonWebsiteInfrastructureUrl(normalized)) return null;
  return normalized;
}

/** Tweet, community, search/query, or profile path on x.com / twitter.com */
export function classifyTwitterUrl(url: string): TwitterLinkKind {
  try {
    const u = new URL(url);
    if (!isTwitterHost(u.hostname)) return 'profile';
    const p = u.pathname.toLowerCase();
    const seg0 = p.split('/').filter(Boolean)[0] ?? '';

    if (p.includes('/i/communities/') || /^\/communities\//.test(p)) return 'community';

    if (
      seg0 === 'search' ||
      p.startsWith('/search') ||
      seg0 === 'hashtag' ||
      p.startsWith('/hashtag/') ||
      (seg0 === 'explore' && u.search.length > 1)
    ) {
      return 'search';
    }

    if (/\/status\//i.test(p) || /\/i\/web\/status\//i.test(p)) return 'tweet';

    return 'profile';
  } catch {
    return 'profile';
  }
}

export function twitterHandleFromProfileUrl(url: string): string | undefined {
  try {
    const u = new URL(url);
    if (!isTwitterHost(u.hostname)) return undefined;
    const parts = u.pathname.split('/').filter(Boolean);
    const first = parts[0]?.toLowerCase();
    if (
      !first ||
      [
        'i',
        'intent',
        'share',
        'home',
        'search',
        'hashtag',
        'messages',
        'settings',
        'explore',
        'compose',
      ].includes(first)
    ) {
      return undefined;
    }
    if (first === 'communities') return undefined;
    if (parts[0]?.toLowerCase() === 'i') return undefined;
    return parts[0];
  } catch {
    return undefined;
  }
}

function addToUrlSet(set: Set<string>, raw: unknown) {
  if (typeof raw !== 'string' || !raw.trim()) return;
  let s = raw.trim();
  if (s.startsWith('t.me/') || s.startsWith('telegram.me/')) s = `https://${s}`;
  else if (/^(x\.com|twitter\.com)\//i.test(s)) s = `https://${s}`;
  else if (!/^https?:\/\//i.test(s) && /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}([/:?#].*)?$/i.test(s)) {
    s = `https://${s}`;
  }
  const n = normalizeHttpUrl(s);
  if (n) set.add(rewriteTwitterToX(n));
}

function walkForUrls(obj: unknown, acc: Set<string>, depth: number) {
  if (depth > 14 || obj == null) return;

  if (typeof obj === 'string') {
    const ms = obj.match(URL_IN_STRING);
    if (ms) {
      for (const m of ms) addToUrlSet(acc, m);
    }
    return;
  }

  if (Array.isArray(obj)) {
    for (const x of obj) walkForUrls(x, acc, depth + 1);
    return;
  }

  if (typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const kl = k.toLowerCase();
      if (typeof v === 'string') {
        if (kl.includes('twitter') || kl === 'x' || kl.endsWith('_twitter')) {
          if (v.startsWith('http')) addToUrlSet(acc, v);
          else {
            const h = v.replace(/^@/, '').replace(/\/$/, '');
            if (h && !h.includes('/') && !h.includes(' ')) addToUrlSet(acc, `https://x.com/${h}`);
          }
        } else if (kl.includes('telegram') || kl === 'tg') {
          if (v.startsWith('http')) addToUrlSet(acc, v);
          else addToUrlSet(acc, `https://t.me/${v.replace(/^@/, '')}`);
        } else if (kl.includes('instagram') || kl === 'ig') {
          if (v.startsWith('http')) addToUrlSet(acc, v);
          else addToUrlSet(acc, `https://instagram.com/${v.replace(/^@/, '')}`);
        } else if (kl.includes('github')) {
          if (v.startsWith('http')) addToUrlSet(acc, v);
          else addToUrlSet(acc, `https://github.com/${v.replace(/^@/, '')}`);
        } else if (kl.includes('youtube') || kl.includes('youtu')) {
          if (v.startsWith('http')) addToUrlSet(acc, v);
          else addToUrlSet(acc, `https://youtube.com/${v.replace(/^@/, '')}`);
        } else if (kl.includes('tiktok')) {
          if (v.startsWith('http')) addToUrlSet(acc, v);
          else addToUrlSet(acc, `https://www.tiktok.com/@${v.replace(/^@/, '')}`);
        } else if (
          kl.includes('website') ||
          kl === 'external_url' ||
          kl.includes('homepage') ||
          kl.includes('web_url')
        ) {
          addToUrlSet(acc, v);
        }
      }
      walkForUrls(v, acc, depth + 1);
    }
  }
}

export function collectUrlsFromUnknown(root: unknown): Set<string> {
  const acc = new Set<string>();
  walkForUrls(root, acc, 0);
  return acc;
}

function partitionTwitterLinks(urls: Iterable<string>): {
  profile: TwitterLinkInfo | null;
  community: TwitterLinkInfo | null;
  tweet: TwitterLinkInfo | null;
  search: TwitterLinkInfo | null;
} {
  let profile: TwitterLinkInfo | null = null;
  let community: TwitterLinkInfo | null = null;
  let tweet: TwitterLinkInfo | null = null;
  let search: TwitterLinkInfo | null = null;

  for (const u of urls) {
    let href = u;
    let parsed: URL;
    try {
      parsed = new URL(u);
    } catch {
      const fixed = ensureBrowserUrl(u);
      if (!fixed) continue;
      href = fixed;
      try {
        parsed = new URL(fixed);
      } catch {
        continue;
      }
    }
    if (!isTwitterHost(parsed.hostname)) continue;
    const kind = classifyTwitterUrl(href);
    const info: TwitterLinkInfo = {
      url: href,
      kind,
      handle: kind === 'profile' ? twitterHandleFromProfileUrl(href) : undefined,
    };
    if (kind === 'search' && !search) search = info;
    else if (kind === 'profile' && !profile) profile = info;
    else if (kind === 'community' && !community) community = info;
    else if (kind === 'tweet' && !tweet) tweet = info;
  }

  return { profile, community, tweet, search };
}

function pickWebsiteTelegram(urls: Iterable<string>, twitterUrls: Set<string>): {
  website: string | null;
  telegram: string | null;
} {
  let website: string | null = null;
  let telegram: string | null = null;

  for (const u of urls) {
    if (twitterUrls.has(u)) continue;
    let parsed: URL;
    try {
      parsed = new URL(u);
    } catch {
      continue;
    }
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
    if (host === 't.me' || host === 'telegram.me' || host === 'telegram.org') {
      if (!telegram) telegram = u;
      continue;
    }
    if (
      !website &&
      !host.includes('pump.fun') &&
      !host.includes('tonviewer') &&
      !host.includes('dexscreener') &&
      !host.includes('birdeye') &&
      !host.includes('photon.sol') &&
      !isNonWebsiteInfrastructureUrl(u) &&
      !isInstagramHost(host) &&
      !isGithubHost(parsed.hostname) &&
      !isYoutubeHost(parsed.hostname) &&
      !isTiktokHost(parsed.hostname)
    ) {
      website = u;
    }
  }
  return { website, telegram };
}

function pickInstagram(urls: Iterable<string>): string | null {
  for (const u of urls) {
    try {
      const host = new URL(u).hostname;
      if (isInstagramHost(host)) return ensureBrowserUrl(u);
    } catch {
      /* skip */
    }
  }
  return null;
}

function pickGithub(urls: Iterable<string>): string | null {
  for (const u of urls) {
    try {
      if (isGithubHost(new URL(u).hostname)) return ensureBrowserUrl(u);
    } catch {
      /* skip */
    }
  }
  return null;
}

function pickYoutube(urls: Iterable<string>): string | null {
  for (const u of urls) {
    try {
      if (isYoutubeHost(new URL(u).hostname)) return ensureBrowserUrl(u);
    } catch {
      /* skip */
    }
  }
  return null;
}

function pickTiktok(urls: Iterable<string>): string | null {
  for (const u of urls) {
    try {
      if (isTiktokHost(new URL(u).hostname)) return ensureBrowserUrl(u);
    } catch {
      /* skip */
    }
  }
  return null;
}

function finalizeTwitterInfo(info: TwitterLinkInfo | null): TwitterLinkInfo | null {
  if (!info) return null;
  const url = ensureBrowserUrl(info.url);
  if (!url) return null;
  const kind = classifyTwitterUrl(url);
  return {
    url,
    kind,
    handle:
      kind === 'profile' ? twitterHandleFromProfileUrl(url) ?? info.handle : undefined,
  };
}

/** Client + server: derive icons / links for the Pulse row from DB + raw_metadata. */
export function getPulseSocialModel(bundle: PulseTokenBundle): PulseSocialModel {
  const { token } = bundle;
  const urls = collectUrlsFromUnknown(token.raw_metadata);
  if (bundle.snapshot?.extended_metrics != null) {
    for (const u of collectUrlsFromUnknown(bundle.snapshot.extended_metrics)) {
      urls.add(u);
    }
  }
  if (token.website_url) addToUrlSet(urls, token.website_url);
  if (token.telegram_url) addToUrlSet(urls, token.telegram_url);
  if (token.twitter_handle) {
    const h = token.twitter_handle.replace(/^@/, '').trim();
    if (h.startsWith('http://') || h.startsWith('https://')) {
      addToUrlSet(urls, h);
    } else if (h && !h.includes('/')) {
      addToUrlSet(urls, `https://x.com/${h}`);
    }
  }

  const twitterUrls = new Set<string>();
  for (const u of urls) {
    try {
      if (isTwitterHost(new URL(u).hostname)) twitterUrls.add(u);
    } catch {
      /* skip */
    }
  }

  const { profile, community, tweet, search } = partitionTwitterLinks(twitterUrls);
  const { website: wFromUrls, telegram: tgFromUrls } = pickWebsiteTelegram(urls, twitterUrls);

  let primarySite = token.website_url ? normalizeHttpUrl(token.website_url) : null;
  if (primarySite && isNonWebsiteInfrastructureUrl(primarySite)) primarySite = null;
  let instagram = pickInstagram(urls);
  let github = pickGithub(urls);
  let youtube = pickYoutube(urls);
  let tiktok = pickTiktok(urls);
  if (primarySite) {
    try {
      const host = new URL(primarySite).hostname;
      if (isInstagramHost(host)) {
        instagram = instagram ?? ensureBrowserUrl(primarySite);
        primarySite = null;
      } else if (isGithubHost(host)) {
        github = github ?? ensureBrowserUrl(primarySite);
        primarySite = null;
      } else if (isYoutubeHost(host)) {
        youtube = youtube ?? ensureBrowserUrl(primarySite);
        primarySite = null;
      } else if (isTiktokHost(host)) {
        tiktok = tiktok ?? ensureBrowserUrl(primarySite);
        primarySite = null;
      }
    } catch {
      /* ignore */
    }
  }

  const websiteRaw = primarySite || wFromUrls;
  const telegramRaw =
    (token.telegram_url?.trim() &&
      (ensureBrowserUrl(token.telegram_url) ?? normalizeHttpUrl(token.telegram_url))) ||
    tgFromUrls;

  const website = resolveDisplayWebsite(websiteRaw ? ensureBrowserUrl(websiteRaw) : null);
  const telegram = telegramRaw ? ensureBrowserUrl(telegramRaw) : null;

  const isPump =
    token.launch_pad === 'pump.fun' || token.mint.toLowerCase().endsWith('pump');
  const pumpFunUrl = isPump
    ? ensureBrowserUrl(`https://pump.fun/${encodeURIComponent(token.mint)}`)
    : null;

  return {
    website,
    telegram,
    instagram,
    github,
    youtube,
    tiktok,
    pumpFunUrl,
    twitterProfile: finalizeTwitterInfo(profile),
    twitterCommunity: finalizeTwitterInfo(community),
    twitterTweet: finalizeTwitterInfo(tweet),
    twitterSearch: finalizeTwitterInfo(search),
  };
}

/** Merge Twitter profile URL/handle from raw metadata when DB columns are empty. */
export function enrichBundleTwitterFromSocialModel(bundle: PulseTokenBundle): PulseTokenBundle {
  const model = getPulseSocialModel(bundle);
  const profile = model.twitterProfile;
  if (!profile?.url && !profile?.handle) return bundle;

  const token = { ...bundle.token };
  if (!token.twitter_handle?.trim()) {
    token.twitter_handle = profile.url ?? (profile.handle ? `https://x.com/${profile.handle}` : null);
  }
  return { ...bundle, token };
}

/** Persistable fields from Helius DAS asset (call from ingest). */
export function extractSocialUrlsFromAsset(asset: Asset): {
  website_url: string | null;
  telegram_url: string | null;
  twitter_handle: string | null;
} {
  const urls = collectUrlsFromUnknown(asset);
  addToUrlSet(urls, asset.content?.links?.external_url);

  const meta = asset.content?.metadata;
  if (meta?.attributes) {
    for (const attr of meta.attributes) {
      const tt = attr.trait_type?.toLowerCase() ?? '';
      const val = attr.value;
      if (typeof val !== 'string') continue;
      if (tt.includes('twitter') || tt === 'x' || tt.includes('twitter link')) {
        if (val.startsWith('http')) addToUrlSet(urls, val);
        else addToUrlSet(urls, `https://x.com/${val.replace(/^@/, '')}`);
      }
      if (tt.includes('telegram')) {
        if (val.startsWith('http')) addToUrlSet(urls, val);
        else addToUrlSet(urls, `https://t.me/${val.replace(/^@/, '')}`);
      }
      if (tt.includes('website') || tt.includes('web')) addToUrlSet(urls, val);
      if (tt.includes('instagram') || tt === 'ig') {
        if (val.startsWith('http')) addToUrlSet(urls, val);
        else addToUrlSet(urls, `https://instagram.com/${val.replace(/^@/, '')}`);
      }
      if (tt.includes('github')) {
        if (val.startsWith('http')) addToUrlSet(urls, val);
        else addToUrlSet(urls, `https://github.com/${val.replace(/^@/, '')}`);
      }
      if (tt.includes('youtube') || tt.includes('youtu')) {
        if (val.startsWith('http')) addToUrlSet(urls, val);
        else addToUrlSet(urls, `https://youtube.com/${val.replace(/^@/, '')}`);
      }
      if (tt.includes('tiktok')) {
        if (val.startsWith('http')) addToUrlSet(urls, val);
        else addToUrlSet(urls, `https://www.tiktok.com/@${val.replace(/^@/, '')}`);
      }
    }
  }

  const twitterUrls = new Set<string>();
  for (const u of urls) {
    try {
      if (isTwitterHost(new URL(u).hostname)) twitterUrls.add(u);
    } catch {
      /* skip */
    }
  }

  const { profile } = partitionTwitterLinks(twitterUrls);
  const { website, telegram } = pickWebsiteTelegram(urls, twitterUrls);

  const handle = profile?.handle;
  return {
    website_url: website ? ensureBrowserUrl(website) : null,
    telegram_url: telegram ? ensureBrowserUrl(telegram) : null,
    twitter_handle: handle ? `@${handle.replace(/^@/, '')}` : null,
  };
}
