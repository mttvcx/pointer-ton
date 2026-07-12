import { NextResponse, type NextRequest } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { parseEther } from 'viem';
import { z } from 'zod';
import { inferMintKind } from '@/lib/chains/mintKind';
import { buildEvmSwapQuote } from '@/lib/evm/evmSwapQuote';
import type { TradeQuoteApiOk } from '@/lib/trading/quoteTypes';
import {
  assertTradingAllowed,
  EmergencyBlockedError,
  emergencyBlockedResponse,
} from '@/lib/emergency/controls';
import { getUserByPrivyId } from '@/lib/db/users';
import { tradingFreezeGateOrNull } from '@/lib/trade/accountControlGate';
import { userCanUseWalletForTrading } from '@/lib/db/userWallets';
import { getQuote } from '@/lib/jupiter/quote';
import { getSwapTx, getDefaultSwapFeeParams, type SwapFeeParams } from '@/lib/jupiter/swap';
import { verifyPrivyAccessToken } from '@/lib/privy/config';
import { buildPointerStonSwapQuote } from '@/lib/stonfi/pointerSwap';
import { SOL_MINT, USDC_MINT } from '@/lib/utils/addresses';
import { BUY_PRESETS_USDC, USDC_DECIMALS } from '@/lib/utils/constants';
import { resolveBuyPresetsSol } from '@/lib/beta/founderBeta';
import { getSolUsdPrice } from '@/lib/packs/pricing';
import { PACK_ITEM_SELL_FEE_BPS } from '@/lib/packs/constants';
import { isSellPackOrigin } from '@/lib/db/packInventory';
import { lamportsToSol, solToLamports, uiToRaw } from '@/lib/utils/formatters';
import { normalizeTonAddress } from '@/lib/utils/tonAddress';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const QuoteBodySchema = z
  .object({
    mint: z.string().min(1),
    side: z.enum(['buy', 'sell']),
    userPublicKey: z.string().min(1),
    /** Disambiguates which EVM chain a 0x mint is on (eth/bnb/base). Ignored for sol/ton. */
    chain: z.enum(['sol', 'ton', 'eth', 'bnb', 'base', 'robinhood']).optional(),
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

  // Emergency kill-switch — fail-closed per user when freeze status is uncertain.
  const freezeBlocked = await tradingFreezeGateOrNull(user.id);
  if (freezeBlocked) return freezeBlocked;

  let body: z.infer<typeof QuoteBodySchema>;
  try {
    const json: unknown = await req.json();
    body = QuoteBodySchema.parse(json);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'invalid_body';
    return NextResponse.json({ error: 'invalid_body', message }, { status: 400 });
  }

  const chainKind = inferMintKind(body.mint);

  // EVM spot swap (LiFi) — flag-gated OFF; the server flag is the authoritative
  // money gate (the client flag only controls UI). Robinhood is excluded (no
  // aggregator coverage yet).
  if (chainKind === 'evm') {
    if (process.env.POINTER_EVM_TRADE_ENABLED !== '1') {
      return NextResponse.json(
        { error: 'evm_trading_disabled', message: 'EVM trading is not enabled yet.' },
        { status: 400 },
      );
    }
    const appChain = body.chain;
    if (appChain !== 'eth' && appChain !== 'bnb' && appChain !== 'base') {
      return NextResponse.json(
        { error: 'unsupported_evm_chain', message: 'EVM trading is live on Ethereum, BNB, and Base.' },
        { status: 400 },
      );
    }
    // Emergency kill-switch (global + per-chain) BEFORE we build a quote — no quote,
    // no swap. Fails closed if the controls store is unreadable.
    try {
      await assertTradingAllowed(appChain);
    } catch (e) {
      if (e instanceof EmergencyBlockedError) return emergencyBlockedResponse(e);
      throw e;
    }
    try {
      const slippageBps = body.slippageBps;
      // Buy spends native gas (amountSol carries the native amount); sell sends token raw.
      let sellAmountRaw: string;
      if (body.side === 'buy') {
        if (!(body.amountSol != null && body.amountSol > 0)) {
          return NextResponse.json({ error: 'invalid_body', message: 'amount required' }, { status: 400 });
        }
        sellAmountRaw = parseEther(String(body.amountSol)).toString();
      } else {
        if (!body.amountTokenRaw) {
          return NextResponse.json({ error: 'invalid_body', message: 'amountTokenRaw required' }, { status: 400 });
        }
        sellAmountRaw = body.amountTokenRaw;
      }
      const evm = await buildEvmSwapQuote({
        chain: appChain,
        side: body.side,
        token: body.mint,
        wallet: body.userPublicKey,
        sellAmountRaw,
        slippageBps,
      });
      const resp: TradeQuoteApiOk = {
        side: body.side,
        mint: body.mint,
        chain: 'evm',
        evm: { ...evm, appChain },
        quote: {},
        swapTransaction: null,
        tonConnect: null,
        presetsSol: [0.01, 0.05, 0.1, 0.5],
        summary: {
          amountInRaw: evm.sellAmountRaw,
          amountOutRaw: evm.buyAmountRaw,
          amountSolEstimate: 0,
        },
      };
      return NextResponse.json(resp);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'evm_quote_failed';
      return NextResponse.json({ error: 'evm_quote_failed', message }, { status: 502 });
    }
  }

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

        // SOL-equivalent notional. For USDC-funded buys this MUST be non-zero so the
        // execute route records platform_fee_lamports + referral cashback + points
        // (Jupiter still charges the 1% on-chain fee regardless of spend asset).
        let amountSolEstimate = body.amountSol ?? 0;
        if (spendUsdc) {
          const { solUsd } = await getSolUsdPrice();
          amountSolEstimate = solUsd > 0 ? body.amountUsdc! / solUsd : 0;
        }

        return NextResponse.json({
          chain: 'sol',
          side: body.side,
          mint: mintCanon,
          quote: jq,
          swapTransaction: swap?.swapTransaction ?? null,
          tonConnect: null,
          lastValidBlockHeight: swap?.lastValidBlockHeight,
          presetsSol: [...resolveBuyPresetsSol()],
          presetsUsdc: [...BUY_PRESETS_USDC],
          spendAsset: spendUsdc ? 'usdc' : 'sol',
          summary: {
            amountInRaw: inAmt,
            amountOutRaw: outAmt,
            amountSolEstimate,
            amountUsdcEstimate: spendUsdc ? body.amountUsdc! : undefined,
          },
        });
      }

      const useExactOutSell = body.amountSolOut != null && body.amountSolOut > 0;
      // Tokens won from packs sell at the elevated pack fee (2%) and earn no
      // cashback. The execute route re-checks this server-side as well.
      const packItemSell = await isSellPackOrigin(user.id, mintCanon);
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
        feeBpsOverride: packItemSell ? PACK_ITEM_SELL_FEE_BPS : undefined,
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
        presetsSol: [...resolveBuyPresetsSol()],
        packItemSell,
        feeBps: packItemSell ? PACK_ITEM_SELL_FEE_BPS : undefined,
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
      presetsSol: [...resolveBuyPresetsSol()],
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
