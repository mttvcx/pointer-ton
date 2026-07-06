import 'server-only';

import type { HolderFacts, ProviderStatus } from '@/sibyl/data/providers/types';
import { sibylForceMock } from '@/sibyl/config';

/**
 * Helius — Solana on-chain: holders, transfers, wallet activity, enhanced txns.
 * Real when HELIUS_API_KEY is set. MVP wires top-holder concentration; owner
 * resolution + enhanced-tx wallet history are the next-step items (see CHECKLIST).
 * NOTE: shares the pointer-ton rate-limit reality — keep call volume bounded.
 */
function heliusRpcUrl(): string | null {
  const key = process.env.HELIUS_API_KEY?.trim();
  return key ? `https://mainnet.helius-rpc.com/?api-key=${key}` : null;
}

export function heliusStatus(): ProviderStatus {
  return {
    name: 'helius',
    configured: Boolean(heliusRpcUrl()) && !sibylForceMock(),
    envVars: ['HELIUS_API_KEY'],
    note: 'Solana RPC + enhanced txns. Real whenever HELIUS_API_KEY is set.',
  };
}

function mockHolders(): HolderFacts {
  // Concentration is sample, but every address is a REAL registry KOL wallet — so the
  // moat's labeling (name / @handle / badge / pnl) resolves for real. Labels are left
  // off here on purpose: the Pointer provider fills them from the live registry.
  return {
    top10Pct: 61,
    holders: [
      { rank: 1, address: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', pct: 22 }, // Doji
      { rank: 2, address: 'GThUX1Atox4Ykr68x6dzNChemUoK16z9bAQjyGQeM2dT', pct: 14 }, // Sheep
      { rank: 3, address: 'CenNtDkUuZUV2T36rFq2EMEa6Wk3aouREJFqJa3Yk1iB', pct: 9.5 }, // CENTED
      { rank: 4, address: '2ojv9BAiHUrvsm9gxDe7fJSzbNZSJcxZvf8dqmWGHG8S', pct: 7.8 }, // Trey
      { rank: 5, address: 'A8C3xuqscfmyLrte3VmTqrAq8kgMASF6Bc8jFpKDj9zJ', pct: 4.4 },
      { rank: 6, address: 'Df6yfrKC8kZE3KNkrHERKzAetSxbrWeniQfyJY4Jpump', pct: 3.1 },
    ],
    source: 'helius:mock',
  };
}

// Public Solana RPC fallback for when the Helius key is rate-limited ("max usage
// reached") or absent — getTokenLargestAccounts/getTokenSupply are standard methods,
// so holders (and thus the KOL labels on them) stay REAL without depending on Helius.
function fallbackRpcUrl(): string {
  return process.env.SIBYL_FALLBACK_RPC_URL?.trim() || 'https://api.mainnet-beta.solana.com';
}

async function holdersFrom(url: string, mint: string): Promise<HolderFacts | null> {
  const [largest, supply] = await Promise.all([
    rpc<{ value?: { address: string; amount: string }[] }>(url, 'getTokenLargestAccounts', [mint]),
    rpc<{ value?: { amount: string } }>(url, 'getTokenSupply', [mint]),
  ]);
  const list = (largest?.value ?? []).slice(0, 10);
  if (list.length === 0) return null; // rate-limited / error / empty → let the caller try the next RPC
  const total = Number(supply?.value?.amount ?? 0);

  // getTokenLargestAccounts returns TOKEN-ACCOUNT pubkeys; the registry is keyed by
  // OWNER wallets. Resolve owners so KOL labels can match. Best-effort — fall back to
  // the token-account address if the parse fails.
  const info = await rpc<{ value?: ({ data?: { parsed?: { info?: { owner?: string } } } } | null)[] }>(
    url,
    'getMultipleAccounts',
    [list.map((a) => a.address), { encoding: 'jsonParsed' }],
  );
  const owners = info?.value ?? [];

  const rows = list.map((a, i) => ({
    rank: i + 1,
    address: owners[i]?.data?.parsed?.info?.owner ?? a.address,
    pct: total > 0 ? (Number(a.amount) / total) * 100 : 0,
  }));
  const top10Pct = rows.reduce((s, r) => s + r.pct, 0);
  return { top10Pct: Number.isFinite(top10Pct) ? Number(top10Pct.toFixed(1)) : null, holders: rows, source: 'helius' };
}

export async function getHolderFacts(mint: string): Promise<HolderFacts> {
  if (sibylForceMock()) return mockHolders();
  const helius = heliusRpcUrl();
  // Try Helius first (fast + enhanced), then a public RPC if it's capped/absent.
  const attempts: { url: string; source: HolderFacts['source'] }[] = [];
  if (helius) attempts.push({ url: helius, source: 'helius' });
  attempts.push({ url: fallbackRpcUrl(), source: 'rpc:fallback' });
  for (const { url, source } of attempts) {
    try {
      const facts = await holdersFrom(url, mint);
      if (facts) return { ...facts, source };
    } catch {
      /* try next */
    }
  }
  // Every RPC refused (Helius usage cap + public RPCs block getTokenLargestAccounts).
  // Show the real-KOL sample set so the moat stays demonstrable, flagged 'mock' so the
  // wallet agent surfaces the "concentration is sample" caveat.
  return mockHolders();
}

/**
 * On-chain authority + fee config for a mint — the "fee authority / can they rug you"
 * signals. Real via getAccountInfo (jsonParsed): mint authority (supply inflation),
 * freeze authority (can freeze your tokens), and the token-2022 transfer-fee config
 * (fee bps + the authority that controls it). null when every RPC refuses.
 */
export type TokenAuthority = {
  mintAuthority: string | null; // null = renounced (good)
  freezeAuthority: string | null; // present = dev can freeze holders (bad)
  isToken2022: boolean;
  transferFeeBps: number | null; // token-2022 transfer fee
  transferFeeAuthority: string | null; // who controls the fee
  source: string;
};

const TOKEN_2022_PROGRAM = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';

export async function getTokenAuthority(mint: string): Promise<TokenAuthority | null> {
  if (sibylForceMock()) return { mintAuthority: null, freezeAuthority: null, isToken2022: false, transferFeeBps: null, transferFeeAuthority: null, source: 'mock' };
  const helius = heliusRpcUrl();
  const urls = [helius, fallbackRpcUrl()].filter(Boolean) as string[];
  for (const url of urls) {
    try {
      const info = await rpc<{ value?: { owner?: string; data?: { parsed?: { info?: Record<string, unknown> } } } }>(url, 'getAccountInfo', [mint, { encoding: 'jsonParsed' }]);
      const pinfo = info?.value?.data?.parsed?.info;
      if (!pinfo) continue;
      let transferFeeBps: number | null = null;
      let transferFeeAuthority: string | null = null;
      const exts = pinfo.extensions as Array<{ extension?: string; state?: Record<string, unknown> }> | undefined;
      if (Array.isArray(exts)) {
        const tf = exts.find((e) => e.extension === 'transferFeeConfig');
        const st = tf?.state as { newerTransferFee?: { transferFeeBasisPoints?: number }; olderTransferFee?: { transferFeeBasisPoints?: number }; transferFeeConfigAuthority?: string } | undefined;
        if (st) {
          transferFeeBps = st.newerTransferFee?.transferFeeBasisPoints ?? st.olderTransferFee?.transferFeeBasisPoints ?? null;
          transferFeeAuthority = st.transferFeeConfigAuthority ?? null;
        }
      }
      return {
        mintAuthority: (pinfo.mintAuthority as string) ?? null,
        freezeAuthority: (pinfo.freezeAuthority as string) ?? null,
        isToken2022: info?.value?.owner === TOKEN_2022_PROGRAM,
        transferFeeBps,
        transferFeeAuthority,
        source: url === helius ? 'helius' : 'rpc:fallback',
      };
    } catch {
      /* try next */
    }
  }
  return null;
}

async function rpc<T>(url: string, method: string, params: unknown[]): Promise<T | null> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 'sibyl', method, params }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { result?: T };
  return json.result ?? null;
}
