import type { AppChainId } from '@/lib/chains/appChain';
import { shortenAddress } from '@/lib/utils/addresses';

/** Local KOL list shared by Wallets trackers + Track automation handles tab. */

export type KolHandleRow = { id: string; name: string; handle: string; wallet: string; followers: string };

export function kolStorageKey(chain: AppChainId): string {
  return `pointer-kol-feed-list-${chain}`;
}

export function starterKolMintStorageKey(chain: AppChainId): string {
  return `pointer-kol-starter-minted-${chain}`;
}

/** Empty until user presses Mint starter KOLs for this chain. */
function defaultRows(_chain: AppChainId): KolHandleRow[] {
  return [];
}

/** Browser-persisted KOL list keyed by chain. */
export function readStoredKolRows(chain: AppChainId): KolHandleRow[] {
  if (typeof window === 'undefined') return defaultRows(chain);
  try {
    const raw = window.localStorage.getItem(kolStorageKey(chain));
    if (!raw) return defaultRows(chain);
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return defaultRows(chain);
    return parsed
      .filter((x): x is KolHandleRow => {
        if (!x || typeof x !== 'object') return false;
        const o = x as Record<string, unknown>;
        return typeof o.id === 'string' && typeof o.wallet === 'string';
      })
      .map((r) => ({
        id: r.id,
        name: typeof r.name === 'string' ? r.name : shortenAddress(r.wallet, 4),
        handle: typeof r.handle === 'string' ? r.handle : '',
        wallet: r.wallet,
        followers: typeof r.followers === 'string' ? r.followers : '0',
      }));
  } catch {
    return defaultRows(chain);
  }
}

export function writeStoredKolRows(chain: AppChainId, rows: KolHandleRow[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(kolStorageKey(chain), JSON.stringify(rows));
    localStorage.setItem(starterKolMintStorageKey(chain), '1');
    window.dispatchEvent(new Event('pointer-kol-rows-updated'));
  } catch {
    /* ignore quota */
  }
}

export function hasMintedStarterKols(chain: AppChainId): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(starterKolMintStorageKey(chain)) === '1';
}
