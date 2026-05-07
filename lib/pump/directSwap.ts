import 'server-only';

import {
  canonicalPumpPoolPda,
  getBuyTokenAmountFromSolAmount,
  getSellSolAmountFromTokenAmount,
  OnlinePumpSdk,
  PUMP_SDK,
  bondingCurvePda,
} from '@pump-fun/pump-sdk';
import {
  OnlinePumpAmmSdk,
  PUMP_AMM_SDK,
  buyQuoteInput,
  sellBaseInput,
} from '@pump-fun/pump-swap-sdk';
import {
  type Connection,
  PublicKey,
  TransactionMessage,
  type TransactionInstruction,
  VersionedTransaction,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getMint,
} from '@solana/spl-token';
import BN from 'bn.js';
import type { JupiterQuoteResponse } from '@/lib/jupiter/quote';
import { SOL_MINT } from '@/lib/utils/addresses';
import { lamportsToSol, solToLamports } from '@/lib/utils/formatters';

export type PumpDirectQuoteSuccess = {
  quote: JupiterQuoteResponse;
  swapTransaction: string | null;
  lastValidBlockHeight?: number;
  summary: {
    amountInRaw: string;
    amountOutRaw: string | null;
    amountSolEstimate: number;
  };
  pumpRoute: 'bonding' | 'amm';
};

function slippagePercent(slippageBps: number): number {
  return Math.min(100, Math.max(0, slippageBps / 100));
}

