import { NextResponse, type NextRequest } from 'next/server';
import { buildPortfolioSnapshot } from '@/lib/portfolio/buildSnapshot';
import { getTokensByMints } from '@/lib/db/tokens';
import { getUserByPrivyId } from '@/lib/db/users';
import {
  resolveDefaultWalletAddress,
  userCanViewWalletPortfolio,
} from '@/lib/db/userWallets';
import { verifyPrivyAccessToken } from '@/lib/privy/config';
import { getSolBalanceLamports } from '@/lib/solana/recent-activity';
import { listNonZeroSplBalances } from '@/lib/solana/wallet-token-balances';
import { isValidPublicKey } from '@/lib/utils/addresses';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const accessToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : null;
  if (!accessToken) {
    return NextResponse.json({ error: 'missing_authorization' }, { status: 401 });
  }

  let verified;
  try {
    verified = await verifyPrivyAccessToken(accessToken);
  } catch {
    return NextResponse.json({ error: 'invalid_token' }, { status: 401 });
  }

  const user = await getUserByPrivyId(verified.privyId);
  if (!user) {
    return NextResponse.json(
      { error: 'user_not_synced', message: 'Call /api/auth/sync first' },
      { status: 403 },
    );
  }

  const limitParam = req.nextUrl.searchParams.get('tradesLimit');
  const tradesLimit = Math.min(
    200,
    Math.max(1, limitParam ? Number.parseInt(limitParam, 10) || 50 : 50),
  );

  const fifoParam = req.nextUrl.searchParams.get('fifoLimit');
  const fifoLimit = Math.min(
    5_000,
    Math.max(50, fifoParam ? Number.parseInt(fifoParam, 10) || 2_000 : 2_000),
  );

  const walletParam = req.nextUrl.searchParams.get('wallet');
  let wallet: string | null = null;
  if (walletParam) {
    if (!isValidPublicKey(walletParam)) {
      return NextResponse.json({ error: 'invalid_wallet' }, { status: 400 });
    }
    const allowed = await userCanViewWalletPortfolio(user, walletParam);
    if (!allowed) {
      return NextResponse.json({ error: 'wallet_not_allowed' }, { status: 403 });
    }
    wallet = walletParam;
  } else {
    wallet = await resolveDefaultWalletAddress(user);
  }

  let solLamports: string | null = null;
  let holdings: Array<{
    mint: string;
    rawAmount: string;
    symbol: string | null;
    decimals: number;
    imageUrl: string | null;
  }> = [];

  let holdingsMeta = new Map<
    string,
    { symbol: string | null; name: string | null; decimals: number; image_url: string | null }
  >();

  if (wallet) {
    try {
      const [lamports, spl] = await Promise.all([
        getSolBalanceLamports(wallet),
        listNonZeroSplBalances(wallet),
      ]);
      solLamports = lamports.toString();
      holdingsMeta = await getTokensByMints(spl.map((s) => s.mint));
      holdings = spl.map((s) => {
        const t = holdingsMeta.get(s.mint);
        return {
          mint: s.mint,
          rawAmount: s.rawAmount,
          symbol: t?.symbol ?? null,
          decimals: t?.decimals ?? 9,
          imageUrl: t?.image_url ?? null,
        };
      });
    } catch {
      solLamports = null;
      holdings = [];
      holdingsMeta = new Map();
    }
  }

  try {
    const snapshot = await buildPortfolioSnapshot({
      userId: user.id,
      solLamports,
      holdings,
      recentTradeLimit: tradesLimit,
      fifoTradeLimit: fifoLimit,
    });

    const sellMints = [...new Set(snapshot.closedSells.map((c) => c.mint))].filter(
      (m) => !holdingsMeta.has(m),
    );
    const sellMeta =
      sellMints.length > 0 ? await getTokensByMints(sellMints) : new Map();

    return NextResponse.json({
      walletAddress: wallet,
      solLamports,
      holdings,
      solUsd: snapshot.solUsd,
      summary: snapshot.summary,
      positions: snapshot.positions.map((p) => ({
        mint: p.mint,
        balanceRaw: p.balanceRaw,
        decimals: p.decimals,
        symbol: p.symbol,
        name: holdingsMeta.get(p.mint)?.name ?? null,
        imageUrl: p.imageUrl,
        costBasisSol: p.costBasisSol,
        costBasisUsd: p.costBasisUsd,
        valueUsd: p.valueUsd,
        unrealizedPnlUsd: p.unrealizedPnlUsd,
        avgEntrySolPerUiToken: p.avgEntrySolPerUiToken,
      })),
      closedSells: snapshot.closedSells.map((c) => {
        const t = holdingsMeta.get(c.mint) ?? sellMeta.get(c.mint);
        return {
          ...c,
          symbol: t?.symbol ?? null,
          name: t?.name ?? null,
          decimals: t?.decimals ?? 9,
        };
      }),
      trades: snapshot.tradesRecent.map((t) => ({
        id: t.id,
        mint: t.mint,
        side: t.side,
        status: t.status,
        amountInRaw: t.amount_in_raw,
        amountOutRaw: t.amount_out_raw,
        amountSol: t.amount_sol,
        txSignature: t.tx_signature,
        submittedAt: t.submitted_at,
        confirmedAt: t.confirmed_at,
        failureReason: t.failure_reason,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'portfolio_failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
