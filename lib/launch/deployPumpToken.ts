import 'server-only';

import { Connection, Keypair, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import { getHeliusRpcUrl } from '@/lib/utils/constants';
import { generateLaunchPackage } from '@/lib/launch/generateLaunchPackage';
import type { TweetLaunchInput } from '@/lib/launch/types';
import type { AppChainId } from '@/lib/chains/appChain';
import { deployEvmToken, evmAutoLaunchEnabled } from '@/lib/launch/deployEvmToken';

/**
 * pump.fun token deploy via PumpPortal's local-transaction API. Signs with the
 * server-held burner (DEPLOY_WALLET_SECRET) — the key never touches the client.
 *
 * SAFETY: `autoLaunchDeployEnabled()` gates AUTO firing behind an explicit env
 * flag so nothing deploys unexpectedly; `devBuySol` is clamped to a hard cap so a
 * bad trigger can't drain the burner. Real-money path — test manually first.
 */

const PUMP_IPFS_URL = 'https://pump.fun/api/ipfs';
const PUMPPORTAL_LOCAL_URL = 'https://pumpportal.fun/api/trade-local';
/** Hard ceiling on the dev-buy per deploy (SOL) — a runaway trigger can't drain the wallet. */
const MAX_DEV_BUY_SOL = 0.05;

function hexToBytes(h: string): Uint8Array {
  const clean = h.length % 2 ? '0' + h : h;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}

/** Bytes from a Solana secret in JSON-array, hex, or base58 (Phantom export) form. */
function solSecretBytes(secret: string): Uint8Array {
  const s = secret.trim();
  if (s.startsWith('[')) return Uint8Array.from(JSON.parse(s) as number[]);
  if (/^[0-9a-fA-F]+$/.test(s) && (s.length === 64 || s.length === 128)) return hexToBytes(s);
  return bs58.decode(s);
}

function deployKeypair(): Keypair {
  const secret = process.env.DEPLOY_WALLET_SECRET?.trim();
  if (!secret) throw new Error('deploy_wallet_not_configured');
  const bytes = solSecretBytes(secret);
  return bytes.length === 32 ? Keypair.fromSeed(bytes) : Keypair.fromSecretKey(bytes);
}

/** A deploy wallet key is present. */
export function deployWalletConfigured(): boolean {
  return Boolean(process.env.DEPLOY_WALLET_SECRET?.trim());
}

/** Auto-launch is explicitly enabled (separate seatbelt from having a key). */
export function autoLaunchDeployEnabled(): boolean {
  return deployWalletConfigured() && process.env.POINTER_AUTO_LAUNCH_ENABLED?.trim() === '1';
}

export type DeployPumpTokenInput = {
  name: string;
  symbol: string;
  description?: string;
  imageUrl?: string | null;
  twitter?: string | null;
  telegram?: string | null;
  website?: string | null;
  /** Dev buy in SOL (clamped to MAX_DEV_BUY_SOL). 0 = create only. */
  devBuySol?: number;
};

export type DeployPumpTokenResult = { mint: string; signature: string };

export async function deployPumpToken(input: DeployPumpTokenInput): Promise<DeployPumpTokenResult> {
  const payer = deployKeypair();
  const mintKp = Keypair.generate();

  // 1) Upload metadata (+ image) to pump.fun IPFS → metadata URI.
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

  // 2) Ask PumpPortal to build the create transaction (unsigned).
  const devBuy = Math.min(MAX_DEV_BUY_SOL, Math.max(0, input.devBuySol ?? 0));
  const ppRes = await fetch(PUMPPORTAL_LOCAL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      publicKey: payer.publicKey.toBase58(),
      action: 'create',
      tokenMetadata: { name: input.name, symbol: input.symbol, uri: ipfs.metadataUri },
      mint: mintKp.publicKey.toBase58(),
      denominatedInSol: 'true',
      amount: devBuy,
      slippage: 10,
      priorityFee: 0.0005,
      pool: 'pump',
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!ppRes.ok) throw new Error(`pumpportal_failed_${ppRes.status}`);

  // 3) Sign (mint + payer) and broadcast.
  const tx = VersionedTransaction.deserialize(new Uint8Array(await ppRes.arrayBuffer()));
  tx.sign([mintKp, payer]);

  const conn = new Connection(getHeliusRpcUrl(), 'confirmed');
  const signature = await conn.sendRawTransaction(tx.serialize(), { skipPreflight: false, maxRetries: 3 });
  await conn.confirmTransaction(signature, 'confirmed');

  return { mint: mintKp.publicKey.toBase58(), signature };
}

/** Tweets already auto-launched this process — one deploy per tweet, ever. */
const launchedTweetIds = new Set<string>();

/**
 * Auto-launch orchestration for the X Monitor trigger: AI decides name/ticker/image
 * from the tweet, then deploys via {@link deployPumpToken}. No-op unless
 * `autoLaunchDeployEnabled()` and the AI says `shouldLaunch`. Deduped per tweet id.
 */
export async function autoLaunchFromTweet(
  tweet: TweetLaunchInput,
  userId: string,
  chain: AppChainId = 'sol',
): Promise<DeployPumpTokenResult | null> {
  const isEvm = chain === 'eth' || chain === 'bnb' || chain === 'base';
  // Each chain has its own two-seatbelt enable gate.
  if (isEvm ? !evmAutoLaunchEnabled() : !autoLaunchDeployEnabled()) return null;

  // Dedupe per chain — the same tweet can launch on SOL and an EVM chain.
  const dedupeKey = `${chain}:${tweet.id ?? ''}`;
  if (tweet.id && launchedTweetIds.has(dedupeKey)) return null;
  if (tweet.id) launchedTweetIds.add(dedupeKey);

  const { package: pkg } = await generateLaunchPackage(tweet, userId, chain);
  if (!pkg.shouldLaunch || !pkg.suggestedName?.trim() || !pkg.suggestedTicker?.trim()) return null;

  const imageUrl = pkg.imageStrategy === 'use_tweet_image' ? (tweet.imageUrls ?? [])[0] ?? null : null;
  const twitter = `https://x.com/${tweet.authorHandle.replace(/^@/, '')}`;

  if (isEvm) {
    // Shape-compat with the Solana result so callers stay unchanged:
    // contractAddress→mint, txHash→signature.
    const r = await deployEvmToken(chain, {
      name: pkg.suggestedName,
      symbol: pkg.suggestedTicker,
      description: pkg.narrative,
      imageUrl,
      twitter,
      website: null,
      launchpad: pkg.suggestedLaunchpad,
      devBuyNative: 0,
    });
    return { mint: r.contractAddress, signature: r.txHash };
  }

  return deployPumpToken({
    name: pkg.suggestedName,
    symbol: pkg.suggestedTicker,
    description: pkg.narrative,
    imageUrl,
    twitter,
    devBuySol: 0,
  });
}
