import 'server-only';

import type { LaunchPackageLaunchpad } from '@/lib/launch/types';

/**
 * Server-side builder for a Solana launch transaction — uploads metadata to
 * pump.fun IPFS and asks PumpPortal to assemble the *unsigned* create tx whose
 * fee-payer is the USER's wallet (not a server burner). The browser then signs
 * it with the user's Privy wallet + the fresh mint and broadcasts. This is the
 * "your main wallet is the deploy wallet" path — no server key involved.
 */

const PUMP_IPFS_URL = 'https://pump.fun/api/ipfs';
const PUMPPORTAL_LOCAL_URL = 'https://pumpportal.fun/api/trade-local';
/** Hard ceiling on the optional dev-buy per deploy (SOL). */
export const MAX_DEV_BUY_SOL = 0.5;

/** PumpPortal `pool` for a Solana launchpad, or null when that pad isn't wired. */
export function pumpPortalPool(launchpad: LaunchPackageLaunchpad): 'pump' | 'bonk' | null {
  if (launchpad === 'pump.fun') return 'pump';
  if (launchpad === 'bonk') return 'bonk';
  return null;
}

export type BuildSolLaunchInput = {
  ownerPubkey: string;
  mintPubkey: string;
  name: string;
  symbol: string;
  description?: string;
  imageUrl?: string | null;
  twitter?: string | null;
  telegram?: string | null;
  website?: string | null;
  /** Optional dev buy in SOL (clamped to MAX_DEV_BUY_SOL). 0 = create only. */
  devBuySol?: number;
  pool: 'pump' | 'bonk';
};

/**
 * Build the unsigned pump.fun / bonk create transaction for a given owner + mint.
 * Returns the raw serialized bytes as base64 for the client to sign & broadcast.
 */
export async function buildSolLaunchTx(input: BuildSolLaunchInput): Promise<{ serializedTxBase64: string }> {
  // 1) Upload metadata (+ image, best-effort) to pump.fun IPFS → metadata URI.
  const form = new FormData();
  if (input.imageUrl) {
    try {
      const imgRes = await fetch(input.imageUrl, { signal: AbortSignal.timeout(10_000) });
      if (imgRes.ok) form.append('file', await imgRes.blob(), 'image.png');
    } catch {
      /* image is best-effort — pump.fun accepts metadata without one */
    }
  }
  form.append('name', input.name);
  form.append('symbol', input.symbol);
  form.append('description', input.description ?? '');
  form.append('twitter', input.twitter ?? '');
  form.append('telegram', input.telegram ?? '');
  form.append('website', input.website ?? '');
  form.append('showName', 'true');

  const ipfsRes = await fetch(PUMP_IPFS_URL, { method: 'POST', body: form, signal: AbortSignal.timeout(20_000) });
  if (!ipfsRes.ok) throw new Error(`ipfs_upload_failed_${ipfsRes.status}`);
  const ipfs = (await ipfsRes.json()) as { metadataUri?: string };
  if (!ipfs.metadataUri) throw new Error('ipfs_no_uri');

  // 2) Ask PumpPortal to build the create transaction — fee-payer = the user.
  const devBuy = Math.min(MAX_DEV_BUY_SOL, Math.max(0, input.devBuySol ?? 0));
  const ppRes = await fetch(PUMPPORTAL_LOCAL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      publicKey: input.ownerPubkey,
      action: 'create',
      tokenMetadata: { name: input.name, symbol: input.symbol, uri: ipfs.metadataUri },
      mint: input.mintPubkey,
      denominatedInSol: 'true',
      amount: devBuy,
      slippage: 10,
      priorityFee: 0.0005,
      pool: input.pool,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!ppRes.ok) throw new Error(`pumpportal_failed_${ppRes.status}`);

  const bytes = new Uint8Array(await ppRes.arrayBuffer());
  return { serializedTxBase64: Buffer.from(bytes).toString('base64') };
}
