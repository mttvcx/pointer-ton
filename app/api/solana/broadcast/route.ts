import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyPrivyAccessToken } from '@/lib/privy/config';
import { getUserByPrivyId } from '@/lib/db/users';
import { broadcastSignedTransaction } from '@/lib/solana/broadcast';
import { getConnection } from '@/lib/solana/connection';
import { enforceTradeRateLimit } from '@/lib/rate-limit/userAction';
import { assertWriteAllowed, emergencyBlockedResponse, EmergencyBlockedError } from '@/lib/emergency/controls';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const BodySchema = z
  .object({
    /** Base64 fully-signed VersionedTransaction (the user's own, signed sign-only). */
    signedTransaction: z.string().min(80),
    /** Poll to confirmation before returning (withdraw/convert want this). */
    confirm: z.boolean().optional(),
  })
  .strict();

/**
 * Generic authenticated broadcast for a user-signed Solana transaction. The
 * browser signs only (Privy embedded wallet) and the server relays the raw bytes
 * through the private Helius RPC — the public client RPC rejects sends with
 * Solana #8100002. Used by embedded-wallet withdraw + convert (and mirrors the
 * pack pay-broadcast / trade-execute split). The tx is the user's own signed
 * payload, so the server is only a relay.
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
  // Emergency kill switch (BLOCKER-3): the embedded-wallet money actually LEAVES
  // through this relay, so maintenance / read-only must stop it — not just the
  // trade-execute route. assertWriteAllowed = blocked under maintenance/read-only.
  try {
    await assertWriteAllowed();
  } catch (e) {
    if (e instanceof EmergencyBlockedError) return emergencyBlockedResponse(e);
    throw e;
  }

  // Generous per-user cap on the relay/money path (fail-open; env-tunable).
  const rl = await enforceTradeRateLimit(userId);
  if (rl) return rl;

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

  let signature: string;
  try {
    signature = await broadcastSignedTransaction(raw);
  } catch (err) {
    console.error('[solana/broadcast] send failed', err);
    return NextResponse.json(
      { error: 'broadcast_failed', message: err instanceof Error ? err.message : 'send_failed' },
      { status: 502 },
    );
  }

  let confirmed = false;
  if (body.confirm) {
    const conn = getConnection();
    const startedAt = Date.now();
    while (Date.now() - startedAt < 22_000) {
      let value: Awaited<ReturnType<typeof conn.getSignatureStatus>>['value'] | null = null;
      try {
        value = (await conn.getSignatureStatus(signature)).value;
      } catch {
        value = null;
      }
      if (value?.err) {
        return NextResponse.json({ error: 'tx_failed', signature }, { status: 502 });
      }
      if (
        value?.confirmationStatus === 'confirmed' ||
        value?.confirmationStatus === 'finalized'
      ) {
        confirmed = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  return NextResponse.json({ signature, confirmed });
}
