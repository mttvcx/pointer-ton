import 'server-only';

import { createHash } from 'crypto';
import { ethosLevelFromScore } from '@/lib/ethos/score';
import type {
  EthosLookupKeyType,
  EthosProfileSnapshot,
} from '@/lib/ethos/types';

const ETHOS_CLIENT_HEADER = `pointer/${process.env.npm_package_version ?? '1.0.0'}`;

type CacheEntry = { at: number; profile: EthosProfileSnapshot | null };
const memory = new Map<string, CacheEntry>();
const TTL_MS = 1000 * 60 * 60 * 6; /* 6h — aggressively cache per product spec */

function cacheKey(type: EthosLookupKeyType, value: string): string {
  return `${type}:${value.trim().toLowerCase()}`;
}

function stableHash(seed: string): number {
  const h = createHash('sha256').update(seed).digest();
  return h.readUInt32BE(0) / 0xffffffff;
}

/**
 * Deterministic pseudo-Ethos snapshot when API keys are not configured or in tests.
 * Never presented as a real Ethos read — UI should still label data "Ethos" only when live=false? 
 * We mark via resolvedUserkey prefix `mock:` for support.
 */
export function mockEthosSnapshot(seed: string): EthosProfileSnapshot {
  const r = stableHash(seed);
  const score = 900 + Math.floor(r * 1400); /* roughly questionable → exemplary band */
  return {
    score,
    level: ethosLevelFromScore(score),
    displayName: undefined,
    profileUrl: 'https://app.ethos.network/',
    resolvedUserkey: `mock:${seed.slice(0, 32)}`,
  };
}

function toUserKey(type: EthosLookupKeyType, value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  switch (type) {
    case 'profile_id':
      return `profileId:${v}`;
    case 'ethereum':
      return /^0x[a-fA-F0-9]{40}$/.test(v) ? `address:${v.toLowerCase()}` : null;
    case 'x_username':
      return `service:x.com:username:${v.replace(/^@/, '')}`;
    case 'telegram_id':
      return `service:telegram:${v}`;
    case 'discord_id':
      return `service:discord:${v}`;
    case 'farcaster_username':
      return `service:farcaster:${v}`;
    default:
      return null;
  }
}

async function fetchLiveProfile(userkey: string): Promise<EthosProfileSnapshot | null> {
  const apiKey = process.env.ETHOS_API_KEY;
  const base = process.env.ETHOS_API_BASE_URL ?? 'https://api.ethos.network';
  if (!apiKey) return null;

  /* Endpoint shape may evolve — keep isolated for quick updates from OpenAPI. */
  const url = `${base.replace(/\/$/, '')}/v2/user?userkey=${encodeURIComponent(userkey)}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'X-Ethos-Client': ETHOS_CLIENT_HEADER,
      Accept: 'application/json',
    },
    next: { revalidate: 0 },
  });

  if (res.status === 404) return null;
  if (!res.ok) return null;

  const j = (await res.json()) as {
    score?: number;
    userkeys?: string | string[];
  };
  const score = typeof j.score === 'number' && Number.isFinite(j.score) ? j.score : null;
  if (score == null) return null;

  return {
    score,
    level: ethosLevelFromScore(score),
    profileUrl: 'https://app.ethos.network/',
    resolvedUserkey: userkey,
  };
}

export async function lookupEthosByKey(
  type: EthosLookupKeyType,
  value: string,
): Promise<EthosProfileSnapshot | null> {
  const key = cacheKey(type, value);
  const now = Date.now();
  const hit = memory.get(key);
  if (hit && now - hit.at < TTL_MS) return hit.profile;

  const userkey = toUserKey(type, value);
  if (!userkey) {
    memory.set(key, { at: now, profile: null });
    return null;
  }

  /**
   * Live-only: no API key or no Ethos profile → null (UI hides the badge).
   * Mock snapshots are opt-in for demos/tests via `mockEthosSnapshot` directly.
   */
  const profile: EthosProfileSnapshot | null = await fetchLiveProfile(userkey);

  memory.set(key, { at: now, profile });
  return profile;
}

export async function lookupBestEthosForTrader(input: {
  ethereumAddress: string | null;
  xUsername: string | null;
  telegramId: string | null;
  discordId: string | null;
  farcasterUsername: string | null;
}): Promise<EthosProfileSnapshot | null> {
  const tries: Array<[EthosLookupKeyType, string | null]> = [
    ['ethereum', input.ethereumAddress],
    ['x_username', input.xUsername],
    ['telegram_id', input.telegramId],
    ['discord_id', input.discordId],
    ['farcaster_username', input.farcasterUsername],
  ];

  for (const [type, val] of tries) {
    if (!val) continue;
    /* eslint-disable no-await-in-loop -- sequential to respect rate */
    const p = await lookupEthosByKey(type, val);
    if (p) return p;
  }

  return null;
}
