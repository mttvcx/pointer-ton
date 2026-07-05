import 'server-only';

import type { HolderFacts, ProviderStatus } from '@/sibyl/data/providers/types';
import { sibylMockMode } from '@/sibyl/config';

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
    configured: Boolean(heliusRpcUrl()) && !sibylMockMode(),
    envVars: ['HELIUS_API_KEY'],
    note: 'Solana RPC + enhanced txns. Mock without a key.',
  };
}

function mockHolders(): HolderFacts {
  return {
    top10Pct: 82,
    holders: [
      { rank: 1, address: '5gwLX5nszaqA2dBBXi6a4qNgjRuCy69kM4bJE1Wrx73D', pct: 70, label: 'Cupsey Main', isKol: true },
      { rank: 2, address: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', pct: 4.2 },
      { rank: 3, address: 'B62aHj...bundler', pct: 3.1, label: 'bundler cluster' },
      { rank: 4, address: 'A8C3xuqs...NANwpump', pct: 2.0 },
      { rank: 5, address: 'Df6yfrKC...Jpump', pct: 1.4 },
    ],
    source: 'helius:mock',
  };
}

export async function getHolderFacts(mint: string): Promise<HolderFacts> {
  const url = heliusRpcUrl();
  if (sibylMockMode() || !url) return mockHolders();
  try {
    const [largest, supply] = await Promise.all([
      rpc<{ value?: { address: string; amount: string }[] }>(url, 'getTokenLargestAccounts', [mint]),
      rpc<{ value?: { amount: string } }>(url, 'getTokenSupply', [mint]),
    ]);
    const total = Number(supply?.value?.amount ?? 0);
    const rows = (largest?.value ?? []).slice(0, 10).map((a, i) => ({
      rank: i + 1,
      address: a.address,
      pct: total > 0 ? (Number(a.amount) / total) * 100 : 0,
    }));
    const top10Pct = rows.reduce((s, r) => s + r.pct, 0);
    return { top10Pct: Number.isFinite(top10Pct) ? Number(top10Pct.toFixed(1)) : null, holders: rows, source: 'helius' };
  } catch {
    return { ...mockHolders(), source: 'helius:error' };
  }
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
