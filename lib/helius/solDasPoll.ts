import 'server-only';

import type { Asset } from 'helius-sdk/types/das';
import { ingestLaunchpadDiscovery } from '@/lib/helius/discoveryIngest';
import { launchpadEventFromDasAsset, type LaunchpadEvent } from '@/lib/helius/parsers';
import {
  getHeliusRpcUrl,
  LAUNCHPAD_AUTHORITIES,
  type LaunchpadId,
  PULSE_DAS_FALLBACK_POLL_OWNER,
} from '@/lib/utils/constants';
import { heliusCall, heliusDasCredits } from '@/lib/helius/creditLogger';

const DEBUG_DAS = process.env.POINTER_DEBUG_DAS === '1';

function debugDas(message: string, extra?: Record<string, unknown>) {
  if (!DEBUG_DAS) return;
  if (extra && Object.keys(extra).length > 0) {
    console.log(`[pointer][pulse DAS] ${message}`, extra);
  } else {
    console.log(`[pointer][pulse DAS] ${message}`);
  }
}

type DasResult<T> = { error?: { message?: string }; result?: T };

export async function heliusDasRpc<T>(method: string, params: unknown): Promise<T> {
  return heliusCall(method, heliusDasCredits(method), async () => {
    const url = getHeliusRpcUrl();
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 'pointer-das', method, params }),
    });
    const json = (await res.json()) as DasResult<T>;
    if (json.error?.message) {
      throw new Error(json.error.message);
    }
    if (json.result === undefined) {
      throw new Error('helius_das_empty_result');
    }
    return json.result;
  });
}

function parsePulseDasLaunchpadAuthorities(): Array<{ pad: LaunchpadId; authority: string }> {
  const raw = process.env.PULSE_DAS_LAUNCHPAD_AUTHORITIES?.trim();
  if (!raw) {
    return (Object.entries(LAUNCHPAD_AUTHORITIES) as [LaunchpadId, string | null][])
      .filter(([k, v]) => {
        if (!v || k === 'unknown' || k === 'bsc' || k === 'base') return false;
        return true;
      })
      .map(([k, v]) => ({ pad: k, authority: v! }));
  }
  const out: Array<{ pad: LaunchpadId; authority: string }> = [];
  for (const part of raw.split(',').map((s) => s.trim()).filter(Boolean)) {
    const i = part.indexOf(':');
    if (i === -1) continue;
    const padKey = part.slice(0, i).trim();
    const authority = part.slice(i + 1).trim();
    if (!authority || !(padKey in LAUNCHPAD_AUTHORITIES)) continue;
    out.push({ pad: padKey as LaunchpadId, authority });
  }
  return out;
}

function mergeLaunchpad(ev: LaunchpadEvent, pad: LaunchpadId): LaunchpadEvent {
  if (pad === 'unknown') return ev;
  return { ...ev, launchpad: pad };
}

/**
 * Backfill Solana Pulse from Helius DAS (`getAssetsByAuthority` + optional `searchAssets`).
 * Requires HELIUS_API_KEY or SOLANA_RPC_URL.
 */
export async function pollSolanaPulseFromDas(): Promise<number> {
  let rpcUrl: string;
  try {
    rpcUrl = getHeliusRpcUrl();
  } catch {
    debugDas('skip: no Helius RPC URL configured');
    return 0;
  }
  if (!rpcUrl) return 0;

  let inserted = 0;
  const seen = new Set<string>();
  const authorities = parsePulseDasLaunchpadAuthorities();

  for (const { pad, authority } of authorities) {
    try {
      const page = await heliusDasRpc<{ items?: Asset[] }>('getAssetsByAuthority', {
        authorityAddress: authority,
        page: 1,
        limit: 48,
        sortBy: { sortBy: 'created', sortDirection: 'desc' },
      });
      const items = page.items ?? [];
      debugDas('getAssetsByAuthority', { pad, authority, n: items.length });
      for (const asset of items) {
        const ev0 = launchpadEventFromDasAsset(asset);
        if (!ev0) continue;
        if (seen.has(ev0.mint)) continue;
        seen.add(ev0.mint);
        const ev = mergeLaunchpad(ev0, pad);
        inserted += await ingestLaunchpadDiscovery(ev, { alertSource: 'das_authority' });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[pointer][pulse DAS] getAssetsByAuthority failed:', pad, msg);
    }
  }

  const owner =
    process.env.PULSE_DAS_POLL_OWNER_WALLET?.trim() || PULSE_DAS_FALLBACK_POLL_OWNER;
  try {
    const search = await heliusDasRpc<{ items?: Asset[] }>('searchAssets', {
      ownerAddress: owner,
      tokenType: 'fungible',
      limit: 40,
      sortBy: { sortBy: 'id', sortDirection: 'desc' },
    });
    const items = search.items ?? [];
    debugDas('searchAssets', { owner, n: items.length });
    for (const asset of items) {
      const ev = launchpadEventFromDasAsset(asset);
      if (!ev) continue;
      if (seen.has(ev.mint)) continue;
      seen.add(ev.mint);
      inserted += await ingestLaunchpadDiscovery(ev, { alertSource: 'das_search' });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[pointer][pulse DAS] searchAssets failed:', msg);
  }

  return inserted;
}
