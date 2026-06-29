import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyPrivyAccessToken } from '@/lib/privy/config';
import { getUserByPrivyId } from '@/lib/db/users';
import { accountFreezeGateOrNull } from '@/lib/trade/accountControlGate';
import {
  getConnection,
  getPublicSolanaConnection,
  isRpcQuotaError,
} from '@/lib/solana/connection';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const BodySchema = z
  .object({
    /** Base64-encoded fully-signed VersionedTransaction from the client. */
    signedTransaction: z.string().min(80),
  })
  .strict();

/**
 * Broadcast a client-signed pack-payment transfer through the server's private
 * Helius RPC, then confirm it. The browser signs (Privy) but does NOT send —
 * the public client RPC rejects sends (Solana #8100002), and exposing a client
 * Helius key would let anyone drain credits. Mirrors the trade execute split.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const accessToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : null;
  if (!accessToken) {
    return NextResponse.json({ error: 'missing_authorization' }, { status: 401 });
  }
  let userId: string;
  try {
    const verified = await verifyPrivyAccessToken(accessToken);
    const user = await getUserByPrivyId(verified.privyId);
    if (!user) return NextResponse.json({ error: 'user_not_synced' }, { status: 403 });
    userId = user.id;
  } catch {
    return NextResponse.json({ error: 'invalid_token' }, { status: 401 });
  }

  // Per-user account freeze (fail-closed) — defense-in-depth on the broadcast
  // step too, so a freeze applied between pay and broadcast still stops the send.
  const frozen = await accountFreezeGateOrNull(userId, 'trading');
  if (frozen) return frozen;

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  let raw: Buffer;
  try {
    raw = Buffer.from(body.signedTransaction, 'base64');
    if (raw.length < 64) throw new Error('too_short');
  } catch {
    return NextResponse.json({ error: 'invalid_transaction' }, { status: 400 });
  }

  const send = (conn: ReturnType<typeof getConnection>) =>
    conn.sendRawTransaction(raw, { skipPreflight: false, maxRetries: 5 });

  let signature: string;
  try {
    try {
      signature = await send(getConnection());
    } catch (err) {
      if (!isRpcQuotaError(err)) throw err;
      signature = await send(getPublicSolanaConnection());
    }
  } catch (err) {
    console.error('[packs/pay-broadcast] send failed', err);
    return NextResponse.json({ error: 'broadcast_failed' }, { status: 502 });
  }

  // Confirm so /api/packs/open's on-chain verify finds the transfer.
  const conn = getConnection();
  const startedAt = Date.now();
  let confirmed = false;
  while (Date.now() - startedAt < 22_000) {
    let status: Awaited<ReturnType<typeof conn.getSignatureStatus>>['value'] | null = null;
    try {
      status = (await conn.getSignatureStatus(signature)).value;
    } catch {
      status = null;
    }
    if (status?.err) {
      return NextResponse.json({ error: 'tx_failed', signature }, { status: 502 });
    }
    if (
      status?.confirmationStatus === 'confirmed' ||
      status?.confirmationStatus === 'finalized'
    ) {
      confirmed = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }

  return NextResponse.json({ signature, confirmed });
}
