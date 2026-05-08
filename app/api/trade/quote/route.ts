import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getUserByPrivyId } from '@/lib/db/users';
import { verifyPrivyAccessToken } from '@/lib/privy/config';
import { userCanUseWalletForTrading } from '@/lib/db/userWallets';
import { buildPointerStonSwapQuote } from '@/lib/stonfi/pointerSwap';
import { normalizeTonAddress } from '@/lib/utils/tonAddress';
import { BUY_PRESETS_SOL } from '@/lib/utils/constants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const tonAddr = z.string().refine((s) => Boolean(normalizeTonAddress(s)), 'invalid_ton_address');

const QuoteBodySchema = z
  .object({
    mint: tonAddr,
    side: z.enum(['buy', 'sell']),
    userPublicKey: tonAddr,
    amountSol: z.number().positive().optional(),
    amountSolOut: z.number().positive().optional(),
    amountTokenRaw: z.string().regex(/^\d+$/).optional(),
    slippageBps: z.coerce.number().int().min(1).max(5_000).default(500),
    dynamicSlippage: z.boolean().default(true),
    landing: z.enum(['jito', 'rpc']).default('jito'),
    includeSwapTx: z.boolean().default(true),
    jitoTipLamports: z.coerce.number().int().min(0).max(5_000_000).optional(),
    priorityFeeLamports: z.coerce.number().int().min(0).max(5_000_000).optional(),
    autoFee: z.boolean().optional(),
    maxFeeSol: z.coerce.number().positive().max(5).optional(),
  })
  .strict()
  .superRefine((val, ctx) => {
    void val.dynamicSlippage;
    void val.landing;
    void val.jitoTipLamports;
    void val.priorityFeeLamports;
    void val.autoFee;
    void val.maxFeeSol;

    if (val.side === 'buy' && (val.amountSol == null || val.amountSol <= 0)) {
      ctx.addIssue({
        code: 'custom',
        message: 'amountSol required for buy',
        path: ['amountSol'],
      });
    }
    if (val.side === 'sell') {
      const hasRaw =
        val.amountTokenRaw != null && String(val.amountTokenRaw).length > 0;
      const hasOut = val.amountSolOut != null && val.amountSolOut > 0;
      if (!hasRaw && !hasOut) {
        ctx.addIssue({
          code: 'custom',
          message: 'amountTokenRaw or amountSolOut required for sell',
          path: ['amountTokenRaw'],
        });
      }
      if (hasRaw && hasOut) {
        ctx.addIssue({
          code: 'custom',
          message: 'Use either amountTokenRaw or amountSolOut, not both',
          path: ['amountSolOut'],
        });
      }
    }
  });

export async function POST(req: NextRequest) {
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

  let body: z.infer<typeof QuoteBodySchema>;
  try {
    const json: unknown = await req.json();
    body = QuoteBodySchema.parse(json);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'invalid_body';
    return NextResponse.json({ error: 'invalid_body', message }, { status: 400 });
  }

  const walletCanon = normalizeTonAddress(body.userPublicKey)!;
  const mintCanon = normalizeTonAddress(body.mint)!;

  const tradeOk = await userCanUseWalletForTrading(user, walletCanon);
  if (!tradeOk) {
    return NextResponse.json(
      {
        error: 'wallet_not_allowed',
        message: 'This wallet cannot trade in Pointer (imported keys are view-only until Phase 5)',
      },
      { status: 403 },
    );
  }

  try {
    const useExactOutSell = body.side === 'sell' && body.amountSolOut != null;

    const built = await buildPointerStonSwapQuote({
      userWalletAddress: walletCanon,
      jettonMaster: mintCanon,
      side: body.side,
      ...(body.side === 'buy' ? { amountSol: body.amountSol } : {}),
      ...(body.side === 'sell' && !useExactOutSell ? { amountTokenRaw: body.amountTokenRaw } : {}),
      ...(body.side === 'sell' && useExactOutSell ? { amountSolOut: body.amountSolOut } : {}),
      slippageBps: body.slippageBps,
      includeSwapTx: body.includeSwapTx,
    });

    return NextResponse.json({
      side: body.side,
      mint: mintCanon,
      quote: built.quote,
      swapTransaction: null,
      tonConnect: built.tonConnect,
      presetsSol: [...BUY_PRESETS_SOL],
      summary: {
        amountInRaw: built.summary.amountInRaw,
        amountOutRaw: built.summary.amountOutRaw,
        amountSolEstimate: built.summary.amountSolEstimate,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'quote_failed';
    return NextResponse.json({ error: 'quote_failed', message }, { status: 502 });
  }
}
