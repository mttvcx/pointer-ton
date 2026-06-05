import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import type { AppChainId } from '@/lib/chains/appChain';
import { isAppChainId } from '@/lib/chains/appChain';
import { resolveEnsToAddress } from '@/lib/ethereum/ensResolve';
import {
  detectSearchEntityType,
  isValidGlobalSearchQuery,
  looksLikeEnsName,
  normalizeEvmAddress,
} from '@/lib/ethereum/EthereumSearch';
import { resolveEvmSearchAddressKind } from '@/lib/evm/resolveEvmSearchAddressKind';
import { resolveAddressKind } from '@/lib/solana/address-kind';
import { resolveTonSearchAddressKind } from '@/lib/ton/resolveSearchAddressKind';
import {
  buildSearchPathForQuery,
  searchQueryMatchesActiveChain,
} from '@/lib/search/resolveSearchPath';
import { normalizeTonAddress } from '@/lib/utils/tonAddress';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Query = z
  .object({
    q: z.string().trim().min(1).max(120),
    chain: z.string().optional(),
  })
  .strict();

export async function GET(req: NextRequest) {
  const parsed = Query.safeParse({
    q: req.nextUrl.searchParams.get('q'),
    chain: req.nextUrl.searchParams.get('chain') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_query' }, { status: 400 });
  }

  const chainRaw = parsed.data.chain;
  const activeChain: AppChainId =
    chainRaw && isAppChainId(chainRaw) ? chainRaw : 'sol';

  let q = parsed.data.q;
  if (!isValidGlobalSearchQuery(q)) {
    return NextResponse.json({ error: 'invalid_query' }, { status: 400 });
  }

  if (!searchQueryMatchesActiveChain(q, activeChain)) {
    return NextResponse.json(
      {
        error: 'wrong_chain',
        message: `That address does not match the ${activeChain.toUpperCase()} chain selected in the header.`,
      },
      { status: 400 },
    );
  }

  if (looksLikeEnsName(q)) {
    if (activeChain !== 'eth') {
      return NextResponse.json({ error: 'wrong_chain', message: 'ENS names work on Ethereum only.' }, { status: 400 });
    }
    const resolved = await resolveEnsToAddress(q);
    if (!resolved) {
      return NextResponse.json({ error: 'ens_not_found' }, { status: 404 });
    }
    q = resolved;
  }

  const entity = detectSearchEntityType(q, activeChain);
  const tonCanon = normalizeTonAddress(q);
  if (tonCanon && activeChain === 'ton') {
    try {
      const kind = await resolveTonSearchAddressKind(tonCanon);
      const built = buildSearchPathForQuery(tonCanon, activeChain, kind);
      if (!built) {
        return NextResponse.json({ error: 'resolve_failed' }, { status: 502 });
      }
      return NextResponse.json({
        query: parsed.data.q,
        resolved: built.resolved,
        entity: 'ton',
        kind,
        path: built.path,
        chain: built.chain,
      });
    } catch (err) {
      const fallback = buildSearchPathForQuery(tonCanon, activeChain, 'mint');
      if (fallback) {
        return NextResponse.json({
          query: parsed.data.q,
          resolved: fallback.resolved,
          entity: 'ton',
          kind: 'mint',
          path: fallback.path,
          chain: fallback.chain,
          resolveMode: 'fast',
        });
      }
      const message = err instanceof Error ? err.message : 'resolve_failed';
      return NextResponse.json({ error: 'resolve_failed', message }, { status: 502 });
    }
  }

  const evm = normalizeEvmAddress(q);
  if (evm && (activeChain === 'eth' || activeChain === 'bnb' || activeChain === 'base')) {
    let kind: 'mint' | 'wallet' = 'mint';
    try {
      const evmKind = await resolveEvmSearchAddressKind(evm);
      kind = evmKind === 'token' ? 'mint' : 'wallet';
    } catch {
      /* default mint */
    }
    const built = buildSearchPathForQuery(evm, activeChain, kind);
    if (!built) {
      return NextResponse.json({ error: 'resolve_failed' }, { status: 502 });
    }
    return NextResponse.json({
      query: parsed.data.q,
      resolved: built.resolved,
      entity: entity === 'ens' ? 'ens' : kind === 'wallet' ? 'evm_wallet' : 'evm_contract',
      kind,
      path: built.path,
      chain: built.chain,
    });
  }

  if (activeChain === 'sol') {
    let kind: 'mint' | 'wallet' = 'mint';
    try {
      kind = await resolveAddressKind(q);
    } catch {
      /* Helius rate limits — still open token page for valid Solana CAs */
      kind = 'mint';
    }
    const built = buildSearchPathForQuery(q, activeChain, kind);
    if (!built) {
      return NextResponse.json({ error: 'resolve_failed' }, { status: 502 });
    }
    return NextResponse.json({
      query: parsed.data.q,
      resolved: built.resolved,
      entity: 'solana',
      kind,
      path: built.path,
      chain: 'sol',
      resolveMode: kind === 'mint' ? 'fast' : 'rpc',
    });
  }

  return NextResponse.json({ error: 'wrong_chain' }, { status: 400 });
}