async function buildVersionedTx(
  connection: Connection,
  payer: PublicKey,
  instructions: TransactionInstruction[],
): Promise<{ serialized: string; lastValidBlockHeight: number }> {
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash('confirmed');
  const messageV0 = new TransactionMessage({
    payerKey: payer,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message();
  const tx = new VersionedTransaction(messageV0);
  return {
    serialized: Buffer.from(tx.serialize()).toString('base64'),
    lastValidBlockHeight,
  };
}

/**
 * Prefer Pump bonding curve or canonical Pump AMM for pump.fun tokens.
 * Returns null when routing should fall back to Jupiter.
 */
export async function tryPumpDirectSwapQuote(input: {
  connection: Connection;
  mint: string;
  userPublicKey: string;
  side: 'buy' | 'sell';
  amountSol?: number;
  amountTokenRaw?: string;
  slippageBps: number;
  includeSwapTx: boolean;
}): Promise<PumpDirectQuoteSuccess | null> {
  const slippagePct = slippagePercent(input.slippageBps);
  const mintPk = new PublicKey(input.mint);
  const userPk = new PublicKey(input.userPublicKey);

  const mintAcct = await input.connection.getAccountInfo(mintPk);
  if (!mintAcct) return null;
  const tokenProgram = mintAcct.owner.equals(TOKEN_2022_PROGRAM_ID)
    ? TOKEN_2022_PROGRAM_ID
    : TOKEN_PROGRAM_ID;

  const mintData = await getMint(
    input.connection,
    mintPk,
    'confirmed',
    tokenProgram,
  );
  const mintSupplyBn = new BN(mintData.supply.toString());

  const bcPda = bondingCurvePda(mintPk);
  const bcInfo = await input.connection.getAccountInfo(bcPda);
  const bondingCurve = bcInfo
    ? PUMP_SDK.decodeBondingCurveNullable(bcInfo)
    : null;

  const onlinePump = new OnlinePumpSdk(input.connection);
  const [global, feeConfig] = await Promise.all([
    onlinePump.fetchGlobal(),
    onlinePump.fetchFeeConfig(),
  ]);

  // --- Bonding curve (not graduated)
  if (bcInfo && bondingCurve && !bondingCurve.complete) {
    if (input.side === 'buy') {
      if (input.amountSol == null) return null;
      const solLamports = new BN(String(solToLamports(input.amountSol)));
      const buyState = await onlinePump.fetchBuyState(
        mintPk,
        userPk,
        tokenProgram,
      );
      const tokenOut = getBuyTokenAmountFromSolAmount({
        global,
        feeConfig,
        mintSupply: mintSupplyBn,
        bondingCurve: buyState.bondingCurve,
        amount: solLamports,
      });
      const ixs = await PUMP_SDK.buyInstructions({
        global,
        bondingCurveAccountInfo: buyState.bondingCurveAccountInfo,
        bondingCurve: buyState.bondingCurve,
        associatedUserAccountInfo: buyState.associatedUserAccountInfo,
        mint: mintPk,
        user: userPk,
        amount: tokenOut,
        solAmount: solLamports,
        slippage: slippagePct,
        tokenProgram,
      });
      let swapTransaction: string | null = null;
      let lastValidBlockHeight: number | undefined;
      if (input.includeSwapTx) {
        const built = await buildVersionedTx(input.connection, userPk, ixs);
        swapTransaction = built.serialized;
        lastValidBlockHeight = built.lastValidBlockHeight;
      }
      return {
        quote: {
          inputMint: SOL_MINT,
          outputMint: input.mint,
          inAmount: solLamports.toString(),
          outAmount: tokenOut.toString(),
          pumpRoute: 'bonding',
        },
        swapTransaction,
        lastValidBlockHeight,
        summary: {
          amountInRaw: solLamports.toString(),
          amountOutRaw: tokenOut.toString(),
          amountSolEstimate: input.amountSol,
        },
        pumpRoute: 'bonding',
      };
    }

    let sellState: Awaited<ReturnType<typeof onlinePump.fetchSellState>>;
    try {
      sellState = await onlinePump.fetchSellState(
        mintPk,
        userPk,
        tokenProgram,
      );
    } catch {
      return null;
    }
    const tokenIn = new BN(input.amountTokenRaw ?? '0');
    if (tokenIn.lte(new BN(0))) return null;
    const solOut = getSellSolAmountFromTokenAmount({
      global,
      feeConfig,
      mintSupply: mintSupplyBn,
      bondingCurve: sellState.bondingCurve,
      amount: tokenIn,
    });
    const ixs = await PUMP_SDK.sellInstructions({
      global,
      bondingCurveAccountInfo: sellState.bondingCurveAccountInfo,
      bondingCurve: sellState.bondingCurve,
      mint: mintPk,
      user: userPk,
      amount: tokenIn,
      solAmount: solOut,
      slippage: slippagePct,
      tokenProgram,
      mayhemMode: sellState.bondingCurve.isMayhemMode,
      cashback: sellState.bondingCurve.isCashbackCoin,
    });
    let swapTransaction: string | null = null;
    let lastValidBlockHeight: number | undefined;
    if (input.includeSwapTx) {
      const built = await buildVersionedTx(input.connection, userPk, ixs);
      swapTransaction = built.serialized;
      lastValidBlockHeight = built.lastValidBlockHeight;
    }
    return {
      quote: {
        inputMint: input.mint,
        outputMint: SOL_MINT,
        inAmount: tokenIn.toString(),
        outAmount: solOut.toString(),
        pumpRoute: 'bonding',
      },
      swapTransaction,
      lastValidBlockHeight,
      summary: {
        amountInRaw: tokenIn.toString(),
        amountOutRaw: solOut.toString(),
        amountSolEstimate: lamportsToSol(BigInt(solOut.toString())),
      },
      pumpRoute: 'bonding',
    };
  }

  // --- Pump Swap AMM (graduated or no bonding account)
  const poolKey = canonicalPumpPoolPda(mintPk);
  const poolAcc = await input.connection.getAccountInfo(poolKey);
  if (!poolAcc) return null;

  const ammOnline = new OnlinePumpAmmSdk(input.connection);

  if (input.side === 'buy') {
    if (input.amountSol == null) return null;
    const quoteLamports = new BN(String(solToLamports(input.amountSol)));
    const swapState = await ammOnline.swapSolanaState(poolKey, userPk);
    const { coinCreator, creator: poolCreator } = swapState.pool;
    const quoteMath = buyQuoteInput({
      quote: quoteLamports,
      slippage: slippagePct,
      baseReserve: swapState.poolBaseAmount,
      quoteReserve: swapState.poolQuoteAmount,
      globalConfig: swapState.globalConfig,
      baseMintAccount: swapState.baseMintAccount,
      baseMint: swapState.baseMint,
      coinCreator,
      creator: poolCreator,
      feeConfig: swapState.feeConfig,
    });
    const ixs = await PUMP_AMM_SDK.buyQuoteInput(
      swapState,
      quoteLamports,
      slippagePct,
    );
    let swapTransaction: string | null = null;
    let lastValidBlockHeight: number | undefined;
    if (input.includeSwapTx) {
      const built = await buildVersionedTx(input.connection, userPk, ixs);
      swapTransaction = built.serialized;
      lastValidBlockHeight = built.lastValidBlockHeight;
    }
    return {
      quote: {
        inputMint: SOL_MINT,
        outputMint: input.mint,
        inAmount: quoteLamports.toString(),
        outAmount: quoteMath.base.toString(),
        pumpRoute: 'amm',
      },
      swapTransaction,
      lastValidBlockHeight,
      summary: {
        amountInRaw: quoteLamports.toString(),
        amountOutRaw: quoteMath.base.toString(),
        amountSolEstimate: input.amountSol,
      },
      pumpRoute: 'amm',
    };
  }

  const baseIn = new BN(input.amountTokenRaw ?? '0');
  if (baseIn.lte(new BN(0))) return null;
  const swapState = await ammOnline.swapSolanaState(poolKey, userPk);
  const { coinCreator, creator: poolCreator } = swapState.pool;
  const quoteMath = sellBaseInput({
    base: baseIn,
    slippage: slippagePct,
    baseReserve: swapState.poolBaseAmount,
    quoteReserve: swapState.poolQuoteAmount,
    globalConfig: swapState.globalConfig,
    baseMintAccount: swapState.baseMintAccount,
    baseMint: swapState.baseMint,
    coinCreator,
    creator: poolCreator,
    feeConfig: swapState.feeConfig,
  });
  const ixs = await PUMP_AMM_SDK.sellBaseInput(
    swapState,
    baseIn,
    slippagePct,
  );
  let swapTransaction: string | null = null;
  let lastValidBlockHeight: number | undefined;
  if (input.includeSwapTx) {
    const built = await buildVersionedTx(input.connection, userPk, ixs);
    swapTransaction = built.serialized;
    lastValidBlockHeight = built.lastValidBlockHeight;
  }
  return {
    quote: {
      inputMint: input.mint,
      outputMint: SOL_MINT,
      inAmount: baseIn.toString(),
      outAmount: quoteMath.uiQuote.toString(),
      pumpRoute: 'amm',
    },
    swapTransaction,
    lastValidBlockHeight,
    summary: {
      amountInRaw: baseIn.toString(),
      amountOutRaw: quoteMath.uiQuote.toString(),
      amountSolEstimate: lamportsToSol(BigInt(quoteMath.uiQuote.toString())),
    },
    pumpRoute: 'amm',
  };
}
