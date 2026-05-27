import type { RecognizedWalletRecord } from '@/lib/walletIdentity/types';

/**
 * Demo directory: recognized wallets resolve even when user does not track them.
 * Addresses align with DEMO_WALLETS in demoTokenFixtures for consistent screenshots.
 */

const MOCK: RecognizedWalletRecord[] = [
  {
    address: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
    displayName: 'sanuxo',
    handle: '@sanuxo',
    source: 'kol_feed',
    confidence: 0.86,
    category: 'kol',
    badges: ['kol', 'smart_money'],
    profileUrl: 'https://x.com/sanuxo',
    avatarUrl: undefined,
    notes: 'Frequent early caller on meme rotations.',
    firstSeenAt: new Date(Date.now() - 86400000 * 120).toISOString(),
    lastVerifiedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    address: 'GThUX1Atox4Ykr68x6dzNChemUoK16z9bAQjyGQeM2dT',
    displayName: 'Stream desk · Apex',
    handle: '@apexflow',
    source: 'pointer_directory',
    confidence: 0.72,
    category: 'streamer',
    badges: ['kol', 'whale'],
    profileUrl: 'https://x.com/apexflow',
    firstSeenAt: new Date(Date.now() - 86400000 * 400).toISOString(),
    lastVerifiedAt: new Date(Date.now() - 86400000 * 7).toISOString(),
  },
  {
    address: '2ojv9BAiHUrvsm9gxDe7fJSzbNZSJcxZvf8dqmWGHG8S',
    displayName: 'Insider desk',
    handle: undefined,
    source: 'admin_curated',
    confidence: 0.61,
    category: 'insider',
    badges: ['insider', 'fresh'],
    notes: 'Tight clustering with repeated launch funding.',
    firstSeenAt: new Date(Date.now() - 86400000 * 14).toISOString(),
    lastVerifiedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
  },
  {
    address: 'CenNtDkUuZUV2T36rFq2EMEa6Wk3aouREJFqJa3Yk1iB',
    displayName: 'Sniper lane',
    source: 'import',
    confidence: 0.55,
    category: 'sniper',
    badges: ['sniper', 'fresh'],
    firstSeenAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    lastVerifiedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
  },
  {
    address: '7K1WgKQgDzH9H3WR8QjmN8KqVn1YJgZxYzPLFToK9mNp',
    displayName: 'Deployer cohort B',
    source: 'pointer_directory',
    confidence: 0.48,
    category: 'deployer',
    badges: ['dev', 'fresh'],
    firstSeenAt: new Date(Date.now() - 86400000 * 200).toISOString(),
    lastVerifiedAt: new Date(Date.now() - 86400000 * 30).toISOString(),
  },
];

const byAddr = new Map(MOCK.map((r) => [r.address, r]));

export function getRecognizedWallet(
  address: string,
  opts?: { demo?: boolean },
): RecognizedWalletRecord | null {
  if (!opts?.demo) return null;
  return byAddr.get(address) ?? null;
}
