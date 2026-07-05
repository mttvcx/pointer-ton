import 'server-only';

import type { ProviderStatus } from '@/sibyl/data/providers/types';
import { dexscreenerStatus } from '@/sibyl/data/providers/dexscreener';
import { heliusStatus } from '@/sibyl/data/providers/helius';
import { birdeyeStatus } from '@/sibyl/data/providers/birdeye';
import { duneStatus } from '@/sibyl/data/providers/dune';
import { xStatus } from '@/sibyl/data/providers/x';
import { grokSearchStatus } from '@/sibyl/data/providers/grok-or-search';
import { pointerStatus } from '@/sibyl/data/providers/pointer';

/** One place to see which data providers are live vs mock. */
export function providerStatuses(): ProviderStatus[] {
  return [
    pointerStatus(),
    dexscreenerStatus(),
    heliusStatus(),
    birdeyeStatus(),
    duneStatus(),
    xStatus(),
    grokSearchStatus(),
  ];
}

export * as dexscreener from '@/sibyl/data/providers/dexscreener';
export * as helius from '@/sibyl/data/providers/helius';
export * as birdeye from '@/sibyl/data/providers/birdeye';
export * as dune from '@/sibyl/data/providers/dune';
export * as x from '@/sibyl/data/providers/x';
export * as grok from '@/sibyl/data/providers/grok-or-search';
export * as pointer from '@/sibyl/data/providers/pointer';
