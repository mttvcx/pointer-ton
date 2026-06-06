import { NextResponse, type NextRequest } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { z } from 'zod';
import { inferMintKind } from '@/lib/chains/mintKind';
import { getUserByPrivyId } from '@/lib/db/users';
import { isActivityFrozen } from '@/lib/db/accountControls';
import { userCanUseWalletForTrading } from '@/lib/db/userWallets';
import { getQuote } from '@/lib/jupiter/quote';
import { getSwapTx, getDefaultSwapFeeParams, type SwapFeeParams } from '@/lib/jupiter/swap';
import { verifyPrivyAccessToken } from '@/lib/privy/config';
import { buildPointerStonSwapQuote } from '@/lib/stonfi/pointerSwap';
import { SOL_MINT, USDC_MINT } from '@/lib/utils/addresses';
import { BUY_PRESETS_SOL, BUY_PRESETS_USDC, USDC_DECIMALS } from '@/lib/utils/constants';
import { lamportsToSol, solToLamports, uiToRaw } from '@/lib/utils/formatters';
import { normalizeTonAddress } from '@/lib/utils/tonAddress';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const QuoteBodySchema = z
  .object({
    mint: z.string().min(1),
    side: z.enum(['buy', 'sell']),
    userPublicKey: z.string().min(1),
    amountSol: z.number().positive().optional(),
    amountUsdc: z.number().positive().optional(),
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
    const mk = inferMintKind(val.mint);
    const uk = inferMintKind(val.userPublicKey);
    if (mk === 'unknown') {
      ctx.addIssue({ code: 'custom', message: 'invalid_mint', path: ['mint'] });
    }
    if (uk === 'unknown') {
      ctx.addIssue({ code: 'custom', message: 'invalid_wallet', path: ['userPublicKey'] });
    }
    if (mk !== 'unknown' && uk !== 'unknown' && mk !== uk) {
      ctx.addIssue({
        code: 'custom',
        message: 'mint_and_wallet_must_be_same_chain',
        path: ['mint'],
      });
    }

    if (val.side === 'buy') {
      const hasSol = val.amountSol != null && val.amountSol > 0;
      const hasUsdc = val.amountUsdc != null && val.amountUsdc > 0;
      if (!hasSol && !hasUsdc) {
        ctx.addIssue({
          code: 'custom',
          message: 'amountSol or amountUsdc required for buy',
          path: ['amountSol'],
        });
      }
      if (hasSol && hasUsdc) {
        ctx.addIssue({
          code: 'custom',
          message: 'Use either amountSol or amountUsdc, not both',
          path: ['amountUsdc'],
        });
      }
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

function swapFeesFromBody(body: z.infer<typeof QuoteBodySchema>): SwapFeeParams {
  const d = getDefaultSwapFeeParams();
  return {
    jitoTipLamports: body.jitoTipLamports ?? d.jitoTipLamports,
    priorityFeeLamports: body.priorityFeeLamports ?? d.priorityFeeLamports,
    autoFee: body.autoFee ?? d.autoFee,
    maxFeeSol: body.maxFeeSol ?? d.maxFeeSol,
  };
}

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

  // Emergency kill-switch: a superadmin-frozen account cannot mint swap
  // transactions. Since every order (manual, quick-buy, autobuy, copy-trade)
  // gets its swap tx from here, this stops a hijacked-automation drain at the
  // source for ALL wallet types — no transaction is ever produced to sign.
  try {
    const { frozen } = await isActivityFrozen(user.id, 'trading');
    if (frozen) {
      return NextResponse.json(
        {
          error: 'account_frozen',
          message:
            'Trading is temporarily unavailable on this account. Please try again later or contact support.',
        },
        { status: 423 },
      );
    }
  } catch {
    /* fail-open on lookup error: never block legitimate trading on a freeze-check fault */
  }

  let body: z.infer<typeof QuoteBodySchema>;
  try {
    const json: unknown = await req.json();
    body = QuoteBodySchema.parse(json);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'invalid_body';
    return NextResponse.json({ error: 'invalid_body', message }, { status: 400 });
  }

  const chainKind = inferMintKind(body.mint);
  if (chainKind !== 'sol' && chainKind !== 'ton') {
    return NextResponse.json({ error: 'unsupported_mint_chain' }, { status: 400 });
  }

  if (chainKind === 'sol') {
    let mintCanon: string;
    let walletCanon: string;
    try {
      mintCanon = new PublicKey(body.mint.trim()).toBase58();
      walletCanon = new PublicKey(body.userPublicKey.trim()).toBase58();
    } catch {
      return NextResponse.json({ error: 'invalid_sol_address' }, { status: 400 });
    }

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
      const fees = swapFeesFromBody(body);
      const landing = body.landing === 'jito' ? 'jito' : 'rpc';

      if (body.side === 'buy') {
        const spendUsdc = body.amountUsdc != null && body.amountUsdc > 0;
        const inputMint = spendUsdc ? USDC_MINT : SOL_MINT;
        const amountRaw = spendUsdc
          ? uiToRaw(body.amountUsdc!, USDC_DECIMALS).toString()
          : solToLamports(body.amountSol!).toString();
        const jq = await getQuote({
          userId: user.id,
          inputMint,
          outputMint: mintCanon,
          amountRaw,
          slippageBps: body.slippageBps,
          dynamicSlippage: body.dynamicSlippage,
        });
        const swap = body.includeSwapTx
          ? await getSwapTx(jq, walletCanon, {
              dynamicSlippage: body.dynamicSlippage,
              landing,
              fees,
            })
          : null;

        const inAmt =
          typeof jq.inAmount === 'string' ? jq.inAmount : String(jq.inAmount ?? amountRaw);
        const outAmt =
          typeof jq.outAmount === 'string' ? jq.outAmount : String(jq.outAmount ?? '0');

        return NextResponse.json({
          chain: 'sol',
          side: body.side,
          mint: mintCanon,
          quote: jq,
          swapTransaction: swap?.swapTransaction ?? null,
          tonConnect: null,
          lastValidBlockHeight: swap?.lastValidBlockHeight,
          presetsSol: [...BUY_PRESETS_SOL],
          presetsUsdc: [...BUY_PRESETS_USDC],
          spendAsset: spendUsdc ? 'usdc' : 'sol',
          summary: {
            amountInRaw: inAmt,
            amountOutRaw: outAmt,
            amountSolEstimate: spendUsdc ? 0 : body.amountSol!,
            amountUsdcEstimate: spendUsdc ? body.amountUsdc! : undefined,
          },
        });
      }

      const useExactOutSell = body.amountSolOut != null && body.amountSolOut > 0;
      const jq = await getQuote({
        userId: user.id,
        inputMint: mintCanon,
        outputMint: SOL_MINT,
        amountRaw: useExactOutSell
          ? solToLamports(body.amountSolOut!).toString()
          : body.amountTokenRaw!,
        slippageBps: body.slippageBps,
        dynamicSlippage: body.dynamicSlippage,
        swapMode: useExactOutSell ? 'ExactOut' : 'ExactIn',
      });
      const swap = body.includeSwapTx
        ? await getSwapTx(jq, walletCanon, {
            dynamicSlippage: body.dynamicSlippage,
            landing,
            fees,
          })
        : null;

      const inAmt =
        typeof jq.inAmount === 'string' ? jq.inAmount : String(jq.inAmount ?? '0');
      const outAmt =
        typeof jq.outAmount === 'string' ? jq.outAmount : String(jq.outAmount ?? '0');
      const solEst = useExactOutSell
        ? body.amountSolOut!
        : lamportsToSol(BigInt(outAmt));

      return NextResponse.json({
        chain: 'sol',
        side: body.side,
        mint: mintCanon,
        quote: jq,
        swapTransaction: swap?.swapTransaction ?? null,
        tonConnect: null,
        lastValidBlockHeight: swap?.lastValidBlockHeight,
        presetsSol: [...BUY_PRESETS_SOL],
        summary: {
          amountInRaw: inAmt,
          amountOutRaw: outAmt,
          amountSolEstimate: solEst,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'quote_failed';
      return NextResponse.json({ error: 'quote_failed', message }, { status: 502 });
    }
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
      chain: 'ton',
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
