import 'server-only';
import { Keypair, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import bs58 from 'bs58';
import { getConnection } from '@/lib/solana/connection';

/**
 * Gas sponsorship — so users never have to hold SOL to transact (Smart Yield
 * deposits, etc.). We use the simplest robust model: a **top-up**. Right before a
 * user needs to sign an on-chain action, the Pointer sponsor wallet sends them
 * just enough SOL for the fee. Their own wallet then pays its (now-funded) fee as
 * normal — so this works with any provider-built tx (Lulo) and with Privy's
 * sign-and-send, no fee-payer surgery.
 *
 * KEY-GATED on `SOLANA_SPONSOR_SECRET` (base58 64-byte secret, Phantom export).
 * The key lives ONLY in server env — never in the repo or the app bundle. Keep
 * only gas-money in this wallet.
 */

let cached: Keypair | null = null;
function sponsorKeypair(): Keypair | null {
  const secret = process.env.SOLANA_SPONSOR_SECRET?.trim();
  if (!secret) return null;
  if (cached) return cached;
  try {
    cached = Keypair.fromSecretKey(bs58.decode(secret));
  } catch {
    cached = null;
  }
  return cached;
}

export function isSponsorConfigured(): boolean {
  return !!process.env.SOLANA_SPONSOR_SECRET?.trim();
}

// ~0.004 SOL covers a base fee + priority fee + a token-account rent. Below that,
// top the user up to ~0.006 SOL.
const MIN_LAMPORTS = 4_000_000;
const TARGET_LAMPORTS = 6_000_000;
const SPONSOR_RESERVE = 2_000_000; // never let the sponsor go below this

/**
 * If the recipient is short on SOL and the sponsor is configured + funded, send a
 * top-up and wait for confirmation so a subsequent user tx has gas. Best-effort:
 * returns `{ topped:false }` (never throws) when unconfigured, unneeded, or the
 * sponsor is too low — the caller proceeds either way.
 */
export async function topUpGasIfNeeded(recipient: string): Promise<{ topped: boolean; signature?: string; reason?: string }> {
  const kp = sponsorKeypair();
  if (!kp) return { topped: false, reason: 'not-configured' };

  let to: PublicKey;
  try {
    to = new PublicKey(recipient.trim());
  } catch {
    return { topped: false, reason: 'bad-recipient' };
  }

  try {
    const conn = getConnection();
    const bal = await conn.getBalance(to);
    if (bal >= MIN_LAMPORTS) return { topped: false, reason: 'has-gas' };

    const need = TARGET_LAMPORTS - bal;
    const sponsorBal = await conn.getBalance(kp.publicKey);
    if (sponsorBal < need + SPONSOR_RESERVE) return { topped: false, reason: 'sponsor-low' };

    const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash('confirmed');
    const tx = new Transaction({ feePayer: kp.publicKey, blockhash, lastValidBlockHeight }).add(
      SystemProgram.transfer({ fromPubkey: kp.publicKey, toPubkey: to, lamports: need }),
    );
    tx.sign(kp);
    const signature = await conn.sendRawTransaction(tx.serialize(), { maxRetries: 5 });
    await conn.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');
    return { topped: true, signature };
  } catch (err) {
    return { topped: false, reason: err instanceof Error ? err.message : 'error' };
  }
}
