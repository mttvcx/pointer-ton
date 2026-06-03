import { HYPERLIQUID_INFO_URL } from '@/lib/hyperliquid/constants';
import { HlL2BookSchema, HlMetaAndCtxSchema, type HlL2Book, type HlMetaAndCtx } from '@/lib/hyperliquid/schemas';

async function postInfo<T>(body: Record<string, unknown>, schema: { parse: (v: unknown) => T }): Promise<T> {
  const res = await fetch(HYPERLIQUID_INFO_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    next: { revalidate: 0 },
  });
  if (!res.ok) {
    throw new Error(`hyperliquid_info_${res.status}`);
  }
  const json: unknown = await res.json();
  return schema.parse(json);
}

export async function fetchMetaAndAssetCtxs(): Promise<HlMetaAndCtx> {
  return postInfo({ type: 'metaAndAssetCtxs' }, HlMetaAndCtxSchema);
}

export async function fetchL2Book(coin: string): Promise<HlL2Book> {
  return postInfo({ type: 'l2Book', coin }, HlL2BookSchema);
}

/** Minutes until next UTC hour (Hyperliquid hourly funding). */
export function fundingCountdownLabel(now = Date.now()): string {
  const d = new Date(now);
  const mins = 59 - d.getUTCMinutes();
  const secs = 59 - d.getUTCSeconds();
  return `${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
}

export function hourlyFundingToApr(hourlyRate: number): number {
  return hourlyRate * 8760 * 100;
}
