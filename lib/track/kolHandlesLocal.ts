import type { AppChainId } from '@/lib/chains/appChain';
import { shortenAddress } from '@/lib/utils/addresses';

/** Local-demo KOL list shared by Wallets trackers + Track automation handles tab. */

export type KolHandleRow = { id: string; name: string; handle: string; wallet: string; followers: string };

const INITIAL_KOL_ROWS: KolHandleRow[] = [
  { id: 'k1', name: 'Ozark', handle: '@ozarkm', wallet: 'EQDXWFihDsLUEJM5z2HPiFxjxBKvZuLcuY9alCu00i7vJaZa', followers: '3947' },
  { id: 'k2', name: 'Cupsey', handle: '@cupsey', wallet: 'EQBMPsBatosg8z8WFMAm4IKzzk9oNVDjVINaZJgKL7UKBphA', followers: '2188' },
  { id: 'k3', name: 'Kadenox', handle: '@kadenox', wallet: 'EQBPauSJUSd-lRxePlW-S3wxb1m4ZilvBFTaeytfMqmBj84c', followers: '1735' },
  { id: 'k4', name: '1simple', handle: '@simple_unique', wallet: 'EQCGECIaOBhYcTj77EqQmVC5qupOS2iJ7Ixzfj-tp0dPd2I8', followers: '1512' },
  { id: 'k5', name: 'LimoonLambo', handle: '@limoonlambo', wallet: 'EQDSsGG5WYliTh4n7bDKANc-mCqrHwsCJSr-oRNOe-xN49q1', followers: '1409' },
  { id: 'k6', name: 'dandiono45', handle: '@dandiono45', wallet: 'EQC-5bzneBaxgeIUoPUtTI-R3Tm_g-Pm87EctIyLbVdPRvdt', followers: '1288' },
  { id: 'k7', name: 'Tii', handle: '@tinnews', wallet: 'EQC4HnbbC_XOfJFblcEPQwikzr_eUGFJZIdwdfJSq2kNaXJe', followers: '1194' },
  { id: 'k8', name: 'Henn100x', handle: '@henn100x', wallet: 'EQDS36Lp3cbqvKBRqn0LNRKxKiqNTOj2se__DNgfLuh0RfF-', followers: '1091' },
  { id: 'k9', name: 'Danny', handle: '@danny', wallet: 'EQDVhxI-CWaTsPrZO1X58pSIETmMF4DPht6aiQlu88keu9y5', followers: '988' },
  { id: 'k10', name: 'YieldYolo', handle: '@yieldyolo', wallet: 'EQBv9lbU6I0eXg8UZuGxVwNeMsCQm4mQ9-KVuH4A1Qydloee', followers: '912' },
  { id: 'k11', name: 'Kev', handle: '@kev', wallet: 'EQDJgAtxmV0O6Py1jjbfeCzJ1l3vH3U2BRkcwiBEIh8VtN8p', followers: '854' },
  { id: 'k12', name: 'Ghostee', handle: '@ghostee', wallet: 'EQA-zLyMNoRdJ6hPraacQJwsVbo6wExGIR7-T9dj5coOnOGZ', followers: '801' },
];

const INITIAL_KOL_ROWS_SOL: KolHandleRow[] = [
  { id: 's1', name: 'SOL KOL A', handle: '@sol_a', wallet: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', followers: '2100' },
  { id: 's2', name: 'SOL KOL B', handle: '@sol_b', wallet: '5ZWj7a1f8tWkjBESHKgrLmXshuXx6mvKULojCCA3hg8d', followers: '1840' },
  { id: 's3', name: 'SOL KOL C', handle: '@sol_c', wallet: 'GKNeKHqYJZwVMCfvA4n6mJTH3pZvd3f6VK5N9yRQnaXm', followers: '1200' },
  { id: 's4', name: 'SOL KOL D', handle: '@sol_d', wallet: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', followers: '980' },
  { id: 's5', name: 'SOL KOL E', handle: '@sol_e', wallet: 'Vote111111111111111111111111111111111111111', followers: '760' },
  { id: 's6', name: 'SOL KOL F', handle: '@sol_f', wallet: 'So11111111111111111111111111111111111111112', followers: '540' },
];

const INITIAL_KOL_ROWS_EVM: KolHandleRow[] = [
  { id: 'e1', name: 'EVM KOL A', handle: '@evm_a', wallet: '0xd8dA6BF26964af9D7eEd9e03E53415D37aA96045', followers: '3200' },
  { id: 'e2', name: 'EVM KOL B', handle: '@evm_b', wallet: '0x28C6c06298d514Db089934071355E5743bf21d60', followers: '2100' },
  { id: 'e3', name: 'EVM KOL C', handle: '@evm_c', wallet: '0x47ac0Fb4F2D84898e4D9E7bDaDaBb6c6CFe9b794', followers: '1500' },
];

export function kolStorageKey(chain: AppChainId): string {
  return `pointer-kol-feed-list-${chain}`;
}

function defaultRows(chain: AppChainId): KolHandleRow[] {
  if (chain === 'ton') return INITIAL_KOL_ROWS.map((r) => ({ ...r }));
  if (chain === 'sol') return INITIAL_KOL_ROWS_SOL.map((r) => ({ ...r }));
  return INITIAL_KOL_ROWS_EVM.map((r) => ({ ...r }));
}

/** Browser-persisted KOL list keyed by chain (parity with wallets Trackers demo data). */
export function readStoredKolRows(chain: AppChainId): KolHandleRow[] {
  if (typeof window === 'undefined') return defaultRows(chain);
  try {
    const raw = window.localStorage.getItem(kolStorageKey(chain));
    if (!raw) return defaultRows(chain);
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return defaultRows(chain);
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
