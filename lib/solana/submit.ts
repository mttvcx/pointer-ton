import 'server-only';

import bs58 from 'bs58';
import { sendViaSender } from 'helius-sdk/transactions/sendViaSender';
import { VersionedTransaction } from '@solana/web3.js';

import { getConnection } from '@/lib/solana/connection';
import {
  SIGNATURE_POLL_INTERVAL_MS,
  SUBMIT_TIMEOUT_MS,
} from '@/lib/utils/constants';

export type SubmitTxResult =
  | { signature: string; status: 'confirmed' }
  | { signature: string; status: 'failed'; error: string };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitoBundlesUrl(): string {
  const base =
    process.env.JITO_BLOCK_ENGINE_URL ?? 'https://mainnet.block-engine.jito.wtf';
  return `${base.replace(/\/$/, '')}/api/v1/bundles`;
}

/** Single-tx bundle to Jito block engine (`sendBundle`). */
async function sendJitoBundleSingleTx(txSerialized: Uint8Array): Promise<void> {
  const encoded = bs58.encode(txSerialized);
  const res = await fetch(jitoBundlesUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'sendBundle',
      params: [[encoded]],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jito HTTP ${res.status}: ${text.slice(0, 240)}`);
  }
  const body = (await res.json()) as { error?: unknown; result?: string };
  if (body.error) {
    throw new Error(`Jito RPC: ${JSON.stringify(body.error)}`);
  }
  void body.result;
}

/** Resolve when the first promise settles successfully; reject only if all fail. */
async function raceFirstSuccess(promises: Promise<unknown>[]): Promise<void> {
  if (promises.length === 0) throw new Error('raceFirstSuccess: empty');
  return new Promise((resolve, reject) => {
    let failed = 0;
    const errors: unknown[] = [];
    for (const p of promises) {
      p.then(
        () => resolve(),
        (err: unknown) => {
          errors.push(err);
          failed += 1;
          if (failed === promises.length) {
            reject(errors[0]);
          }
        },
      );
    }
  });
}

export function firstSignatureFromSerialized(serialized: Uint8Array): string {
  const tx = VersionedTransaction.deserialize(serialized);
  const sigBytes = tx.signatures[0];
  if (!sigBytes || sigBytes.every((b) => b === 0)) {
    throw new Error('submitTransaction: expected a signed versioned transaction');
  }
  return bs58.encode(sigBytes);
}

async function waitForConfirmation(signature: string): Promise<'confirmed' | 'failed'> {
  const conn = getConnection();
  const deadline = Date.now() + SUBMIT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const { value } = await conn.getSignatureStatuses([signature], {
      searchTransactionHistory: true,
    });
    const s = value[0];
    if (s?.err) return 'failed';
    if (s?.confirmationStatus === 'confirmed' || s?.confirmationStatus === 'finalized') {
      return 'confirmed';
    }
    await sleep(SIGNATURE_POLL_INTERVAL_MS);
  }
  throw new Error(`confirmation_timeout after ${SUBMIT_TIMEOUT_MS}ms`);
}

/**
 * Parallel submission: Helius Sender (`sendViaSender`) and Jito `sendBundle`.
 * Whichever lands first returns; we then poll signature status until confirmed
 * or {@link SUBMIT_TIMEOUT_MS}.
 */
export async function submitTransaction(serialized: Uint8Array): Promise<SubmitTxResult> {
  let signature: string;
  try {
    signature = firstSignatureFromSerialized(serialized);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { signature: '', status: 'failed', error: msg };
  }

  const b64 = Buffer.from(serialized).toString('base64');

  try {
    await raceFirstSuccess([
      sendViaSender(b64, 'Default'),
      sendJitoBundleSingleTx(serialized),
    ]);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { signature, status: 'failed', error: msg };
  }

  try {
    const outcome = await waitForConfirmation(signature);
    if (outcome === 'failed') {
      return { signature, status: 'failed', error: 'transaction_err_on_chain' };
    }
    return { signature, status: 'confirmed' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { signature, status: 'failed', error: msg };
  }
}
