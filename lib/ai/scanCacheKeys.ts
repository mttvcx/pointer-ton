import 'server-only';

import { hashContext } from '@/lib/utils/hashContext';

export { hashContext };

/** Scan kinds aligned with product surfaces (see AI_SCAN_CACHE_TTL). */
export type AiScanType =
  | 'token_scan'
  | 'copilot'
  | 'wallet_intel'
  | 'tooltip'
  | 'narrative'
  | 'twitter_scan'
  | 'tracker_parse'
  | 'launch_package';

export type AiScanSurface = 'hover' | 'copilot';

/**
 * ~20% multiplicative MC bands (log base 1.2). Small moves share a bucket;
 * large moves get a new bucket and/or MC invalidation at read time.
 */
export function mcBucket(marketCapUsd: number | null | undefined): string {
  if (marketCapUsd == null || !Number.isFinite(marketCapUsd) || marketCapUsd <= 0) {
    return 'mc0';
  }
  return `mc${Math.floor(Math.log(marketCapUsd) / Math.log(1.2))}`;
}

export function dayBucket(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function hourBucket(d = new Date()): string {
  return d.toISOString().slice(0, 13);
}

export interface BuildScanCacheKeyInput {
  type: AiScanType;
  subject: string;
  mode?: 'fast' | 'deep';
  marketCapUsd?: number | null;
  contextHash?: string;
  day?: string;
  hour?: string;
}

/** `{type}:{subject}:{bucket}[:mode]` — global/shared, no user ids. */
export function buildScanCacheKey(input: BuildScanCacheKeyInput): string {
  const subject = input.subject.trim();
  const modeSuffix = input.mode === 'deep' ? ':deep' : '';

  switch (input.type) {
    case 'token_scan':
      return `token_scan:${subject}:${mcBucket(input.marketCapUsd)}${modeSuffix}`;
    case 'copilot':
      return `copilot:${subject}:${mcBucket(input.marketCapUsd)}${modeSuffix}`;
    case 'wallet_intel': {
      const activity = input.contextHash ?? 'na';
      return `wallet:${subject}:${input.day ?? dayBucket()}:${activity}${modeSuffix}`;
    }
    case 'tooltip': {
      const ctx = input.contextHash ?? 'none';
      return `tooltip:${subject.toLowerCase()}:${ctx}${modeSuffix}`;
    }
    case 'narrative':
      return `narrative:${subject}${modeSuffix}`;
    case 'twitter_scan':
      return `twitter:${subject.toLowerCase()}:${input.hour ?? hourBucket()}${modeSuffix}`;
    case 'tracker_parse':
      return `tracker_parse:${input.contextHash ?? hashContext({ subject })}${modeSuffix}`;
    case 'launch_package':
      return `launch_package:${subject}${modeSuffix}`;
    default:
      return `unknown:${subject}${modeSuffix}`;
  }
}
