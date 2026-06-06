import 'server-only';

import { randomUUID } from 'node:crypto';
import { PublicKey } from '@solana/web3.js';
import { getQuote } from '@/lib/jupiter/quote';
import { getSwapTx, getDefaultSwapFeeParams } from '@/lib/jupiter/swap';
import { insertTrade } from '@/lib/db/trades';
import { getFeeBpsForUser } from '@/lib/db/tiers';
import { privyUserOwnsEmbeddedAddress } from '@/lib/privy/embeddedWallets';
import { signSolanaSwapTransactionServer } from '@/lib/privy/serverWalletSign';
import { getSplBalanceRaw, listNonZeroSplBalances } from '@/lib/solana/wallet-token-balances';
import { submitTransaction } from '@/lib/solana/submit';
import { SOL_MINT } from '@/lib/utils/addresses';
import { lamportsToSol } from '@/lib/utils/formatters';
import type { UserRow } from '@/lib/db/users';

export type EmergencySellInput = {
  targetUser: UserRow;
  walletAddress: string;
  mint: string;
  /** 1–100 percent of token balance to sell. */
  sellPct: number;
  slippageBps?: number;
};

export type EmergencySellResult = {
  signature: string;
  mint: string;
  amountInRaw: string;
  amountOutRaw: string;
  amountSolEstimate: number;
};

function pctRawAmount(raw: string, pct: number): string {
  const total = BigInt(raw);
  if (total <= 0n) throw new Error('zero_token_balance');
  const clamped = Math.min(100, Math.max(1, Math.floor(pct)));
  const slice = (total * BigInt(clamped)) / 100n;
  return slice > 0n ? slice.toString() : '1';
}

async function buildAndSubmitSell(input: {
  userId: string;
  walletAddress: string;
  mint: string;
  amountTokenRaw: string;
  slippageBps: number;
}): Promise<{ signature: string; amountInRaw: string; amountOutRaw: string; amountSolEstimate: number }> {
  const mintCanon = new PublicKey(input.mint.trim()).toBase58();
  const walletCanon = new PublicKey(input.walletAddress.trim()).toBase58();

  const jq = await getQuote({
    userId: input.userId,
    inputMint: mintCanon,
    outputMint: SOL_MINT,
    amountRaw: input.amountTokenRaw,
    slippageBps: input.slippageBps,
    dynamicSlippage: true,
    swapMode: 'ExactIn',
  });

  const fees = getDefaultSwapFeeParams();
  const swap = await getSwapTx(jq, walletCanon, {
    dynamicSlippage: true,
    landing: 'jito',
    fees,
  });
  if (!swap?.swapTransaction) throw new Error('swap_build_failed');

  const { signedTransactionBase64 } = await signSolanaSwapTransactionServer({
    walletAddress: walletCanon,
    swapTransactionBase64: swap.swapTransaction,
  });

  const serialized = Buffer.from(signedTransactionBase64, 'base64');
  const submit = await submitTransaction(new Uint8Array(serialized));
  if (submit.status !== 'confirmed') {
    throw new Error(submit.error ?? 'submit_failed');
  }

  const inAmt = typeof jq.inAmount === 'string' ? jq.inAmount : String(jq.inAmount ?? input.amountTokenRaw);
  const outAmt = typeof jq.outAmount === 'string' ? jq.outAmount : String(jq.outAmount ?? '0');
  const amountSolEstimate = lamportsToSol(BigInt(outAmt));

  return {
    signature: submit.signature,
    amountInRaw: inAmt,
    amountOutRaw: outAmt,
    amountSolEstimate,
  };
}

/** Admin-only protective sell — bypasses user freeze; no user-facing notification. */
export async function executeEmergencySell(input: EmergencySellInput): Promise<EmergencySellResult> {
  if (!input.targetUser.privy_id) throw new Error('target_not_privy_user');

  let walletCanon: string;
  let mintCanon: string;
  try {
    walletCanon = new PublicKey(input.walletAddress.trim()).toBase58();
    mintCanon = new PublicKey(input.mint.trim()).toBase58();
  } catch {
    throw new Error('invalid_sol_address');
  }

  const owns = await privyUserOwnsEmbeddedAddress(
    input.targetUser.privy_id,
    walletCanon,
    input.targetUser.wallet_address,
  );
  if (!owns) throw new Error('wallet_not_privy_embedded');

  const balanceRaw = await getSplBalanceRaw(walletCanon, mintCanon);
  if (!balanceRaw || balanceRaw === '0') throw new Error('no_token_balance');

  const amountTokenRaw = pctRawAmount(balanceRaw, input.sellPct);
  const slippageBps = input.slippageBps ?? 800;

  const submitted = await buildAndSubmitSell({
    userId: input.targetUser.id,
    walletAddress: walletCanon,
    mint: mintCanon,
    amountTokenRaw,
    slippageBps,
  });

  const feeBps = await getFeeBpsForUser(input.targetUser.id);
  const lamports = BigInt(submitted.amountOutRaw);
  const platformFeeLamports = Number((lamports * BigInt(feeBps)) / 10_000n);
  await insertTrade({
    id: randomUUID(),
    user_id: input.targetUser.id,
    mint: mintCanon,
    side: 'sell',
    tx_signature: submitted.signature,
    amount_in_raw: submitted.amountInRaw,
    amount_out_raw: submitted.amountOutRaw,
    amount_sol: submitted.amountSolEstimate,
    platform_fee_lamports: Number.isFinite(platformFeeLamports) ? platformFeeLamports : null,
    status: 'confirmed',
    submitted_at: new Date().toISOString(),
    confirmed_at: new Date().toISOString(),
  });

  return {
    signature: submitted.signature,
    mint: mintCanon,
    amountInRaw: submitted.amountInRaw,
    amountOutRaw: submitted.amountOutRaw,
    amountSolEstimate: submitted.amountSolEstimate,
  };
}

export async function executeEmergencySellAll(input: {
  targetUser: UserRow;
  walletAddress: string;
  slippageBps?: number;
  maxTokens?: number;
}): Promise<EmergencySellResult[]> {
  let walletCanon: string;
  try {
    walletCanon = new PublicKey(input.walletAddress.trim()).toBase58();
  } catch {
    throw new Error('invalid_sol_address');
  }

  const tokens = await listNonZeroSplBalances(walletCanon);
  const cap = Math.min(20, Math.max(1, input.maxTokens ?? 12));
  const slice = tokens.slice(0, cap);
  const results: EmergencySellResult[] = [];

  for (const row of slice) {
    try {
      const r = await executeEmergencySell({
        targetUser: input.targetUser,
        walletAddress: walletCanon,
        mint: row.mint,
        sellPct: 100,
        slippageBps: input.slippageBps,
      });
      results.push(r);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'sell_failed';
      if (message === 'no_token_balance' || message === 'zero_token_balance') continue;
      throw err;
    }
  }

  if (results.length === 0) throw new Error('no_tokens_to_sell');
  return results;
}
