import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getTokenByMint } from '@/lib/db/tokens';
import { getUserByPrivyId } from '@/lib/db/users';
import type { JupiterQuoteResponse } from '@/lib/jupiter/quote';
import { getQuote } from '@/lib/jupiter/quote';
import {
  getDefaultSwapFeeParams,
  getSwapTx,
  type SwapFeeParams,
  type SwapLanding,
} from '@/lib/jupiter/swap';
import { tryPumpDirectSwapQuote } from '@/lib/pump/directSwap';
import { verifyPrivyAccessToken } from '@/lib/privy/config';
import { userCanUseWalletForTrading } from '@/lib/db/userWallets';
import { getConnection } from '@/lib/solana/connection';
import { isValidPublicKey, SOL_MINT } from '@/lib/utils/addresses';
import { BUY_PRESETS_SOL } from '@/lib/utils/constants';
import { lamportsToSol, solToLamports } from '@/lib/utils/formatters';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const QuoteBodySchema = z
  .object({
    mint: z.string().refine(isValidPublicKey, 'invalid mint'),
    side: z.enum(['buy', 'sell']),
    userPublicKey: z.string().refine(isValidPublicKey, 'invalid userPublicKey'),
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

  const useExactOutSell = body.side === 'sell' && body.amountSolOut != null;

  const tradeOk = await userCanUseWalletForTrading(user, body.userPublicKey);
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
    const tokenRow = await getTokenByMint(body.mint);
    if (!useExactOutSell && tokenRow?.launch_pad === 'pump.fun') {
      try {
        const pumpQuote = await tryPumpDirectSwapQuote({
          connection: getConnection(),
          mint: body.mint,
          userPublicKey: body.userPublicKey,
          side: body.side,
          ...(body.side === 'buy'
            ? { amountSol: body.amountSol }
            : { amountTokenRaw: body.amountTokenRaw }),
          slippageBps: body.slippageBps,
          includeSwapTx: body.includeSwapTx,
        });
        if (pumpQuote) {
          return NextResponse.json({
            side: body.side,
            mint: body.mint,
            quote: pumpQuote.quote,
            swapTransaction: pumpQuote.swapTransaction,
            lastValidBlockHeight: pumpQuote.lastValidBlockHeight,
            presetsSol: [...BUY_PRESETS_SOL],
            summary: pumpQuote.summary,
          });
        }
      } catch {
        // Fall through to Jupiter.
      }
    }

    if (useExactOutSell) {
      const feesExact: SwapFeeParams = {
        ...getDefaultSwapFeeParams(),
        ...(body.jitoTipLamports != null ? { jitoTipLamports: body.jitoTipLamports } : {}),
        ...(body.priorityFeeLamports != null ? { priorityFeeLamports: body.priorityFeeLamports } : {}),
        ...(body.autoFee != null ? { autoFee: body.autoFee } : {}),
        ...(body.maxFeeSol != null ? { maxFeeSol: body.maxFeeSol } : {}),
      };

      const wantLamports = solToLamports(body.amountSolOut!);
      const quoteEx = (await getQuote({
        userId: user.id,
        inputMint: body.mint,
        outputMint: SOL_MINT,
        amountRaw: String(wantLamports),
        slippageBps: body.slippageBps,
        dynamicSlippage: body.dynamicSlippage,
        swapMode: 'ExactOut',
      })) as JupiterQuoteResponse;

      let swapTransaction: string | null = null;
      let lastValidBlockHeight: number | undefined;

      if (body.includeSwapTx) {
        const swap = await getSwapTx(quoteEx, body.userPublicKey, {
          dynamicSlippage: body.dynamicSlippage,
          landing: body.landing as SwapLanding,
          fees: feesExact,
        });
        swapTransaction = swap.swapTransaction;
        lastValidBlockHeight = swap.lastValidBlockHeight;
      }

      const inAmt = quoteEx.inAmount != null ? String(quoteEx.inAmount) : '0';
      const outAmt =
        quoteEx.outAmount != null ? String(quoteEx.outAmount) : String(wantLamports);

      return NextResponse.json({
        side: body.side,
        mint: body.mint,
        quote: quoteEx,
        swapTransaction,
        lastValidBlockHeight,
        presetsSol: [...BUY_PRESETS_SOL],
        summary: {
          amountInRaw: inAmt,
          amountOutRaw: outAmt,
          amountSolEstimate: body.amountSolOut!,
        },
      });
    }

    const inputMint = body.side === 'buy' ? SOL_MINT : body.mint;
    const outputMint = body.side === 'buy' ? body.mint : SOL_MINT;
    const amountRaw =
      body.side === 'buy' ? String(solToLamports(body.amountSol!)) : body.amountTokenRaw!;

    const fees: SwapFeeParams = {
      ...getDefaultSwapFeeParams(),
      ...(body.jitoTipLamports != null ? { jitoTipLamports: body.jitoTipLamports } : {}),
      ...(body.priorityFeeLamports != null ? { priorityFeeLamports: body.priorityFeeLamports } : {}),
      ...(body.autoFee != null ? { autoFee: body.autoFee } : {}),
      ...(body.maxFeeSol != null ? { maxFeeSol: body.maxFeeSol } : {}),
    };

    const quote = (await getQuote({
      userId: user.id,
      inputMint,
      outputMint,
      amountRaw,
      slippageBps: body.slippageBps,
      dynamicSlippage: body.dynamicSlippage,
    })) as JupiterQuoteResponse;

    let swapTransaction: string | null = null;
    let lastValidBlockHeight: number | undefined;

    if (body.includeSwapTx) {
      const swap = await getSwapTx(quote, body.userPublicKey, {
        dynamicSlippage: body.dynamicSlippage,
        landing: body.landing as SwapLanding,
        fees,
      });
      swapTransaction = swap.swapTransaction;
      lastValidBlockHeight = swap.lastValidBlockHeight;
    }

    const inAmt = quote.inAmount != null ? String(quote.inAmount) : amountRaw;
    const outAmt = quote.outAmount != null ? String(quote.outAmount) : null;

    return NextResponse.json({
      side: body.side,
      mint: body.mint,
      quote,
      swapTransaction,
      lastValidBlockHeight,
      presetsSol: [...BUY_PRESETS_SOL],
      summary: {
        amountInRaw: inAmt,
        amountOutRaw: outAmt,
        amountSolEstimate:
          body.side === 'buy' ? body.amountSol : lamportsToSol(BigInt(outAmt ?? '0')),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'quote_failed';
    return NextResponse.json({ error: 'quote_failed', message }, { status: 502 });
  }
}
